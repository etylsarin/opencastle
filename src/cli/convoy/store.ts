import { DatabaseSync } from 'node:sqlite'
import type {
  ConvoyRecord,
  ConvoyStatus,
  TaskRecord,
  ConvoyTaskStatus,
  WorkerRecord,
  WorkerStatus,
  EventRecord,
} from './types.js'

const SCHEMA_VERSION = 1

export interface ConvoyStore {
  insertConvoy(record: Omit<ConvoyRecord, 'started_at' | 'finished_at'>): void
  getConvoy(id: string): ConvoyRecord | undefined
  getLatestConvoy(): ConvoyRecord | undefined
  updateConvoyStatus(
    id: string,
    status: ConvoyStatus,
    extra?: { started_at?: string; finished_at?: string },
  ): void
  insertTask(
    record: Omit<
      TaskRecord,
      'worker_id' | 'worktree' | 'output' | 'exit_code' | 'started_at' | 'finished_at'
    >,
  ): void
  getTask(id: string, convoyId: string): TaskRecord | undefined
  getTasksByConvoy(convoyId: string): TaskRecord[]
  updateTaskStatus(
    id: string,
    convoyId: string,
    status: ConvoyTaskStatus,
    extra?: Partial<
      Pick<TaskRecord, 'worker_id' | 'worktree' | 'output' | 'exit_code' | 'started_at' | 'finished_at' | 'retries'>
    >,
  ): void
  getReadyTasks(convoyId: string): TaskRecord[]
  insertWorker(record: Omit<WorkerRecord, 'finished_at' | 'last_heartbeat'>): void
  getWorker(id: string): WorkerRecord | undefined
  updateWorkerStatus(
    id: string,
    status: WorkerStatus,
    extra?: Partial<Pick<WorkerRecord, 'finished_at' | 'last_heartbeat' | 'pid'>>,
  ): void
  insertEvent(record: Omit<EventRecord, 'id'>): void
  getEvents(convoyId: string): EventRecord[]
  withTransaction<T>(fn: () => T): T
  close(): void
}

class ConvoyStoreImpl implements ConvoyStore {
  private db: DatabaseSync

  constructor(dbPath: string) {
    this.db = new DatabaseSync(dbPath)
    this.db.exec('PRAGMA journal_mode = WAL')
    this.db.exec('PRAGMA synchronous = NORMAL')
    this.initSchema()
  }

  private initSchema(): void {
    const row = this.db.prepare('PRAGMA user_version').get() as { user_version: number }
    if (row.user_version === 0) {
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS convoy (
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

        CREATE TABLE IF NOT EXISTS task (
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

        CREATE TABLE IF NOT EXISTS worker (
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

        CREATE TABLE IF NOT EXISTS event (
          id         INTEGER PRIMARY KEY AUTOINCREMENT,
          convoy_id  TEXT REFERENCES convoy(id),
          task_id    TEXT,
          worker_id  TEXT,
          type       TEXT NOT NULL,
          data       TEXT,
          created_at TEXT NOT NULL
        );
      `)
      this.db.exec(`PRAGMA user_version = ${SCHEMA_VERSION}`)
    }
  }

  insertConvoy(record: Omit<ConvoyRecord, 'started_at' | 'finished_at'>): void {
    this.db
      .prepare(
        `INSERT INTO convoy (id, name, spec_hash, status, branch, created_at, started_at, finished_at, spec_yaml)
         VALUES (:id, :name, :spec_hash, :status, :branch, :created_at, NULL, NULL, :spec_yaml)`,
      )
      .run(record)
  }

  getConvoy(id: string): ConvoyRecord | undefined {
    return this.db
      .prepare('SELECT * FROM convoy WHERE id = :id')
      .get({ id }) as ConvoyRecord | undefined
  }

  getLatestConvoy(): ConvoyRecord | undefined {
    return this.db
      .prepare('SELECT * FROM convoy ORDER BY created_at DESC LIMIT 1')
      .get() as ConvoyRecord | undefined
  }

  updateConvoyStatus(
    id: string,
    status: ConvoyStatus,
    extra?: { started_at?: string; finished_at?: string },
  ): void {
    const sets = ['status = :status']
    const params: Record<string, string | null> = { id, status }

    if (extra?.started_at !== undefined) {
      sets.push('started_at = :started_at')
      params.started_at = extra.started_at
    }
    if (extra?.finished_at !== undefined) {
      sets.push('finished_at = :finished_at')
      params.finished_at = extra.finished_at
    }

    this.db.prepare(`UPDATE convoy SET ${sets.join(', ')} WHERE id = :id`).run(params)
  }

  insertTask(
    record: Omit<
      TaskRecord,
      'worker_id' | 'worktree' | 'output' | 'exit_code' | 'started_at' | 'finished_at'
    >,
  ): void {
    this.db
      .prepare(
        `INSERT INTO task
           (id, convoy_id, phase, prompt, agent, model, timeout_ms, status,
            worker_id, worktree, output, exit_code, started_at, finished_at,
            retries, max_retries, files, depends_on)
         VALUES
           (:id, :convoy_id, :phase, :prompt, :agent, :model, :timeout_ms, :status,
            NULL, NULL, NULL, NULL, NULL, NULL,
            :retries, :max_retries, :files, :depends_on)`,
      )
      .run(record)
  }

  getTask(id: string, convoyId: string): TaskRecord | undefined {
    return this.db
      .prepare('SELECT * FROM task WHERE id = :id AND convoy_id = :convoy_id')
      .get({ id, convoy_id: convoyId }) as TaskRecord | undefined
  }

  getTasksByConvoy(convoyId: string): TaskRecord[] {
    return this.db
      .prepare('SELECT * FROM task WHERE convoy_id = :convoy_id ORDER BY phase, id')
      .all({ convoy_id: convoyId }) as unknown as TaskRecord[]
  }

  updateTaskStatus(
    id: string,
    convoyId: string,
    status: ConvoyTaskStatus,
    extra?: Partial<
      Pick<TaskRecord, 'worker_id' | 'worktree' | 'output' | 'exit_code' | 'started_at' | 'finished_at' | 'retries'>
    >,
  ): void {
    const sets = ['status = :status']
    const params: Record<string, string | number | null> = { id, convoy_id: convoyId, status }
    const extraFields = ['worker_id', 'worktree', 'output', 'exit_code', 'started_at', 'finished_at', 'retries'] as const

    if (extra) {
      for (const field of extraFields) {
        if (field in extra && extra[field] !== undefined) {
          sets.push(`${field} = :${field}`)
          params[field] = extra[field] as string | number | null
        }
      }
    }

    this.db
      .prepare(`UPDATE task SET ${sets.join(', ')} WHERE id = :id AND convoy_id = :convoy_id`)
      .run(params)
  }

  getReadyTasks(convoyId: string): TaskRecord[] {
    const allTasks = this.getTasksByConvoy(convoyId)
    const doneTaskIds = new Set(allTasks.filter(t => t.status === 'done').map(t => t.id))

    return allTasks.filter(task => {
      if (task.status !== 'pending') return false
      if (!task.depends_on) return true
      const deps = JSON.parse(task.depends_on) as string[]
      return deps.length === 0 || deps.every(depId => doneTaskIds.has(depId))
    })
  }

  insertWorker(record: Omit<WorkerRecord, 'finished_at' | 'last_heartbeat'>): void {
    this.db
      .prepare(
        `INSERT INTO worker
           (id, task_id, adapter, pid, session_id, status, worktree, created_at,
            finished_at, last_heartbeat)
         VALUES
           (:id, :task_id, :adapter, :pid, :session_id, :status, :worktree, :created_at,
            NULL, NULL)`,
      )
      .run(record)
  }

  getWorker(id: string): WorkerRecord | undefined {
    return this.db
      .prepare('SELECT * FROM worker WHERE id = :id')
      .get({ id }) as WorkerRecord | undefined
  }

  updateWorkerStatus(
    id: string,
    status: WorkerStatus,
    extra?: Partial<Pick<WorkerRecord, 'finished_at' | 'last_heartbeat' | 'pid'>>,
  ): void {
    const sets = ['status = :status']
    const params: Record<string, string | number | null> = { id, status }

    if (extra?.finished_at !== undefined) {
      sets.push('finished_at = :finished_at')
      params.finished_at = extra.finished_at
    }
    if (extra?.last_heartbeat !== undefined) {
      sets.push('last_heartbeat = :last_heartbeat')
      params.last_heartbeat = extra.last_heartbeat
    }
    if (extra?.pid !== undefined) {
      sets.push('pid = :pid')
      params.pid = extra.pid
    }

    this.db.prepare(`UPDATE worker SET ${sets.join(', ')} WHERE id = :id`).run(params)
  }

  insertEvent(record: Omit<EventRecord, 'id'>): void {
    this.db
      .prepare(
        `INSERT INTO event (convoy_id, task_id, worker_id, type, data, created_at)
         VALUES (:convoy_id, :task_id, :worker_id, :type, :data, :created_at)`,
      )
      .run(record)
  }

  getEvents(convoyId: string): EventRecord[] {
    return this.db
      .prepare('SELECT * FROM event WHERE convoy_id = :convoy_id ORDER BY id')
      .all({ convoy_id: convoyId }) as unknown as EventRecord[]
  }

  withTransaction<T>(fn: () => T): T {
    this.db.exec('BEGIN')
    try {
      const result = fn()
      this.db.exec('COMMIT')
      return result
    } catch (err) {
      this.db.exec('ROLLBACK')
      throw err
    }
  }

  close(): void {
    this.db.close()
  }
}

export function createConvoyStore(dbPath: string): ConvoyStore {
  return new ConvoyStoreImpl(dbPath)
}
