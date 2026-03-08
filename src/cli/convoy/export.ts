import { appendFileSync, mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
import type { ConvoyStore } from './store.js'

export async function exportPipelineToNdjson(
  store: ConvoyStore,
  pipelineId: string,
  logsDir?: string,
): Promise<void> {
  try {
    const pipeline = store.getPipeline(pipelineId)
    if (!pipeline) return

    const convoys = store.getConvoysByPipeline(pipelineId)

    const record = {
      id: pipeline.id,
      name: pipeline.name,
      status: pipeline.status,
      branch: pipeline.branch,
      created_at: pipeline.created_at,
      started_at: pipeline.started_at,
      finished_at: pipeline.finished_at,
      total_tokens: pipeline.total_tokens,
      total_cost_usd: pipeline.total_cost_usd,
      convoy_count: convoys.length,
      convoys: convoys.map(c => ({
        id: c.id,
        name: c.name,
        status: c.status,
        started_at: c.started_at,
        finished_at: c.finished_at,
        total_tokens: c.total_tokens,
      })),
    }

    const dir = logsDir ?? resolve(process.cwd(), '.opencastle', 'logs')
    mkdirSync(dir, { recursive: true })
    appendFileSync(resolve(dir, 'pipelines.ndjson'), JSON.stringify(record) + '\n', 'utf8')
  } catch (err) {
    process.stderr.write(`[opencastle] exportPipelineToNdjson warning: ${String(err)}\n`)
  }
}

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
        prompt_tokens: t.prompt_tokens,
        completion_tokens: t.completion_tokens,
        total_tokens: t.total_tokens,
      })),
      events_count: eventsCount,
      total_tokens: convoy.total_tokens,
      total_cost_usd: convoy.total_cost_usd,
    }

    const dir = logsDir ?? resolve(process.cwd(), '.opencastle', 'logs')
    mkdirSync(dir, { recursive: true })
    appendFileSync(resolve(dir, 'convoys.ndjson'), JSON.stringify(record) + '\n', 'utf8')
  } catch (err) {
    process.stderr.write(`[opencastle] exportConvoyToNdjson warning: ${String(err)}\n`)
  }
}
