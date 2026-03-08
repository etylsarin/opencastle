import { appendFileSync, mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
import type { ConvoyStore } from './store.js'
export async function exportConvoyToNdjson(
  store: ConvoyStore,
  convoyId: string,
  logsDir?: string,
): Promise<void> {
  try {
    const convoy = store.getConvoy(convoyId)
    if (!convoy) return

    const tasks = store.getTasksByConvoy(convoyId)
    const eventsCount = store.getEvents(convoyId).length

    const summary = {
      total: tasks.length,
      done: tasks.filter((t) => t.status === 'done').length,
      failed: tasks.filter((t) => t.status === 'failed').length,
      skipped: tasks.filter((t) => t.status === 'skipped').length,
      timedOut: tasks.filter((t) => t.status === 'timed-out').length,
    }

    const record = {
      id: convoy.id,
      name: convoy.name,
      status: convoy.status,
      branch: convoy.branch,
      created_at: convoy.created_at,
      started_at: convoy.started_at,
      finished_at: convoy.finished_at,
      summary,
      tasks: tasks.map((t) => ({
        id: t.id,
        phase: t.phase,
        agent: t.agent,
        adapter: t.adapter,
        status: t.status,
        started_at: t.started_at,
        finished_at: t.finished_at,
        retries: t.retries,
      })),
      events_count: eventsCount,
    }

    const dir = logsDir ?? resolve(process.cwd(), '.opencastle', 'logs')
    mkdirSync(dir, { recursive: true })
    appendFileSync(resolve(dir, 'convoys.ndjson'), JSON.stringify(record) + '\n', 'utf8')
  } catch (err) {
    process.stderr.write(`[opencastle] exportConvoyToNdjson warning: ${String(err)}\n`)
  }
}
