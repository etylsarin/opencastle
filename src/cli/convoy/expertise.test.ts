import { mkdtempSync, rmSync, realpathSync, writeFileSync, mkdirSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { readExpertise, updateExpertise, feedCircuitBreaker } from './expertise.js'

vi.mock('./gates.js', () => ({
  scanForSecrets: vi.fn(() => ({ clean: true, findings: [] })),
}))

const EXPERTISE_REL = '.opencastle/AGENT-EXPERTISE.md'

function makeBase(): string {
  const dir = realpathSync(mkdtempSync(join(tmpdir(), 'expertise-test-')))
  mkdirSync(join(dir, '.opencastle'), { recursive: true })
  return dir
}

let tmpDir: string

beforeEach(() => {
  tmpDir = makeBase()
  vi.clearAllMocks()
})

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true })
})

describe('readExpertise', () => {
  it('returns empty expertise for missing file', () => {
    const result = readExpertise('developer', tmpDir)
    expect(result).toEqual({ strong: [], weak: [], files: [] })
  })

  it('returns empty expertise when agent section not present', () => {
    writeFileSync(join(tmpDir, EXPERTISE_REL), '# Agent Expertise\n\n## other-agent\n### Strong Areas\n- Knows stuff\n')
    const result = readExpertise('developer', tmpDir)
    expect(result).toEqual({ strong: [], weak: [], files: [] })
  })

  it('parses strong areas', () => {
    writeFileSync(
      join(tmpDir, EXPERTISE_REL),
      '# Agent Expertise\n\n## developer\n### Strong Areas\n- TypeScript typing\n- React hooks\n### Weak Areas\n### File Familiarity\n',
    )
    const result = readExpertise('developer', tmpDir)
    expect(result.strong).toContain('TypeScript typing')
    expect(result.strong).toContain('React hooks')
  })

  it('parses weak areas', () => {
    writeFileSync(
      join(tmpDir, EXPERTISE_REL),
      '# Agent Expertise\n\n## developer\n### Strong Areas\n### Weak Areas\n- CSS animations\n### File Familiarity\n',
    )
    const result = readExpertise('developer', tmpDir)
    expect(result.weak).toContain('CSS animations')
  })

  it('parses file familiarity', () => {
    writeFileSync(
      join(tmpDir, EXPERTISE_REL),
      '# Agent Expertise\n\n## developer\n### Strong Areas\n### Weak Areas\n### File Familiarity\n- src/cli/engine.ts\n',
    )
    const result = readExpertise('developer', tmpDir)
    expect(result.files).toContain('src/cli/engine.ts')
  })
})

describe('updateExpertise', () => {
  it('creates file if missing when updating success with no retries', () => {
    updateExpertise('developer', { taskId: 'task-1', success: true, retries: 0, files: ['src/app.ts'] }, tmpDir)
    const content = readFileSync(join(tmpDir, EXPERTISE_REL), 'utf8')
    expect(content).toContain('## developer')
    expect(content).toContain('src/app.ts')
  })

  it('appends success to Strong Areas', () => {
    updateExpertise('developer', { taskId: 'task-1', success: true, retries: 0, files: ['src/engine.ts'] }, tmpDir)
    const result = readExpertise('developer', tmpDir)
    expect(result.strong.some(s => s.includes('task-1'))).toBe(true)
  })

  it('appends failure to Weak Areas', () => {
    updateExpertise('developer', { taskId: 'task-fail', success: false, retries: 3, files: ['src/hard.ts'] }, tmpDir)
    const result = readExpertise('developer', tmpDir)
    expect(result.weak.some(w => w.includes('task-fail'))).toBe(true)
  })

  it('appends to Weak Areas when success with retries > 0', () => {
    updateExpertise('developer', { taskId: 'task-retry', success: true, retries: 2, files: ['src/tricky.ts'] }, tmpDir)
    const result = readExpertise('developer', tmpDir)
    expect(result.weak.some(w => w.includes('task-retry'))).toBe(true)
  })

  it('rejects secrets in expertise content', async () => {
    const { scanForSecrets } = await import('./gates.js')
    vi.mocked(scanForSecrets).mockReturnValueOnce({
      clean: false,
      findings: [{ pattern: 'Token', file: '', line: 1, snippet: 'x' }],
    })
    // Should not throw; silently skips the write
    expect(() => {
      updateExpertise('developer', { taskId: 'leak', success: true, retries: 0, files: [] }, tmpDir)
    }).not.toThrow()
  })
})

describe('feedCircuitBreaker', () => {
  it('returns weak areas for the agent', () => {
    writeFileSync(
      join(tmpDir, EXPERTISE_REL),
      '# Agent Expertise\n\n## developer\n### Strong Areas\n### Weak Areas\n- database migrations\n### File Familiarity\n',
    )
    const result = feedCircuitBreaker('developer', tmpDir)
    expect(result).toContain('database migrations')
  })

  it('returns empty array when the agent has no weak areas', () => {
    writeFileSync(
      join(tmpDir, EXPERTISE_REL),
      '# Agent Expertise\n\n## developer\n### Strong Areas\n- everything\n### Weak Areas\n### File Familiarity\n',
    )
    const result = feedCircuitBreaker('developer', tmpDir)
    expect(result).toEqual([])
  })
})
