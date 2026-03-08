export type ConvoyStatus = 'pending' | 'running' | 'done' | 'failed' | 'gate-failed'

export type ConvoyTaskStatus =
  | 'pending'
  | 'assigned'
  | 'running'
  | 'done'
  | 'failed'
  | 'timed-out'
  | 'skipped'

export type WorkerStatus = 'spawned' | 'running' | 'done' | 'failed' | 'killed'

export interface ConvoyRecord {
  id: string
  name: string
  spec_hash: string
  status: ConvoyStatus
  branch: string | null
  created_at: string
  started_at: string | null
  finished_at: string | null
  spec_yaml: string
}

export interface TaskRecord {
  id: string
  convoy_id: string
  phase: number
  prompt: string
  agent: string
  adapter: string | null
  model: string | null
  timeout_ms: number
  status: ConvoyTaskStatus
  worker_id: string | null
  worktree: string | null
  output: string | null
  exit_code: number | null
  started_at: string | null
  finished_at: string | null
  retries: number
  max_retries: number
  files: string | null
  depends_on: string | null
}

export interface WorkerRecord {
  id: string
  task_id: string | null
  adapter: string
  pid: number | null
  session_id: string | null
  status: WorkerStatus
  worktree: string | null
  created_at: string
  finished_at: string | null
  last_heartbeat: string | null
}

export interface EventRecord {
  id?: number
  convoy_id: string | null
  task_id: string | null
  worker_id: string | null
  type: string
  data: string | null
  created_at: string
}
