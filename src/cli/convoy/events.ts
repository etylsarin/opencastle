import { appendFileSync, closeSync, fsyncSync, openSync } from 'node:fs'
import type { ConvoyStore } from './store.js'
import { scanForSecrets } from './gates.js'

export interface ConvoyEventEmitter {
  emit(
    type: string,
    data?: Record<string, unknown>,
    ids?: { convoy_id?: string; task_id?: string; worker_id?: string },
  ): void
  close(): void
}

export function createEventEmitter(
  store: ConvoyStore,
  options?: { ndjsonPath?: string },
): ConvoyEventEmitter {
  let fd: number | null = null
  if (options?.ndjsonPath) {
    fd = openSync(options.ndjsonPath, 'a')
  }

  // NDJSON writes are supplementary — SQLite is the primary store. Use async
  // retries to avoid blocking the Node.js event loop.
  async function writeNdjson(
    type: string,
    data: Record<string, unknown> | undefined,
    ids: { convoy_id?: string; task_id?: string; worker_id?: string } | undefined,
    now: string,
    eventId: number,
    currentFd: number,
  ): Promise<void> {
    const record = {
      _event_id: eventId,
      timestamp: now,
      type,
      convoy_id: ids?.convoy_id ?? null,
      task_id: ids?.task_id ?? null,
      worker_id: ids?.worker_id ?? null,
      ...(data ?? {}),
    }
    const jsonLine = JSON.stringify(record) + '\n'

    const scanResult = scanForSecrets(jsonLine, 'ndjson')
    if (!scanResult.clean) {
      // Block the NDJSON write — record the blocked event in SQLite only
      store.insertEvent({
        convoy_id: ids?.convoy_id ?? null,
        task_id: ids?.task_id ?? null,
        worker_id: ids?.worker_id ?? null,
        type: 'secret_leak_prevented',
        data: JSON.stringify({ original_type: type, patterns: scanResult.findings.map(f => f.pattern) }),
        created_at: now,
      })
      return
    }

    try {
      appendFileSync(currentFd, jsonLine)
      fsyncSync(currentFd)
    } catch {
      // Retry once after 100ms (non-blocking)
      await new Promise<void>(resolve => setTimeout(resolve, 100))
      try {
        appendFileSync(currentFd, jsonLine)
        fsyncSync(currentFd)
      } catch {
        // Emit failure meta-event to SQLite only (do NOT recurse into NDJSON write)
        store.insertEvent({
          convoy_id: ids?.convoy_id ?? null,
          task_id: ids?.task_id ?? null,
          worker_id: ids?.worker_id ?? null,
          type: 'ndjson_write_failed',
          data: JSON.stringify({ original_type: type }),
          created_at: new Date().toISOString(),
        })
      }
    }
  }

  return {
    emit(type, data, ids) {
      // Event data is NOT secret-scanned here because all user-generated content
      // (task output, DLQ entries) is scanned at its source before reaching the
      // event emitter. Re-scanning would be redundant. See MF-4 in panel report.
      const now = new Date().toISOString()

      const eventId = store.insertEvent({
        convoy_id: ids?.convoy_id ?? null,
        task_id: ids?.task_id ?? null,
        worker_id: ids?.worker_id ?? null,
        type,
        data: data !== undefined ? JSON.stringify(data) : null,
        created_at: now,
      })

      // Fire-and-forget: SQLite record (above) is the source of truth.
      // NDJSON is supplementary — no need to await or block on it.
      if (fd !== null) {
        writeNdjson(type, data, ids, now, eventId, fd).catch(() => {
          // Swallow unhandled rejection — failure already recorded in SQLite via writeNdjson
        })
      }
    },

    close() {
      if (fd !== null) {
        closeSync(fd)
        fd = null
      }
    },
  }
}
