export interface DashboardOverallStats {
  total_convoys: number
  running_convoys: number
  successful_convoys: number
  failed_convoys: number
  avg_convoy_duration_sec: number | null
  p95_convoy_duration_sec: number | null
  total_tokens: number
  total_cost_usd: number
  top_agents: Array<{ agent: string; task_count: number; total_tokens: number }>
  top_models: Array<{ model: string; task_count: number; total_tokens: number }>
  retry_queue_count: number
  disputed_tasks: number
}

export interface DashboardConvoySummary {
  id: string
  name: string
  status: string
  branch: string | null
  created_at: string
  started_at: string | null
  finished_at: string | null
  duration_sec: number | null
  total_tokens: number | null
  total_cost_usd: number | null
  tasks_total: number
  tasks_done: number
  tasks_running: number
  tasks_waiting: number
  tasks_failed: number
  tasks_retrying: number
}

export interface DashboardTaskSummary {
  id: string
  phase: number
  agent: string
  model: string | null
  status: string
  duration_sec: number | null
  retries: number
  files: string[]
  total_tokens: number | null
  cost_usd: number | null
  review_level: string | null
  review_verdict: string | null
  drift_score: number | null
}

export interface DashboardConvoyDetail {
  convoy: {
    id: string
    name: string
    status: string
    created_at: string
    finished_at: string | null
    branch: string | null
    total_tokens: number | null
    total_cost_usd: number | null
  }
  taskSummary: {
    total: number
    done: number
    running: number
    failed: number
    review_blocked: number
    disputed: number
    reviewed: number
    panel_reviewed: number
    tasks_with_drift: number
    max_drift_score: number | null
    drift_retried: number
  }
  quality: {
    reviewed_tasks: number
    review_blocked_tasks: number
    disputed_tasks: number
    panel_reviews: number
  }
  drift: {
    tasks_with_drift: number
    max_drift_score: number | null
    drift_retried_tasks: number
  }
  dlq_count: number
  dlq_entries: Array<{
    id: string
    task_id: string
    agent: string
    failure_type: string
    attempts: number
    resolved: number
  }>
  artifact_count: number
  artifacts: Array<{
    id: string
    name: string
    type: string
    task_id: string
    created_at: string
  }>
  has_more_events: boolean
  events: Array<{
    type: string
    task_id: string | null
    data: unknown
    created_at: string
  }>
  tasks: Array<{
    id: string
    phase: number
    agent: string
    model: string | null
    status: string
    retries: number
    started_at: string | null
    finished_at: string | null
    total_tokens: number | null
    cost_usd: number | null
    review_level: string | null
    review_verdict: string | null
    review_tokens: number | null
    review_model: string | null
    panel_attempts: number | null
    dispute_id: string | null
    drift_score: number | null
    drift_retried: number | null
    files: string[] | null
  }>
}

export interface DashboardTimelineEvent {
  id: number
  timestamp: string
  type: string
  convoy_id: string | null
  task_id: string | null
  worker_id: string | null
  summary: string
}
