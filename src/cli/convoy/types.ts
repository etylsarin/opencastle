export type ConvoyStatus = 'pending' | 'running' | 'done' | 'failed' | 'gate-failed' | 'hook-failed'

export type ConvoyTaskStatus =
  | 'pending'
  | 'assigned'
  | 'running'
  | 'done'
  | 'failed'
  | 'gate-failed'
  | 'review-blocked'
  | 'timed-out'
  | 'skipped'
  | 'hook-failed'
  | 'disputed'
  | 'wait-for-input'

export type WorkerStatus = 'spawned' | 'running' | 'done' | 'failed' | 'killed'

export type PipelineStatus = 'pending' | 'running' | 'done' | 'failed'

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
  total_tokens: number | null
  total_cost_usd: string | null
  pipeline_id: string | null
  circuit_state: string | null
  review_tokens_total: number | null
  review_budget: number | null
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
  prompt_tokens: number | null
  completion_tokens: number | null
  total_tokens: number | null
  cost_usd: string | null
  gates: string | null
  on_exhausted: 'dlq' | 'skip' | 'stop'
  injected: number
  provenance: string | null
  idempotency_key: string | null
  current_step: number | null
  total_steps: number | null
  review_level: string | null
  review_verdict: string | null
  review_tokens: number | null
  review_model: string | null
  panel_attempts: number
  dispute_id: string | null
  drift_score: number | null
  drift_retried: number
  outputs?: string | null          // JSON array of TaskOutput
  inputs?: string | null           // JSON array of TaskInput
  discovered_issues?: string | null // JSON array
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

export interface PipelineRecord {
  id: string
  name: string
  status: PipelineStatus
  branch: string | null
  spec_yaml: string
  convoy_specs: string
  created_at: string
  started_at: string | null
  finished_at: string | null
  total_tokens: number | null
  total_cost_usd: string | null
}

export interface BuiltInGatesConfig {
  secret_scan?: boolean
  blast_radius?: boolean
  dependency_audit?: 'auto' | boolean
  regression_test?: 'auto' | boolean
  browser_test?: 'auto' | boolean
  gate_timeout?: number
}


export interface BrowserTestConfig {
  urls: string[]
  check_console_errors?: boolean
  visual_diff_threshold?: number
  a11y?: boolean
  severity_threshold?: 'critical' | 'serious' | 'moderate' | 'minor'
  baselines_dir?: string
}
export interface GuardConfig {
  enabled?: boolean      // default: true
  agent?: string         // optional agent name (e.g. 'session-guard')
  checks?: string[]      // e.g. ['observability', 'cleanup', 'cost-report']
}

export interface DlqRecord {
  id: string
  convoy_id: string
  task_id: string
  agent: string
  failure_type: string
  error_output: string | null
  attempts: number
  tokens_spent: number | null
  escalation_task_id: string | null
  resolved: number
  resolution: string | null
  created_at: string
  resolved_at: string | null
}

export interface CircuitBreakerConfig {
  threshold?: number      // failures before Open (default: 3)
  cooldown_ms?: number    // ms in Open before Half-Open (default: 300000 = 5min)
  fallback_agent?: string // reassign pending tasks when circuit opens
}

export interface TaskOutput {
  name: string
  type: 'file' | 'summary' | 'json'
  description?: string
}

export interface TaskInput {
  from: string
  name: string
  as?: string
}

export interface ArtifactRecord {
  id: string
  convoy_id: string
  task_id: string
  name: string
  type: 'file' | 'summary' | 'json'
  content: string
  created_at: string
}

export interface AgentIdentityRecord {
  id: string
  agent: string
  convoy_id: string
  task_id: string
  summary: string
  created_at: string
  retention_days: number
}

export interface StepCondition {
  step: string         // reference previous step by id
  exitCode?: { eq?: number; ne?: number; gt?: number; lt?: number }
  fileExists?: { path: string }
}

export interface TaskStep {
  id?: string
  prompt: string
  gates?: string[]
  max_retries?: number // inherits from task if omitted
  if?: StepCondition
}

export interface Hook {
  type: 'review' | 'guard' | 'agent' | 'command' | 'validate'
  name?: string
  prompt?: string  // for agent hooks
  command?: string // for command hooks
  on?: 'pre_task' | 'post_task' | 'post_convoy'
}

export interface TaskStepRecord {
  id: number
  task_id: string
  step_index: number
  prompt: string
  gates: string | null
  status: string
  exit_code: number | null
  output: string | null
  started_at: string | null
  finished_at: string | null
}

export interface WatchTrigger {
  type: 'file-change' | 'cron' | 'git-push'
  glob?: string        // for file-change: glob pattern to watch
  schedule?: string    // for cron: 5-field cron expression
  branch?: string      // for git-push: branch name pattern
  debounce_ms?: number // file-change debounce (default: 500ms)
}

export interface WatchConfig {
  triggers: WatchTrigger[]
  clear_scratchpad?: boolean // clear scratchpad on watch start
  scratchpad_retention_days?: number // auto-clear scratchpad entries older than N days
}

export interface ScratchpadRecord {
  key: string
  value: string
  updated_at: string
}

export interface MCPServerConfig {
  name: string
  type: string
  local?: boolean
  command?: string
  args?: string[]
  url?: string
  config?: Record<string, unknown>
}
