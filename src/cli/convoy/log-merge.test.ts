import { mkdtempSync, rmSync, realpathSync, mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mergeConvoyLogs } from '../log.js'

const CONVOYS_REL = '.opencastle/logs/convoys'
const OUTPUT_REL = '.opencastle/logs/convoy-events.ndjson'

function makeBase(): string {
  const dir = realpathSync(mkdtempSync(join(tmpdir(), 'log-merge-test-')))
  mkdirSync(join(dir, CONVOYS_REL), { recursive: true })
  return dir
}

function writeConvoyFile(base: string, convoyId: string, records: object[]): void {
  const path = join(base, CONVOYS_REL, `${convoyId}.ndjson`)
  writeFileSync(path, records.map(r => JSON.stringify(r)).join('\n') + '\n', 'utf8')
}

let tmpDir: string

beforeEach(() => {
  tmpDir = makeBase()
})

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true })
})

describe('mergeConvoyLogs', () => {
  it('returns zeros when convoys directory is missing', async () => {
    rmSync(join(tmpDir, '.opencastle'), { recursive: true, force: true })
    const result = await mergeConvoyLogs({ basePath: tmpDir })
    expect(result).toEqual({ merged: 0, deduplicated: 0, written: 0 })
  })

  it('returns zeros when convoys directory is empty', async () => {
    const result = await mergeConvoyLogs({ basePath: tmpDir })
    expect(result).toEqual({ merged: 0, deduplicated: 0, written: 0 })
  })

  it('merges records from 3 convoy files', async () => {
    writeConvoyFile(tmpDir, 'convoy-a', [
      { _event_id: 1, timestamp: '2026-01-01T10:00:00.000Z', type: 'task_started' },
    ])
    writeConvoyFile(tmpDir, 'convoy-b', [
      { _event_id: 2, timestamp: '2026-01-02T10:00:00.000Z', type: 'task_done' },
    ])
    writeConvoyFile(tmpDir, 'convoy-c', [
      { _event_id: 3, timestamp: '2026-01-03T10:00:00.000Z', type: 'session' },
    ])

    const result = await mergeConvoyLogs({ basePath: tmpDir })
    expect(result.merged).toBe(3)
    expect(result.written).toBe(3)
  })

  it('output is sorted by timestamp ascending', async () => {
    writeConvoyFile(tmpDir, 'convoy-z', [
      { _event_id: 10, timestamp: '2026-03-01T00:00:00.000Z', type: 'task_done' },
      { _event_id: 11, timestamp: '2026-01-01T00:00:00.000Z', type: 'task_started' },
    ])
    writeConvoyFile(tmpDir, 'convoy-a', [
      { _event_id: 12, timestamp: '2026-02-01T00:00:00.000Z', type: 'session' },
    ])

    const outputPath = join(tmpDir, 'merged.ndjson')
    await mergeConvoyLogs({ basePath: tmpDir, output: outputPath })

    const lines = readFileSync(outputPath, 'utf8').split('\n').filter(l => l.trim())
    const timestamps = lines.map(l => (JSON.parse(l) as { timestamp: string }).timestamp)
    expect(timestamps).toEqual([
      '2026-01-01T00:00:00.000Z',
      '2026-02-01T00:00:00.000Z',
      '2026-03-01T00:00:00.000Z',
    ])
  })

  it('deduplicates records by _event_id (keeps first occurrence)', async () => {
    writeConvoyFile(tmpDir, 'convoy-a', [
      { _event_id: 5, timestamp: '2026-01-01T00:00:00.000Z', type: 'task_started', note: 'first' },
    ])
    writeConvoyFile(tmpDir, 'convoy-b', [
      { _event_id: 5, timestamp: '2026-01-01T00:00:00.000Z', type: 'task_started', note: 'duplicate' },
      { _event_id: 6, timestamp: '2026-01-02T00:00:00.000Z', type: 'task_done' },
    ])

    const outputPath = join(tmpDir, 'merged.ndjson')
    const result = await mergeConvoyLogs({ basePath: tmpDir, output: outputPath })

    expect(result.merged).toBe(3)
    expect(result.deduplicated).toBe(1)
    expect(result.written).toBe(2)

    const lines = readFileSync(outputPath, 'utf8').split('\n').filter(l => l.trim())
    expect(lines).toHaveLength(2)
    const first = JSON.parse(lines[0]) as { note: string }
    expect(first.note).toBe('first')
  })

  it('filters by --since (inclusive)', async () => {
    writeConvoyFile(tmpDir, 'convoy-a', [
      { _event_id: 1, timestamp: '2026-01-01T00:00:00.000Z', type: 'session' },
      { _event_id: 2, timestamp: '2026-02-01T00:00:00.000Z', type: 'session' },
      { _event_id: 3, timestamp: '2026-03-01T00:00:00.000Z', type: 'session' },
    ])

    const outputPath = join(tmpDir, 'merged.ndjson')
    const result = await mergeConvoyLogs({ basePath: tmpDir, since: '2026-02-01T00:00:00.000Z', output: outputPath })

    expect(result.written).toBe(2)
    const lines = readFileSync(outputPath, 'utf8').split('\n').filter(l => l.trim())
    expect(lines).toHaveLength(2)
  })

  it('filters by --until (inclusive)', async () => {
    writeConvoyFile(tmpDir, 'convoy-a', [
      { _event_id: 1, timestamp: '2026-01-01T00:00:00.000Z', type: 'session' },
      { _event_id: 2, timestamp: '2026-02-01T00:00:00.000Z', type: 'session' },
      { _event_id: 3, timestamp: '2026-03-01T00:00:00.000Z', type: 'session' },
    ])

    const outputPath = join(tmpDir, 'merged.ndjson')
    const result = await mergeConvoyLogs({ basePath: tmpDir, until: '2026-02-01T00:00:00.000Z', output: outputPath })

    expect(result.written).toBe(2)
  })

  it('filters by --since and --until together', async () => {
    writeConvoyFile(tmpDir, 'convoy-a', [
      { _event_id: 1, timestamp: '2026-01-01T00:00:00.000Z', type: 'session' },
      { _event_id: 2, timestamp: '2026-02-15T00:00:00.000Z', type: 'session' },
      { _event_id: 3, timestamp: '2026-03-01T00:00:00.000Z', type: 'session' },
    ])

    const outputPath = join(tmpDir, 'merged.ndjson')
    const result = await mergeConvoyLogs({
      basePath: tmpDir,
      since: '2026-02-01T00:00:00.000Z',
      until: '2026-02-28T23:59:59.999Z',
      output: outputPath,
    })

    expect(result.written).toBe(1)
    const lines = readFileSync(outputPath, 'utf8').split('\n').filter(l => l.trim())
    const record = JSON.parse(lines[0]) as { timestamp: string }
    expect(record.timestamp).toBe('2026-02-15T00:00:00.000Z')
  })

  it('writes to default output path when --output not specified', async () => {
    writeConvoyFile(tmpDir, 'convoy-a', [
      { _event_id: 1, timestamp: '2026-01-01T00:00:00.000Z', type: 'session' },
    ])

    await mergeConvoyLogs({ basePath: tmpDir })

    const defaultPath = join(tmpDir, '.opencastle', 'logs', 'convoy-events.ndjson')
    expect(existsSync(defaultPath)).toBe(true)
  })

  it('returns written: 0 when all records filtered out', async () => {
    writeConvoyFile(tmpDir, 'convoy-a', [
      { _event_id: 1, timestamp: '2026-01-01T00:00:00.000Z', type: 'session' },
    ])

    const result = await mergeConvoyLogs({ basePath: tmpDir, since: '2027-01-01T00:00:00.000Z' })
    expect(result.written).toBe(0)
    expect(result.merged).toBe(1)
  })

  it('skips malformed JSON lines gracefully', async () => {
    const path = join(tmpDir, CONVOYS_REL, 'convoy-bad.ndjson')
    writeFileSync(path, '{"_event_id":1,"timestamp":"2026-01-01T00:00:00.000Z","type":"session"}\nnot-valid-json\n{"_event_id":2,"timestamp":"2026-01-02T00:00:00.000Z","type":"task_done"}\n', 'utf8')

    const result = await mergeConvoyLogs({ basePath: tmpDir })
    expect(result.written).toBe(2)
  })
})
