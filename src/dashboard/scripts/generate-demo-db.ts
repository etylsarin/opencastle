import { resolve, dirname } from 'node:path'
import { mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { createConvoyStore } from '../../cli/convoy/store.js'

// Fixed timestamps ensure the demo JSON committed to the repo stays stable
const C1_START  = '2026-01-15T10:00:00.000Z'
const T1A_START = '2026-01-15T10:00:01.000Z'
const T1A_END   = '2026-01-15T10:00:15.000Z'
const T1B_START = '2026-01-15T10:00:16.000Z'
const T1B_END   = '2026-01-15T10:00:32.000Z'
const C1_END    = '2026-01-15T10:00:33.000Z'  // convoy-1 total: 33s
const C2_START  = '2026-01-15T10:05:00.000Z'
const T2A_START = '2026-01-15T10:05:01.000Z'

export async function createDemoDb(outPath: string): Promise<void> {
  const dbPath = resolve(process.cwd(), outPath)
  mkdirSync(dirname(dbPath), { recursive: true })
  const store = createConvoyStore(dbPath)

  try {
    // --- Convoy 1: completed ---
    store.insertConvoy({
      id: 'demo-convoy-1',
      name: 'Demo Convoy Alpha',
      spec_hash: 'h1',
      status: 'done',
      branch: 'main',
      created_at: C1_START,
      spec_yaml: 'name: demo-alpha',
    })
    store.updateConvoyStatus('demo-convoy-1', 'done', {
      started_at: C1_START,
      finished_at: C1_END,
      total_tokens: 8432,
      total_cost_usd: 0.84,
    })

    store.insertTask({
      id: 'task-1-a',
      convoy_id: 'demo-convoy-1',
      phase: 1,
      prompt: 'Implement authentication middleware',
      agent: 'developer',
      adapter: 'noop',
      model: 'claude-sonnet-4-6',
      timeout_ms: 60000,
      status: 'done',
      retries: 0,
      max_retries: 3,
      files: null,
      depends_on: null,
      gates: null,
      outputs: JSON.stringify({ result: 'done' }),
      inputs: null,
    })
    store.updateTaskStatus('task-1-a', 'demo-convoy-1', 'done', {
      started_at: T1A_START,
      finished_at: T1A_END,
      total_tokens: 4200,
      cost_usd: 0.42,
    })

    store.insertTask({
      id: 'task-1-b',
      convoy_id: 'demo-convoy-1',
      phase: 2,
      prompt: 'Write unit tests for auth middleware',
      agent: 'developer',
      adapter: 'noop',
      model: 'claude-sonnet-4-6',
      timeout_ms: 60000,
      status: 'done',
      retries: 1,
      max_retries: 3,
      files: null,
      depends_on: null,
      gates: null,
      outputs: JSON.stringify({ tests: 12 }),
      inputs: null,
    })
    store.updateTaskStatus('task-1-b', 'demo-convoy-1', 'done', {
      started_at: T1B_START,
      finished_at: T1B_END,
      total_tokens: 4232,
      cost_usd: 0.42,
    })

    store.insertEvent({ convoy_id: 'demo-convoy-1', task_id: 'task-1-a', worker_id: null, type: 'task_started', data: null, created_at: T1A_START })
    store.insertEvent({ convoy_id: 'demo-convoy-1', task_id: 'task-1-a', worker_id: null, type: 'task_done', data: null, created_at: T1A_END })
    store.insertEvent({ convoy_id: 'demo-convoy-1', task_id: 'task-1-b', worker_id: null, type: 'task_started', data: null, created_at: T1B_START })
    store.insertEvent({ convoy_id: 'demo-convoy-1', task_id: 'task-1-b', worker_id: null, type: 'task_done', data: null, created_at: T1B_END })

    // --- Convoy 2: still running ---
    store.insertConvoy({
      id: 'demo-convoy-2',
      name: 'Demo Convoy Beta',
      spec_hash: 'h2',
      status: 'running',
      branch: 'feature/x',
      created_at: C2_START,
      spec_yaml: 'name: demo-beta',
    })
    store.updateConvoyStatus('demo-convoy-2', 'running', { started_at: C2_START })

    store.insertTask({
      id: 'task-2-a',
      convoy_id: 'demo-convoy-2',
      phase: 1,
      prompt: 'Refactor database layer',
      agent: 'developer',
      adapter: 'noop',
      model: 'claude-sonnet-4-6',
      timeout_ms: 60000,
      status: 'running',
      retries: 0,
      max_retries: 3,
      files: null,
      depends_on: null,
      gates: null,
      outputs: null,
      inputs: null,
    })
    store.updateTaskStatus('task-2-a', 'demo-convoy-2', 'running', { started_at: T2A_START })

    store.insertEvent({ convoy_id: 'demo-convoy-2', task_id: 'task-2-a', worker_id: null, type: 'task_started', data: null, created_at: T2A_START })

    console.log(`Created demo convoy DB at ${dbPath}`)
  } finally {
    store.close()
  }
}

// CLI entry (ESM-safe)
const __filename = fileURLToPath(import.meta.url)
if (process.argv[1] != null && resolve(process.argv[1]) === __filename) {
  const outArgIndex = process.argv.indexOf('--out')
  const out = outArgIndex >= 0 && process.argv[outArgIndex + 1] ? process.argv[outArgIndex + 1] : '.opencastle/convoy-demo.db'
  createDemoDb(out).catch(err => { console.error('Failed to create demo DB:', (err as Error).message); process.exit(1) })
}
