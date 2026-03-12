import { mkdtempSync, rmSync, realpathSync, writeFileSync, mkdirSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { readLessons, captureLessons, consolidateLessons } from './lessons.js'

vi.mock('./gates.js', () => ({
  scanForSecrets: vi.fn(() => ({ clean: true, findings: [] })),
}))

const LESSONS_REL = '.opencastle/LESSONS-LEARNED.md'

function makeBase(): string {
  const dir = realpathSync(mkdtempSync(join(tmpdir(), 'lessons-test-')))
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

describe('readLessons', () => {
  it('returns empty array when file does not exist', () => {
    const result = readLessons('developer', [], tmpDir)
    expect(result).toEqual([])
  })

  it('returns empty array when file has no LES entries', () => {
    writeFileSync(join(tmpDir, LESSONS_REL), '# Lessons Learned\n\nNo entries yet.\n')
    const result = readLessons('developer', [], tmpDir)
    expect(result).toEqual([])
  })

  it('filters by agent name', () => {
    writeFileSync(
      join(tmpDir, LESSONS_REL),
      '# Lessons\n\n' +
      '### LES-001: Dev tip\n| **Category** | `general` |\n| **Added** | 2026-01-01 |\n| **Agent** | developer |\nText about developer agent.\n\n' +
      '### LES-002: Other tip\n| **Category** | `git` |\n| **Added** | 2026-01-02 |\n| **Agent** | reviewer |\nText about reviewer agent.\n',
    )
    const result = readLessons('developer', [], tmpDir)
    expect(result).toHaveLength(1)
    expect(result[0]).toContain('Dev tip')
  })

  it('filters by file paths', () => {
    writeFileSync(
      join(tmpDir, LESSONS_REL),
      '# Lessons\n\n' +
      '### LES-001: File tip\n| **Category** | `general` |\n| **Added** | 2026-01-01 |\nText about src/cli/engine.ts file.\n\n' +
      '### LES-002: Unrelated\n| **Category** | `git` |\n| **Added** | 2026-01-02 |\nSome other content.\n',
    )
    const result = readLessons('unknown', ['src/cli/engine.ts'], tmpDir)
    expect(result).toHaveLength(1)
    expect(result[0]).toContain('File tip')
  })

  it('returns maximum 5 entries', () => {
    let content = '# Lessons\n\n'
    for (let i = 1; i <= 8; i++) {
      content += `### LES-00${i}: Tip ${i}\n| **Category** | \`general\` |\n| **Added** | 2026-01-0${i} |\nText about developer agent.\n\n`
    }
    writeFileSync(join(tmpDir, LESSONS_REL), content)
    const result = readLessons('developer', [], tmpDir)
    expect(result.length).toBeLessThanOrEqual(5)
  })

  it('prioritizes agent+file matches over agent-only matches', () => {
    writeFileSync(
      join(tmpDir, LESSONS_REL),
      '# Lessons\n\n' +
      '### LES-001: Agent only\n| **Category** | `general` |\n| **Added** | 2026-01-01 |\nContent about developer.\n\n' +
      '### LES-002: Agent and file\n| **Category** | `general` |\n| **Added** | 2026-01-02 |\nContent about developer and src/app.ts.\n',
    )
    const result = readLessons('developer', ['src/app.ts'], tmpDir)
    expect(result[0]).toContain('Agent and file')
  })
})

describe('captureLessons', () => {
  it('appends an entry with correct format', () => {
    const result = captureLessons(
      { title: 'Test lesson', category: 'general', agent: 'developer', problem: 'A problem', solution: 'A solution' },
      tmpDir,
    )
    expect(result.captured).toBe(true)
    const content = readFileSync(join(tmpDir, LESSONS_REL), 'utf8')
    expect(content).toContain('### LES-001: Test lesson')
    expect(content).toContain('**Problem:** A problem')
    expect(content).toContain('**Correct approach:** A solution')
  })

  it('creates file if it does not exist', () => {
    captureLessons(
      { title: 'First', category: 'general', agent: 'x', problem: 'p', solution: 's' },
      tmpDir,
    )
    expect(readFileSync(join(tmpDir, LESSONS_REL), 'utf8')).toContain('### LES-001: First')
  })

  it('auto-increments LES number', () => {
    writeFileSync(join(tmpDir, LESSONS_REL), '# Lessons\n\n### LES-007: Existing\n')
    captureLessons(
      { title: 'New', category: 'general', agent: 'x', problem: 'p', solution: 's' },
      tmpDir,
    )
    const content = readFileSync(join(tmpDir, LESSONS_REL), 'utf8')
    expect(content).toContain('### LES-008: New')
  })

  it('includes files note when files provided', () => {
    captureLessons(
      { title: 'With files', category: 'general', agent: 'x', problem: 'p', solution: 's', files: ['foo.ts', 'bar.ts'] },
      tmpDir,
    )
    const content = readFileSync(join(tmpDir, LESSONS_REL), 'utf8')
    expect(content).toContain('foo.ts')
    expect(content).toContain('bar.ts')
  })

  it('rejects content with secrets', async () => {
    const { scanForSecrets } = await import('./gates.js')
    vi.mocked(scanForSecrets).mockReturnValueOnce({
      clean: false,
      findings: [{ pattern: 'Generic Secret', file: '', line: 1, snippet: 'x' }],
    })
    const result = captureLessons(
      { title: 'Bad', category: 'general', agent: 'x', problem: 'p', solution: 's' },
      tmpDir,
    )
    expect(result.captured).toBe(false)
    expect(result.reason).toBe('secrets_detected')
  })
})

describe('consolidateLessons', () => {
  it('returns zeros when file does not exist', () => {
    const result = consolidateLessons(tmpDir)
    expect(result).toEqual({ merged: 0, remaining: 0 })
  })

  it('merges duplicate entries with same category and similar title', () => {
    writeFileSync(
      join(tmpDir, LESSONS_REL),
      '# Lessons\n\n' +
      '### LES-001: Git push rejected error\n| **Category** | `git` |\n| **Added** | 2026-01-01 |\nOld content.\n\n' +
      '### LES-002: Git push rejected error fix\n| **Category** | `git` |\n| **Added** | 2026-01-05 |\nNewer content.\n',
    )
    const result = consolidateLessons(tmpDir)
    expect(result.merged).toBe(1)
    expect(result.remaining).toBe(1)
    const content = readFileSync(join(tmpDir, LESSONS_REL), 'utf8')
    expect(content).toContain('2026-01-05')
  })

  it('keeps the most recent entry when merging', () => {
    writeFileSync(
      join(tmpDir, LESSONS_REL),
      '# Lessons\n\n' +
      '### LES-001: Same title same\n| **Category** | `general` |\n| **Added** | 2026-01-01 |\nOld.\n\n' +
      '### LES-002: Same title same\n| **Category** | `general` |\n| **Added** | 2026-03-01 |\nNew.\n',
    )
    consolidateLessons(tmpDir)
    const content = readFileSync(join(tmpDir, LESSONS_REL), 'utf8')
    expect(content).toContain('New.')
    expect(content).not.toContain('Old.')
  })

  it('does not merge entries with different categories', () => {
    writeFileSync(
      join(tmpDir, LESSONS_REL),
      '# Lessons\n\n' +
      '### LES-001: Same title same\n| **Category** | `git` |\n| **Added** | 2026-01-01 |\nGit.\n\n' +
      '### LES-002: Same title same\n| **Category** | `general` |\n| **Added** | 2026-01-02 |\nGeneral.\n',
    )
    const result = consolidateLessons(tmpDir)
    expect(result.remaining).toBe(2)
    expect(result.merged).toBe(0)
  })
})
