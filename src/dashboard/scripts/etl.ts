import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

export interface EtlOptions {
  dbPath: string
  outputDir: string
}

export interface EtlResult {
  convoyCount: number
  taskCount: number
}

const EMPTY_OVERALL_STATS = {
  convoyCounts: { total: 0, running: 0, done: 0, failed: 0, gate_failed: 0 },
  durationStats: { avg_sec: null, p95_sec: null, max_sec: null },
  tokenCostTotals: { total_tokens: 0, total_cost_usd: 0 },
  topAgents: [] as unknown[],
  topModels: [] as unknown[],
  dlqSummary: { count: 0, top_failure_types: [] as unknown[] },
}

export async function runEtl(options: EtlOptions): Promise<EtlResult> {
  const { dbPath, outputDir } = options

  mkdirSync(outputDir, { recursive: true })
  mkdirSync(resolve(outputDir, 'convoys'), { recursive: true })

  if (!existsSync(dbPath)) {
    console.warn(`  \u26a0 No convoy database found at ${dbPath}. Writing empty JSON files.`)
    writeFileSync(
      resolve(outputDir, 'overall-stats.json'),
      JSON.stringify(EMPTY_OVERALL_STATS, null, 2),
      'utf8',
    )
    writeFileSync(resolve(outputDir, 'convoy-list.json'), JSON.stringify([], null, 2), 'utf8')
    return { convoyCount: 0, taskCount: 0 }
  }

  const { createConvoyStore } = await import('../../cli/convoy/store.js')
  const store = createConvoyStore(dbPath)

  try {
    const overallStats = {
      convoyCounts: store.getConvoyCounts(),
      durationStats: store.getConvoyDurationStats(),
      tokenCostTotals: store.getTokenAndCostTotals(),
      topAgents: store.getTopAgents(5),
      topModels: store.getTopModels(5),
      dlqSummary: store.getDlqSummary(),
    }
    writeFileSync(
      resolve(outputDir, 'overall-stats.json'),
      JSON.stringify(overallStats, null, 2),
      'utf8',
    )

    const allConvoys = store.getConvoyList(1000, 0)
    const convoyList = allConvoys.map(c => ({
      id: c.id,
      name: c.name,
      status: c.status,
      created_at: c.created_at,
      finished_at: c.finished_at,
      total_tokens: c.total_tokens,
      total_cost_usd: c.total_cost_usd,
    }))
    writeFileSync(
      resolve(outputDir, 'convoy-list.json'),
      JSON.stringify(convoyList, null, 2),
      'utf8',
    )

    let totalTasks = 0
    for (const convoy of allConvoys) {
      const detail = store.getConvoyDetails(convoy.id)
      if (detail) {
        totalTasks += detail.tasks.length
        writeFileSync(
          resolve(outputDir, 'convoys', `${convoy.id}.json`),
          JSON.stringify(detail, null, 2),
          'utf8',
        )
      }
    }

    console.log(`ETL complete: ${allConvoys.length} convoys exported, ${totalTasks} tasks.`)
    return { convoyCount: allConvoys.length, taskCount: totalTasks }
  } finally {
    store.close()
  }
}

const isMain =
  process.argv[1] != null &&
  fileURLToPath(import.meta.url) === resolve(process.argv[1])
if (isMain) {
  const dbPath = resolve(process.cwd(), '.opencastle', 'convoy.db')
  const outputDir = resolve(__dirname, '..', 'public', 'data')
  runEtl({ dbPath, outputDir }).catch((err: unknown) => {
    console.error('ETL failed:', (err as Error).message)
    process.exit(1)
  })
}