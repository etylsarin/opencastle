import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { parseTaskSpec } from './run/schema.js'
import { createExecutor, buildPhases } from './run/executor.js'
import { getAdapter, detectAdapter } from './run/adapters/index.js'
import { createReporter, printExecutionPlan } from './run/reporter.js'
import type { CliContext, RunOptions } from './types.js'

const HELP = `
  opencastle run [options]

  Process a task queue from a spec file, delegating to AI agents autonomously.
  Supports two modes: tasks (default phase-based execution) and loop (iterative Ralph Loop).

  Options:
    --file, -f <path>        Task spec file (default: opencastle.tasks.yml)
    --dry-run                Show execution plan without running
    --concurrency, -c <n>    Override max parallel tasks (tasks mode)
    --adapter, -a <name>     Override agent runtime adapter
    --report-dir <path>      Where to write run reports (default: .opencastle/runs)
    --verbose                Show full agent output
    --mode <name>            Execution mode: tasks | loop
    --max-iterations <n>     Override max loop iterations (loop mode)
    --help, -h               Show this help
`

/**
 * Parse CLI arguments for the run command.
 */
function parseArgs(args: string[]): RunOptions {
  const opts: RunOptions = {
    file: 'opencastle.tasks.yml',
    dryRun: false,
    concurrency: null,
    adapter: null,
    reportDir: null,
    verbose: false,
    help: false,
    maxIterations: null,
    mode: null,
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
      case '--max-iterations': {
        if (i + 1 >= args.length) { console.error('  \u2717 --max-iterations requires a number'); process.exit(1) }
        const val = parseInt(args[++i], 10)
        if (!Number.isFinite(val) || val < 1) {
          console.error(`  \u2717 --max-iterations must be an integer >= 1`)
          process.exit(1)
        }
        opts.maxIterations = val
        break
      }
      case '--mode': {
        if (i + 1 >= args.length) { console.error('  \u2717 --mode requires a name'); process.exit(1) }
        const modeVal = args[++i]
        if (modeVal !== 'tasks' && modeVal !== 'loop') {
          console.error(`  \u2717 --mode must be one of: tasks, loop`)
          process.exit(1)
        }
        opts.mode = modeVal
        break
      }
      default:
        console.error(`  ✗ Unknown option: ${arg}`)
        console.log(HELP)
        process.exit(1)
    }
  }

  return opts
}

/**
 * CLI entry point for the `run` command.
 */
export default async function run({ args }: CliContext): Promise<void> {
  const opts = parseArgs(args)

  if (opts.help) {
    console.log(HELP)
    return
  }

  // ── Read and validate spec ────────────────────────────────────
  const specPath = resolve(process.cwd(), opts.file)
  const spec = await parseTaskSpec(specPath)

  // Apply CLI overrides
  if (opts.concurrency !== null) spec.concurrency = opts.concurrency
  if (opts.adapter !== null) spec.adapter = opts.adapter
  if (opts.verbose) spec._verbose = true
  if (opts.mode !== null) spec.mode = opts.mode as 'tasks' | 'loop'

  // ── Auto-detect adapter if not specified ─────────────────────
  let detectionFailed = false
  if (!spec.adapter) {
    const detected = await detectAdapter()
    if (detected) {
      spec.adapter = detected
      console.log(`  ℹ Auto-detected adapter: ${detected}`)
    } else {
      detectionFailed = true
      spec.adapter = 'claude-code' // fallback for availability check below
    }
  }

  // ── Dry run ──────────────────────────────────────────────────
  if (opts.dryRun) {
    if (spec.mode === 'loop') {
      const loop = spec.loop!
      console.log(`\n  \uD83C\uDFF0 Loop Plan: ${spec.name}`)
      console.log(`  Mode: loop`)
      console.log(`  Prompt: ${loop.prompt}`)
      console.log(`  Max iterations: ${loop.max_iterations}`)
      console.log(`  Timeout: ${loop.timeout}`)
      if (loop.plan_file) console.log(`  Plan file: ${loop.plan_file}`)
      if (loop.model) console.log(`  Model: ${loop.model}`)
      if (loop.backpressure?.length) {
        console.log(`  Backpressure:`)
        for (const cmd of loop.backpressure) {
          console.log(`    - ${cmd}`)
        }
      }
      return
    }
    const phases = buildPhases(spec.tasks!)
    printExecutionPlan(spec, phases)
    return
  }

  // ── Check adapter ────────────────────────────────────────────
  const adapter = await getAdapter(spec.adapter)
  const available = await adapter.isAvailable()
  if (!available) {
    if (detectionFailed) {
      console.error(
        `  ✗ No agent CLI found on your PATH.\n` +
          `    Install one of the following adapters:\n` +
          `    • copilot    — https://docs.github.com/en/copilot/how-tos/set-up/install-copilot-cli\n` +
          `    • claude     — npm install -g @anthropic-ai/claude-code\n` +
          `    • cursor     — https://cursor.com (Cursor > Install CLI)\n` +
          `\n` +
          `    Or specify an adapter explicitly: opencastle run --adapter <name>`
      )
    } else {
      const hints: Record<string, string> = {
        'claude-code':
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
      }
      const cliName = spec.adapter === 'claude-code' ? 'claude' : spec.adapter
      const hint = hints[spec.adapter] ?? ''
      console.error(
        `  ✗ Adapter "${spec.adapter}" is not available.\n` +
          `    Make sure the "${cliName}" CLI is installed and on your PATH.\n` +
          hint
      )
    }
    process.exit(1)
  }

  // ── Execute ──────────────────────────────────────────────────
  if (spec.mode === 'loop') {
    const { createLoopExecutor } = await import('./run/loop-executor.js')
    const { createLoopReporter } = await import('./run/loop-reporter.js')

    if (opts.maxIterations !== null && spec.loop) {
      spec.loop.max_iterations = opts.maxIterations
    }

    const promptPath = resolve(process.cwd(), spec.loop!.prompt)
    try {
      await readFile(promptPath)
    } catch {
      console.error(`  \u2717 Prompt file not found: ${spec.loop!.prompt}`)
      process.exit(1)
    }

    console.log(`\n  \uD83C\uDFF0 OpenCastle Loop: ${spec.name}`)
    console.log(`  Adapter: ${adapter.name} | Max iterations: ${spec.loop!.max_iterations} | Timeout: ${spec.loop!.timeout}`)
    if (spec.loop!.backpressure?.length) {
      console.log(`  Backpressure: ${spec.loop!.backpressure.join(', ')}`)
    }

    const loopReporter = createLoopReporter(spec.name, {
      reportDir: opts.reportDir ? resolve(process.cwd(), opts.reportDir) : undefined,
      verbose: opts.verbose,
    })

    const loopExecutor = createLoopExecutor(spec, adapter, loopReporter)
    const loopReport = await loopExecutor.run()

    const failed = loopReport.stoppedReason === 'error' || loopReport.stoppedReason === 'backpressure-fail'
    process.exit(failed ? 1 : 0)
  }

  console.log(`\n  \uD83C\uDFF0 OpenCastle Run: ${spec.name}`)
  console.log(`  Adapter: ${adapter.name} | Concurrency: ${spec.concurrency} | Tasks: ${spec.tasks!.length}`)

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
