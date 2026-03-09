import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createConvoyEngine } from './engine.js'
import { createConvoyStore } from './store.js'
import type { AgentAdapter, Task, TaskSpec, ExecuteResult, ExecuteOptions } from '../types.js'
import type { WorktreeManager } from './worktree.js'
import type { MergeQueue } from './merge.js'
import { getAdapter, detectAdapter } from '../run/adapters/index.js'

// ── Mock NDJSON log writes ────────────────────────────────────────────────────

vi.mock('../log.js', () => ({
  appendEvent: vi.fn().mockResolvedValue(undefined),
}))

// ── Mock runtime adapter registry ────────────────────────────────────────────

vi.mock('../run/adapters/index.js', () => ({
  getAdapter: vi.fn(),
  detectAdapter: vi.fn(),
}))

// ── Fixture helpers ───────────────────────────────────────────────────────────

type MockAdapter = AgentAdapter & {
  execute: ReturnType<typeof vi.fn>
  kill: ReturnType<typeof vi.fn>
}

type MockWorktreeManager = WorktreeManager & {
  create: ReturnType<typeof vi.fn>
  remove: ReturnType<typeof vi.fn>
  removeAll: ReturnType<typeof vi.fn>
}

type MockMergeQueue = MergeQueue & { merge: ReturnType<typeof vi.fn> }

function makeAdapter(name = 'test-adapter'): MockAdapter {
  return {
    name,
    isAvailable: vi.fn().mockResolvedValue(true),
    execute: vi.fn().mockResolvedValue({
      success: true,
      output: 'ok',
      exitCode: 0,
    } satisfies ExecuteResult),
    kill: vi.fn(),
  } as unknown as MockAdapter
}

function makeWorktreeManager(): MockWorktreeManager {
  return {
    create: vi.fn().mockResolvedValue('/tmp/worktree-mock'),
    remove: vi.fn().mockResolvedValue(undefined),
    list: vi.fn().mockResolvedValue([]),
    removeAll: vi.fn().mockResolvedValue(undefined),
  }
}

function makeMergeQueue(): MockMergeQueue {
  return {
    merge: vi.fn().mockResolvedValue({ success: true, conflicted: false, message: 'ok' }),
  }
}

/** Build a minimal TaskSpec — branch:'main' avoids a git subprocess call. */
function makeSpec(
  specOverrides: Partial<TaskSpec> = {},
  taskOverrides: Partial<Task>[] = [{}],
): TaskSpec {
  const tasks: Task[] = taskOverrides.map((overrides, i) => ({
    id: `task-${i + 1}`,
    prompt: `Prompt for task ${i + 1}`,
    agent: 'developer',
    timeout: '30s',
    depends_on: [],
    files: [],
    description: '',
    max_retries: 0,
    ...overrides,
  }))
  return {
    name: 'Test Convoy',
    concurrency: 1,
    on_failure: 'continue',
    adapter: 'test',
    branch: 'main',
    tasks,
    ...specOverrides,
  }
}

// ── Test lifecycle ────────────────────────────────────────────────────────────

let tmpDir: string
let dbPath: string

beforeEach(() => {
  // Throw by default so accidental unmocked getAdapter/detectAdapter calls surface immediately
  vi.mocked(getAdapter).mockRejectedValue(new Error('unmocked getAdapter call'))
  vi.mocked(detectAdapter).mockRejectedValue(new Error('unmocked detectAdapter call'))
  tmpDir = mkdtempSync(join(tmpdir(), 'engine-test-'))
  dbPath = join(tmpDir, 'convoy.db')
})

afterEach(() => {
  vi.clearAllMocks()
  rmSync(tmpDir, { recursive: true, force: true })
})

// ── 1. Single task success ────────────────────────────────────────────────────

describe('single task success', () => {
  it('returns status done with summary.done=1', async () => {
    const adapter = makeAdapter()
    const engine = createConvoyEngine({
      spec: makeSpec(),
      specYaml: 'name: test',
      adapter,
      dbPath,
      _worktreeManager: makeWorktreeManager(),
      _mergeQueue: makeMergeQueue(),
    })

    const result = await engine.run()

    expect(result.status).toBe('done')
    expect(result.summary.total).toBe(1)
    expect(result.summary.done).toBe(1)
    expect(result.summary.failed).toBe(0)
    expect(result.summary.skipped).toBe(0)
    expect(typeof result.convoyId).toBe('string')
    expect(typeof result.duration).toBe('string')
  })

  it('calls adapter.execute once with the correct task', async () => {
    const adapter = makeAdapter()
    const engine = createConvoyEngine({
      spec: makeSpec(),
      specYaml: 'name: test',
      adapter,
      dbPath,
      _worktreeManager: makeWorktreeManager(),
      _mergeQueue: makeMergeQueue(),
    })

    await engine.run()

    expect(adapter.execute).toHaveBeenCalledOnce()
    const [task] = adapter.execute.mock.calls[0] as [Task]
    expect(task.id).toBe('task-1')
  })
})

// ── 2. Single task failure ────────────────────────────────────────────────────

describe('single task failure', () => {
  it('returns status failed with summary.failed=1 when task errors and no retries allowed', async () => {
    const adapter = makeAdapter()
    adapter.execute.mockResolvedValue({ success: false, output: 'boom', exitCode: 1 })

    const engine = createConvoyEngine({
      spec: makeSpec({}, [{ id: 'task-1', max_retries: 0 }]),
      specYaml: 'name: test',
      adapter,
      dbPath,
      _worktreeManager: makeWorktreeManager(),
      _mergeQueue: makeMergeQueue(),
    })

    const result = await engine.run()

    expect(result.status).toBe('failed')
    expect(result.summary.failed).toBe(1)
    expect(result.summary.done).toBe(0)
  })

  it('calls adapter.kill when the task fails', async () => {
    const adapter = makeAdapter()
    adapter.execute.mockResolvedValue({ success: false, output: 'boom', exitCode: 1 })

    const engine = createConvoyEngine({
      spec: makeSpec({}, [{ id: 'task-1', max_retries: 0 }]),
      specYaml: 'name: test',
      adapter,
      dbPath,
      _worktreeManager: makeWorktreeManager(),
      _mergeQueue: makeMergeQueue(),
    })

    await engine.run()

    expect(adapter.kill).toHaveBeenCalledOnce()
  })
})

// ── 3. Two-phase DAG ─────────────────────────────────────────────────────────

describe('two-phase DAG (task-b depends on task-a)', () => {
  it('executes task-a before task-b and both succeed', async () => {
    const executeOrder: string[] = []
    const adapter = makeAdapter()
    adapter.execute.mockImplementation((task: Task) => {
      executeOrder.push(task.id)
      return Promise.resolve({ success: true, output: 'ok', exitCode: 0 })
    })

    const spec = makeSpec({}, [
      { id: 'task-a', depends_on: [] },
      { id: 'task-b', depends_on: ['task-a'] },
    ])
    const engine = createConvoyEngine({
      spec,
      specYaml: 'name: test',
      adapter,
      dbPath,
      _worktreeManager: makeWorktreeManager(),
      _mergeQueue: makeMergeQueue(),
    })

    const result = await engine.run()

    expect(result.status).toBe('done')
    expect(result.summary.done).toBe(2)
    expect(executeOrder).toEqual(['task-a', 'task-b'])
  })

  it('does not start dependent task until dependency is done', async () => {
    let maxConcurrent = 0
    let active = 0
    const adapter = makeAdapter()
    adapter.execute.mockImplementation(async () => {
      active++
      maxConcurrent = Math.max(maxConcurrent, active)
      await new Promise<void>(r => setTimeout(r, 5))
      active--
      return { success: true, output: 'ok', exitCode: 0 }
    })

    const spec = makeSpec({ concurrency: 4 }, [
      { id: 'task-a', depends_on: [] },
      { id: 'task-b', depends_on: ['task-a'] },
    ])
    const engine = createConvoyEngine({
      spec,
      specYaml: 'name: test',
      adapter,
      dbPath,
      _worktreeManager: makeWorktreeManager(),
      _mergeQueue: makeMergeQueue(),
    })

    await engine.run()

    // Even with high concurrency, dependent tasks may not overlap with their dependency
    expect(maxConcurrent).toBeLessThanOrEqual(1)
  })
})

// ── 4. on_failure:continue ────────────────────────────────────────────────────

describe('on_failure:continue', () => {
  it('skips dependents of the failed task but continues independent tasks', async () => {
    const adapter = makeAdapter()
    adapter.execute.mockImplementation((task: Task) => {
      if (task.id === 'task-a') {
        return Promise.resolve({ success: false, output: 'fail', exitCode: 1 })
      }
      return Promise.resolve({ success: true, output: 'ok', exitCode: 0 })
    })

    // order by id: task-a and task-c are phase 0 (task-a first alphabetically)
    // task-b (depends task-a) is phase 1 and gets skipped
    const spec = makeSpec({ on_failure: 'continue' }, [
      { id: 'task-a', depends_on: [] },
      { id: 'task-b', depends_on: ['task-a'] },
      { id: 'task-c', depends_on: [] },
    ])
    const engine = createConvoyEngine({
      spec,
      specYaml: 'name: test',
      adapter,
      dbPath,
      _worktreeManager: makeWorktreeManager(),
      _mergeQueue: makeMergeQueue(),
    })

    const result = await engine.run()

    expect(result.status).toBe('failed')
    expect(result.summary.failed).toBe(1)
    expect(result.summary.done).toBe(1)
    expect(result.summary.skipped).toBe(1)

    const store = createConvoyStore(dbPath)
    const tasks = store.getTasksByConvoy(result.convoyId)
    store.close()
    const byId = Object.fromEntries(tasks.map(t => [t.id, t.status]))
    expect(byId['task-a']).toBe('failed')
    expect(byId['task-b']).toBe('skipped')
    expect(byId['task-c']).toBe('done')
  })

  it('skips transitive dependents recursively (chain a→b→c)', async () => {
    const adapter = makeAdapter()
    adapter.execute.mockImplementation((task: Task) => {
      if (task.id === 'task-a') {
        return Promise.resolve({ success: false, output: 'fail', exitCode: 1 })
      }
      return Promise.resolve({ success: true, output: 'ok', exitCode: 0 })
    })

    const spec = makeSpec({ on_failure: 'continue' }, [
      { id: 'task-a', depends_on: [] },
      { id: 'task-b', depends_on: ['task-a'] },
      { id: 'task-c', depends_on: ['task-b'] },
    ])
    const engine = createConvoyEngine({
      spec,
      specYaml: 'name: test',
      adapter,
      dbPath,
      _worktreeManager: makeWorktreeManager(),
      _mergeQueue: makeMergeQueue(),
    })

    const result = await engine.run()

    expect(result.summary.failed).toBe(1)
    expect(result.summary.skipped).toBe(2)
    expect(result.summary.done).toBe(0)
  })
})

// ── 5. on_failure:stop ────────────────────────────────────────────────────────

describe('on_failure:stop', () => {
  it('skips all pending tasks when on_failure is stop', async () => {
    const adapter = makeAdapter()
    adapter.execute.mockResolvedValue({ success: false, output: 'fail', exitCode: 1 })

    // task-b and task-c depend on task-a — both pending when task-a fails
    const spec = makeSpec({ on_failure: 'stop' }, [
      { id: 'task-a', depends_on: [] },
      { id: 'task-b', depends_on: ['task-a'] },
      { id: 'task-c', depends_on: ['task-a'] },
    ])
    const engine = createConvoyEngine({
      spec,
      specYaml: 'name: test',
      adapter,
      dbPath,
      _worktreeManager: makeWorktreeManager(),
      _mergeQueue: makeMergeQueue(),
    })

    const result = await engine.run()

    expect(result.status).toBe('failed')
    expect(result.summary.failed).toBe(1)
    expect(result.summary.skipped).toBe(2)
    expect(result.summary.done).toBe(0)

    const store = createConvoyStore(dbPath)
    const tasks = store.getTasksByConvoy(result.convoyId)
    store.close()
    const byId = Object.fromEntries(tasks.map(t => [t.id, t.status]))
    expect(byId['task-a']).toBe('failed')
    expect(byId['task-b']).toBe('skipped')
    expect(byId['task-c']).toBe('skipped')
  })

  it('does not retry when on_failure is stop even if max_retries > 0', async () => {
    const adapter = makeAdapter()
    adapter.execute.mockResolvedValue({ success: false, output: 'fail', exitCode: 1 })

    const spec = makeSpec({ on_failure: 'stop' }, [{ id: 'task-1', max_retries: 3 }])
    const engine = createConvoyEngine({
      spec,
      specYaml: 'name: test',
      adapter,
      dbPath,
      _worktreeManager: makeWorktreeManager(),
      _mergeQueue: makeMergeQueue(),
    })

    await engine.run()

    // No retries — stop mode skips them
    expect(adapter.execute).toHaveBeenCalledOnce()
  })
})

// ── 6. Task retry ─────────────────────────────────────────────────────────────

describe('task retry', () => {
  it('re-runs a task that fails and succeeds on second attempt', async () => {
    const adapter = makeAdapter()
    // Add small delays so Date.now() advances between worker insertions on retry
    adapter.execute
      .mockImplementationOnce(async () => {
        await new Promise(r => setTimeout(r, 5))
        return { success: false, output: 'first attempt failed', exitCode: 1 }
      })
      .mockImplementationOnce(async () => {
        await new Promise(r => setTimeout(r, 5))
        return { success: true, output: 'second attempt ok', exitCode: 0 }
      })

    const spec = makeSpec({}, [{ id: 'task-1', max_retries: 1 }])
    const engine = createConvoyEngine({
      spec,
      specYaml: 'name: test',
      adapter,
      dbPath,
      _worktreeManager: makeWorktreeManager(),
      _mergeQueue: makeMergeQueue(),
    })

    const result = await engine.run()

    expect(result.status).toBe('done')
    expect(result.summary.done).toBe(1)
    expect(adapter.execute).toHaveBeenCalledTimes(2)
  })

  it('marks task as failed when retries are exhausted', async () => {
    const adapter = makeAdapter()
    // Small delay ensures Date.now() advances between each worker insertion on retry
    adapter.execute.mockImplementation(async () => {
      await new Promise(r => setTimeout(r, 5))
      return { success: false, output: 'always fails', exitCode: 1 }
    })

    const spec = makeSpec({}, [{ id: 'task-1', max_retries: 2 }])
    const engine = createConvoyEngine({
      spec,
      specYaml: 'name: test',
      adapter,
      dbPath,
      _worktreeManager: makeWorktreeManager(),
      _mergeQueue: makeMergeQueue(),
    })

    const result = await engine.run()

    // 1 original + 2 retries = 3 total calls
    expect(adapter.execute).toHaveBeenCalledTimes(3)
    expect(result.status).toBe('failed')
    expect(result.summary.failed).toBe(1)
  })
})

// ── 7. Validation gates ───────────────────────────────────────────────────────

describe('validation gates', () => {
  it('returns status done when all gates pass', async () => {
    const adapter = makeAdapter()
    const spec = makeSpec({ gates: ['echo gate-ok'] }, [{ id: 'task-1' }])
    const engine = createConvoyEngine({
      spec,
      specYaml: 'name: test',
      adapter,
      dbPath,
      _worktreeManager: makeWorktreeManager(),
      _mergeQueue: makeMergeQueue(),
    })

    const result = await engine.run()

    expect(result.status).toBe('done')
    expect(result.gateResults).toHaveLength(1)
    expect(result.gateResults![0]).toMatchObject({ command: 'echo gate-ok', exitCode: 0, passed: true })
  })

  it('returns status gate-failed when a gate exits non-zero', async () => {
    const adapter = makeAdapter()
    const spec = makeSpec({ gates: ['false'] }, [{ id: 'task-1' }])
    const engine = createConvoyEngine({
      spec,
      specYaml: 'name: test',
      adapter,
      dbPath,
      _worktreeManager: makeWorktreeManager(),
      _mergeQueue: makeMergeQueue(),
    })

    const result = await engine.run()

    expect(result.status).toBe('gate-failed')
    expect(result.gateResults).toHaveLength(1)
    expect(result.gateResults![0].passed).toBe(false)
  })

  it('returns undefined gateResults when spec has no gates', async () => {
    const adapter = makeAdapter()
    const engine = createConvoyEngine({
      spec: makeSpec(),
      specYaml: 'name: test',
      adapter,
      dbPath,
      _worktreeManager: makeWorktreeManager(),
      _mergeQueue: makeMergeQueue(),
    })

    const result = await engine.run()

    expect(result.gateResults).toBeUndefined()
  })

  it('runs multiple gates and reports each result individually', async () => {
    const adapter = makeAdapter()
    const spec = makeSpec({ gates: ['echo first', 'false', 'echo third'] }, [{ id: 'task-1' }])
    const engine = createConvoyEngine({
      spec,
      specYaml: 'name: test',
      adapter,
      dbPath,
      _worktreeManager: makeWorktreeManager(),
      _mergeQueue: makeMergeQueue(),
    })

    const result = await engine.run()

    expect(result.status).toBe('gate-failed')
    expect(result.gateResults).toHaveLength(3)
    expect(result.gateResults![0].passed).toBe(true)
    expect(result.gateResults![1].passed).toBe(false)
    expect(result.gateResults![2].passed).toBe(true)
  })
})

// ── 8. Resume (crash recovery) ────────────────────────────────────────────────

describe('resume (crash recovery)', () => {
  function seedCrashedConvoy(convoyId: string, taskStatus: 'running' | 'assigned') {
    const seeder = createConvoyStore(dbPath)
    seeder.insertConvoy({
      id: convoyId,
      name: 'Crashed Convoy',
      spec_hash: 'abc123',
      status: 'running',
      branch: 'main',
      created_at: new Date().toISOString(),
      spec_yaml: 'name: test',
    })
    seeder.insertTask({
      id: 'task-1',
      convoy_id: convoyId,
      phase: 0,
      prompt: 'Do something',
      agent: 'developer',
      adapter: null,
      model: null,
      timeout_ms: 30_000,
      status: taskStatus,
      retries: 0,
      max_retries: 0,
      files: null,
      depends_on: null,
    })
    if (taskStatus === 'running') {
      seeder.insertWorker({
        id: 'worker-orphan',
        task_id: 'task-1',
        adapter: 'test',
        pid: null,
        session_id: null,
        status: 'running',
        worktree: null,
        created_at: new Date().toISOString(),
      })
      seeder.updateTaskStatus('task-1', convoyId, 'running', { worker_id: 'worker-orphan' })
    }
    seeder.close()
  }

  it('resets running tasks to pending, calls removeAll, and re-executes them', async () => {
    const convoyId = 'convoy-crashed-running'
    seedCrashedConvoy(convoyId, 'running')

    const adapter = makeAdapter()
    const wtManager = makeWorktreeManager()
    const engine = createConvoyEngine({
      spec: makeSpec({}, [{ id: 'task-1' }]),
      specYaml: 'name: test',
      adapter,
      dbPath,
      _worktreeManager: wtManager,
      _mergeQueue: makeMergeQueue(),
    })

    const result = await engine.resume(convoyId)

    expect(result.status).toBe('done')
    expect(result.summary.done).toBe(1)
    expect(result.convoyId).toBe(convoyId)
    expect(wtManager.removeAll).toHaveBeenCalledOnce()
    expect(adapter.execute).toHaveBeenCalledOnce()
  })

  it('resets assigned (not yet running) tasks to pending on resume', async () => {
    const convoyId = 'convoy-crashed-assigned'
    seedCrashedConvoy(convoyId, 'assigned')

    const adapter = makeAdapter()
    const engine = createConvoyEngine({
      spec: makeSpec({}, [{ id: 'task-1' }]),
      specYaml: 'name: test',
      adapter,
      dbPath,
      _worktreeManager: makeWorktreeManager(),
      _mergeQueue: makeMergeQueue(),
    })

    const result = await engine.resume(convoyId)
    expect(result.status).toBe('done')
    expect(adapter.execute).toHaveBeenCalledOnce()
  })

  it('throws an error when the convoy is not found', async () => {
    const adapter = makeAdapter()
    const engine = createConvoyEngine({
      spec: makeSpec(),
      specYaml: 'name: test',
      adapter,
      dbPath,
      _worktreeManager: makeWorktreeManager(),
      _mergeQueue: makeMergeQueue(),
    })

    await expect(engine.resume('convoy-does-not-exist')).rejects.toThrow(
      'Convoy "convoy-does-not-exist" not found in store',
    )
  })

  it('falls back to spec.branch when convoy.branch is null', async () => {
    // Seed a convoy with branch=null to exercise the ?? fallback chain in resume
    const convoyId = 'convoy-null-branch'
    const seeder = createConvoyStore(dbPath)
    seeder.insertConvoy({
      id: convoyId,
      name: 'Null Branch Convoy',
      spec_hash: 'abc123',
      status: 'running',
      branch: null, // convoy has no recorded branch
      created_at: new Date().toISOString(),
      spec_yaml: 'name: test',
    })
    seeder.insertTask({
      id: 'task-1',
      convoy_id: convoyId,
      phase: 0,
      prompt: 'Do something',
      agent: 'developer',
      adapter: null,
      model: null,
      timeout_ms: 30_000,
      status: 'pending',
      retries: 0,
      max_retries: 0,
      files: null,
      depends_on: null,
    })
    seeder.close()

    const adapter = makeAdapter()
    const engine = createConvoyEngine({
      spec: makeSpec({ branch: 'feature-branch' }), // spec.branch used as fallback
      specYaml: 'name: test',
      adapter,
      dbPath,
      _worktreeManager: makeWorktreeManager(),
      _mergeQueue: makeMergeQueue(),
    })

    const result = await engine.resume(convoyId)
    expect(result.status).toBe('done')
    expect(result.convoyId).toBe(convoyId)
  })

  it('calls getCurrentBranch in resume when convoy.branch and spec.branch are both absent', async () => {
    // Seed a convoy with branch=null; spec also has no branch — triggers getCurrentBranch()
    const convoyId = 'convoy-git-branch-resume'
    const seeder = createConvoyStore(dbPath)
    seeder.insertConvoy({
      id: convoyId,
      name: 'Git Branch Convoy',
      spec_hash: 'abc123',
      status: 'running',
      branch: null,
      created_at: new Date().toISOString(),
      spec_yaml: 'name: test',
    })
    seeder.insertTask({
      id: 'task-1',
      convoy_id: convoyId,
      phase: 0,
      prompt: 'Do something',
      agent: 'developer',
      adapter: null,
      model: null,
      timeout_ms: 30_000,
      status: 'pending',
      retries: 0,
      max_retries: 0,
      files: null,
      depends_on: null,
    })
    seeder.close()

    const adapter = makeAdapter()
    const engine = createConvoyEngine({
      spec: {
        name: 'Git Branch Convoy',
        concurrency: 1,
        on_failure: 'continue',
        adapter: 'test',
        // branch not set — getCurrentBranch() will be called
        tasks: [{ id: 'task-1', prompt: 'p', agent: 'dev', timeout: '30s', depends_on: [], files: [], description: '', max_retries: 0 }],
      },
      specYaml: 'name: git-test',
      adapter,
      dbPath,
      _worktreeManager: makeWorktreeManager(),
      _mergeQueue: makeMergeQueue(),
    })

    const result = await engine.resume(convoyId)
    expect(result.status).toBe('done')
  })
})

// ── 9. Worktree lifecycle for non-copilot adapters ────────────────────────────

describe('worktree lifecycle (non-copilot)', () => {
  it('creates, merges, and removes a worktree on task success', async () => {
    const adapter = makeAdapter('developer')
    const wtManager = makeWorktreeManager()
    const mergeQueue = makeMergeQueue()

    const engine = createConvoyEngine({
      spec: makeSpec(),
      specYaml: 'name: test',
      adapter,
      dbPath,
      _worktreeManager: wtManager,
      _mergeQueue: mergeQueue,
    })

    await engine.run()

    expect(wtManager.create).toHaveBeenCalledOnce()
    expect(mergeQueue.merge).toHaveBeenCalledOnce()
    expect(wtManager.remove).toHaveBeenCalledOnce()
  })

  it('removes the worktree but skips merge when task fails', async () => {
    const adapter = makeAdapter('developer')
    adapter.execute.mockResolvedValue({ success: false, output: 'err', exitCode: 1 })
    const wtManager = makeWorktreeManager()
    const mergeQueue = makeMergeQueue()

    const engine = createConvoyEngine({
      spec: makeSpec({}, [{ id: 'task-1', max_retries: 0 }]),
      specYaml: 'name: test',
      adapter,
      dbPath,
      _worktreeManager: wtManager,
      _mergeQueue: mergeQueue,
    })

    await engine.run()

    expect(wtManager.create).toHaveBeenCalledOnce()
    expect(mergeQueue.merge).not.toHaveBeenCalled()
    expect(wtManager.remove).toHaveBeenCalledOnce()
  })

  it('continues task execution when worktree creation throws', async () => {
    const adapter = makeAdapter('developer')
    const wtManager = makeWorktreeManager()
    wtManager.create.mockRejectedValue(new Error('git worktree unavailable'))
    const mergeQueue = makeMergeQueue()

    const engine = createConvoyEngine({
      spec: makeSpec(),
      specYaml: 'name: test',
      adapter,
      dbPath,
      _worktreeManager: wtManager,
      _mergeQueue: mergeQueue,
    })

    // Task should still succeed even without a worktree
    const result = await engine.run()
    expect(result.status).toBe('done')
    expect(adapter.execute).toHaveBeenCalledOnce()
  })

  it('task still succeeds when merge throws', async () => {
    const adapter = makeAdapter('developer')
    const wtManager = makeWorktreeManager()
    const mergeQueue = makeMergeQueue()
    mergeQueue.merge.mockRejectedValue(new Error('merge conflict'))

    const engine = createConvoyEngine({
      spec: makeSpec(),
      specYaml: 'name: test',
      adapter,
      dbPath,
      _worktreeManager: wtManager,
      _mergeQueue: mergeQueue,
    })

    const result = await engine.run()
    // task is still marked done despite the merge warning
    expect(result.status).toBe('done')
    expect(wtManager.remove).toHaveBeenCalledOnce()
  })
})

// ── 10. Copilot adapter skips worktree ────────────────────────────────────────

describe('copilot adapter', () => {
  it('skips worktree create, merge, and remove for copilot adapter', async () => {
    const adapter = makeAdapter('copilot')
    const wtManager = makeWorktreeManager()
    const mergeQueue = makeMergeQueue()

    const engine = createConvoyEngine({
      spec: makeSpec(),
      specYaml: 'name: test',
      adapter,
      dbPath,
      _worktreeManager: wtManager,
      _mergeQueue: mergeQueue,
    })

    const result = await engine.run()

    expect(result.status).toBe('done')
    expect(wtManager.create).not.toHaveBeenCalled()
    expect(mergeQueue.merge).not.toHaveBeenCalled()
    expect(wtManager.remove).not.toHaveBeenCalled()
  })
})

// ── 11. Timeout handling ──────────────────────────────────────────────────────

describe('timeout handling', () => {
  it('marks a task as timed-out when adapter result carries _timedOut flag', async () => {
    const adapter = makeAdapter()
    // Mirror what makeTimeoutPromise resolves with to exercise the _timedOut branch
    adapter.execute.mockResolvedValue({
      _timedOut: true,
      success: false,
      output: 'Task timed out',
      exitCode: -1,
    } satisfies ExecuteResult)

    const engine = createConvoyEngine({
      spec: makeSpec({}, [{ id: 'task-1', max_retries: 0 }]),
      specYaml: 'name: test',
      adapter,
      dbPath,
      _worktreeManager: makeWorktreeManager(),
      _mergeQueue: makeMergeQueue(),
    })

    const result = await engine.run()

    expect(result.status).toBe('failed')
    expect(result.summary.timedOut).toBe(1)
    expect(adapter.kill).toHaveBeenCalledOnce()
  })

  it('retries a timed-out task when retries remain', async () => {
    const adapter = makeAdapter()
    adapter.execute
      .mockImplementationOnce(async () => {
        await new Promise(r => setTimeout(r, 5))
        return { _timedOut: true, success: false, output: 'timed out', exitCode: -1 }
      })
      .mockImplementationOnce(async () => {
        await new Promise(r => setTimeout(r, 5))
        return { success: true, output: 'ok', exitCode: 0 }
      })

    const engine = createConvoyEngine({
      spec: makeSpec({ on_failure: 'continue' }, [{ id: 'task-1', max_retries: 1 }]),
      specYaml: 'name: test',
      adapter,
      dbPath,
      _worktreeManager: makeWorktreeManager(),
      _mergeQueue: makeMergeQueue(),
    })

    const result = await engine.run()

    expect(result.status).toBe('done')
    expect(adapter.execute).toHaveBeenCalledTimes(2)
  })

  it('does not retry a timed-out task when on_failure is stop', async () => {
    const adapter = makeAdapter()
    adapter.execute.mockResolvedValue({
      _timedOut: true,
      success: false,
      output: 'timed out',
      exitCode: -1,
    })

    const engine = createConvoyEngine({
      spec: makeSpec({ on_failure: 'stop' }, [{ id: 'task-1', max_retries: 2 }]),
      specYaml: 'name: test',
      adapter,
      dbPath,
      _worktreeManager: makeWorktreeManager(),
      _mergeQueue: makeMergeQueue(),
    })

    const result = await engine.run()

    expect(result.summary.timedOut).toBe(1)
    expect(adapter.execute).toHaveBeenCalledOnce()
  })
})

// ── 12. Adapter without kill method ──────────────────────────────────────────

describe('adapter without kill method', () => {
  it('handles missing kill gracefully on task failure', async () => {
    const adapter: AgentAdapter = {
      name: 'no-kill-adapter',
      isAvailable: vi.fn().mockResolvedValue(true),
      execute: vi.fn().mockResolvedValue({ success: false, output: 'err', exitCode: 1 }),
      // kill intentionally absent
    }

    const engine = createConvoyEngine({
      spec: makeSpec({}, [{ id: 'task-1', max_retries: 0 }]),
      specYaml: 'name: test',
      adapter,
      dbPath,
      _worktreeManager: makeWorktreeManager(),
      _mergeQueue: makeMergeQueue(),
    })

    const result = await engine.run()
    expect(result.status).toBe('failed')
  })

  it('handles missing kill gracefully on timeout', async () => {
    const adapter: AgentAdapter = {
      name: 'no-kill-adapter',
      isAvailable: vi.fn().mockResolvedValue(true),
      execute: vi.fn().mockResolvedValue({
        _timedOut: true,
        success: false,
        output: 'timed out',
        exitCode: -1,
      }),
    }

    const engine = createConvoyEngine({
      spec: makeSpec({}, [{ id: 'task-1', max_retries: 0 }]),
      specYaml: 'name: test',
      adapter,
      dbPath,
      _worktreeManager: makeWorktreeManager(),
      _mergeQueue: makeMergeQueue(),
    })

    const result = await engine.run()
    expect(result.summary.timedOut).toBe(1)
  })
})

// ── 13. Parallel task execution ───────────────────────────────────────────────

describe('parallel task execution', () => {
  it('runs independent tasks concurrently when concurrency > 1', async () => {
    let maxActive = 0
    let active = 0
    const adapter = makeAdapter()
    adapter.execute.mockImplementation(async () => {
      active++
      maxActive = Math.max(maxActive, active)
      await new Promise<void>(r => setTimeout(r, 10))
      active--
      return { success: true, output: 'ok', exitCode: 0 }
    })

    const spec = makeSpec({ concurrency: 3 }, [
      { id: 'task-1', depends_on: [] },
      { id: 'task-2', depends_on: [] },
      { id: 'task-3', depends_on: [] },
    ])
    const engine = createConvoyEngine({
      spec,
      specYaml: 'name: test',
      adapter,
      dbPath,
      _worktreeManager: makeWorktreeManager(),
      _mergeQueue: makeMergeQueue(),
    })

    const result = await engine.run()

    expect(result.summary.done).toBe(3)
    expect(maxActive).toBeGreaterThan(1)
  })
})

// ── 14. Executor error (adapter.execute throws) ───────────────────────────────

describe('executor error', () => {
  it('treats a thrown execute error as task failure', async () => {
    const adapter = makeAdapter()
    adapter.execute.mockRejectedValue(new Error('adapter crashed'))

    const engine = createConvoyEngine({
      spec: makeSpec({}, [{ id: 'task-1', max_retries: 0 }]),
      specYaml: 'name: test',
      adapter,
      dbPath,
      _worktreeManager: makeWorktreeManager(),
      _mergeQueue: makeMergeQueue(),
    })

    const result = await engine.run()

    expect(result.status).toBe('failed')
    expect(result.summary.failed).toBe(1)
  })
})

// ── 15. Verbose mode — covers all if(verbose) branches ───────────────────────

describe('verbose mode', () => {
  it('runs a successful task with verbose=true without throwing', async () => {
    const adapter = makeAdapter('developer')
    const engine = createConvoyEngine({
      spec: makeSpec({}, [{ id: 'task-1' }]),
      specYaml: 'name: test',
      adapter,
      verbose: true,
      dbPath,
      _worktreeManager: makeWorktreeManager(),
      _mergeQueue: makeMergeQueue(),
    })

    const result = await engine.run()
    expect(result.status).toBe('done')
  })

  it('runs a failed task with skip cascade with verbose=true without throwing', async () => {
    const adapter = makeAdapter('developer')
    adapter.execute.mockImplementation((task: Task) => {
      if (task.id === 'task-a') return Promise.resolve({ success: false, output: 'fail', exitCode: 1 })
      return Promise.resolve({ success: true, output: 'ok', exitCode: 0 })
    })

    const spec = makeSpec({ on_failure: 'continue' }, [
      { id: 'task-a', depends_on: [] },
      { id: 'task-b', depends_on: ['task-a'] }, // gets skipped — also triggers verbose skip log
    ])
    const engine = createConvoyEngine({
      spec,
      specYaml: 'name: test',
      adapter,
      verbose: true,
      dbPath,
      _worktreeManager: makeWorktreeManager(),
      _mergeQueue: makeMergeQueue(),
    })

    const result = await engine.run()
    expect(result.summary.failed).toBe(1)
    expect(result.summary.skipped).toBe(1)
  })

  it('logs verbose message when retrying a failed task', async () => {
    const adapter = makeAdapter('developer')
    adapter.execute
      .mockImplementationOnce(async () => {
        await new Promise(r => setTimeout(r, 5))
        return { success: false, output: 'first fail', exitCode: 1 }
      })
      .mockImplementationOnce(async () => {
        await new Promise(r => setTimeout(r, 5))
        return { success: true, output: 'ok', exitCode: 0 }
      })

    const engine = createConvoyEngine({
      spec: makeSpec({}, [{ id: 'task-1', max_retries: 1 }]),
      specYaml: 'name: test',
      adapter,
      verbose: true,
      dbPath,
      _worktreeManager: makeWorktreeManager(),
      _mergeQueue: makeMergeQueue(),
    })

    const result = await engine.run()
    expect(result.status).toBe('done')
  })

  it('logs verbose message on permanent timeout', async () => {
    const adapter = makeAdapter()
    adapter.execute.mockResolvedValue({
      _timedOut: true,
      success: false,
      output: 'timed out',
      exitCode: -1,
    })

    const engine = createConvoyEngine({
      spec: makeSpec({}, [{ id: 'task-1', max_retries: 0 }]),
      specYaml: 'name: test',
      adapter,
      verbose: true,
      dbPath,
      _worktreeManager: makeWorktreeManager(),
      _mergeQueue: makeMergeQueue(),
    })

    const result = await engine.run()
    expect(result.summary.timedOut).toBe(1)
  })

  it('logs verbose message when retrying a timed-out task', async () => {
    const adapter = makeAdapter()
    adapter.execute
      .mockImplementationOnce(async () => {
        await new Promise(r => setTimeout(r, 5))
        return { _timedOut: true, success: false, output: 'timed out', exitCode: -1 }
      })
      .mockImplementationOnce(async () => {
        await new Promise(r => setTimeout(r, 5))
        return { success: true, output: 'ok', exitCode: 0 }
      })

    const engine = createConvoyEngine({
      spec: makeSpec({ on_failure: 'continue' }, [{ id: 'task-1', max_retries: 1 }]),
      specYaml: 'name: test',
      adapter,
      verbose: true,
      dbPath,
      _worktreeManager: makeWorktreeManager(),
      _mergeQueue: makeMergeQueue(),
    })

    const result = await engine.run()
    expect(result.status).toBe('done')
  })

  it('logs verbose warning when worktree creation fails', async () => {
    const adapter = makeAdapter('developer')
    const wtManager = makeWorktreeManager()
    wtManager.create.mockRejectedValue(new Error('no worktrees'))

    const engine = createConvoyEngine({
      spec: makeSpec({}, [{ id: 'task-1' }]),
      specYaml: 'name: test',
      adapter,
      verbose: true,
      dbPath,
      _worktreeManager: wtManager,
      _mergeQueue: makeMergeQueue(),
    })

    const result = await engine.run()
    expect(result.status).toBe('done')
  })

  it('logs verbose warning when merge fails', async () => {
    const adapter = makeAdapter('developer')
    const mergeQueue = makeMergeQueue()
    mergeQueue.merge.mockRejectedValue(new Error('merge conflict'))

    const engine = createConvoyEngine({
      spec: makeSpec({}, [{ id: 'task-1' }]),
      specYaml: 'name: test',
      adapter,
      verbose: true,
      dbPath,
      _worktreeManager: makeWorktreeManager(),
      _mergeQueue: mergeQueue,
    })

    const result = await engine.run()
    expect(result.status).toBe('done')
  })
})

// ── 16. msToTimeout branch coverage ──────────────────────────────────────────

describe('msToTimeout — timeout string representation', () => {
  it('runs a task with 1-hour timeout (covers hours branch of msToTimeout)', async () => {
    const adapter = makeAdapter()
    // parseTimeout('1h') = 3600000ms; msToTimeout(3600000) = '1h'
    const spec = makeSpec({}, [{ id: 'task-1', timeout: '1h' }])
    const engine = createConvoyEngine({
      spec,
      specYaml: 'name: test',
      adapter,
      dbPath,
      _worktreeManager: makeWorktreeManager(),
      _mergeQueue: makeMergeQueue(),
    })

    const result = await engine.run()
    expect(result.status).toBe('done')
  })

  it('runs a task with 1-minute timeout (covers minutes branch of msToTimeout)', async () => {
    const adapter = makeAdapter()
    // parseTimeout('1m') = 60000ms; msToTimeout(60000) = '1m'
    const spec = makeSpec({}, [{ id: 'task-1', timeout: '1m' }])
    const engine = createConvoyEngine({
      spec,
      specYaml: 'name: test',
      adapter,
      dbPath,
      _worktreeManager: makeWorktreeManager(),
      _mergeQueue: makeMergeQueue(),
    })

    const result = await engine.run()
    expect(result.status).toBe('done')
  })
})

// ── 17. Per-task adapter resolution ─────────────────────────────────────────

describe('per-task adapter resolution', () => {
  it('uses per-task adapter when task has adapter field set', async () => {
    const mainAdapter = makeAdapter('test')
    const altAdapter = makeAdapter('alt-adapter')
    vi.mocked(getAdapter).mockResolvedValue(altAdapter)

    const spec = makeSpec({}, [{ adapter: 'alt-adapter' }])
    const engine = createConvoyEngine({
      spec,
      specYaml: 'name: test',
      adapter: mainAdapter,
      dbPath,
      _worktreeManager: makeWorktreeManager(),
      _mergeQueue: makeMergeQueue(),
    })

    await engine.run()

    expect(getAdapter).toHaveBeenCalledWith('alt-adapter')
    expect(altAdapter.execute).toHaveBeenCalledOnce()
    expect(mainAdapter.execute).not.toHaveBeenCalled()
  })

  it('uses convoy-level adapter when task has no adapter field', async () => {
    const adapter = makeAdapter('test')
    const spec = makeSpec()
    const engine = createConvoyEngine({
      spec,
      specYaml: 'name: test',
      adapter,
      dbPath,
      _worktreeManager: makeWorktreeManager(),
      _mergeQueue: makeMergeQueue(),
    })

    await engine.run()

    expect(adapter.execute).toHaveBeenCalledOnce()
    expect(getAdapter).not.toHaveBeenCalled()
  })

  it('uses convoy-level adapter when task adapter matches convoy adapter name', async () => {
    const adapter = makeAdapter('test')
    // task.adapter === adapter.name → no per-task resolution
    const spec = makeSpec({}, [{ adapter: 'test' }])
    const engine = createConvoyEngine({
      spec,
      specYaml: 'name: test',
      adapter,
      dbPath,
      _worktreeManager: makeWorktreeManager(),
      _mergeQueue: makeMergeQueue(),
    })

    await engine.run()

    expect(adapter.execute).toHaveBeenCalledOnce()
    expect(getAdapter).not.toHaveBeenCalled()
  })

  it('resolves adapter: auto to detected adapter', async () => {
    const mainAdapter = makeAdapter('test')
    const autoAdapter = makeAdapter('claude-code')
    vi.mocked(detectAdapter).mockResolvedValue('claude-code')
    vi.mocked(getAdapter).mockResolvedValue(autoAdapter)

    const spec = makeSpec({}, [{ adapter: 'auto' }])
    const engine = createConvoyEngine({
      spec,
      specYaml: 'name: test',
      adapter: mainAdapter,
      dbPath,
      _worktreeManager: makeWorktreeManager(),
      _mergeQueue: makeMergeQueue(),
    })

    await engine.run()

    expect(detectAdapter).toHaveBeenCalled()
    expect(getAdapter).toHaveBeenCalledWith('claude-code')
    expect(autoAdapter.execute).toHaveBeenCalledOnce()
    expect(mainAdapter.execute).not.toHaveBeenCalled()
  })

  it('stores per-task adapter name in worker record', async () => {
    const altAdapter = makeAdapter('alt-adapter')
    vi.mocked(getAdapter).mockResolvedValue(altAdapter)

    const spec = makeSpec({}, [{ adapter: 'alt-adapter' }])
    const engine = createConvoyEngine({
      spec,
      specYaml: 'name: test',
      adapter: makeAdapter('test'),
      dbPath,
      _worktreeManager: makeWorktreeManager(),
      _mergeQueue: makeMergeQueue(),
    })

    const result = await engine.run()

    const store = createConvoyStore(dbPath)
    const tasks = store.getTasksByConvoy(result.convoyId)
    const worker = store.getWorker(tasks[0].worker_id!)
    store.close()

    expect(worker!.adapter).toBe('alt-adapter')
  })
})

// ── 18. getCurrentBranch fallback ─────────────────────────────────────────────

describe('getCurrentBranch', () => {
  it('resolves the base branch from git when spec.branch is not set', async () => {
    const adapter = makeAdapter()
    // No spec.branch — forces getCurrentBranch() to call git
    const spec: TaskSpec = {
      name: 'Branch Test',
      concurrency: 1,
      on_failure: 'continue',
      adapter: 'test',
      // branch intentionally omitted
      tasks: [{ id: 'task-1', prompt: 'p', agent: 'dev', timeout: '30s', depends_on: [], files: [], description: '', max_retries: 0 }],
    }

    const engine = createConvoyEngine({
      spec,
      specYaml: 'name: branch-test',
      adapter,
      dbPath,
      _worktreeManager: makeWorktreeManager(),
      _mergeQueue: makeMergeQueue(),
    })

    const result = await engine.run()
    expect(result.status).toBe('done')
  })

  it('falls back to "main" when git command fails (non-git basePath)', async () => {
    const adapter = makeAdapter()
    const spec: TaskSpec = {
      name: 'Fallback Branch Test',
      concurrency: 1,
      on_failure: 'continue',
      adapter: 'test',
      // branch not set — getCurrentBranch will fail because basePath is /tmp
      tasks: [{ id: 'task-1', prompt: 'p', agent: 'dev', timeout: '30s', depends_on: [], files: [], description: '', max_retries: 0 }],
    }

    const engine = createConvoyEngine({
      spec,
      specYaml: 'name: fallback-test',
      adapter,
      basePath: tmpdir(), // not a git repo — git command will fail → fallback to 'main'
      dbPath,
      _worktreeManager: makeWorktreeManager(),
      _mergeQueue: makeMergeQueue(),
    })

    const result = await engine.run()
    expect(result.status).toBe('done')
  })
})

// ── 19. Real timer timeout (covers makeTimeoutPromise callback at line 71) ────

describe('real timer timeout path', () => {
  it('marks task timed-out when the real internal timer fires via fake timers', async () => {
    vi.useFakeTimers()

    const adapter = makeAdapter()
    // adapter.execute returns a promise that never resolves — real timer wins the race
    adapter.execute.mockImplementation(() => new Promise<ExecuteResult>(() => {}))

    const engine = createConvoyEngine({
      spec: makeSpec({}, [{ id: 'task-1', timeout: '1s', max_retries: 0 }]),
      specYaml: 'name: test',
      adapter,
      dbPath,
      _worktreeManager: makeWorktreeManager(),
      _mergeQueue: makeMergeQueue(),
    })

    const runPromise = engine.run()
    // Advance time past the 1s timeout to trigger the internal setTimeout callback
    await vi.advanceTimersByTimeAsync(2000)
    const result = await runPromise

    vi.useRealTimers()

    expect(result.status).toBe('failed')
    expect(result.summary.timedOut).toBe(1)
  })
})

describe('diamond dependency skip', () => {
  it('handles diamond deps gracefully (task-c skipped via two paths)', async () => {
    const adapter = makeAdapter()
    adapter.execute.mockImplementation((task: Task) => {
      if (task.id === 'task-a') return Promise.resolve({ success: false, output: 'fail', exitCode: 1 })
      return Promise.resolve({ success: true, output: 'ok', exitCode: 0 })
    })

    // Diamond: task-a → task-b → task-c AND task-a → task-c directly
    // When task-a fails, cascadeFailure tries to skip task-b and task-c directly.
    // skipTask(task-b) recursively skips task-c first.
    // Then when cascadeFailure tries skipTask(task-c) directly, task-c.status !== 'pending' → early return.
    const spec = makeSpec({ on_failure: 'continue' }, [
      { id: 'task-a', depends_on: [] },
      { id: 'task-b', depends_on: ['task-a'] },
      { id: 'task-c', depends_on: ['task-a', 'task-b'] }, // diamond
    ])
    const engine = createConvoyEngine({
      spec,
      specYaml: 'name: test',
      adapter,
      dbPath,
      _worktreeManager: makeWorktreeManager(),
      _mergeQueue: makeMergeQueue(),
    })

    const result = await engine.run()

    expect(result.summary.failed).toBe(1)
    expect(result.summary.skipped).toBe(2) // task-b and task-c both skipped
    expect(result.summary.done).toBe(0)

    const store = createConvoyStore(dbPath)
    const tasks = store.getTasksByConvoy(result.convoyId)
    store.close()
    const byId = Object.fromEntries(tasks.map(t => [t.id, t.status]))
    expect(byId['task-a']).toBe('failed')
    expect(byId['task-b']).toBe('skipped')
    expect(byId['task-c']).toBe('skipped')
  })
})

// ── 21. Cost tracking (usage propagation) ────────────────────────────────────

describe('cost tracking', () => {
  it('persists usage data to task record when adapter returns usage', async () => {
    const adapter = makeAdapter()
    adapter.execute.mockResolvedValue({
      success: true,
      output: 'ok',
      exitCode: 0,
      usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 },
    } satisfies ExecuteResult)

    const engine = createConvoyEngine({
      spec: makeSpec(),
      specYaml: 'name: test',
      adapter,
      dbPath,
      _worktreeManager: makeWorktreeManager(),
      _mergeQueue: makeMergeQueue(),
    })

    const result = await engine.run()
    expect(result.status).toBe('done')

    const store = createConvoyStore(dbPath)
    const tasks = store.getTasksByConvoy(result.convoyId)
    store.close()
    expect(tasks[0].prompt_tokens).toBe(100)
    expect(tasks[0].completion_tokens).toBe(50)
    expect(tasks[0].total_tokens).toBe(150)
  })

  it('leaves cost fields null when adapter returns no usage', async () => {
    const adapter = makeAdapter()
    // default makeAdapter returns no usage field

    const engine = createConvoyEngine({
      spec: makeSpec(),
      specYaml: 'name: test',
      adapter,
      dbPath,
      _worktreeManager: makeWorktreeManager(),
      _mergeQueue: makeMergeQueue(),
    })

    const result = await engine.run()

    const store = createConvoyStore(dbPath)
    const tasks = store.getTasksByConvoy(result.convoyId)
    store.close()
    expect(tasks[0].prompt_tokens).toBeNull()
    expect(tasks[0].completion_tokens).toBeNull()
    expect(tasks[0].total_tokens).toBeNull()
  })

  it('aggregates total_tokens from multiple tasks to convoy record', async () => {
    const adapter = makeAdapter()
    adapter.execute
      .mockResolvedValueOnce({ success: true, output: 'ok', exitCode: 0, usage: { total_tokens: 100 } })
      .mockResolvedValueOnce({ success: true, output: 'ok', exitCode: 0, usage: { total_tokens: 200 } })

    const spec = makeSpec({ concurrency: 2 }, [
      { id: 'task-1', depends_on: [] },
      { id: 'task-2', depends_on: [] },
    ])
    const engine = createConvoyEngine({
      spec,
      specYaml: 'name: test',
      adapter,
      dbPath,
      _worktreeManager: makeWorktreeManager(),
      _mergeQueue: makeMergeQueue(),
    })

    const result = await engine.run()

    const store = createConvoyStore(dbPath)
    const convoy = store.getConvoy(result.convoyId)
    store.close()
    expect(convoy!.total_tokens).toBe(300)
  })

  it('includes cost in ConvoyResult when usage is available', async () => {
    const adapter = makeAdapter()
    adapter.execute.mockResolvedValue({
      success: true,
      output: 'ok',
      exitCode: 0,
      usage: { total_tokens: 75 },
    } satisfies ExecuteResult)

    const engine = createConvoyEngine({
      spec: makeSpec(),
      specYaml: 'name: test',
      adapter,
      dbPath,
      _worktreeManager: makeWorktreeManager(),
      _mergeQueue: makeMergeQueue(),
    })

    const result = await engine.run()

    expect(result.cost).toEqual({ total_tokens: 75 })
  })

  it('omits cost from ConvoyResult when no usage data is available', async () => {
    const adapter = makeAdapter()
    // default makeAdapter returns no usage

    const engine = createConvoyEngine({
      spec: makeSpec(),
      specYaml: 'name: test',
      adapter,
      dbPath,
      _worktreeManager: makeWorktreeManager(),
      _mergeQueue: makeMergeQueue(),
    })

    const result = await engine.run()

    expect(result.cost).toBeUndefined()
  })

  it('partial usage fields are persisted correctly (only total_tokens set)', async () => {
    const adapter = makeAdapter()
    adapter.execute.mockResolvedValue({
      success: true,
      output: 'ok',
      exitCode: 0,
      usage: { total_tokens: 42 },
    } satisfies ExecuteResult)

    const engine = createConvoyEngine({
      spec: makeSpec(),
      specYaml: 'name: test',
      adapter,
      dbPath,
      _worktreeManager: makeWorktreeManager(),
      _mergeQueue: makeMergeQueue(),
    })

    const result = await engine.run()

    const store = createConvoyStore(dbPath)
    const tasks = store.getTasksByConvoy(result.convoyId)
    store.close()
    expect(tasks[0].total_tokens).toBe(42)
    expect(tasks[0].prompt_tokens).toBeNull()
    expect(tasks[0].completion_tokens).toBeNull()
  })

  it('convoy total_tokens is null when no task has usage', async () => {
    const adapter = makeAdapter()
    // default adapter returns no usage

    const engine = createConvoyEngine({
      spec: makeSpec({ concurrency: 2 }, [
        { id: 'task-1', depends_on: [] },
        { id: 'task-2', depends_on: [] },
      ]),
      specYaml: 'name: test',
      adapter,
      dbPath,
      _worktreeManager: makeWorktreeManager(),
      _mergeQueue: makeMergeQueue(),
    })

    const result = await engine.run()

    const store = createConvoyStore(dbPath)
    const convoy = store.getConvoy(result.convoyId)
    store.close()
    expect(convoy!.total_tokens).toBeNull()
    expect(result.cost).toBeUndefined()
  })
})

// ── 22. Progress reporting (always-on output) ─────────────────────────────────

describe('progress reporting', () => {
  let stdoutSpy: ReturnType<typeof vi.spyOn>
  let writtenChunks: string[]

  beforeEach(() => {
    writtenChunks = []
    stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation((data) => {
      writtenChunks.push(String(data))
      return true
    })
  })

  afterEach(() => {
    stdoutSpy.mockRestore()
  })

  it('prints task start message without verbose flag', async () => {
    const adapter = makeAdapter()
    const engine = createConvoyEngine({
      spec: makeSpec(),
      specYaml: 'name: test',
      adapter,
      dbPath,
      _worktreeManager: makeWorktreeManager(),
      _mergeQueue: makeMergeQueue(),
    })

    await engine.run()

    const written = writtenChunks.join('')
    expect(written).toContain('[task-1]')
    expect(written).toMatch(/▶/)
  })

  it('prints task completion with counter', async () => {
    const adapter = makeAdapter()
    const engine = createConvoyEngine({
      spec: makeSpec(),
      specYaml: 'name: test',
      adapter,
      dbPath,
      _worktreeManager: makeWorktreeManager(),
      _mergeQueue: makeMergeQueue(),
    })

    await engine.run()

    const written = writtenChunks.join('')
    expect(written).toContain('[1/1]')
    expect(written).toMatch(/✓/)
  })

  it('prints task failure with counter', async () => {
    const adapter = makeAdapter()
    adapter.execute.mockResolvedValue({ success: false, output: 'boom', exitCode: 1 })

    const engine = createConvoyEngine({
      spec: makeSpec({}, [{ id: 'task-1', max_retries: 0 }]),
      specYaml: 'name: test',
      adapter,
      dbPath,
      _worktreeManager: makeWorktreeManager(),
      _mergeQueue: makeMergeQueue(),
    })

    await engine.run()

    const written = writtenChunks.join('')
    expect(written).toContain('[1/1]')
    expect(written).toMatch(/✗/)
  })

  it('prints phase headers when tasks span multiple phases', async () => {
    const adapter = makeAdapter()
    const spec = makeSpec({}, [
      { id: 'task-a', depends_on: [] },
      { id: 'task-b', depends_on: ['task-a'] },
    ])
    const engine = createConvoyEngine({
      spec,
      specYaml: 'name: test',
      adapter,
      dbPath,
      _worktreeManager: makeWorktreeManager(),
      _mergeQueue: makeMergeQueue(),
    })

    await engine.run()

    const written = writtenChunks.join('')
    expect(written).toContain('Phase 1:')
    expect(written).toContain('Phase 2:')
  })

  it('prints gate results with pass/fail indicators', async () => {
    const adapter = makeAdapter()
    const spec = makeSpec({ gates: ['echo gate-ok', 'false'] }, [{ id: 'task-1' }])
    const engine = createConvoyEngine({
      spec,
      specYaml: 'name: test',
      adapter,
      dbPath,
      _worktreeManager: makeWorktreeManager(),
      _mergeQueue: makeMergeQueue(),
    })

    await engine.run()

    const written = writtenChunks.join('')
    expect(written).toContain('Gates:')
    expect(written).toContain('echo gate-ok')
    expect(written).toContain('false')
  })

  it('prints retry messages when a task fails and is retried', async () => {
    const adapter = makeAdapter()
    adapter.execute
      .mockImplementationOnce(async () => {
        await new Promise(r => setTimeout(r, 5))
        return { success: false, output: 'fail', exitCode: 1 }
      })
      .mockImplementationOnce(async () => {
        await new Promise(r => setTimeout(r, 5))
        return { success: true, output: 'ok', exitCode: 0 }
      })

    const engine = createConvoyEngine({
      spec: makeSpec({}, [{ id: 'task-1', max_retries: 1 }]),
      specYaml: 'name: test',
      adapter,
      dbPath,
      _worktreeManager: makeWorktreeManager(),
      _mergeQueue: makeMergeQueue(),
    })

    await engine.run()

    const written = writtenChunks.join('')
    expect(written).toMatch(/⟳/)
    expect(written).toContain('retry 1/1')
  })
})

// ── 23. Gate retry mechanism ──────────────────────────────────────────────────

describe('gate retry mechanism', () => {
  let tmpDir: string
  let adapter: MockAdapter
  let wtManager: MockWorktreeManager
  let mergeQueue: MockMergeQueue

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'convoy-gate-retry-'))
    adapter = makeAdapter()
    wtManager = makeWorktreeManager()
    mergeQueue = makeMergeQueue()
  })

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true })
  })

  it('gates pass on first attempt when gate_retries > 0 — no fix task run', async () => {
    const spec = makeSpec(
      { gates: [`node -e "process.exit(0)"`], gate_retries: 1 },
      [{ id: 'task-1' }],
    )
    const engine = createConvoyEngine({
      spec,
      specYaml: 'name: test',
      adapter,
      basePath: tmpDir,
      _worktreeManager: wtManager,
      _mergeQueue: mergeQueue,
    })
    const result = await engine.run()
    expect(result.status).toBe('done')
    // Only task-1 executed, no fix task needed
    expect(adapter.execute).toHaveBeenCalledTimes(1)
  })

  it('defaults gate_retries to 0 (no retry on gate failure)', async () => {
    const spec = makeSpec({ gates: ['false'] }, [{ id: 'task-1' }])
    const engine = createConvoyEngine({
      spec,
      specYaml: 'name: test',
      adapter,
      basePath: tmpDir,
      _worktreeManager: wtManager,
      _mergeQueue: mergeQueue,
    })
    const result = await engine.run()
    expect(result.status).toBe('gate-failed')
    // No fix task attempted — only task-1 was executed
    expect(adapter.execute).toHaveBeenCalledTimes(1)
  })

  it('calls adapter.execute with fix prompt when gates fail and retries available', async () => {
    const spec = makeSpec({ gates: ['false'], gate_retries: 1 }, [{ id: 'task-1' }])
    const engine = createConvoyEngine({
      spec,
      specYaml: 'name: test',
      adapter,
      basePath: tmpDir,
      _worktreeManager: wtManager,
      _mergeQueue: mergeQueue,
    })
    const result = await engine.run()
    // The fix task should have been called (adapter.execute called for task-1 + gate-fix-1)
    expect(adapter.execute).toHaveBeenCalledTimes(2)
    // The second call should be the fix task
    const fixCall = adapter.execute.mock.calls[1] as [Task]
    expect(fixCall[0].id).toBe('gate-fix-1')
    expect(fixCall[0].prompt).toContain('validation gates failed')
    // Gates still fail after fix, so final status is gate-failed
    expect(result.status).toBe('gate-failed')
  })

  it('stops retrying when fix task fails', async () => {
    adapter.execute
      .mockResolvedValueOnce({ success: true, output: 'ok', exitCode: 0 }) // task-1
      .mockResolvedValueOnce({ success: false, output: 'fix failed', exitCode: 1 }) // gate-fix-1
    const spec = makeSpec({ gates: ['false'], gate_retries: 2 }, [{ id: 'task-1' }])
    const engine = createConvoyEngine({
      spec,
      specYaml: 'name: test',
      adapter,
      basePath: tmpDir,
      _worktreeManager: wtManager,
      _mergeQueue: mergeQueue,
    })
    const result = await engine.run()
    // Only 2 adapter calls: task-1 + one failed fix attempt (no second retry)
    expect(adapter.execute).toHaveBeenCalledTimes(2)
    expect(result.status).toBe('gate-failed')
  })
})
