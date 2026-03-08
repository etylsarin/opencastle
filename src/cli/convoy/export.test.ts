import { mkdtempSync, rmSync, readFileSync, existsSync, realpathSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { exportConvoyToNdjson } from './export.js'
import { createConvoyStore } from './store.js'
import type { ConvoyStore } from './store.js'
import type { ConvoyTaskStatus } from './types.js'

vi.mock('../log.js', () => ({
  appendEvent: vi.fn().mockResolvedValue(undefined),
}))

const NOW = '2026-03-08T10:00:00.000Z'

let tmpDir: string
let store: ConvoyStore

function insertConvoy(id: string, name = 'Test Convoy') {
  store.insertConvoy({
    id,
    name,
    spec_hash: 'abc123',
    status: 'done',
    branch: 'main',
    created_at: NOW,
    spec_yaml: 'name: test',
  })
  store.updateConvoyStatus(id, 'done', { started_at: NOW, finished_at: NOW })
}

function insertTask(
  taskId: string,
  convoyId: string,
  phase = 1,
  status: ConvoyTaskStatus = 'done',
) {
  store.insertTask({
    id: taskId,
    convoy_id: convoyId,
    phase,
    prompt: 'Do something',
    agent: 'developer',
    adapter: 'claude-code',
    model: null,
    timeout_ms: 1_800_000,
    status,
    retries: 0,
    max_retries: 1,
    files: null,
    depends_on: null,
  })
  if (status !== 'pending') {
    store.updateTaskStatus(taskId, convoyId, status, {
      started_at: NOW,
      finished_at: NOW,
      retries: 0,
    })
  }
}

function insertEvent(convoyId: string) {
  store.insertEvent({
    convoy_id: convoyId,
    task_id: null,
    worker_id: null,
    type: 'convoy.started',
    data: null,
    created_at: NOW,
  })
}

beforeEach(() => {
  tmpDir = realpathSync(mkdtempSync(join(tmpdir(), 'convoy-export-test-')))
  store = createConvoyStore(join(tmpDir, 'convoy.db'))
})

afterEach(() => {
  store.close()
  rmSync(tmpDir, { recursive: true, force: true })
})

describe('exportConvoyToNdjson', () => {
  it('creates convoys.ndjson with valid NDJSON', async () => {
    insertConvoy('c1')
    insertTask('t1', 'c1')
    const logsDir = join(tmpDir, 'logs')

    await exportConvoyToNdjson(store, 'c1', logsDir)

    const outFile = join(logsDir, 'convoys.ndjson')
    expect(existsSync(outFile)).toBe(true)
    const line = readFileSync(outFile, 'utf8').trimEnd()
    expect(() => JSON.parse(line)).not.toThrow()
  })

  it('appends on multiple exports (2 convoys -> 2 lines)', async () => {
    insertConvoy('c1')
    insertConvoy('c2', 'Second Convoy')
    const logsDir = join(tmpDir, 'logs')

    await exportConvoyToNdjson(store, 'c1', logsDir)
    await exportConvoyToNdjson(store, 'c2', logsDir)

    const content = readFileSync(join(logsDir, 'convoys.ndjson'), 'utf8')
    const lines = content.trim().split('\n').filter(Boolean)
    expect(lines).toHaveLength(2)
    expect(JSON.parse(lines[0]).id).toBe('c1')
    expect(JSON.parse(lines[1]).id).toBe('c2')
  })

  it('required fields present', async () => {
    insertConvoy('c1')
    insertTask('t1', 'c1', 1, 'done')
    insertTask('t2', 'c1', 1, 'failed')
    insertEvent('c1')
    const logsDir = join(tmpDir, 'logs')

    await exportConvoyToNdjson(store, 'c1', logsDir)

    const record = JSON.parse(readFileSync(join(logsDir, 'convoys.ndjson'), 'utf8').trim())
    expect(record.id).toBe('c1')
    expect(record.name).toBe('Test Convoy')
    expect(record.status).toBe('done')
    expect(Array.isArray(record.tasks)).toBe(true)
    expect(record.tasks).toHaveLength(2)
    expect(record.tasks[0]).toMatchObject({
      id: 't1',
      phase: 1,
      agent: 'developer',
      adapter: 'claude-code',
      status: 'done',
      retries: 0,
    })
    expect(record.summary).toMatchObject({ total: 2, done: 1, failed: 1, skipped: 0, timedOut: 0 })
    expect(record.events_count).toBe(1)
  })

  it('missing convoy -> no error, no file', async () => {
    const logsDir = join(tmpDir, 'logs')
    await expect(exportConvoyToNdjson(store, 'nonexistent', logsDir)).resolves.toBeUndefined()
    expect(existsSync(join(logsDir, 'convoys.ndjson'))).toBe(false)
  })

  it('creates directory if missing', async () => {
    insertConvoy('c1')
    const logsDir = join(tmpDir, 'deep', 'nested', 'logs')

    await exportConvoyToNdjson(store, 'c1', logsDir)

    expect(existsSync(join(logsDir, 'convoys.ndjson'))).toBe(true)
  })

  it('respects custom logsDir', async () => {
    insertConvoy('c1')
    const customDir = join(tmpDir, 'custom-output')

    await exportConvoyToNdjson(store, 'c1', customDir)

    const outFile = join(customDir, 'convoys.ndjson')
    expect(existsSync(outFile)).toBe(true)
    const record = JSON.parse(readFileSync(outFile, 'utf8').trim())
    expect(record.id).toBe('c1')
  })

  it('never throws on store error — writes warning to stderr', async () => {
    const broken = {
      getConvoy: () => { throw new Error('db exploded') },
    } as unknown as ConvoyStore
    const stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true)

    await expect(exportConvoyToNdjson(broken, 'c1', join(tmpDir, 'logs'))).resolves.toBeUndefined()
    expect(stderrSpy).toHaveBeenCalledWith(expect.stringContaining('exportConvoyToNdjson warning'))

    stderrSpy.mockRestore()
  })

  it('defaults to .opencastle/logs when logsDir is omitted', async () => {
    insertConvoy('c1')
    const originalCwd = process.cwd()
    process.chdir(tmpDir)
    try {
      await exportConvoyToNdjson(store, 'c1')
      const outFile = join(tmpDir, '.opencastle', 'logs', 'convoys.ndjson')
      expect(existsSync(outFile)).toBe(true)
    } finally {
      process.chdir(originalCwd)
    }
  })
})
