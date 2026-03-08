import type { ConvoyStore } from './store.js'
import type { ConvoyEventEmitter } from './events.js'

export interface HealthMonitorOptions {
  store: ConvoyStore
  events: ConvoyEventEmitter
  convoyId: string
  /** Interval between health checks in ms (default: 30000) */
  intervalMs?: number
  /** Factor of task timeout before declaring stuck (default: 2) */
  stuckFactor?: number
  /** Optional kill callback for killing a stuck worker's process */
  onKill?: (workerId: string, taskId: string) => void
}

export interface HealthMonitor {
  /** Start periodic health checks. Returns immediately. */
  start(): void
  /** Stop periodic health checks and clean up. */
  stop(): void
  /** Run a single health check cycle (useful for testing). */
  check(): void
}

export function createHealthMonitor(options: HealthMonitorOptions): HealthMonitor {
  const {
    store,
    events,
    convoyId,
    intervalMs = 30_000,
    stuckFactor = 2,
    onKill,
  } = options

  let timer: ReturnType<typeof setInterval> | null = null

  function check(): void {
    const activeTasks = store
      .getTasksByConvoy(convoyId)
      .filter(t => t.status === 'running' || t.status === 'assigned')

    for (const task of activeTasks) {
      if (!task.worker_id) continue

      const worker = store.getWorker(task.worker_id)
      if (!worker) continue

      let reason: 'stuck' | 'zombie' | null = null

      if (worker.last_heartbeat !== null) {
        const elapsed = Date.now() - new Date(worker.last_heartbeat).getTime()
        if (elapsed > task.timeout_ms * stuckFactor) {
          reason = 'stuck'
        }
      }

      if (reason === null && worker.pid !== null) {
        let processGone = false
        try {
          process.kill(worker.pid, 0)
        } catch {
          processGone = true
        }
        if (processGone && worker.status === 'running') {
          reason = 'zombie'
        }
      }

      if (reason !== null) {
        const workerId = worker.id
        const taskId = task.id

        onKill?.(workerId, taskId)

        store.withTransaction(() => {
          store.updateWorkerStatus(workerId, 'killed', {
            finished_at: new Date().toISOString(),
          })

          if (task.retries < task.max_retries) {
            store.updateTaskStatus(taskId, convoyId, 'pending', {
              retries: task.retries + 1,
            })
          } else {
            store.updateTaskStatus(taskId, convoyId, 'failed')
          }
        })

        events.emit(
          'worker_killed',
          { reason, worker_id: workerId, task_id: taskId },
          { convoy_id: convoyId, task_id: taskId, worker_id: workerId },
        )
      }
    }
  }

  return {
    start() {
      if (timer !== null) return
      timer = setInterval(check, intervalMs)
    },
    stop() {
      if (timer !== null) {
        clearInterval(timer)
        timer = null
      }
    },
    check,
  }
}
