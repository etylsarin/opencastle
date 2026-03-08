import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { createConvoyStore } from './store.js'
import type { ConvoyStore } from './store.js'

// ── helpers ───────────────────────────────────────────────────────────────────

let tmpDir: string
let dbPath: string
let store: ConvoyStore

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), 'convoy-test-'))
  dbPath = join(tmpDir, 'test.db')
  store = createConvoyStore(dbPath)
})

afterEach(() => {
  store.close()
  rmSync(tmpDir, { recursive: true, force: true })
})

function makeConvoy(overrides: Partial<Parameters<ConvoyStore['insertConvoy']>[0]> = {}) {
  return {
    id: 'convoy-1',
    name: 'Test Convoy',
    spec_hash: 'abc123',
    status: 'pending' as const,
    branch: null,
    created_at: new Date().toISOString(),
    spec_yaml: 'name: test',
    ...overrides,
  }
}

function makeTask(overrides: Partial<Parameters<ConvoyStore['insertTask']>[0]> = {}) {
  return {
    id: 'task-1',
    convoy_id: 'convoy-1',
    phase: 0,
    prompt: 'Do something',
    agent: 'developer',
    adapter: null as string | null,
    model: null,
    timeout_ms: 1_800_000,
    status: 'pending' as const,
    retries: 0,
    max_retries: 1,
    files: null,
    depends_on: null,
    ...overrides,
  }
}

function makeWorker(overrides: Partial<Parameters<ConvoyStore['insertWorker']>[0]> = {}) {
  return {
    id: 'worker-1',
    task_id: null,
    adapter: 'copilot',
    pid: null,
    session_id: null,
    status: 'spawned' as const,
    worktree: null,
    created_at: new Date().toISOString(),
    ...overrides,
  }
}

// ── DB creation and WAL mode ──────────────────────────────────────────────────

describe('DB creation', () => {
  it('creates the database file at the given path', async () => {
    const { existsSync } = await import('node:fs')
    expect(existsSync(dbPath)).toBe(true)
  })

  it('sets WAL journal mode', () => {
    const db = new DatabaseSync(dbPath)
    const row = db.prepare('PRAGMA journal_mode').get() as { journal_mode: string }
    db.close()
    expect(row.journal_mode).toBe('wal')
  })

  it('sets schema version to 2', () => {
    const db = new DatabaseSync(dbPath)
    const row = db.prepare('PRAGMA user_version').get() as { user_version: number }
    db.close()
    expect(row.user_version).toBe(2)
  })

  it('creates all required tables', () => {
    const db = new DatabaseSync(dbPath)
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
      .all() as { name: string }[]
    db.close()
    const names = tables.map(t => t.name).sort()
    expect(names).toContain('convoy')
    expect(names).toContain('task')
    expect(names).toContain('worker')
    expect(names).toContain('event')
  })

  it('reopening an existing DB does not reset schema version', () => {
    store.close()
    const store2 = createConvoyStore(dbPath)
    const db = new DatabaseSync(dbPath)
    const row = db.prepare('PRAGMA user_version').get() as { user_version: number }
    db.close()
    store2.close()
    // Reassign so afterEach does not double-close
    store = createConvoyStore(dbPath)
    expect(row.user_version).toBe(2)
  })
})

// ── schema migration ─────────────────────────────────────────────────────────

describe('schema migration', () => {
  it('schema migration v1 to v2 adds adapter column', () => {
    // Create a v1 database manually: task table without adapter column
    const v1DbPath = join(tmpDir, 'v1.db')
    const rawDb = new DatabaseSync(v1DbPath)
    rawDb.exec(`
      CREATE TABLE convoy (
        id          TEXT PRIMARY KEY,
        name        TEXT NOT NULL,
        spec_hash   TEXT NOT NULL,
        status      TEXT NOT NULL DEFAULT 'pending',
        branch      TEXT,
        created_at  TEXT NOT NULL,
        started_at  TEXT,
        finished_at TEXT,
        spec_yaml   TEXT NOT NULL
      );
      CREATE TABLE task (
        id          TEXT PRIMARY KEY,
        convoy_id   TEXT NOT NULL REFERENCES convoy(id),
        phase       INTEGER NOT NULL,
        prompt      TEXT NOT NULL,
        agent       TEXT NOT NULL DEFAULT 'developer',
        model       TEXT,
        timeout_ms  INTEGER NOT NULL DEFAULT 1800000,
        status      TEXT NOT NULL DEFAULT 'pending',
        worker_id   TEXT,
        worktree    TEXT,
        output      TEXT,
        exit_code   INTEGER,
        started_at  TEXT,
        finished_at TEXT,
        retries     INTEGER NOT NULL DEFAULT 0,
        max_retries INTEGER NOT NULL DEFAULT 1,
        files       TEXT,
        depends_on  TEXT
      );
      CREATE TABLE worker (
        id             TEXT PRIMARY KEY,
        task_id        TEXT REFERENCES task(id),
        adapter        TEXT NOT NULL,
        pid            INTEGER,
        session_id     TEXT,
        status         TEXT NOT NULL DEFAULT 'spawned',
        worktree       TEXT,
        created_at     TEXT NOT NULL,
        finished_at    TEXT,
        last_heartbeat TEXT
      );
      CREATE TABLE event (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        convoy_id  TEXT REFERENCES convoy(id),
        task_id    TEXT,
        worker_id  TEXT,
        type       TEXT NOT NULL,
        data       TEXT,
        created_at TEXT NOT NULL
      );
    `)
    rawDb.exec('PRAGMA user_version = 1')
    rawDb.close()

    // Open with createConvoyStore — should apply the v1→v2 migration
    const v1Store = createConvoyStore(v1DbPath)
    v1Store.close()

    // Verify adapter column was added to task table
    const verifyDb = new DatabaseSync(v1DbPath)
    const cols = verifyDb.prepare('PRAGMA table_info(task)').all() as Array<{ name: string }>
    const version = verifyDb.prepare('PRAGMA user_version').get() as { user_version: number }
    verifyDb.close()

    expect(cols.map(c => c.name)).toContain('adapter')
    expect(version.user_version).toBe(2)
  })
})

// ── convoy CRUD ───────────────────────────────────────────────────────────────

describe('convoy CRUD', () => {
  it('inserts and retrieves a convoy record', () => {
    const record = makeConvoy()
    store.insertConvoy(record)
    const retrieved = store.getConvoy('convoy-1')
    expect(retrieved).toBeDefined()
    expect(retrieved!.id).toBe('convoy-1')
    expect(retrieved!.name).toBe('Test Convoy')
    expect(retrieved!.status).toBe('pending')
    expect(retrieved!.started_at).toBeNull()
    expect(retrieved!.finished_at).toBeNull()
  })

  it('returns undefined for missing convoy', () => {
    expect(store.getConvoy('does-not-exist')).toBeUndefined()
  })

  it('updates convoy status', () => {
    store.insertConvoy(makeConvoy())
    store.updateConvoyStatus('convoy-1', 'running')
    expect(store.getConvoy('convoy-1')!.status).toBe('running')
  })

  it('updates convoy status with started_at', () => {
    const ts = '2026-01-01T00:00:00.000Z'
    store.insertConvoy(makeConvoy())
    store.updateConvoyStatus('convoy-1', 'running', { started_at: ts })
    const retrieved = store.getConvoy('convoy-1')!
    expect(retrieved.status).toBe('running')
    expect(retrieved.started_at).toBe(ts)
  })

  it('updates convoy status with finished_at', () => {
    const ts = '2026-01-01T01:00:00.000Z'
    store.insertConvoy(makeConvoy())
    store.updateConvoyStatus('convoy-1', 'done', { finished_at: ts })
    const retrieved = store.getConvoy('convoy-1')!
    expect(retrieved.status).toBe('done')
    expect(retrieved.finished_at).toBe(ts)
  })
})

// ── task CRUD ─────────────────────────────────────────────────────────────────

describe('task CRUD', () => {
  beforeEach(() => {
    store.insertConvoy(makeConvoy())
  })

  it('inserts and retrieves a task record', () => {
    store.insertTask(makeTask())
    const retrieved = store.getTask('task-1', 'convoy-1')
    expect(retrieved).toBeDefined()
    expect(retrieved!.id).toBe('task-1')
    expect(retrieved!.convoy_id).toBe('convoy-1')
    expect(retrieved!.status).toBe('pending')
    expect(retrieved!.worker_id).toBeNull()
    expect(retrieved!.output).toBeNull()
  })

  it('returns undefined for missing task', () => {
    expect(store.getTask('does-not-exist', 'convoy-1')).toBeUndefined()
  })

  it('insertTask stores adapter field', () => {
    store.insertTask(makeTask({ adapter: 'opencode' }))
    const retrieved = store.getTask('task-1', 'convoy-1')!
    expect(retrieved.adapter).toBe('opencode')
  })

  it('stores JSON fields as strings', () => {
    const task = makeTask({
      id: 'task-json',
      files: JSON.stringify(['src/a.ts', 'src/b.ts']),
      depends_on: JSON.stringify(['task-prev']),
    })
    store.insertTask(task)
    const retrieved = store.getTask('task-json', 'convoy-1')!
    expect(JSON.parse(retrieved.files!)).toEqual(['src/a.ts', 'src/b.ts'])
    expect(JSON.parse(retrieved.depends_on!)).toEqual(['task-prev'])
  })

  it('retrieves all tasks for a convoy ordered by phase', () => {
    store.insertTask(makeTask({ id: 'task-2', phase: 1 }))
    store.insertTask(makeTask({ id: 'task-1', phase: 0 }))
    const tasks = store.getTasksByConvoy('convoy-1')
    expect(tasks).toHaveLength(2)
    expect(tasks[0].phase).toBe(0)
    expect(tasks[1].phase).toBe(1)
  })

  it('updates task status', () => {
    store.insertTask(makeTask())
    store.updateTaskStatus('task-1', 'convoy-1', 'running')
    expect(store.getTask('task-1', 'convoy-1')!.status).toBe('running')
  })

  it('updates task status with extra fields', () => {
    const ts = '2026-01-01T00:00:00.000Z'
    store.insertTask(makeTask())
    store.updateTaskStatus('task-1', 'convoy-1', 'done', {
      output: 'Task complete',
      exit_code: 0,
      finished_at: ts,
      retries: 1,
    })
    const task = store.getTask('task-1', 'convoy-1')!
    expect(task.status).toBe('done')
    expect(task.output).toBe('Task complete')
    expect(task.exit_code).toBe(0)
    expect(task.finished_at).toBe(ts)
    expect(task.retries).toBe(1)
  })
})

// ── getReadyTasks ─────────────────────────────────────────────────────────────

describe('getReadyTasks', () => {
  beforeEach(() => {
    store.insertConvoy(makeConvoy())
  })

  it('returns a pending task with no dependencies', () => {
    store.insertTask(makeTask({ id: 'task-a', depends_on: null }))
    const ready = store.getReadyTasks('convoy-1')
    expect(ready.map(t => t.id)).toContain('task-a')
  })

  it('returns a pending task with empty depends_on array', () => {
    store.insertTask(makeTask({ id: 'task-a', depends_on: JSON.stringify([]) }))
    const ready = store.getReadyTasks('convoy-1')
    expect(ready.map(t => t.id)).toContain('task-a')
  })

  it('returns a task when its single dependency is done', () => {
    store.insertTask(makeTask({ id: 'task-dep', depends_on: null }))
    store.insertTask(makeTask({ id: 'task-a', depends_on: JSON.stringify(['task-dep']) }))
    store.updateTaskStatus('task-dep', 'convoy-1', 'done')
    const ready = store.getReadyTasks('convoy-1')
    expect(ready.map(t => t.id)).toContain('task-a')
  })

  it('does not return a task when its single dependency is not done', () => {
    store.insertTask(makeTask({ id: 'task-dep', depends_on: null }))
    store.insertTask(makeTask({ id: 'task-a', depends_on: JSON.stringify(['task-dep']) }))
    // task-dep stays pending
    const ready = store.getReadyTasks('convoy-1')
    expect(ready.map(t => t.id)).not.toContain('task-a')
  })

  it('returns a task when all multiple dependencies are done', () => {
    store.insertTask(makeTask({ id: 'dep-1', depends_on: null }))
    store.insertTask(makeTask({ id: 'dep-2', depends_on: null }))
    store.insertTask(makeTask({ id: 'task-a', depends_on: JSON.stringify(['dep-1', 'dep-2']) }))
    store.updateTaskStatus('dep-1', 'convoy-1', 'done')
    store.updateTaskStatus('dep-2', 'convoy-1', 'done')
    const ready = store.getReadyTasks('convoy-1')
    expect(ready.map(t => t.id)).toContain('task-a')
  })

  it('does not return a task when only some of multiple dependencies are done', () => {
    store.insertTask(makeTask({ id: 'dep-1', depends_on: null }))
    store.insertTask(makeTask({ id: 'dep-2', depends_on: null }))
    store.insertTask(makeTask({ id: 'task-a', depends_on: JSON.stringify(['dep-1', 'dep-2']) }))
    store.updateTaskStatus('dep-1', 'convoy-1', 'done')
    // dep-2 stays pending
    const ready = store.getReadyTasks('convoy-1')
    expect(ready.map(t => t.id)).not.toContain('task-a')
  })

  it('does not return tasks that are already running', () => {
    store.insertTask(makeTask({ id: 'task-a', depends_on: null }))
    store.updateTaskStatus('task-a', 'convoy-1', 'running')
    const ready = store.getReadyTasks('convoy-1')
    expect(ready.map(t => t.id)).not.toContain('task-a')
  })

  it('does not return tasks that are already done', () => {
    store.insertTask(makeTask({ id: 'task-a', depends_on: null }))
    store.updateTaskStatus('task-a', 'convoy-1', 'done')
    const ready = store.getReadyTasks('convoy-1')
    expect(ready.map(t => t.id)).not.toContain('task-a')
  })

  it('returns empty array when no tasks are ready', () => {
    store.insertTask(makeTask({ id: 'dep-1', depends_on: null, status: 'running' }))
    store.insertTask(makeTask({ id: 'task-a', depends_on: JSON.stringify(['dep-1']) }))
    const ready = store.getReadyTasks('convoy-1')
    expect(ready.map(t => t.id)).not.toContain('task-a')
  })

  it('returns empty array for a convoy with no tasks', () => {
    const ready = store.getReadyTasks('convoy-1')
    expect(ready).toHaveLength(0)
  })
})

// ── worker CRUD ───────────────────────────────────────────────────────────────

describe('worker CRUD', () => {
  it('inserts and retrieves a worker record', () => {
    store.insertWorker(makeWorker())
    const retrieved = store.getWorker('worker-1')
    expect(retrieved).toBeDefined()
    expect(retrieved!.id).toBe('worker-1')
    expect(retrieved!.adapter).toBe('copilot')
    expect(retrieved!.status).toBe('spawned')
    expect(retrieved!.finished_at).toBeNull()
    expect(retrieved!.last_heartbeat).toBeNull()
  })

  it('returns undefined for missing worker', () => {
    expect(store.getWorker('does-not-exist')).toBeUndefined()
  })

  it('updates worker status', () => {
    store.insertWorker(makeWorker())
    store.updateWorkerStatus('worker-1', 'running')
    expect(store.getWorker('worker-1')!.status).toBe('running')
  })

  it('updates worker status with finished_at and pid', () => {
    const ts = '2026-01-01T01:00:00.000Z'
    store.insertWorker(makeWorker())
    store.updateWorkerStatus('worker-1', 'done', { finished_at: ts, pid: 12345 })
    const worker = store.getWorker('worker-1')!
    expect(worker.status).toBe('done')
    expect(worker.finished_at).toBe(ts)
    expect(worker.pid).toBe(12345)
  })

  it('updates worker last_heartbeat', () => {
    const ts = '2026-01-01T00:30:00.000Z'
    store.insertWorker(makeWorker())
    store.updateWorkerStatus('worker-1', 'running', { last_heartbeat: ts })
    expect(store.getWorker('worker-1')!.last_heartbeat).toBe(ts)
  })
})

// ── event CRUD ────────────────────────────────────────────────────────────────

describe('event CRUD', () => {
  beforeEach(() => {
    store.insertConvoy(makeConvoy())
  })

  it('inserts and retrieves events for a convoy', () => {
    store.insertEvent({
      convoy_id: 'convoy-1',
      task_id: null,
      worker_id: null,
      type: 'convoy_started',
      data: JSON.stringify({ msg: 'hello' }),
      created_at: new Date().toISOString(),
    })
    const events = store.getEvents('convoy-1')
    expect(events).toHaveLength(1)
    expect(events[0].type).toBe('convoy_started')
    expect(events[0].convoy_id).toBe('convoy-1')
    expect(JSON.parse(events[0].data!)).toEqual({ msg: 'hello' })
  })

  it('returns events ordered by id (insertion order)', () => {
    const now = new Date().toISOString()
    store.insertEvent({ convoy_id: 'convoy-1', task_id: null, worker_id: null, type: 'first', data: null, created_at: now })
    store.insertEvent({ convoy_id: 'convoy-1', task_id: null, worker_id: null, type: 'second', data: null, created_at: now })
    store.insertEvent({ convoy_id: 'convoy-1', task_id: null, worker_id: null, type: 'third', data: null, created_at: now })
    const events = store.getEvents('convoy-1')
    expect(events.map(e => e.type)).toEqual(['first', 'second', 'third'])
  })

  it('returns empty array for convoy with no events', () => {
    expect(store.getEvents('convoy-1')).toHaveLength(0)
  })

  it('assigns autoincrement id', () => {
    const now = new Date().toISOString()
    store.insertEvent({ convoy_id: 'convoy-1', task_id: null, worker_id: null, type: 'ev', data: null, created_at: now })
    store.insertEvent({ convoy_id: 'convoy-1', task_id: null, worker_id: null, type: 'ev2', data: null, created_at: now })
    const events = store.getEvents('convoy-1')
    expect(typeof events[0].id).toBe('number')
    expect(events[1].id).toBeGreaterThan(events[0].id!)
  })
})

// ── withTransaction ───────────────────────────────────────────────────────────

describe('withTransaction', () => {
  beforeEach(() => {
    store.insertConvoy(makeConvoy())
  })

  it('commits on success and returns the result', () => {
    const result = store.withTransaction(() => {
      store.insertTask(makeTask())
      return 'done'
    })
    expect(result).toBe('done')
    expect(store.getTask('task-1', 'convoy-1')).toBeDefined()
  })

  it('rolls back on error and re-throws', () => {
    expect(() => {
      store.withTransaction(() => {
        store.insertTask(makeTask())
        throw new Error('forced error')
      })
    }).toThrow('forced error')

    expect(store.getTask('task-1', 'convoy-1')).toBeUndefined()
  })

  it('supports nested data operations inside transaction', () => {
    const ts = new Date().toISOString()
    store.withTransaction(() => {
      store.insertTask(makeTask({ id: 'task-alpha' }))
      store.updateTaskStatus('task-alpha', 'convoy-1', 'running', { started_at: ts })
    })
    const task = store.getTask('task-alpha', 'convoy-1')!
    expect(task.status).toBe('running')
    expect(task.started_at).toBe(ts)
  })
})

// ── close ─────────────────────────────────────────────────────────────────────

describe('close', () => {
  it('closes without error when DB is open', () => {
    const freshStore = createConvoyStore(join(tmpDir, 'fresh.db'))
    expect(() => freshStore.close()).not.toThrow()
  })
})
