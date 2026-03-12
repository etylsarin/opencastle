import { mkdtempSync, rmSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { createDemoDb } from './generate-demo-db.js'
import { runEtl } from './etl.js'

function makeTmp(): string {
  return mkdtempSync(join(tmpdir(), 'demo-db-test-'))
}

let tmp: string
beforeEach(() => { tmp = makeTmp() })
afterEach(() => { try { rmSync(tmp, { recursive: true, force: true }) } catch {} })

describe('generate-demo-db + etl', () => {
  it('creates a demo DB and produces ETL JSON', async () => {
    const dbPath = join(tmp, 'convoy-demo.db')
    await createDemoDb(dbPath)

    const outDir = join(tmp, 'out')
    const res = await runEtl({ dbPath, outputDir: outDir })

    expect(res.convoyCount).toBeGreaterThanOrEqual(1)
    const overall = JSON.parse(readFileSync(join(outDir, 'overall-stats.json'), 'utf8'))
    const list = JSON.parse(readFileSync(join(outDir, 'convoy-list.json'), 'utf8'))
    expect(Array.isArray(list)).toBe(true)
    expect(overall).toHaveProperty('convoyCounts')
  })
})
