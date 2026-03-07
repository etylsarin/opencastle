import { mkdtempSync, readFileSync, rmSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createConvoyStore } from './store.js'
import { createEventEmitter } from './events.js'
import type { ConvoyStore } from './store.js'

vi.mock('../log.js', () => ({
  appendEvent: vi.fn().mockResolvedValue(undefined),
}))

import { appendEvent } from '../log.js'
const mockAppend = vi.mocked(appendEvent)

let tmpDir: string
let store: ConvoyStore

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), 'emitter-test-'))
  store = createConvoyStore(join(tmpDir, 'test.db'))
  vi.clearAllMocks()

  store.insertConvoy({
    id: 'c1',
    name: 'Test',
    spec_hash: 'x',
    status: 'pending',
    branch: null,
    created_at: new Date().toISOString(),
    spec_yaml: 'name: test',
  })
})

afterEach(() => {
  store.close()
  rmSync(tmpDir, { recursive: true, force: true })
})

describe('createEventEmitter', () => {
  it('inserts the event into SQLite', () => {
    const emitter = createEventEmitter(store)
    emitter.emit('task_started', { msg: 'started' }, { convoy_id: 'c1' })
    const events = store.getEvents('c1')
    expect(events).toHaveLength(1)
    expect(events[0].type).toBe('task_started')
    expect(events[0].convoy_id).toBe('c1')
  })

  it('serializes event data to JSON in SQLite', () => {
    const emitter = createEventEmitter(store)
    emitter.emit('task_done', { exitCode: 0, output: 'ok' }, { convoy_id: 'c1' })
    const events = store.getEvents('c1')
    const parsed = JSON.parse(events[0].data!)
    expect(parsed.exitCode).toBe(0)
    expect(parsed.output).toBe('ok')
  })

  it('stores null data when no data object is provided', () => {
    const emitter = createEventEmitter(store)
    emitter.emit('heartbeat', undefined, { convoy_id: 'c1' })
    const events = store.getEvents('c1')
    expect(events[0].data).toBeNull()
  })

  it('calls appendEvent for NDJSON dual-write', () => {
    const emitter = createEventEmitter(store)
    emitter.emit('convoy_started', { name: 'test' }, { convoy_id: 'c1' })
    expect(mockAppend).toHaveBeenCalledOnce()
  })

  it('passes logs dir to appendEvent', () => {
    const emitter = createEventEmitter(store, '/some/logs')
    emitter.emit('convoy_started', {}, { convoy_id: 'c1' })
    expect(mockAppend).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'convoy_started', convoy_id: 'c1' }),
      '/some/logs',
    )
  })

  it('defaults all ids to null when ids are not provided', () => {
    const emitter = createEventEmitter(store)
    emitter.emit('generic_event')
    const db = require('node:sqlite').DatabaseSync
    // Verify via NDJSON mock payload
    expect(mockAppend).toHaveBeenCalledWith(
      expect.objectContaining({
        convoy_id: null,
        task_id: null,
        worker_id: null,
      }),
      null,
    )
  })

  it('includes all provided ids in the NDJSON record', () => {
    const emitter = createEventEmitter(store, tmpDir)
    emitter.emit('worker_spawned', {}, { convoy_id: 'c1', task_id: 't1', worker_id: 'w1' })
    expect(mockAppend).toHaveBeenCalledWith(
      expect.objectContaining({ convoy_id: 'c1', task_id: 't1', worker_id: 'w1' }),
      tmpDir,
    )
  })

  it('SQLite event stores correct ids', () => {
    const emitter = createEventEmitter(store)
    emitter.emit('worker_done', {}, { convoy_id: 'c1', task_id: 'task-x', worker_id: 'wkr-y' })
    const events = store.getEvents('c1')
    expect(events[0].task_id).toBe('task-x')
    expect(events[0].worker_id).toBe('wkr-y')
  })

  it('does not throw if NDJSON write fails', () => {
    mockAppend.mockRejectedValueOnce(new Error('disk full'))
    const emitter = createEventEmitter(store)
    expect(() => emitter.emit('test', {}, { convoy_id: 'c1' })).not.toThrow()
  })
})
