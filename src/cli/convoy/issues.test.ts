import { mkdtempSync, rmSync, realpathSync, writeFileSync, mkdirSync, readFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { injectDiscoveredIssuesInstruction, checkDiscoveredIssues, consolidateIssues } from './issues.js'

vi.mock('./gates.js', () => ({
  scanForSecrets: vi.fn(() => ({ clean: true, findings: [] })),
}))

const DISCOVERED_REL = '.opencastle/DISCOVERED-ISSUES.md'
const KNOWN_REL = '.opencastle/KNOWN-ISSUES.md'

const DISCOVERED_HEADER = '# Discovered Issues\n\n'
const KNOWN_HEADER = '# Known Issues\n\n'

function makeBase(): string {
  const dir = realpathSync(mkdtempSync(join(tmpdir(), 'issues-test-')))
  mkdirSync(join(dir, '.opencastle'), { recursive: true })
  return dir
}

function makeEvents() {
  const emitted: Array<{ type: string; data?: unknown }> = []
  return {
    emit: vi.fn((type: string, data?: unknown) => { emitted.push({ type, data }) }),
    emitted,
  }
}

let tmpDir: string

beforeEach(() => {
  tmpDir = makeBase()
  vi.clearAllMocks()
})

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true })
})

describe('injectDiscoveredIssuesInstruction', () => {
  it('prepends the instruction to the prompt', () => {
    const result = injectDiscoveredIssuesInstruction('Do the task.')
    expect(result).toContain('Do the task.')
    expect(result.indexOf('IMPORTANT')).toBeLessThan(result.indexOf('Do the task.'))
  })

  it('includes the ISSUE format in the instruction', () => {
    const result = injectDiscoveredIssuesInstruction('proceed')
    expect(result).toContain('### ISSUE:')
  })
})

describe('checkDiscoveredIssues', () => {
  it('returns 0 when file does not exist', () => {
    const events = makeEvents()
    const count = checkDiscoveredIssues('task-1', events as any, 'convoy-1', tmpDir)
    expect(count).toBe(0)
    expect(events.emit).not.toHaveBeenCalled()
  })

  it('returns 0 when file has no ISSUE entries', () => {
    writeFileSync(join(tmpDir, DISCOVERED_REL), DISCOVERED_HEADER)
    const events = makeEvents()
    const count = checkDiscoveredIssues('task-1', events as any, 'convoy-1', tmpDir)
    expect(count).toBe(0)
  })

  it('emits discovered_issue event for each entry', () => {
    writeFileSync(
      join(tmpDir, DISCOVERED_REL),
      DISCOVERED_HEADER +
      '### ISSUE: Null pointer crash\n- **File:** src/app.ts\n- **Description:** Crashes when null.\n- **Severity:** high\n\n---\n',
    )
    const events = makeEvents()
    const count = checkDiscoveredIssues('task-1', events as any, 'convoy-1', tmpDir)
    expect(count).toBe(1)
    expect(events.emit).toHaveBeenCalledWith(
      'discovered_issue',
      expect.objectContaining({ title: 'Null pointer crash' }),
      expect.objectContaining({ task_id: 'task-1', convoy_id: 'convoy-1' }),
    )
  })

  it('parses multiple entries', () => {
    writeFileSync(
      join(tmpDir, DISCOVERED_REL),
      DISCOVERED_HEADER +
      '### ISSUE: Issue one\n- **File:** a.ts\n- **Description:** Desc one.\n\n---\n' +
      '### ISSUE: Issue two\n- **File:** b.ts\n- **Description:** Desc two.\n\n---\n',
    )
    const events = makeEvents()
    const count = checkDiscoveredIssues('task-x', events as any, 'convoy-y', tmpDir)
    expect(count).toBe(2)
    expect(events.emit).toHaveBeenCalledTimes(2)
  })
})

describe('consolidateIssues', () => {
  it('returns zero counts when discovered file does not exist', () => {
    const result = consolidateIssues(tmpDir)
    expect(result).toEqual({ moved: 0, skipped: 0 })
  })

  it('moves entries from discovered to known', () => {
    writeFileSync(
      join(tmpDir, DISCOVERED_REL),
      DISCOVERED_HEADER +
      '### ISSUE: New bug\n- **File:** src/x.ts\n- **Description:** A bug.\n\n---\n',
    )
    const result = consolidateIssues(tmpDir)
    expect(result.moved).toBe(1)
    const known = readFileSync(join(tmpDir, KNOWN_REL), 'utf8')
    expect(known).toContain('New bug')
  })

  it('deduplicates by title and file', () => {
    const existingEntry = '### ISSUE: Known bug\n- **File:** src/x.ts\n- **Description:** Already known.\n\n---\n'
    writeFileSync(join(tmpDir, KNOWN_REL), KNOWN_HEADER + existingEntry)
    writeFileSync(
      join(tmpDir, DISCOVERED_REL),
      DISCOVERED_HEADER +
      '### ISSUE: Known bug\n- **File:** src/x.ts\n- **Description:** Duplicate.\n\n---\n',
    )
    const result = consolidateIssues(tmpDir)
    expect(result.skipped).toBe(1)
    expect(result.moved).toBe(0)
    const known = readFileSync(join(tmpDir, KNOWN_REL), 'utf8')
    const occurrences = (known.match(/### ISSUE: Known bug/g) || []).length
    expect(occurrences).toBe(1)
  })

  it('clears discovered file after consolidation', () => {
    writeFileSync(
      join(tmpDir, DISCOVERED_REL),
      DISCOVERED_HEADER +
      '### ISSUE: Temp issue\n- **File:** src/y.ts\n- **Description:** Temp.\n\n---\n',
    )
    consolidateIssues(tmpDir)
    const discovered = readFileSync(join(tmpDir, DISCOVERED_REL), 'utf8')
    expect(discovered).not.toContain('### ISSUE:')
  })
})
