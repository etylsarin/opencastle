import { readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { parseTaskSpecText, isConvoySpec, isPipelineSpec } from './run/schema.js'
import { createExecutor, buildPhases } from './run/executor.js'
import { getAdapter, detectAdapter } from './run/adapters/index.js'
import { createReporter, printExecutionPlan } from './run/reporter.js'
import { c } from './prompt.js'
import type { CliContext, RunOptions } from './types.js'
import type { ConvoyResult } from './convoy/engine.js'
import type { PipelineResult } from './convoy/pipeline.js'

function formatTokens(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M'
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K'
  return String(n)
}

const HELP = `
  opencastle run [options]

  Process a task queue from a spec file, delegating to AI agents autonomously.
  Version 1 specs use the Convoy Engine; legacy specs use the standard executor.

  Options:
    --file, -f <path>        Task spec file
    --dry-run                Show execution plan without running
    --concurrency, -c <n>    Override max parallel tasks
    --adapter, -a <name>     Override agent runtime adapter
    --report-dir <path>      Where to write run reports (default: .opencastle/runs)
    --verbose                Show full agent output
    --resume                 Resume the last interrupted convoy from .opencastle/convoy.db
    --status                 Print the current convoy state from .opencastle/convoy.db
    --help, -h               Show this help
`

/**
 * Parse CLI arguments for the run command.
 */
function parseArgs(args: string[]): RunOptions {
  const opts: RunOptions = {
    file: 'convoy.yml',
    dryRun: false,
    concurrency: null,
    adapter: null,
    reportDir: null,
    verbose: false,
    help: false,
    resume: false,
    status: false,
  }

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    switch (arg) {
      case '--help':
      case '-h':
        opts.help = true
        break
      case '--file':
      case '-f':
        if (i + 1 >= args.length) { console.error('  \u2717 --file requires a path'); process.exit(1) }
        opts.file = args[++i]
        break
      case '--dryRun':
      case '--dry-run':
        opts.dryRun = true
        break
      case '--concurrency':
      case '-c': {
        if (i + 1 >= args.length) { console.error('  \u2717 --concurrency requires a number'); process.exit(1) }
        const val = parseInt(args[++i], 10)
        if (!Number.isFinite(val) || val < 1) {
          console.error(`  ✗ --concurrency must be an integer >= 1`)
          process.exit(1)
        }
        opts.concurrency = val
        break
      }
      case '--adapter':
      case '-a':
        if (i + 1 >= args.length) { console.error('  \u2717 --adapter requires a name'); process.exit(1) }
        opts.adapter = args[++i]
        break
      case '--report-dir':
        if (i + 1 >= args.length) { console.error('  \u2717 --report-dir requires a path'); process.exit(1) }
        opts.reportDir = args[++i]
        break
      case '--verbose':
        opts.verbose = true
        break
      case '--resume':
        opts.resume = true
        break
      case '--status':
        opts.status = true
        break
      default:
        console.error(`  ✗ Unknown option: ${arg}`)
        console.log(HELP)
        process.exit(1)
    }
  }

  return opts
}

/**
 * Print a user-friendly adapter unavailable error.
 */
function printAdapterError(detectionFailed: boolean, adapterName: string): void {
  if (detectionFailed) {
    console.error(
      `  ✗ No agent CLI found on your PATH.\n` +
        `    Install one of the following adapters:\n` +
        `    • copilot    — https://docs.github.com/en/copilot/how-tos/set-up/install-copilot-cli\n` +
        `    • claude     — npm install -g @anthropic-ai/claude-code\n` +
        `    • cursor     — https://cursor.com (Cursor > Install CLI)\n` +
        `    • opencode   — https://opencode.ai\n` +
        `\n` +
        `    Or specify an adapter explicitly: opencastle run --adapter <name>`
    )
  } else {
    const hints: Record<string, string> = {
      'claude':
        '    Install: npm install -g @anthropic-ai/claude-code\n' +
        '    Docs:    https://docs.anthropic.com/en/docs/claude-code',
      copilot:
        '    Requires the Copilot CLI installed and authenticated:\n' +
        '    https://docs.github.com/en/copilot/how-tos/set-up/install-copilot-cli\n' +
        '    Docs:    https://docs.github.com/en/copilot',
      cursor:
        '    The Cursor agent CLI ships with the Cursor editor.\n' +
        '    Install Cursor from https://cursor.com and ensure the\n' +
        '    "agent" command is on your PATH (Cursor > Install CLI).',
      opencode:
        '    Install OpenCode from https://opencode.ai\n' +
        '    Ensure the "opencode" command is on your PATH.',
    }
    const cliName = adapterName === 'cursor' ? 'agent' : adapterName
    const hint = hints[adapterName] ?? ''
    console.error(
      `  ✗ Adapter "${adapterName}" is not available.\n` +
        `    Make sure the "${cliName}" CLI is installed and on your PATH.\n` +
        hint
    )
  }
}

/**
 * Print a convoy result summary.
 */
function printConvoyResult(result: ConvoyResult): void {
  console.log(`\n  ──────────────────────────────────────`)
  console.log(`  Convoy ${result.status}: ${result.duration}`)
  console.log(
    `  Tasks: ${result.summary.done}/${result.summary.total} done` +
    (result.summary.failed > 0 ? ` | ${result.summary.failed} failed` : '') +
    (result.summary.skipped > 0 ? ` | ${result.summary.skipped} skipped` : '') +
    (result.summary.timedOut > 0 ? ` | ${result.summary.timedOut} timed out` : '')
  )
  if (result.gateResults) {
    const gatesPassed = result.gateResults.filter(g => g.passed).length
    const gatesFailed = result.gateResults.filter(g => !g.passed).length
    console.log(`  Gates: ${gatesPassed}/${result.gateResults.length} passed${gatesFailed > 0 ? ` | ${gatesFailed} failed` : ''}`)
    for (const g of result.gateResults) {
      console.log(`    ${g.passed ? '✓' : '✗'} ${g.command}`)
    }
  }
  if (result.cost) {
    console.log(`  Tokens: ${formatTokens(result.cost.total_tokens)}`)
  }
}

/**
 * Print a pipeline result summary.
 */
function printPipelineResult(result: PipelineResult): void {
  console.log(`\n  ──────────────────────────────────────`)
  console.log(`  Pipeline ${result.status}: ${result.duration}`)
  console.log(
    `  Convoys: ${result.summary.completed}/${result.summary.totalConvoys} completed` +
    (result.summary.failed > 0 ? ` | ${result.summary.failed} failed` : '') +
    (result.summary.skipped > 0 ? ` | ${result.summary.skipped} skipped` : '')
  )
  for (const cr of result.convoyResults) {
    const icon = cr.status === 'done' ? '✓' : cr.status === 'failed' ? '✗' : '⊘'
    console.log(`    ${icon} ${cr.convoyId}: ${cr.status} (${cr.duration})`)
  }
  if (result.cost) {
    console.log(`  Tokens: ${formatTokens(result.cost.total_tokens)}`)
  }
}

/**
 * CLI entry point for the `run` command.
 */
export default async function run({ args, pkgRoot }: CliContext): Promise<void> {
  const opts = parseArgs(args)

  if (opts.help) {
    console.log(HELP)
    return
  }

  const dbPath = resolve(process.cwd(), '.opencastle', 'convoy.db')

  // ── --status flag ─────────────────────────────────────────────
  if (opts.status) {
    if (!existsSync(dbPath)) {
      console.log('  No convoy database found at .opencastle/convoy.db')
      return
    }
    const { createConvoyStore } = await import('./convoy/store.js')
    const store = createConvoyStore(dbPath)
    try {
      const pipeline = store.getLatestPipeline()
      if (pipeline) {
        const pipelineConvoys = store.getConvoysByPipeline(pipeline.id)
        console.log(`\n  Pipeline: ${pipeline.name}`)
        console.log(`  ID:       ${pipeline.id}`)
        console.log(`  Status:   ${pipeline.status}`)
        console.log(`  Branch:   ${pipeline.branch ?? '(none)'}`)
        console.log(`  Created:  ${pipeline.created_at}`)
        if (pipeline.started_at) console.log(`  Started:  ${pipeline.started_at}`)
        if (pipeline.finished_at) console.log(`  Finished: ${pipeline.finished_at}`)
        if (pipelineConvoys.length > 0) {
          console.log(`\n  Convoys:`)
          let totalTasks = 0
          let totalDone = 0
          let totalFailed = 0
          let totalTokens = 0
          for (const c of pipelineConvoys) {
            const tasks = store.getTasksByConvoy(c.id)
            const done = tasks.filter(t => t.status === 'done').length
            const failed = tasks.filter(t => t.status === 'failed').length
            totalTasks += tasks.length
            totalDone += done
            totalFailed += failed
            totalTokens += tasks.reduce((sum, t) => sum + (t.total_tokens ?? 0), 0)
            console.log(`    ${c.name} [${c.status}] — ${done}/${tasks.length} tasks done`)
          }
          console.log(`\n  Tasks: ${totalDone} done | ${totalFailed} failed | ${totalTasks} total`)
          if (totalTokens > 0) console.log(`  Tokens: ${formatTokens(totalTokens)}`)
        }
        return
      }

      const convoy = store.getLatestConvoy()
      if (!convoy) {
        console.log('  No convoy records found.')
        return
      }
      const tasks = store.getTasksByConvoy(convoy.id)
      const byStatus = tasks.reduce((acc, t) => {
        acc[t.status] = (acc[t.status] ?? 0) + 1
        return acc
      }, {} as Record<string, number>)
      console.log(`\n  Convoy: ${convoy.name}`)
      console.log(`  ID:     ${convoy.id}`)
      console.log(`  Status: ${convoy.status}`)
      console.log(`  Branch: ${convoy.branch ?? '(none)'}`)
      console.log(`  Created: ${convoy.created_at}`)
      if (convoy.started_at) console.log(`  Started: ${convoy.started_at}`)
      if (convoy.finished_at) console.log(`  Finished: ${convoy.finished_at}`)
      console.log(`\n  Tasks:`)
      for (const [status, count] of Object.entries(byStatus)) {
        console.log(`    ${status}: ${count}`)
      }
      console.log(`    total: ${tasks.length}`)
      const totalTokens = tasks.reduce((sum, t) => sum + (t.total_tokens ?? 0), 0)
      if (tasks.some(t => t.total_tokens != null)) {
        console.log(`\n  Tokens: ${formatTokens(totalTokens)}`)
        const tasksWithTokens = tasks.filter(t => t.total_tokens != null)
        if (tasksWithTokens.length > 0) {
          console.log(`\n  Token usage by task:`)
          for (const t of tasksWithTokens) {
            const parts = [formatTokens(t.total_tokens!)]
            if (t.prompt_tokens != null) parts.push(`in: ${formatTokens(t.prompt_tokens)}`)
            if (t.completion_tokens != null) parts.push(`out: ${formatTokens(t.completion_tokens)}`)
            console.log(`    ${t.id}: ${parts.join(' | ')}`)
          }
        }
      }
    } finally {
      store.close()
    }
    return
  }

  // ── --resume flag ─────────────────────────────────────────────
  if (opts.resume) {
    if (!existsSync(dbPath)) {
      console.error('  ✗ No convoy database found at .opencastle/convoy.db')
      console.error('    Run a convoy spec first: opencastle run convoy.yml')
      process.exit(1)
    }
    const { createConvoyStore } = await import('./convoy/store.js')
    const store = createConvoyStore(dbPath)
    const latestPipeline = store.getLatestPipeline()
    if (latestPipeline && (latestPipeline.status === 'pending' || latestPipeline.status === 'running')) {
      store.close()
      const resumePipelineSpec = parseTaskSpecText(latestPipeline.spec_yaml)
      if (opts.concurrency !== null) resumePipelineSpec.concurrency = opts.concurrency
      if (opts.adapter !== null) resumePipelineSpec.adapter = opts.adapter
      if (opts.verbose) resumePipelineSpec._verbose = true

      let resumePipelineDetectionFailed = false
      if (!resumePipelineSpec.adapter) {
        const detected = await detectAdapter()
        if (detected) {
          resumePipelineSpec.adapter = detected
          console.log(`  ℹ Auto-detected adapter: ${detected}`)
        } else {
          resumePipelineDetectionFailed = true
          resumePipelineSpec.adapter = 'claude'
        }
      }

      const resumePipelineAdapter = await getAdapter(resumePipelineSpec.adapter)
      const resumePipelineAvailable = await resumePipelineAdapter.isAvailable()
      if (!resumePipelineAvailable) {
        printAdapterError(resumePipelineDetectionFailed, resumePipelineSpec.adapter)
        process.exit(1)
      }

      console.log(`\n  🏰 OpenCastle Pipeline (Resume): ${latestPipeline.name}`)
      console.log(`  Pipeline ID: ${latestPipeline.id}`)
      const { createPipelineOrchestrator } = await import('./convoy/pipeline.js')
      const resumePipelineOrchestrator = createPipelineOrchestrator({
        spec: resumePipelineSpec,
        specYaml: latestPipeline.spec_yaml,
        adapter: resumePipelineAdapter,
        verbose: opts.verbose,
      })
      const resumePipelineResult = await resumePipelineOrchestrator.resume(latestPipeline.id)
      printPipelineResult(resumePipelineResult)
      process.exit(resumePipelineResult.status !== 'done' ? 1 : 0)
    }

    const convoy = store.getLatestConvoy()
    store.close()
    if (!convoy) {
      console.error('  ✗ No convoy records found in .opencastle/convoy.db')
      process.exit(1)
    }
    if (convoy.status === 'done' || convoy.status === 'failed') {
      console.error(
        `  ✗ Last convoy "${convoy.name}" already finished with status: ${convoy.status}`
      )
      console.error(`    Only interrupted (running/pending) convoys can be resumed.`)
      process.exit(1)
    }

    const resumeSpec = parseTaskSpecText(convoy.spec_yaml)
    if (opts.concurrency !== null) resumeSpec.concurrency = opts.concurrency
    if (opts.adapter !== null) resumeSpec.adapter = opts.adapter
    if (opts.verbose) resumeSpec._verbose = true

    let resumeDetectionFailed = false
    if (!resumeSpec.adapter) {
      const detected = await detectAdapter()
      if (detected) {
        resumeSpec.adapter = detected
        console.log(`  ℹ Auto-detected adapter: ${detected}`)
      } else {
        resumeDetectionFailed = true
        resumeSpec.adapter = 'claude'
      }
    }

    const resumeAdapter = await getAdapter(resumeSpec.adapter)
    const resumeAvailable = await resumeAdapter.isAvailable()
    if (!resumeAvailable) {
      printAdapterError(resumeDetectionFailed, resumeSpec.adapter)
      process.exit(1)
    }

    console.log(`\n  \uD83C\uDFF0 OpenCastle Convoy (Resume): ${convoy.name}`)
    console.log(`  Convoy ID: ${convoy.id}`)
    const { createConvoyEngine } = await import('./convoy/engine.js')
    const resumeEngine = createConvoyEngine({
      spec: resumeSpec,
      specYaml: convoy.spec_yaml,
      adapter: resumeAdapter,
      verbose: opts.verbose,
    })
    const resumeResult = await resumeEngine.resume(convoy.id)
    printConvoyResult(resumeResult)
    process.exit(resumeResult.status !== 'done' ? 1 : 0)
  }

  // ── Read and validate spec ────────────────────────────────────
  const specPath = resolve(process.cwd(), opts.file)
  let specText = ''
  try {
    specText = await readFile(specPath, 'utf8')
  } catch (err: unknown) {
    const e = err as Error & { code?: string }
    if (e.code === 'ENOENT') {
      console.error(`  ✗ Task spec file not found: ${opts.file}`)
    } else {
      console.error(`  ✗ Cannot read task spec file: ${e.message}`)
    }
    process.exit(1)
  }

  let spec
  try {
    spec = parseTaskSpecText(specText)
  } catch (err: unknown) {
    console.error(`  ✗ ${(err as Error).message}`)
    process.exit(1)
  }

  // Apply CLI overrides
  if (opts.concurrency !== null) spec.concurrency = opts.concurrency
  if (opts.adapter !== null) spec.adapter = opts.adapter
  if (opts.verbose) spec._verbose = true

  // ── Auto-detect adapter if not specified ─────────────────────
  let detectionFailed = false
  if (!spec.adapter) {
    const detected = await detectAdapter()
    if (detected) {
      spec.adapter = detected
      console.log(`  ℹ Auto-detected adapter: ${detected}`)
    } else {
      detectionFailed = true
      spec.adapter = 'claude' // fallback for availability check below
    }
  }

  // ── Dry run ──────────────────────────────────────────────────
  if (opts.dryRun) {
    if (isPipelineSpec(spec)) {
      console.log(`\n  🏰 Pipeline Plan: ${spec.name}`)
      console.log(`  Convoy chain: ${(spec.depends_on_convoy as string[]).join(' → ')}`)
      if (spec.tasks?.length) {
        console.log(`  Plus ${spec.tasks.length} local tasks after chain completes`)
      }
      if (spec.branch) console.log(`  Branch: ${spec.branch}`)
      if (spec.gates?.length) console.log(`  Gates: ${spec.gates.length} validation commands`)
      if (!spec.tasks?.length) return
    } else if (isConvoySpec(spec)) {
      console.log(`\n  \uD83C\uDFF0 Convoy Plan: ${spec.name}`)
      console.log(
        `  Adapter: ${spec.adapter} | Concurrency: ${spec.concurrency} | Tasks: ${spec.tasks!.length}`
      )
      if (spec.branch) console.log(`  Branch: ${spec.branch}`)
      if (spec.gates?.length) console.log(`  Gates: ${spec.gates.length} validation commands`)
    }
    const phases = buildPhases(spec.tasks!)
    printExecutionPlan(spec, phases)
    return
  }

  // ── Check adapter ────────────────────────────────────────────
  const adapter = await getAdapter(spec.adapter)
  const available = await adapter.isAvailable()
  if (!available) {
    printAdapterError(detectionFailed, spec.adapter)
    process.exit(1)
  }

  // ── Pipeline orchestrator path (version: 2 specs with depends_on_convoy) ──
  if (isPipelineSpec(spec)) {
    const { createPipelineOrchestrator } = await import('./convoy/pipeline.js')
    console.log(`\n  🏰 OpenCastle Pipeline: ${spec.name}`)
    console.log(`  Convoy chain: ${(spec.depends_on_convoy as string[]).join(' → ')}`)
    if (spec.branch) console.log(`  Branch: ${spec.branch}`)
    if (spec.gates?.length) console.log(`  Gates: ${spec.gates.length} validation commands`)

    const { startDashboardServer } = await import('./dashboard.js')
    let pipelineDashboardResult: { server: import('node:http').Server; port: number; url: string } | null = null
    try {
      pipelineDashboardResult = await startDashboardServer({
        pkgRoot,
        openBrowser: true,
        convoyId: 'active',
      })
    } catch {
      // Dashboard failure must not block pipeline
    }
    if (pipelineDashboardResult) {
      console.log(`  ${c.dim('Dashboard:')} ${pipelineDashboardResult.url}`)
    }

    const pipelineOrchestrator = createPipelineOrchestrator({
      spec,
      specYaml: specText,
      adapter,
      verbose: opts.verbose,
    })

    const pipelineResult = await pipelineOrchestrator.run()
    printPipelineResult(pipelineResult)
    if (pipelineDashboardResult) {
      console.log(`\n  ${c.dim('Results saved to .opencastle/logs/convoys.ndjson')}`)
      console.log(`  ${c.dim('View again:')} opencastle dashboard`)
      pipelineDashboardResult.server.close()
    }
    process.exit(pipelineResult.status !== 'done' ? 1 : 0)
  }

  // ── Convoy engine path (version: 1 specs) ────────────────────
  if (isConvoySpec(spec)) {
    const { createConvoyEngine } = await import('./convoy/engine.js')
    console.log(`\n  \uD83C\uDFF0 OpenCastle Convoy: ${spec.name}`)
    console.log(
      `  Adapter: ${adapter.name} | Concurrency: ${spec.concurrency} | Tasks: ${spec.tasks!.length}`
    )
    if (spec.branch) console.log(`  Branch: ${spec.branch}`)
    if (spec.gates?.length) console.log(`  Gates: ${spec.gates.length} validation commands`)

    const { startDashboardServer } = await import('./dashboard.js')
    let dashboardResult: { server: import('node:http').Server; port: number; url: string } | null = null
    try {
      dashboardResult = await startDashboardServer({
        pkgRoot,
        openBrowser: true,
        convoyId: 'active',
      })
    } catch {
      // Dashboard failure must not block convoy
    }
    if (dashboardResult) {
      console.log(`  ${c.dim('Dashboard:')} ${dashboardResult.url}`)
    }

    const engine = createConvoyEngine({
      spec,
      specYaml: specText,
      adapter,
      verbose: opts.verbose,
    })

    const result = await engine.run()
    printConvoyResult(result)
    if (dashboardResult) {
      console.log(`\n  ${c.dim('Results saved to .opencastle/logs/convoys.ndjson')}`)
      console.log(`  ${c.dim('View again:')} opencastle dashboard`)
      dashboardResult.server.close()
    }
    process.exit(result.status !== 'done' ? 1 : 0)
  }

  // ── Legacy executor path ──────────────────────────────────────
  console.log(`\n  \uD83C\uDFF0 OpenCastle Run: ${spec.name}`)
  console.log(
    `  Adapter: ${adapter.name} | Concurrency: ${spec.concurrency} | Tasks: ${spec.tasks!.length}`
  )

  const reporter = createReporter(spec, {
    reportDir: opts.reportDir
      ? resolve(process.cwd(), opts.reportDir)
      : undefined,
    verbose: opts.verbose,
  })

  const executor = createExecutor(spec, adapter, reporter)
  const report = await executor.run()

  // ── Exit code ────────────────────────────────────────────────
  const hasFailures = report.summary.failed > 0 || report.summary['timed-out'] > 0
  process.exit(hasFailures ? 1 : 0)
}
