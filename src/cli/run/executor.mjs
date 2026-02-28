/* global console */
import { parseTimeout } from './schema.mjs'

/**
 * Task statuses.
 * @typedef {'pending'|'running'|'done'|'failed'|'skipped'|'timed-out'} TaskStatus
 */

/**
 * Topological sort of tasks based on `depends_on` edges.
 * Returns groups (phases) of tasks that can run in parallel.
 * @param {Array} tasks
 * @returns {Array<Array<object>>} Phases — each phase is a list of tasks
 */
export function buildPhases(tasks) {
  const taskMap = new Map()
  for (const t of tasks) taskMap.set(t.id, t)

  const inDegree = new Map()
  const dependents = new Map()

  for (const t of tasks) {
    inDegree.set(t.id, (t.depends_on || []).length)
    dependents.set(t.id, [])
  }

  for (const t of tasks) {
    for (const dep of t.depends_on || []) {
      dependents.get(dep).push(t.id)
    }
  }

  const phases = []
  const remaining = new Set(tasks.map((t) => t.id))

  while (remaining.size > 0) {
    const phase = []
    for (const id of remaining) {
      if (inDegree.get(id) === 0) {
        phase.push(taskMap.get(id))
      }
    }

    if (phase.length === 0) {
      // Should not happen if cycle detection passed
      throw new Error('Cannot resolve task order — possible circular dependency')
    }

    phases.push(phase)

    for (const t of phase) {
      remaining.delete(t.id)
      for (const depId of dependents.get(t.id)) {
        inDegree.set(depId, inDegree.get(depId) - 1)
      }
    }
  }

  return phases
}

/**
 * Create a task executor.
 * @param {object} spec - Validated task spec (with defaults applied)
 * @param {object} adapter - Agent adapter ({ execute, name })
 * @param {object} reporter - Reporter object
 * @returns {{ run: () => Promise<object>, getPhases: () => Array }}
 */
export function createExecutor(spec, adapter, reporter) {
  const phases = buildPhases(spec.tasks)
  const statuses = new Map()
  const results = new Map()
  const startTimes = new Map()

  for (const t of spec.tasks) {
    statuses.set(t.id, 'pending')
    results.set(t.id, null)
  }

  /**
   * Execute a single task with timeout enforcement.
   * @param {object} task
   * @returns {Promise<object>} result
   */
  async function executeTask(task) {
    const timeoutMs = parseTimeout(task.timeout)
    statuses.set(task.id, 'running')
    startTimes.set(task.id, Date.now())
    reporter.onTaskStart(task)

    try {
      const result = await Promise.race([
        adapter.execute(task, { verbose: spec._verbose }),
        timeoutPromise(timeoutMs, task.id),
      ])

      const duration = Date.now() - startTimes.get(task.id)

      if (result._timedOut) {
        statuses.set(task.id, 'timed-out')
        const taskResult = {
          id: task.id,
          status: 'timed-out',
          duration,
          output: `Task timed out after ${task.timeout}`,
          exitCode: -1,
        }
        results.set(task.id, taskResult)
        reporter.onTaskDone(task, taskResult)
        return taskResult
      }

      const status = result.success ? 'done' : 'failed'
      statuses.set(task.id, status)
      const taskResult = {
        id: task.id,
        status,
        duration,
        output: result.output || '',
        exitCode: result.exitCode,
      }
      results.set(task.id, taskResult)
      reporter.onTaskDone(task, taskResult)
      return taskResult
    } catch (err) {
      const duration = Date.now() - startTimes.get(task.id)
      statuses.set(task.id, 'failed')
      const taskResult = {
        id: task.id,
        status: 'failed',
        duration,
        output: err.message,
        exitCode: -1,
      }
      results.set(task.id, taskResult)
      reporter.onTaskDone(task, taskResult)
      return taskResult
    }
  }

  /**
   * Skip a task and all its transitive dependents.
   * @param {string} taskId
   * @param {string} reason
   */
  function skipTask(taskId, reason) {
    if (statuses.get(taskId) !== 'pending') return
    statuses.set(taskId, 'skipped')
    const task = spec.tasks.find((t) => t.id === taskId)
    results.set(taskId, {
      id: taskId,
      status: 'skipped',
      duration: 0,
      output: reason,
      exitCode: -1,
    })
    reporter.onTaskSkipped(task, reason)

    // Recursively skip dependents
    for (const t of spec.tasks) {
      if ((t.depends_on || []).includes(taskId)) {
        skipTask(t.id, `dependency "${taskId}" was skipped/failed`)
      }
    }
  }

  /**
   * Run all tasks respecting phases and concurrency.
   * @returns {Promise<object>} Final run results
   */
  async function run() {
    const startedAt = new Date()
    let halted = false

    for (let phaseIdx = 0; phaseIdx < phases.length; phaseIdx++) {
      if (halted) break

      const phase = phases[phaseIdx]
      const eligible = phase.filter((t) => statuses.get(t.id) === 'pending')

      if (eligible.length === 0) continue

      reporter.onPhaseStart(phaseIdx + 1, eligible)

      // Process eligible tasks in batches limited by concurrency
      const concurrency = spec.concurrency
      for (let i = 0; i < eligible.length; i += concurrency) {
        if (halted) break
        const batch = eligible.slice(i, i + concurrency)
        const batchResults = await Promise.all(batch.map(executeTask))

        for (const r of batchResults) {
          if (r.status === 'failed' || r.status === 'timed-out') {
            if (spec.on_failure === 'stop') {
              halted = true
              // Skip all remaining tasks
              for (const t of spec.tasks) {
                if (statuses.get(t.id) === 'pending') {
                  skipTask(t.id, 'execution halted due to on_failure: stop')
                }
              }
            } else {
              // on_failure: continue — skip dependents of this failed task
              for (const t of spec.tasks) {
                if ((t.depends_on || []).includes(r.id)) {
                  skipTask(t.id, `dependency "${r.id}" failed`)
                }
              }
            }
          }
        }
      }
    }

    const completedAt = new Date()
    const allResults = spec.tasks.map((t) => results.get(t.id) || {
      id: t.id,
      status: statuses.get(t.id),
      duration: 0,
      output: '',
      exitCode: -1,
    })

    const summary = { total: spec.tasks.length, done: 0, failed: 0, skipped: 0, 'timed-out': 0 }
    for (const r of allResults) {
      if (summary[r.status] !== undefined) summary[r.status]++
    }

    const finalReport = {
      name: spec.name,
      startedAt: startedAt.toISOString(),
      completedAt: completedAt.toISOString(),
      duration: formatDuration(completedAt - startedAt),
      summary,
      tasks: allResults,
    }

    await reporter.onComplete(finalReport)

    return finalReport
  }

  return {
    run,
    getPhases: () => phases,
  }
}

/**
 * Create a timeout promise that resolves with a sentinel.
 * @param {number} ms
 * @param {string} taskId
 * @returns {Promise<{_timedOut: true}>}
 */
function timeoutPromise(ms, taskId) {
  return new Promise((resolve) => {
    setTimeout(() => resolve({ _timedOut: true, taskId }), ms)
  })
}

/**
 * Format a duration in ms to a human-readable string.
 * @param {number} ms
 * @returns {string}
 */
export function formatDuration(ms) {
  if (ms < 1000) return `${ms}ms`
  const seconds = Math.floor(ms / 1000)
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  const remSec = seconds % 60
  if (minutes < 60) return remSec > 0 ? `${minutes}m ${remSec}s` : `${minutes}m`
  const hours = Math.floor(minutes / 60)
  const remMin = minutes % 60
  return remMin > 0 ? `${hours}h ${remMin}m` : `${hours}h`
}
