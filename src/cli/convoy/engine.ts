import { execFile as execFileCb } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { promisify } from 'node:util'
import type { Task, TaskSpec, AgentAdapter, ExecuteResult } from '../types.js'
import { createConvoyStore, type ConvoyStore } from './store.js'
import { createEventEmitter, type ConvoyEventEmitter } from './events.js'
import { createWorktreeManager, type WorktreeManager } from './worktree.js'
import { createMergeQueue, type MergeQueue } from './merge.js'
import { createHealthMonitor } from './health.js'
import { exportConvoyToNdjson } from './export.js'
import type { TaskRecord, ConvoyStatus } from './types.js'
import { buildPhases, formatDuration } from '../run/executor.js'
import { parseTimeout } from '../run/schema.js'
import { getAdapter, detectAdapter } from '../run/adapters/index.js'
import { c } from '../prompt.js'

const execFile = promisify(execFileCb)

// ── Public interfaces ─────────────────────────────────────────────────────────

export interface ConvoyEngineOptions {
  spec: TaskSpec
  specYaml: string
  adapter: AgentAdapter
  basePath?: string
  dbPath?: string
  logsDir?: string
  verbose?: boolean
  pipelineId?: string
  _worktreeManager?: WorktreeManager
  _mergeQueue?: MergeQueue
}

export interface ConvoyResult {
  convoyId: string
  status: ConvoyStatus
  summary: { total: number; done: number; failed: number; skipped: number; timedOut: number }
  duration: string
  gateResults?: Array<{ command: string; exitCode: number; passed: boolean; output?: string }>
  cost?: { total_tokens: number }
}

export interface ConvoyEngine {
  run(): Promise<ConvoyResult>
  resume(convoyId: string): Promise<ConvoyResult>
}

// ── Internal helpers ──────────────────────────────────────────────────────────

function msToTimeout(ms: number): string {
  if (ms >= 3_600_000 && ms % 3_600_000 === 0) return `${ms / 3_600_000}h`
  if (ms >= 60_000 && ms % 60_000 === 0) return `${ms / 60_000}m`
  return `${ms / 1_000}s`
}

function taskRecordToTask(record: TaskRecord): Task {
  return {
    id: record.id,
    prompt: record.prompt,
    agent: record.agent,
    timeout: msToTimeout(record.timeout_ms),
    depends_on: record.depends_on ? (JSON.parse(record.depends_on) as string[]) : [],
    files: record.files ? (JSON.parse(record.files) as string[]) : [],
    description: '',
    model: record.model ?? undefined,
    max_retries: record.max_retries,
    adapter: record.adapter ?? undefined,
  }
}

function makeTimeoutPromise(ms: number): { promise: Promise<ExecuteResult>; clear: () => void } {
  let timerId: ReturnType<typeof setTimeout> | undefined
  const promise = new Promise<ExecuteResult>((res) => {
    timerId = setTimeout(
      () => res({ _timedOut: true, success: false, output: 'Task timed out', exitCode: -1 }),
      ms,
    )
  })
  return { promise, clear: () => { if (timerId !== undefined) clearTimeout(timerId) } }
}

// ── Core convoy execution ─────────────────────────────────────────────────────

async function runConvoy(
  convoyId: string,
  spec: TaskSpec,
  adapter: AgentAdapter,
  store: ConvoyStore,
  events: ConvoyEventEmitter,
  wtManager: WorktreeManager,
  mergeQueue: MergeQueue,
  basePath: string,
  baseBranch: string,
  verbose: boolean,
  startTime: number,
): Promise<ConvoyResult> {
  const totalTasks = spec.tasks?.length ?? 0
  let completedCount = 0
  const activeTaskMap = new Map<string, Task>()
  const taskAdapterMap = new Map<string, AgentAdapter>()

  const healthMonitor = createHealthMonitor({
    store,
    events,
    convoyId,
    onKill: (workerId, taskId) => {
      const task = activeTaskMap.get(taskId)
      const taskAdpt = taskAdapterMap.get(taskId) ?? adapter
      if (task && typeof taskAdpt.kill === 'function') {
        taskAdpt.kill(task)
      }
      activeTaskMap.delete(taskId)
      taskAdapterMap.delete(taskId)
    },
  })
  healthMonitor.start()

  // ── Task skipping ─────────────────────────────────────────────────────────

  function skipTask(taskId: string, reason: string, visited: Set<string> = new Set()): void {
    if (visited.has(taskId)) return
    visited.add(taskId)
    const allTasks = store.getTasksByConvoy(convoyId)
    const task = allTasks.find(t => t.id === taskId)
    if (!task || task.status !== 'pending') return
    store.updateTaskStatus(taskId, convoyId, 'skipped', { output: reason })
    process.stdout.write(`  ${c.dim('⊘')} ${c.bold(`[${taskId}]`)} skipped\n`)
    events.emit('task_skipped', { reason }, { convoy_id: convoyId, task_id: taskId })
    for (const t of allTasks) {
      const deps = t.depends_on ? (JSON.parse(t.depends_on) as string[]) : []
      if (deps.includes(taskId)) {
        skipTask(t.id, `dependency "${taskId}" was skipped/failed`, visited)
      }
    }
  }

  function cascadeFailure(failedTaskId: string): void {
    if (spec.on_failure === 'stop') {
      const allPending = store.getTasksByConvoy(convoyId).filter(t => t.status === 'pending')
      for (const t of allPending) {
        skipTask(t.id, 'execution halted due to on_failure: stop')
      }
    } else {
      const allTasks = store.getTasksByConvoy(convoyId)
      for (const t of allTasks) {
        const deps = t.depends_on ? (JSON.parse(t.depends_on) as string[]) : []
        if (deps.includes(failedTaskId)) {
          skipTask(t.id, `dependency "${failedTaskId}" failed`)
        }
      }
    }
  }

  // ── Single-task executor ──────────────────────────────────────────────────

  async function executeOneTask(taskRecord: TaskRecord): Promise<void> {
    const workerId = `worker-${taskRecord.id}-${Date.now()}`
    const now = () => new Date().toISOString()

    // Resolve per-task adapter (fallback to convoy-level adapter)
    let taskAdapter: AgentAdapter = adapter
    if (taskRecord.adapter && taskRecord.adapter !== adapter.name) {
      if (taskRecord.adapter === 'auto') {
        const detected = await detectAdapter()
        if (detected) {
          taskAdapter = await getAdapter(detected)
        }
      } else {
        taskAdapter = await getAdapter(taskRecord.adapter)
      }
    }
    taskAdapterMap.set(taskRecord.id, taskAdapter)

    // Create worktree (skip for copilot adapter)
    let worktreePath: string | null = null
    if (taskAdapter.name !== 'copilot') {
      try {
        worktreePath = await wtManager.create(workerId, baseBranch)
      } catch (err) {
        if (verbose) {
          process.stderr.write(
            `Warning: failed to create worktree for ${taskRecord.id}: ${(err as Error).message}\n`,
          )
        }
      }
    }

    store.insertWorker({
      id: workerId,
      task_id: taskRecord.id,
      adapter: taskAdapter.name,
      pid: null,
      session_id: null,
      status: 'spawned',
      worktree: worktreePath,
      created_at: now(),
    })

    // Mark assigned then running
    store.updateTaskStatus(taskRecord.id, convoyId, 'assigned', {
      worker_id: workerId,
      worktree: worktreePath,
    })
    store.updateTaskStatus(taskRecord.id, convoyId, 'running', { started_at: now() })
    store.updateWorkerStatus(workerId, 'running')

    const task = taskRecordToTask(taskRecord)
    activeTaskMap.set(taskRecord.id, task)

    process.stdout.write(`  ${c.cyan('▶')} ${c.bold(`[${taskRecord.id}]`)} ${taskRecord.agent}${worktreePath ? c.dim(' (worktree)') : ''}\n`)
    events.emit(
      'task_started',
      { worker_id: workerId },
      { convoy_id: convoyId, task_id: taskRecord.id, worker_id: workerId },
    )

    const taskStartTime = Date.now()
    const timeout = makeTimeoutPromise(taskRecord.timeout_ms)
    let result: ExecuteResult
    try {
      result = await Promise.race([
        taskAdapter.execute(task, { verbose, cwd: worktreePath ?? basePath }),
        timeout.promise,
      ])
      timeout.clear()
    } catch (err) {
      timeout.clear()
      result = { success: false, output: (err as Error).message, exitCode: -1 }
    }

    activeTaskMap.delete(taskRecord.id)
    const finishedAt = now()
    const elapsed = `(${formatDuration(Date.now() - taskStartTime)})`

    async function removeWorktree(): Promise<void> {
      if (worktreePath) {
        try { await wtManager.remove(worktreePath) } catch { /* ignore cleanup errors */ }
      }
    }

    // ── Timed out ───────────────────────────────────────────────────────────
    if (result._timedOut) {
      if (typeof taskAdapter.kill === 'function') taskAdapter.kill(task)
      await removeWorktree()

      const freshRecord = store.getTask(taskRecord.id, convoyId)!
      if (freshRecord.retries < freshRecord.max_retries && spec.on_failure !== 'stop') {
        store.updateTaskStatus(taskRecord.id, convoyId, 'pending', {
          retries: freshRecord.retries + 1,
          worker_id: null,
          worktree: null,
          started_at: null,
          finished_at: null,
        })
        store.updateWorkerStatus(workerId, 'killed', { finished_at: finishedAt })
        process.stdout.write(`  ${c.yellow('⟳')} ${c.bold(`[${taskRecord.id}]`)} timed out, retry ${freshRecord.retries + 1}/${freshRecord.max_retries}\n`)
      } else {
        store.withTransaction(() => {
          store.updateTaskStatus(taskRecord.id, convoyId, 'timed-out', {
            finished_at: finishedAt,
            output: result.output,
          })
          store.updateWorkerStatus(workerId, 'failed', { finished_at: finishedAt })
        })
        completedCount++
        process.stdout.write(`  ${c.red('⏱')} ${c.bold(`[${taskRecord.id}]`)} timed out ${c.dim(`[${completedCount}/${totalTasks}]`)}\n`)
        events.emit(
          'task_failed',
          { reason: 'timeout', worker_id: workerId },
          { convoy_id: convoyId, task_id: taskRecord.id, worker_id: workerId },
        )
        events.emit('session', {
          agent: taskRecord.agent,
          model: taskRecord.model ?? taskAdapter.name,
          task: taskRecord.id,
          outcome: 'failed',
          duration_min: Math.round((Date.now() - taskStartTime) / 60_000),
          files_changed: 0,
          retries: freshRecord.retries,
          convoy_id: convoyId,
        }, { convoy_id: convoyId, task_id: taskRecord.id })
        events.emit('delegation', {
          session_id: convoyId,
          agent: taskRecord.agent,
          model: taskRecord.model ?? taskAdapter.name,
          tier: 'standard',
          mechanism: 'convoy',
          outcome: 'failed',
          retries: freshRecord.retries,
          phase: taskRecord.phase,
          convoy_id: convoyId,
        }, { convoy_id: convoyId, task_id: taskRecord.id })
        cascadeFailure(taskRecord.id)
      }
      taskAdapterMap.delete(taskRecord.id)
      return
    }

    // ── Success ─────────────────────────────────────────────────────────────
    if (result.success) {
      if (worktreePath) {
        try {
          await mergeQueue.merge(worktreePath, `convoy-${workerId}`, baseBranch)
        } catch (err) {
          if (verbose) {
            process.stderr.write(
              `Warning: merge failed for ${taskRecord.id}: ${(err as Error).message}\n`,
            )
          }
        }
        await removeWorktree()
      }

      const usageExtra: Partial<{ prompt_tokens: number; completion_tokens: number; total_tokens: number }> = {}
      if (result.usage) {
        if (result.usage.prompt_tokens != null) usageExtra.prompt_tokens = result.usage.prompt_tokens
        if (result.usage.completion_tokens != null) usageExtra.completion_tokens = result.usage.completion_tokens
        if (result.usage.total_tokens != null) usageExtra.total_tokens = result.usage.total_tokens
      }

      store.withTransaction(() => {
        store.updateTaskStatus(taskRecord.id, convoyId, 'done', {
          finished_at: finishedAt,
          output: result.output,
          exit_code: result.exitCode,
          ...usageExtra,
        })
        store.updateWorkerStatus(workerId, 'done', { finished_at: finishedAt })
      })
      completedCount++
      process.stdout.write(`  ${c.green('✓')} ${c.bold(`[${taskRecord.id}]`)} ${elapsed} ${c.dim(`[${completedCount}/${totalTasks}]`)}\n`)
      events.emit(
        'task_done',
        { exit_code: result.exitCode, worker_id: workerId },
        { convoy_id: convoyId, task_id: taskRecord.id, worker_id: workerId },
      )
      events.emit('session', {
        agent: taskRecord.agent,
        model: taskRecord.model ?? taskAdapter.name,
        task: taskRecord.id,
        outcome: 'success',
        duration_min: Math.round((Date.now() - taskStartTime) / 60_000),
        files_changed: 0,
        retries: taskRecord.retries,
        convoy_id: convoyId,
      }, { convoy_id: convoyId, task_id: taskRecord.id })
      events.emit('delegation', {
        session_id: convoyId,
        agent: taskRecord.agent,
        model: taskRecord.model ?? taskAdapter.name,
        tier: 'standard',
        mechanism: 'convoy',
        outcome: 'success',
        retries: taskRecord.retries,
        phase: taskRecord.phase,
        convoy_id: convoyId,
      }, { convoy_id: convoyId, task_id: taskRecord.id })
      taskAdapterMap.delete(taskRecord.id)
      return
    }

    // ── Failure ─────────────────────────────────────────────────────────────
    if (typeof taskAdapter.kill === 'function') taskAdapter.kill(task)
    await removeWorktree()

    const freshRecord = store.getTask(taskRecord.id, convoyId)!
    if (freshRecord.retries < freshRecord.max_retries && spec.on_failure !== 'stop') {
      store.updateTaskStatus(taskRecord.id, convoyId, 'pending', {
        retries: freshRecord.retries + 1,
        worker_id: null,
        worktree: null,
        started_at: null,
        finished_at: null,
      })
      store.updateWorkerStatus(workerId, 'failed', { finished_at: finishedAt })
      process.stdout.write(`  ${c.yellow('⟳')} ${c.bold(`[${taskRecord.id}]`)} retry ${freshRecord.retries + 1}/${freshRecord.max_retries}\n`)
    } else {
      store.withTransaction(() => {
        store.updateTaskStatus(taskRecord.id, convoyId, 'failed', {
          finished_at: finishedAt,
          output: result.output,
          exit_code: result.exitCode,
        })
        store.updateWorkerStatus(workerId, 'failed', { finished_at: finishedAt })
      })
      completedCount++
      process.stdout.write(`  ${c.red('✗')} ${c.bold(`[${taskRecord.id}]`)} failed ${elapsed} ${c.dim(`[${completedCount}/${totalTasks}]`)}\n`)
      if (verbose) {
        const outputPreview = result.output.split('\n').slice(0, 5).join('\n')
        process.stdout.write(`${outputPreview}\n`)
      }
      events.emit(
        'task_failed',
        { reason: 'error', exit_code: result.exitCode, worker_id: workerId },
        { convoy_id: convoyId, task_id: taskRecord.id, worker_id: workerId },
      )
      events.emit('session', {
        agent: taskRecord.agent,
        model: taskRecord.model ?? taskAdapter.name,
        task: taskRecord.id,
        outcome: 'failed',
        duration_min: Math.round((Date.now() - taskStartTime) / 60_000),
        files_changed: 0,
        retries: freshRecord.retries,
        convoy_id: convoyId,
      }, { convoy_id: convoyId, task_id: taskRecord.id })
      events.emit('delegation', {
        session_id: convoyId,
        agent: taskRecord.agent,
        model: taskRecord.model ?? taskAdapter.name,
        tier: 'standard',
        mechanism: 'convoy',
        outcome: 'failed',
        retries: freshRecord.retries,
        phase: taskRecord.phase,
        convoy_id: convoyId,
      }, { convoy_id: convoyId, task_id: taskRecord.id })
      cascadeFailure(taskRecord.id)
    }
    taskAdapterMap.delete(taskRecord.id)
  }

  // ── Main execution loop ───────────────────────────────────────────────────

  let lastPhase = -1
  try {
    let ready = store.getReadyTasks(convoyId)
    const concurrency = spec.concurrency ?? 1
    while (ready.length > 0) {
      for (const t of ready) {
        if (t.phase !== lastPhase) {
          lastPhase = t.phase
          const tasksInPhase = ready.filter(r => r.phase === t.phase)
          const ids = tasksInPhase.map(r => r.id).join(', ')
          process.stdout.write(`\n  ${c.bold(`Phase ${t.phase + 1}:`)} ${c.dim(ids)}\n`)
        }
      }
      for (let i = 0; i < ready.length; i += concurrency) {
        await Promise.all(ready.slice(i, i + concurrency).map(t => executeOneTask(t)))
      }
      ready = store.getReadyTasks(convoyId)
    }
  } finally {
    healthMonitor.stop()
  }

  // ── Validation gates ──────────────────────────────────────────────────────

  const maxGateRetries = spec.gate_retries ?? 0
  let gateAttempt = 0
  let gateResults: Array<{ command: string; exitCode: number; passed: boolean; output?: string }> = []

  while (gateAttempt <= maxGateRetries) {
    if (!spec.gates || spec.gates.length === 0) break

    gateResults = []
    process.stdout.write(`\n  ${c.bold(gateAttempt === 0 ? 'Gates:' : `Gates (retry ${gateAttempt}/${maxGateRetries}):`)}\n`)

    for (const command of spec.gates) {
      try {
        await execFile('sh', ['-c', command], { cwd: basePath })
        gateResults.push({ command, exitCode: 0, passed: true })
        process.stdout.write(`  ${c.green('✓')} ${c.dim(command)}\n`)
      } catch (err) {
        const execErr = err as Error & { code?: unknown; stderr?: string; stdout?: string }
        const code = typeof execErr.code === 'number' ? execErr.code : 1
        const output = execErr.stderr || execErr.stdout || execErr.message || ''
        gateResults.push({ command, exitCode: code, passed: false, output })
        process.stdout.write(`  ${c.red('✗')} ${c.dim(command)}\n`)
      }
    }

    const failedGates = gateResults.filter(g => !g.passed)
    if (failedGates.length === 0) break // All gates passed

    // Can we retry?
    if (gateAttempt >= maxGateRetries) break // No more retries

    // Create and execute a fix task
    gateAttempt++
    const failureSummary = failedGates
      .map(g => `Command: ${g.command}\nExit code: ${g.exitCode}\nOutput:\n${g.output ?? '(no output)'}`)
      .join('\n\n---\n\n')

    const fixPrompt = `The following validation gates failed after all convoy tasks completed. Fix the issues so these commands pass.\n\n${failureSummary}`
    const fixTaskId = `gate-fix-${gateAttempt}`

    process.stdout.write(`\n  ${c.yellow('⟳')} ${c.bold(`[${fixTaskId}]`)} fixing gate failures (attempt ${gateAttempt}/${maxGateRetries})\n`)

    const fixTask: Task = {
      id: fixTaskId,
      prompt: fixPrompt,
      agent: spec.defaults?.agent ?? 'developer',
      timeout: spec.defaults?.timeout ?? '30m',
      depends_on: [],
      files: [],
      description: `Auto-fix gate failures (attempt ${gateAttempt})`,
      max_retries: 0,
    }

    const fixResult = await adapter.execute(fixTask, { verbose, cwd: basePath })

    if (fixResult.success) {
      process.stdout.write(`  ${c.green('✓')} ${c.bold(`[${fixTaskId}]`)} fix applied\n`)
    } else {
      process.stdout.write(`  ${c.red('✗')} ${c.bold(`[${fixTaskId}]`)} fix failed\n`)
      break // Don't retry if the fix task itself fails
    }
  }

  // ── Final status & summary ────────────────────────────────────────────────

  const allTasksFinal = store.getTasksByConvoy(convoyId)
  const summary = {
    total: allTasksFinal.length,
    done: allTasksFinal.filter(t => t.status === 'done').length,
    failed: allTasksFinal.filter(t => t.status === 'failed').length,
    skipped: allTasksFinal.filter(t => t.status === 'skipped').length,
    timedOut: allTasksFinal.filter(t => t.status === 'timed-out').length,
  }

  const anyGateFailed = gateResults.some(g => !g.passed)
  const finalStatus: ConvoyStatus = anyGateFailed
    ? 'gate-failed'
    : summary.failed > 0 || summary.timedOut > 0
      ? 'failed'
      : 'done'

  // Aggregate token usage across completed tasks
  let convoyTotalTokens: number | null = null
  for (const t of allTasksFinal) {
    if (t.total_tokens != null) {
      convoyTotalTokens = (convoyTotalTokens ?? 0) + t.total_tokens
    }
  }

  store.updateConvoyStatus(convoyId, finalStatus, {
    finished_at: new Date().toISOString(),
    total_tokens: convoyTotalTokens,
  })

  return {
    convoyId,
    status: finalStatus,
    summary,
    duration: formatDuration(Date.now() - startTime),
    gateResults: spec.gates && spec.gates.length > 0 ? gateResults : undefined,
    cost: convoyTotalTokens != null ? { total_tokens: convoyTotalTokens } : undefined,
  }
}

// ── Factory ───────────────────────────────────────────────────────────────────

export function createConvoyEngine(options: ConvoyEngineOptions): ConvoyEngine {
  const { spec, specYaml, adapter, verbose = false } = options
  const basePath = resolve(options.basePath ?? process.cwd())
  const dbPath = options.dbPath ?? join(basePath, '.opencastle', 'convoy.db')

  async function getCurrentBranch(): Promise<string> {
    try {
      const { stdout } = await execFile('git', ['rev-parse', '--abbrev-ref', 'HEAD'], {
        cwd: basePath,
      })
      return stdout.trim()
    } catch {
      return 'main'
    }
  }

  async function run(): Promise<ConvoyResult> {
    const startTime = Date.now()
    const convoyId = `convoy-${startTime}`
    const specHash = createHash('sha256').update(specYaml).digest('hex')
    const baseBranch = spec.branch ?? (await getCurrentBranch())

    mkdirSync(dirname(dbPath), { recursive: true })
    const store = createConvoyStore(dbPath)
    const events = createEventEmitter(store, options.logsDir)
    const wtManager = options._worktreeManager ?? createWorktreeManager(basePath)
    const mergeQueue = options._mergeQueue ?? createMergeQueue(basePath)

    let result: ConvoyResult
    try {
      store.insertConvoy({
        id: convoyId,
        name: spec.name,
        spec_hash: specHash,
        status: 'pending',
        branch: baseBranch,
        created_at: new Date().toISOString(),
        spec_yaml: specYaml,
        pipeline_id: options.pipelineId ?? null,
      })

      const tasks = spec.tasks ?? []
      const phases = buildPhases(tasks)
      for (let phaseIdx = 0; phaseIdx < phases.length; phaseIdx++) {
        for (const task of phases[phaseIdx]) {
          store.insertTask({
            id: task.id,
            convoy_id: convoyId,
            phase: phaseIdx,
            prompt: task.prompt,
            agent: task.agent,
            adapter: task.adapter ?? null,
            model: task.model ?? null,
            timeout_ms: parseTimeout(task.timeout),
            status: 'pending',
            retries: 0,
            max_retries: task.max_retries,
            files: task.files.length > 0 ? JSON.stringify(task.files) : null,
            depends_on: task.depends_on.length > 0 ? JSON.stringify(task.depends_on) : null,
          })
        }
      }

      store.updateConvoyStatus(convoyId, 'running', { started_at: new Date().toISOString() })
      events.emit('convoy_started', { name: spec.name }, { convoy_id: convoyId })

      result = await runConvoy(
        convoyId, spec, adapter, store, events,
        wtManager, mergeQueue, basePath, baseBranch, verbose, startTime,
      )
    } finally {
      try { await exportConvoyToNdjson(store, convoyId, options.logsDir) } catch { /* silent */ }
      store.close()
    }
    return result
  }

  async function resume(convoyId: string): Promise<ConvoyResult> {
    const startTime = Date.now()

    mkdirSync(dirname(dbPath), { recursive: true })
    const store = createConvoyStore(dbPath)
    const events = createEventEmitter(store, options.logsDir)
    const wtManager = options._worktreeManager ?? createWorktreeManager(basePath)
    const mergeQueue = options._mergeQueue ?? createMergeQueue(basePath)

    let result: ConvoyResult
    try {
      const convoy = store.getConvoy(convoyId)
      if (!convoy) {
        throw new Error(`Convoy "${convoyId}" not found in store`)
      }

      const baseBranch = convoy.branch ?? spec.branch ?? (await getCurrentBranch())

      // Reset interrupted tasks and mark their workers as killed
      const allTasks = store.getTasksByConvoy(convoyId)
      for (const task of allTasks) {
        if (task.status === 'running' || task.status === 'assigned') {
          if (task.worker_id) {
            try {
              store.updateWorkerStatus(task.worker_id, 'killed', {
                finished_at: new Date().toISOString(),
              })
            } catch {
              // worker record may already be absent
            }
          }
          store.updateTaskStatus(task.id, convoyId, 'pending', {
            worker_id: null,
            worktree: null,
            started_at: null,
            finished_at: null,
          })
        }
      }

      // Remove all orphaned worktrees from the crashed run
      await wtManager.removeAll()

      events.emit(
        'convoy_resumed',
        { original_created_at: convoy.created_at },
        { convoy_id: convoyId },
      )

      result = await runConvoy(
        convoyId, spec, adapter, store, events,
        wtManager, mergeQueue, basePath, baseBranch, verbose, startTime,
      )
    } finally {
      try { await exportConvoyToNdjson(store, convoyId, options.logsDir) } catch { /* silent */ }
      store.close()
    }
    return result
  }

  return { run, resume }
}
