import { appendEvent as appendNdjson } from '../log.js'
import type { ConvoyStore } from './store.js'

export interface ConvoyEventEmitter {
  emit(
    type: string,
    data?: Record<string, unknown>,
    ids?: { convoy_id?: string; task_id?: string; worker_id?: string },
  ): void
}

export function createEventEmitter(store: ConvoyStore, logsDir?: string): ConvoyEventEmitter {
  return {
    emit(type, data, ids) {
      const now = new Date().toISOString()

      store.insertEvent({
        convoy_id: ids?.convoy_id ?? null,
        task_id: ids?.task_id ?? null,
        worker_id: ids?.worker_id ?? null,
        type,
        data: data !== undefined ? JSON.stringify(data) : null,
        created_at: now,
      })

      appendNdjson(
        {
          timestamp: now,
          type,
          convoy_id: ids?.convoy_id ?? null,
          task_id: ids?.task_id ?? null,
          worker_id: ids?.worker_id ?? null,
          ...(data ?? {}),
        },
        logsDir ?? null,
      ).catch(() => {
        // fire-and-forget: NDJSON write failure must not crash the convoy engine
      })
    },
  }
}
