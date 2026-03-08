import { DatabaseSync } from 'node:sqlite'
import type {
  ConvoyRecord,
  ConvoyStatus,
  TaskRecord,
  ConvoyTaskStatus,
  WorkerRecord,
  WorkerStatus,
  EventRecord,
  PipelineRecord,
  PipelineStatus,
} from './types.js'

const SCHEMA_VERSION = 4

export interface ConvoyStore {
  insertConvoy(record: Omit<ConvoyRecord, 'started_at' | 'finished_at' | 'total_tokens' | 'total_cost_usd' | 'pipeline_id'> & { pipeline_id?: string | null }): void
  getConvoy(id: string): ConvoyRecord | undefined
  getLatestConvoy(): ConvoyRecord | undefined
  updateConvoyStatus(
    id: string,
    status: ConvoyStatus,
    extra?: { started_at?: string; finished_at?: string; total_tokens?: number | null; total_cost_usd?: string | null },
  ): void
  insertTask(
    record: Omit<
      TaskRecord,
      'worker_id' | 'worktree' | 'output' | 'exit_code' | 'started_at' | 'finished_at' | 'prompt_tokens' | 'completion_tokens' | 'total_tokens' | 'cost_usd'
    >,
  ): void
  getTask(id: string, convoyId: string): TaskRecord | undefined
  getTasksByConvoy(convoyId: string): TaskRecord[]
  updateTaskStatus(
    id: string,
    convoyId: string,
    status: ConvoyTaskStatus,
    extra?: Partial<
      Pick<TaskRecord, 'worker_id' | 'worktree' | 'output' | 'exit_code' | 'started_at' | 'finished_at' | 'retries' | 'prompt_tokens' | 'completion_tokens' | 'total_tokens' | 'cost_usd'>
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
  insertPipeline(record: Omit<PipelineRecord, 'started_at' | 'finished_at' | 'total_tokens' | 'total_cost_usd'>): void
  getPipeline(id: string): PipelineRecord | undefined
  getLatestPipeline(): PipelineRecord | undefined
  updatePipelineStatus(
    id: string,
    status: PipelineStatus,
    extra?: { started_at?: string; finished_at?: string; total_tokens?: number | null; total_cost_usd?: string | null },
  ): void
  getConvoysByPipeline(pipelineId: string): ConvoyRecord[]
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
    let version = (this.db.prepare('PRAGMA user_version').get() as { user_version: number }).user_version
    if (version === 0) {
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS convoy (
          id          TEXT PRIMARY KEY,
          name        TEXT NOT NULL,
          spec_hash   TEXT NOT NULL,
          status      TEXT NOT NULL DEFAULT 'pending',
          branch      TEXT,
          created_at  TEXT NOT NULL,
          started_at  TEXT,
          finished_at    TEXT,
          spec_yaml      TEXT NOT NULL,
          total_tokens   INTEGER,
          total_cost_usd TEXT,
          pipeline_id    TEXT
        );

        CREATE TABLE IF NOT EXISTS pipeline (
          id              TEXT PRIMARY KEY,
          name            TEXT NOT NULL,
          status          TEXT NOT NULL DEFAULT 'pending',
          branch          TEXT,
          spec_yaml       TEXT NOT NULL,
          convoy_specs    TEXT NOT NULL,
          created_at      TEXT NOT NULL,
          started_at      TEXT,
          finished_at     TEXT,
          total_tokens    INTEGER,
          total_cost_usd  TEXT
        );

        CREATE TABLE IF NOT EXISTS task (
          id          TEXT PRIMARY KEY,
          convoy_id   TEXT NOT NULL REFERENCES convoy(id),
          phase       INTEGER NOT NULL,
          prompt      TEXT NOT NULL,
          agent       TEXT NOT NULL DEFAULT 'developer',
          adapter     TEXT,
          model       TEXT,
          timeout_ms  INTEGER NOT NULL DEFAULT 1800000,
          status      TEXT NOT NULL DEFAULT 'pending',
          worker_id   TEXT,
          worktree    TEXT,
          output      TEXT,
          exit_code   INTEGER,
          started_at  TEXT,
          finished_at TEXT,
          retries           INTEGER NOT NULL DEFAULT 0,
          max_retries       INTEGER NOT NULL DEFAULT 1,
          files             TEXT,
          depends_on        TEXT,
          prompt_tokens     INTEGER,
          completion_tokens INTEGER,
          total_tokens      INTEGER,
          cost_usd          TEXT
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
      version = SCHEMA_VERSION
    }
    if (version === 1) {
      this.db.exec('ALTER TABLE task ADD COLUMN adapter TEXT')
      this.db.exec('PRAGMA user_version = 2')
      version = 2
    }
    if (version === 2) {
      this.db.exec('ALTER TABLE task ADD COLUMN prompt_tokens INTEGER')
      this.db.exec('ALTER TABLE task ADD COLUMN completion_tokens INTEGER')
      this.db.exec('ALTER TABLE task ADD COLUMN total_tokens INTEGER')
      this.db.exec('ALTER TABLE task ADD COLUMN cost_usd TEXT')
      this.db.exec('ALTER TABLE convoy ADD COLUMN total_tokens INTEGER')
      this.db.exec('ALTER TABLE convoy ADD COLUMN total_cost_usd TEXT')
      this.db.exec('PRAGMA user_version = 3')
      version = 3
    }
    if (version === 3) {
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS pipeline (
          id              TEXT PRIMARY KEY,
          name            TEXT NOT NULL,
          status          TEXT NOT NULL DEFAULT 'pending',
          branch          TEXT,
          spec_yaml       TEXT NOT NULL,
          convoy_specs    TEXT NOT NULL,
          created_at      TEXT NOT NULL,
          started_at      TEXT,
          finished_at     TEXT,
          total_tokens    INTEGER,
          total_cost_usd  TEXT
        )
      `)
      this.db.exec('ALTER TABLE convoy ADD COLUMN pipeline_id TEXT')
      this.db.exec('PRAGMA user_version = 4')
      version = 4
    }
  }

  insertConvoy(record: Omit<ConvoyRecord, 'started_at' | 'finished_at' | 'total_tokens' | 'total_cost_usd' | 'pipeline_id'> & { pipeline_id?: string | null }): void {
    this.db
      .prepare(
        `INSERT INTO convoy (id, name, spec_hash, status, branch, created_at, started_at, finished_at, spec_yaml, pipeline_id)
         VALUES (:id, :name, :spec_hash, :status, :branch, :created_at, NULL, NULL, :spec_yaml, :pipeline_id)`,
      )
      .run({ ...record, pipeline_id: record.pipeline_id ?? null })
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
    extra?: { started_at?: string; finished_at?: string; total_tokens?: number | null; total_cost_usd?: string | null },
  ): void {
    const sets = ['status = :status']
    const params: Record<string, string | number | null> = { id, status }

    if (extra?.started_at !== undefined) {
      sets.push('started_at = :started_at')
      params.started_at = extra.started_at
    }
    if (extra?.finished_at !== undefined) {
      sets.push('finished_at = :finished_at')
      params.finished_at = extra.finished_at
    }
    if (extra?.total_tokens !== undefined) {
      sets.push('total_tokens = :total_tokens')
      params.total_tokens = extra.total_tokens
    }
    if (extra?.total_cost_usd !== undefined) {
      sets.push('total_cost_usd = :total_cost_usd')
      params.total_cost_usd = extra.total_cost_usd
    }

    this.db.prepare(`UPDATE convoy SET ${sets.join(', ')} WHERE id = :id`).run(params)
  }

  insertTask(
    record: Omit<
      TaskRecord,
      'worker_id' | 'worktree' | 'output' | 'exit_code' | 'started_at' | 'finished_at' | 'prompt_tokens' | 'completion_tokens' | 'total_tokens' | 'cost_usd'
    >,
  ): void {
    this.db
      .prepare(
        `INSERT INTO task
           (id, convoy_id, phase, prompt, agent, adapter, model, timeout_ms, status,
            worker_id, worktree, output, exit_code, started_at, finished_at,
            retries, max_retries, files, depends_on)
         VALUES
           (:id, :convoy_id, :phase, :prompt, :agent, :adapter, :model, :timeout_ms, :status,
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
      Pick<TaskRecord, 'worker_id' | 'worktree' | 'output' | 'exit_code' | 'started_at' | 'finished_at' | 'retries' | 'prompt_tokens' | 'completion_tokens' | 'total_tokens' | 'cost_usd'>
    >,
  ): void {
    const sets = ['status = :status']
    const params: Record<string, string | number | null> = { id, convoy_id: convoyId, status }
    const extraFields = ['worker_id', 'worktree', 'output', 'exit_code', 'started_at', 'finished_at', 'retries', 'prompt_tokens', 'completion_tokens', 'total_tokens', 'cost_usd'] as const

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

  insertPipeline(record: Omit<PipelineRecord, 'started_at' | 'finished_at' | 'total_tokens' | 'total_cost_usd'>): void {
    this.db
      .prepare(
        `INSERT INTO pipeline (id, name, status, branch, spec_yaml, convoy_specs, created_at,
           started_at, finished_at, total_tokens, total_cost_usd)
         VALUES (:id, :name, :status, :branch, :spec_yaml, :convoy_specs, :created_at,
           NULL, NULL, NULL, NULL)`,
      )
      .run(record)
  }

  getPipeline(id: string): PipelineRecord | undefined {
    return this.db
      .prepare('SELECT * FROM pipeline WHERE id = :id')
      .get({ id }) as PipelineRecord | undefined
  }

  getLatestPipeline(): PipelineRecord | undefined {
    return this.db
      .prepare('SELECT * FROM pipeline ORDER BY created_at DESC LIMIT 1')
      .get() as PipelineRecord | undefined
  }

  updatePipelineStatus(
    id: string,
    status: PipelineStatus,
    extra?: { started_at?: string; finished_at?: string; total_tokens?: number | null; total_cost_usd?: string | null },
  ): void {
    const sets = ['status = :status']
    const params: Record<string, string | number | null> = { id, status }

    if (extra?.started_at !== undefined) {
      sets.push('started_at = :started_at')
      params.started_at = extra.started_at
    }
    if (extra?.finished_at !== undefined) {
      sets.push('finished_at = :finished_at')
      params.finished_at = extra.finished_at
    }
    if (extra?.total_tokens !== undefined) {
      sets.push('total_tokens = :total_tokens')
      params.total_tokens = extra.total_tokens
    }
    if (extra?.total_cost_usd !== undefined) {
      sets.push('total_cost_usd = :total_cost_usd')
      params.total_cost_usd = extra.total_cost_usd
    }

    this.db.prepare(`UPDATE pipeline SET ${sets.join(', ')} WHERE id = :id`).run(params)
  }

  getConvoysByPipeline(pipelineId: string): ConvoyRecord[] {
    return this.db
      .prepare('SELECT * FROM convoy WHERE pipeline_id = :pipeline_id ORDER BY created_at')
      .all({ pipeline_id: pipelineId }) as unknown as ConvoyRecord[]
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
