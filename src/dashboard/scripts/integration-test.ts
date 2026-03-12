/**
 * Integration test for the dashboard ETL → Astro build → HTML pipeline.
 * Usage: npx tsx src/dashboard/scripts/integration-test.ts
 * Exit 0 if all tests pass, exit 1 if any fail.
 */

import { mkdtempSync, rmSync, realpathSync, readFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve, dirname } from 'node:path'
import { execSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import type { ConvoyTaskStatus, ConvoyStatus } from '../../cli/convoy/types.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const WORKSPACE_ROOT = resolve(__dirname, '..', '..', '..')

// ── Colours ───────────────────────────────────────────────────────────────────
const c = {
  green: (s: string) => `\x1b[32m${s}\x1b[0m`,
  red:   (s: string) => `\x1b[31m${s}\x1b[0m`,
  bold:  (s: string) => `\x1b[1m${s}\x1b[0m`,
  dim:   (s: string) => `\x1b[2m${s}\x1b[0m`,
}

// ── Test runner ───────────────────────────────────────────────────────────────
let passed = 0
let failed = 0

async function test(name: string, fn: () => void | Promise<void>): Promise<void> {
  try {
    await fn()
    passed++
    console.log(`  ${c.green('✓')} ${name}`)
  } catch (err) {
    failed++
    console.error(`  ${c.red('✗')} ${name}`)
    const msg = (err as Error).message ?? String(err)
    msg.split('\n').slice(0, 6).forEach((line) => console.error(`    ${c.dim(line)}`))
  }
}

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message)
}

function execCmd(cmd: string, timeoutMs = 120_000): void {
  try {
    execSync(cmd, { cwd: WORKSPACE_ROOT, stdio: 'pipe', timeout: timeoutMs })
  } catch (err) {
    const e = err as { stderr?: Buffer; stdout?: Buffer; message?: string }
    const detail =
      e.stderr?.toString().trim() ?? e.stdout?.toString().trim() ?? String(e.message ?? '')
    throw new Error(`Command failed: ${cmd}\n${detail.slice(0, 600)}`)
  }
}

// ── Fixtures ──────────────────────────────────────────────────────────────────
interface TaskFixture {
  id: string
  agent: string
  model: string
  phase: number
  status: ConvoyTaskStatus
  retries: number
}

interface ConvoyFixture {
  id: string
  name: string
  status: ConvoyStatus
  startedAt: string
  finishedAt: string | null
  tasks: TaskFixture[]
}

const FIXTURES: ConvoyFixture[] = [
  {
    id: 'c-done-001',
    name: 'Feature: Authentication',
    status: 'done',
    startedAt: '2026-03-01T09:01:00.000Z',
    finishedAt: '2026-03-01T11:30:00.000Z',
    tasks: [
      { id: 'c-done-t-1', agent: 'developer', model: 'claude-opus-4-6',   phase: 1, status: 'done',    retries: 0 },
      { id: 'c-done-t-2', agent: 'reviewer',  model: 'claude-sonnet-4-5', phase: 1, status: 'done',    retries: 0 },
      { id: 'c-done-t-3', agent: 'architect', model: 'gpt-4o',            phase: 2, status: 'done',    retries: 0 },
      { id: 'c-done-t-4', agent: 'developer', model: 'claude-opus-4-6',   phase: 2, status: 'done',    retries: 0 },
      { id: 'c-done-t-5', agent: 'reviewer',  model: 'claude-sonnet-4-5', phase: 3, status: 'done',    retries: 0 },
      { id: 'c-done-t-6', agent: 'architect', model: 'gpt-4o',            phase: 3, status: 'failed',  retries: 2 },
      { id: 'c-done-t-7', agent: 'developer', model: 'claude-opus-4-6',   phase: 4, status: 'running', retries: 0 },
    ],
  },
  {
    id: 'c-fail-001',
    name: 'Feature: Payment Integration',
    status: 'failed',
    startedAt: '2026-03-02T10:01:00.000Z',
    finishedAt: '2026-03-02T12:00:00.000Z',
    tasks: [
      { id: 'c-fail-t-1', agent: 'developer', model: 'claude-opus-4-6',   phase: 1, status: 'done',   retries: 0 },
      { id: 'c-fail-t-2', agent: 'reviewer',  model: 'claude-sonnet-4-5', phase: 1, status: 'done',   retries: 0 },
      { id: 'c-fail-t-3', agent: 'architect', model: 'gpt-4o',            phase: 2, status: 'done',   retries: 0 },
      { id: 'c-fail-t-4', agent: 'developer', model: 'claude-opus-4-6',   phase: 2, status: 'failed', retries: 3 },
      { id: 'c-fail-t-5', agent: 'reviewer',  model: 'claude-sonnet-4-5', phase: 3, status: 'failed', retries: 3 },
    ],
  },
  {
    id: 'c-run-001',
    name: 'Refactor: Database Layer',
    status: 'running',
    startedAt: '2026-03-03T08:01:00.000Z',
    finishedAt: null,
    tasks: [
      { id: 'c-run-t-1', agent: 'developer', model: 'claude-opus-4-6',   phase: 1, status: 'done',    retries: 0 },
      { id: 'c-run-t-2', agent: 'reviewer',  model: 'claude-sonnet-4-5', phase: 1, status: 'done',    retries: 0 },
      { id: 'c-run-t-3', agent: 'architect', model: 'gpt-4o',            phase: 2, status: 'running', retries: 0 },
    ],
  },
]

const TOTAL_CONVOYS = FIXTURES.length // 3
const TOTAL_TASKS   = FIXTURES.reduce((sum, f) => sum + f.tasks.length, 0) // 15

// ── Main ──────────────────────────────────────────────────────────────────────
const tmpDir = realpathSync(mkdtempSync(join(tmpdir(), 'dash-int-')))

try {
  // ── Phase A: ETL Smoke Test ────────────────────────────────────────────────
  console.log(c.bold('\n  Phase A: ETL Smoke Test with Realistic Data\n'))

  const dbPath    = join(tmpDir, 'test.db')
  const etlOutDir = join(tmpDir, 'etl-out')
  let etlResult: { convoyCount: number; taskCount: number } | null = null

  await test('seed database and run ETL', async () => {
    const { createConvoyStore } = await import('../../cli/convoy/store.js')
    const store = createConvoyStore(dbPath)
    try {
      for (const [i, f] of FIXTURES.entries()) {
        const createdAt = `2026-03-0${i + 1}T09:00:00.000Z`
        store.insertConvoy({
          id:        f.id,
          name:      f.name,
          spec_hash: `hash-${f.id}`,
          status:    f.status,
          branch:    f.status === 'done' ? 'main' : null,
          created_at: createdAt,
          spec_yaml: 'tasks: []',
        })
        const extra: { started_at: string; finished_at?: string; total_tokens: number; total_cost_usd: number } = {
          started_at: f.startedAt,
          total_tokens: 30_000 * (i + 1),
          total_cost_usd: 0.95 * (i + 1),
        }
        if (f.finishedAt) extra.finished_at = f.finishedAt
        store.updateConvoyStatus(f.id, f.status, extra)

        for (const t of f.tasks) {
          store.insertTask({
            id:         t.id,
            convoy_id:  f.id,
            phase:      t.phase,
            prompt:     `Prompt for ${t.id}`,
            agent:      t.agent,
            adapter:    null,
            model:      t.model,
            timeout_ms: 1_800_000,
            status:     t.status,
            retries:    t.retries,
            depends_on: null,
            files:      null,
            gates:      null,
            max_retries: 3,
          })
        }
      }

      // DLQ entries for the failed convoy
      store.insertDlqEntry({
        id:                  'dlq-001',
        convoy_id:           'c-fail-001',
        task_id:             'c-fail-t-4',
        agent:               'developer',
        failure_type:        'timeout',
        error_output:        'Task timed out after 30 minutes',
        attempts:            3,
        tokens_spent:        null,
        escalation_task_id:  null,
        resolved:            0,
        resolution:          null,
        created_at:          '2026-03-02T10:30:00.000Z',
        resolved_at:         null,
      })
      store.insertDlqEntry({
        id:                  'dlq-002',
        convoy_id:           'c-fail-001',
        task_id:             'c-fail-t-5',
        agent:               'reviewer',
        failure_type:        'gate_failure',
        error_output:        'Secret scan found potential leak',
        attempts:            2,
        tokens_spent:        null,
        escalation_task_id:  null,
        resolved:            0,
        resolution:          null,
        created_at:          '2026-03-02T11:00:00.000Z',
        resolved_at:         null,
      })

      // Events for the done convoy
      store.insertEvent({
        convoy_id:  'c-done-001',
        task_id:    null,
        worker_id:  null,
        type:       'convoy_started',
        data:       JSON.stringify({ name: 'Feature: Authentication' }),
        created_at: '2026-03-01T09:01:00.000Z',
      })
      store.insertEvent({
        convoy_id:  'c-done-001',
        task_id:    'c-done-t-1',
        worker_id:  null,
        type:       'task_done',
        data:       JSON.stringify({ phase: 1, agent: 'developer' }),
        created_at: '2026-03-01T10:00:00.000Z',
      })
      store.insertEvent({
        convoy_id:  'c-done-001',
        task_id:    null,
        worker_id:  null,
        type:       'convoy_finished',
        data:       JSON.stringify({ status: 'done', total_tokens: 30_000 }),
        created_at: '2026-03-01T11:30:00.000Z',
      })
    } finally {
      store.close()
    }

    const { runEtl } = await import('./etl.js')
    etlResult = await runEtl({ dbPath, outputDir: etlOutDir })
  })

  await test(`ETL convoyCount === ${TOTAL_CONVOYS}`, () => {
    assert(etlResult !== null, 'seed/ETL test failed — skipping')
    assert(etlResult!.convoyCount === TOTAL_CONVOYS, `Expected ${TOTAL_CONVOYS}, got ${etlResult!.convoyCount}`)
  })

  await test(`ETL taskCount === ${TOTAL_TASKS}`, () => {
    assert(etlResult !== null, 'seed/ETL test failed — skipping')
    assert(etlResult!.taskCount === TOTAL_TASKS, `Expected ${TOTAL_TASKS}, got ${etlResult!.taskCount}`)
  })

  await test('overall-stats.json: total convoy count is 3', () => {
    const stats = JSON.parse(readFileSync(join(etlOutDir, 'overall-stats.json'), 'utf8'))
    assert(stats.convoyCounts.total === 3, `Expected 3, got ${stats.convoyCounts.total}`)
  })

  await test('overall-stats.json: 1 done, 1 failed, 1 running', () => {
    const stats = JSON.parse(readFileSync(join(etlOutDir, 'overall-stats.json'), 'utf8'))
    assert(stats.convoyCounts.done    === 1, `done: expected 1, got ${stats.convoyCounts.done}`)
    assert(stats.convoyCounts.failed  === 1, `failed: expected 1, got ${stats.convoyCounts.failed}`)
    assert(stats.convoyCounts.running === 1, `running: expected 1, got ${stats.convoyCounts.running}`)
  })

  await test('convoy-list.json has 3 entries', () => {
    const list = JSON.parse(readFileSync(join(etlOutDir, 'convoy-list.json'), 'utf8'))
    assert(list.length === 3, `Expected 3, got ${list.length}`)
  })

  await test('per-convoy detail files exist for all 3 convoys', () => {
    for (const f of FIXTURES) {
      assert(
        existsSync(join(etlOutDir, 'convoys', `${f.id}.json`)),
        `Missing convoys/${f.id}.json`,
      )
    }
  })

  await test('c-done-001 detail has 7 tasks', () => {
    const detail = JSON.parse(readFileSync(join(etlOutDir, 'convoys', 'c-done-001.json'), 'utf8'))
    assert(detail.tasks.length === 7, `Expected 7 tasks, got ${detail.tasks.length}`)
  })

  await test('c-fail-001 detail has 5 tasks', () => {
    const detail = JSON.parse(readFileSync(join(etlOutDir, 'convoys', 'c-fail-001.json'), 'utf8'))
    assert(detail.tasks.length === 5, `Expected 5 tasks, got ${detail.tasks.length}`)
  })

  await test('c-run-001 detail has 3 tasks', () => {
    const detail = JSON.parse(readFileSync(join(etlOutDir, 'convoys', 'c-run-001.json'), 'utf8'))
    assert(detail.tasks.length === 3, `Expected 3 tasks, got ${detail.tasks.length}`)
  })

  await test('c-fail-001 detail has 2 DLQ entries', () => {
    const detail = JSON.parse(readFileSync(join(etlOutDir, 'convoys', 'c-fail-001.json'), 'utf8'))
    assert(detail.dlq_count === 2, `Expected 2 DLQ entries, got ${detail.dlq_count}`)
  })

  await test('c-done-001 detail has at least 3 events', () => {
    const detail = JSON.parse(readFileSync(join(etlOutDir, 'convoys', 'c-done-001.json'), 'utf8'))
    assert(detail.events.length >= 3, `Expected >= 3 events, got ${detail.events.length}`)
  })

  await test('overall-stats.json has required top-level keys', () => {
    const stats = JSON.parse(readFileSync(join(etlOutDir, 'overall-stats.json'), 'utf8'))
    for (const key of ['convoyCounts', 'durationStats', 'tokenCostTotals', 'topAgents', 'topModels', 'dlqSummary']) {
      assert(key in stats, `Missing key "${key}" in overall-stats.json`)
    }
  })

  // ── Phase B: Astro Build Verification ─────────────────────────────────────
  console.log(c.bold('\n  Phase B: Astro Build Verification\n'))

  await test('npm run dashboard:etl exits with code 0', () => {
    execCmd('npm run dashboard:etl', 60_000)
  })

  await test('npx astro build --root src/dashboard exits with code 0', () => {
    execCmd('npx astro build --root src/dashboard', 180_000)
  })

  const distHtmlPath = join(WORKSPACE_ROOT, 'src', 'dashboard', 'dist', 'index.html')

  await test('src/dashboard/dist/index.html exists', () => {
    assert(existsSync(distHtmlPath), `HTML not found at ${distHtmlPath}`)
  })

  // ── Phase C: Content Verification ─────────────────────────────────────────
  console.log(c.bold('\n  Phase C: Content Verification\n'))

  let html = ''
  await test('read dist/index.html (non-empty)', () => {
    assert(existsSync(distHtmlPath), 'dist/index.html missing — Phase B may have failed')
    html = readFileSync(distHtmlPath, 'utf8')
    assert(html.length > 2000, `HTML suspiciously small: ${html.length} bytes`)
  })

  const requiredIds: Array<[string, string]> = [
    ['convoy-select',              'id="convoy-select"'],
    ['overall-section',            'id="overall-section"'],
    ['overall-total-runs KPI',     'id="overall-total-runs"'],
    ['overall-running KPI',        'id="overall-running"'],
    ['overall-success-rate KPI',   'id="overall-success-rate"'],
    ['overall-avg-duration KPI',   'id="overall-avg-duration"'],
    ['overall-total-tokens KPI',   'id="overall-total-tokens"'],
    ['overall-total-cost KPI',     'id="overall-total-cost"'],
    ['tasks-section',              'id="tasks-section"'],
    ['quality-section',            'id="quality-section"'],
    ['reliability-section',        'id="reliability-section"'],
    ['drift-section',              'id="drift-section"'],
    ['outputs-section',            'id="outputs-section"'],
    ['event-timeline-section',     'id="event-timeline-section"'],
    ['export-btn',                 'id="export-btn"'],
    ['selected-convoy-name',       'id="selected-convoy-name"'],
    ['selected-convoy-status',     'id="selected-convoy-status"'],
  ]

  for (const [label, needle] of requiredIds) {
    await test(`HTML contains ${label}`, () => {
      assert(html.includes(needle), `Missing element: ${needle}`)
    })
  }

  // ── Phase C2: Data Population Verification ──────────────────────────────────────
  console.log(c.bold('\n  Phase C2: Data Population Verification\n'))

  await test('HTML contains __DASHBOARD_DATA__ script block', () => {
    assert(html.includes('__DASHBOARD_DATA__'), 'Missing __DASHBOARD_DATA__ injection in HTML')
  })

  await test('HTML contains overall stats data (convoyCounts)', () => {
    assert(html.includes('convoyCounts'), 'Missing convoyCounts in rendered HTML data')
  })

  await test('HTML contains convoy list data (convoy-list)', () => {
    // The convoy selector should have convoy names populated
    assert(
      html.includes('convoy-list') || html.includes('convoyList'),
      'Missing convoy list data reference in rendered HTML',
    )
  })

  // ── Phase D: Accessibility Audit ──────────────────────────────────────────
  console.log(c.bold('\n  Phase D: Accessibility Audit\n'))

  // Strip <script> blocks so JS template strings don't produce false positives
  const htmlNoScripts = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')

  await test('all <img> elements have alt attribute', () => {
    const imgRe = /<img\s[^>]*>/gi
    const imgs  = htmlNoScripts.match(imgRe) ?? []
    const missing = imgs.filter((tag) => !/\balt\s*=/.test(tag))
    assert(
      missing.length === 0,
      `${missing.length} <img> without alt attribute:\n${missing.join('\n')}`,
    )
  })

  await test('all <th> elements have scope attribute', () => {
    const thRe = /<th\b[^>]*>/gi
    const ths  = htmlNoScripts.match(thRe) ?? []
    const missing = ths.filter((tag) => !/\bscope\s*=/.test(tag))
    assert(
      missing.length === 0,
      `${missing.length} <th> without scope attribute:\n${missing.join('\n')}`,
    )
  })

  await test('all <button> elements have accessible label (text or aria-label or title)', () => {
    // Match opening tag + content + closing tag across lines (non-greedy)
    const btnRe = /<button([^>]*)>([\s\S]*?)<\/button>/gi
    const violations: string[] = []
    let m: RegExpExecArray | null
    while ((m = btnRe.exec(htmlNoScripts)) !== null) {
      const attrs       = m[1]
      const textContent = m[2].replace(/<[^>]+>/g, '').trim()
      const hasAriaLabel = /\baria-label\s*=\s*["'][^"']+["']/.test(attrs)
      const hasTitle     = /\btitle\s*=\s*["'][^"']+["']/.test(attrs)
      if (!hasAriaLabel && !hasTitle && textContent.length === 0) {
        violations.push(`<button${attrs.slice(0, 100)}>`)
      }
    }
    assert(
      violations.length === 0,
      `${violations.length} <button> without accessible text:\n${violations.join('\n')}`,
    )
  })

  await test('sidebar navigation links have aria-label attributes', () => {
    // Sidebar <a> elements should have aria-label="...section"
    const count = (htmlNoScripts.match(/aria-label="[^"]*section[^"]*"/g) ?? []).length
    assert(count >= 5, `Expected at least 5 nav aria-label="...section" attributes, found ${count}`)
  })

  await test('status-badge element has role attribute', () => {
    assert(
      htmlNoScripts.includes('id="selected-convoy-status"'),
      'Missing status badge element',
    )
    // The status badge should have role="status" for screen readers
    const badgeRe = /<[^>]+id="selected-convoy-status"[^>]*>/
    const match   = htmlNoScripts.match(badgeRe)
    if (match) {
      assert(/\brole\s*=/.test(match[0]), 'Status badge is missing role attribute')
    }
  })

  // ── Phase E: Empty Data Edge Case ─────────────────────────────────────────
  console.log(c.bold('\n  Phase E: Empty Data Edge Case\n'))

  const emptyOutDir = join(tmpDir, 'empty-etl-out')
  let emptyResult: { convoyCount: number; taskCount: number } | null = null

  await test('ETL with non-existent DB returns convoyCount 0 and taskCount 0', async () => {
    const { runEtl } = await import('./etl.js')
    emptyResult = await runEtl({
      dbPath:    join(tmpDir, 'nonexistent.db'),
      outputDir: emptyOutDir,
    })
    assert(emptyResult.convoyCount === 0, `Expected 0 convoys, got ${emptyResult.convoyCount}`)
    assert(emptyResult.taskCount   === 0, `Expected 0 tasks, got ${emptyResult.taskCount}`)
  })

  await test('empty overall-stats.json has zero counts', () => {
    const stats = JSON.parse(readFileSync(join(emptyOutDir, 'overall-stats.json'), 'utf8'))
    assert(stats.convoyCounts.total   === 0, `total: expected 0, got ${stats.convoyCounts.total}`)
    assert(stats.convoyCounts.running === 0, `running: expected 0, got ${stats.convoyCounts.running}`)
    assert(stats.convoyCounts.done    === 0, `done: expected 0, got ${stats.convoyCounts.done}`)
    assert(stats.convoyCounts.failed  === 0, `failed: expected 0, got ${stats.convoyCounts.failed}`)
  })

  await test('empty convoy-list.json is an empty array', () => {
    const list = JSON.parse(readFileSync(join(emptyOutDir, 'convoy-list.json'), 'utf8'))
    assert(Array.isArray(list) && list.length === 0, `Expected [], got ${JSON.stringify(list)}`)
  })

  await test('dashboard Astro build succeeds with empty data', async () => {
    // Write empty JSON to public/data so the build uses empty state
    const publicDataDir = join(WORKSPACE_ROOT, 'src', 'dashboard', 'public', 'data')
    const { runEtl } = await import('./etl.js')
    await runEtl({
      dbPath:    join(tmpDir, 'nonexistent.db'),
      outputDir: publicDataDir,
    })
    execCmd('npx astro build --root src/dashboard', 180_000)
    const builtHtml = readFileSync(distHtmlPath, 'utf8')
    assert(builtHtml.includes('id="convoy-select"'),  'convoy-select missing in empty-data build')
    assert(builtHtml.includes('id="overall-section"'), 'overall-section missing in empty-data build')
    assert(builtHtml.includes('id="tasks-section"'),   'tasks-section missing in empty-data build')
  })

} finally {
  // Best-effort restore of public/data
  try {
    execSync('npm run dashboard:etl', { cwd: WORKSPACE_ROOT, stdio: 'pipe', timeout: 60_000 })
  } catch { /* no real DB present — that's fine */ }

  rmSync(tmpDir, { recursive: true, force: true })
}

const failStr = failed > 0 ? c.red(String(failed)) : String(0)
console.log(`\n  ${c.bold('Results:')} ${c.green(String(passed))} passed, ${failStr} failed\n`)
process.exit(failed > 0 ? 1 : 0)
