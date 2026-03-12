import { mkdtempSync, rmSync, realpathSync, writeFileSync, mkdirSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { buildKnowledgeGraph } from './knowledge.js'

vi.mock('./gates.js', () => ({
  scanForSecrets: vi.fn(() => ({ clean: true, findings: [] })),
}))

const KG_REL = '.opencastle/KNOWLEDGE-GRAPH.md'

function makeBase(): string {
  const dir = realpathSync(mkdtempSync(join(tmpdir(), 'knowledge-test-')))
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

const SIMPLE_DIFF = `diff --git a/src/app.ts b/src/app.ts
index abc..def 100644
--- a/src/app.ts
+++ b/src/app.ts
@@ -1,2 +1,3 @@
+import { helper } from './utils.js'
 const x = 1
`

const TEST_FILE_DIFF = `diff --git a/src/app.test.ts b/src/app.test.ts
index abc..def 100644
--- a/src/app.test.ts
+++ b/src/app.test.ts
@@ -1,2 +1,3 @@
+import { helper } from './utils.js'
 const x = 1
`

const NON_TS_DIFF = `diff --git a/README.md b/README.md
index abc..def 100644
--- a/README.md
+++ b/README.md
@@ -1,2 +1,3 @@
+Some content about importing things
 existing line
`

describe('buildKnowledgeGraph', () => {
  it('creates file with table header when file does not exist', () => {
    buildKnowledgeGraph(SIMPLE_DIFF, 'convoy-1', tmpDir)
    const content = readFileSync(join(tmpDir, KG_REL), 'utf8')
    expect(content).toContain('| source |')
    expect(content).toContain('| target |')
  })

  it('extracts import relationships from diff', () => {
    buildKnowledgeGraph(SIMPLE_DIFF, 'convoy-1', tmpDir)
    const content = readFileSync(join(tmpDir, KG_REL), 'utf8')
    expect(content).toContain('src/app.ts')
    expect(content).toContain('utils.js')
  })

  it('skips test files', () => {
    buildKnowledgeGraph(TEST_FILE_DIFF, 'convoy-1', tmpDir)
    // File should not be created or should be empty (only header)
    if (require('node:fs').existsSync(join(tmpDir, KG_REL))) {
      const content = readFileSync(join(tmpDir, KG_REL), 'utf8')
      // Should only have header, no data rows from test files
      const lines = content.split('\n').filter((l: string) => l.startsWith('| src/app.test.ts'))
      expect(lines).toHaveLength(0)
    }
  })

  it('skips non-ts/js files', () => {
    buildKnowledgeGraph(NON_TS_DIFF, 'convoy-1', tmpDir)
    expect(require('node:fs').existsSync(join(tmpDir, KG_REL))).toBe(false)
  })

  it('deduplicates existing rows', () => {
    buildKnowledgeGraph(SIMPLE_DIFF, 'convoy-1', tmpDir)
    buildKnowledgeGraph(SIMPLE_DIFF, 'convoy-2', tmpDir)
    const content = readFileSync(join(tmpDir, KG_REL), 'utf8')
    const rows = content.split('\n').filter((l: string) => l.includes('src/app.ts') && l.includes('utils.js'))
    expect(rows).toHaveLength(1)
  })

  it('includes convoy_id in the row', () => {
    buildKnowledgeGraph(SIMPLE_DIFF, 'convoy-abc123', tmpDir)
    const content = readFileSync(join(tmpDir, KG_REL), 'utf8')
    expect(content).toContain('convoy-abc123')
  })
})
