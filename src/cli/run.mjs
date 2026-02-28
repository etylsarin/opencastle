/* global console, process */
import { resolve } from 'node:path'
import { parseTaskSpec } from './run/schema.mjs'
import { createExecutor, buildPhases } from './run/executor.mjs'
import { getAdapter } from './run/adapters/index.mjs'
import { createReporter, printExecutionPlan } from './run/reporter.mjs'

const HELP = `
  opencastle run [options]

  Process a task queue from a spec file, delegating to AI agents autonomously.

  Options:
    --file, -f <path>        Task spec file (default: opencastle.tasks.yml)
    --dry-run                Show execution plan without running
    --concurrency, -c <n>    Override max parallel tasks
    --adapter, -a <name>     Override agent runtime adapter
    --report-dir <path>      Where to write run reports (default: .opencastle/runs)
    --verbose                Show full agent output
    --help, -h               Show this help
`

/**
 * Parse CLI arguments for the run command.
 * @param {string[]} args
 * @returns {object} Parsed options
 */
function parseArgs(args) {
  const opts = {
    file: 'opencastle.tasks.yml',
    dryRun: false,
    concurrency: null,
    adapter: null,
    reportDir: null,
    verbose: false,
    help: false,
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
        opts.file = args[++i]
        break
      case '--dry-run':
        opts.dryRun = true
        break
      case '--concurrency':
      case '-c': {
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
        opts.adapter = args[++i]
        break
      case '--report-dir':
        opts.reportDir = args[++i]
        break
      case '--verbose':
        opts.verbose = true
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
 * CLI entry point for the `run` command.
 * @param {{ pkgRoot: string, args: string[] }} ctx
 */
export default async function run({ args }) {
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

  // ── Dry run ──────────────────────────────────────────────────
  const phases = buildPhases(spec.tasks)

  if (opts.dryRun) {
    printExecutionPlan(spec, phases)
    return
  }

  // ── Check adapter ────────────────────────────────────────────
  const adapter = await getAdapter(spec.adapter)
  const available = await adapter.isAvailable()
  if (!available) {
    console.error(
      `  ✗ Adapter "${spec.adapter}" is not available.\n` +
        `    Make sure the "${spec.adapter === 'claude-code' ? 'claude' : spec.adapter}" CLI is installed and on your PATH.`
    )
    process.exit(1)
  }

  // ── Execute ──────────────────────────────────────────────────
  console.log(`\n  🏰 OpenCastle Run: ${spec.name}`)
  console.log(`  Adapter: ${adapter.name} | Concurrency: ${spec.concurrency} | Tasks: ${spec.tasks.length}`)

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
