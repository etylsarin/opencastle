import { readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { c } from './prompt.js'
import { runPromptStep } from './plan.js'
import type { CliContext } from './types.js'

const HELP = `
  opencastle pipeline [options]

  Run the full convoy generation pipeline from a feature prompt:

    Step 1 — Generate PRD        (generate-prd)
    Step 2 — Validate PRD        (validate-prd)
    Step 3 — Generate convoy spec (generate-convoy, using PRD as BDO)
    Step 4 — Validate convoy spec (validate-convoy)
    Step 5 — Fix convoy spec      (fix-convoy, up to 2 retries if invalid)

  Options:
    --text, -t <text>        Feature prompt text (required, unless --prd is set)
    --prd <path>             Skip step 1 — use an existing PRD file
    --output-prd <path>      Override path for the generated PRD
    --output-spec <path>     Override path for the generated convoy spec
    --adapter, -a <name>     Override agent runtime adapter
    --verbose                Show full agent output for each step
    --dry-run                Generate and print the PRD prompt only, then stop
    --skip-validation        Skip steps 2 and 4 (PRD and convoy validation)
    --help, -h               Show this help
`

interface PipelineOptions {
  text: string | null
  prd: string | null
  outputPrd: string | null
  outputSpec: string | null
  adapter: string | null
  verbose: boolean
  dryRun: boolean
  skipValidation: boolean
  help: boolean
}

function parseArgs(args: string[]): PipelineOptions {
  const opts: PipelineOptions = {
    text: null,
    prd: null,
    outputPrd: null,
    outputSpec: null,
    adapter: null,
    verbose: false,
    dryRun: false,
    skipValidation: false,
    help: false,
  }

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    switch (arg) {
      case '--help':
      case '-h':
        opts.help = true
        break
      case '--text':
      case '-t':
        if (i + 1 >= args.length) { console.error('  ✗ --text requires a value'); process.exit(1) }
        opts.text = args[++i]
        break
      case '--prd':
        if (i + 1 >= args.length) { console.error('  ✗ --prd requires a path'); process.exit(1) }
        opts.prd = args[++i]
        break
      case '--output-prd':
        if (i + 1 >= args.length) { console.error('  ✗ --output-prd requires a path'); process.exit(1) }
        opts.outputPrd = args[++i]
        break
      case '--output-spec':
        if (i + 1 >= args.length) { console.error('  ✗ --output-spec requires a path'); process.exit(1) }
        opts.outputSpec = args[++i]
        break
      case '--adapter':
      case '-a':
        if (i + 1 >= args.length) { console.error('  ✗ --adapter requires a name'); process.exit(1) }
        opts.adapter = args[++i]
        break
      case '--verbose':
        opts.verbose = true
        break
      case '--dry-run':
      case '--dryRun':
        opts.dryRun = true
        break
      case '--skip-validation':
        opts.skipValidation = true
        break
      default:
        console.error(`  ✗ Unknown option: ${arg}`)
        console.log(HELP)
        process.exit(1)
    }
  }

  return opts
}

function relPath(abs: string): string {
  return abs.startsWith(process.cwd()) ? abs.slice(process.cwd().length + 1) : abs
}

function stepLabel(n: number, total: number, name: string): string {
  return c.bold(c.cyan(`  [${n}/${total}] ${name}`))
}

export default async function pipeline({ args, pkgRoot }: CliContext): Promise<void> {
  const opts = parseArgs(args)

  if (opts.help) {
    console.log(HELP)
    return
  }

  if (!opts.text && !opts.prd) {
    console.error(`  ✗ Either --text or --prd is required.`)
    console.log(HELP)
    process.exit(1)
  }

  if (opts.text && opts.prd) {
    console.error(`  ✗ --text and --prd are mutually exclusive.`)
    process.exit(1)
  }

  if (opts.prd) {
    const resolvedPrd = resolve(process.cwd(), opts.prd)
    if (!existsSync(resolvedPrd)) {
      console.error(`  ✗ PRD file not found: ${opts.prd}`)
      process.exit(1)
    }
  }

  const totalSteps = opts.skipValidation ? 3 : 5
  const sharedOpts = {
    adapterName: opts.adapter ?? undefined,
    verbose: opts.verbose,
    pkgRoot,
  }

  console.log(c.bold('\n  opencastle pipeline\n'))

  // ── Step 1: Generate PRD ──────────────────────────────────────────────────
  let prdPath: string

  if (opts.prd) {
    prdPath = resolve(process.cwd(), opts.prd)
    console.log(c.dim(`  [−] Skipping PRD generation — using: ${relPath(prdPath)}`))
  } else {
    console.log(stepLabel(1, totalSteps, 'Generating PRD…'))

    let result
    try {
      result = await runPromptStep({
        ...sharedOpts,
        template: 'generate-prd',
        goalText: opts.text!,
        outputPath: opts.outputPrd ? resolve(process.cwd(), opts.outputPrd) : undefined,
        dryRun: opts.dryRun,
      })
    } catch (err) {
      console.error(`\n  ✗ Step 1 failed: ${err instanceof Error ? err.message : String(err)}`)
      process.exit(1)
    }

    if (opts.dryRun) {
      console.log(c.dim('\n  [dry-run] Stopping after step 1. Remove --dry-run to run the full pipeline.'))
      return
    }

    prdPath = result.outputPath!
    console.log(c.green(`  ✓ PRD written to ${relPath(prdPath)}\n`))
  }

  // ── Step 2: Validate PRD ──────────────────────────────────────────────────
  if (!opts.skipValidation) {
    console.log(stepLabel(2, totalSteps, 'Validating PRD…'))

    const prdContent = await readFile(prdPath, 'utf8')
    let result
    try {
      result = await runPromptStep({
        ...sharedOpts,
        template: 'validate-prd',
        goalText: prdContent,
      })
    } catch (err) {
      console.error(`\n  ✗ Step 2 failed: ${err instanceof Error ? err.message : String(err)}`)
      process.exit(1)
    }

    if (!result.isValid) {
      console.log(c.red(`  ✗ PRD validation failed.\n`))
      console.log(result.errors ?? result.rawOutput)
      console.log(
        c.dim(`\n  Fix the PRD at ${relPath(prdPath)} and re-run with:\n`) +
          `    opencastle pipeline --prd ${relPath(prdPath)}${opts.adapter ? ` --adapter ${opts.adapter}` : ''}\n`
      )
      process.exit(1)
    }

    console.log(c.green(`  ✓ PRD is valid\n`))
  }

  // ── Step 3: Generate convoy spec ──────────────────────────────────────────
  const genStep = opts.skipValidation ? 2 : 3
  console.log(stepLabel(genStep, totalSteps, 'Generating convoy spec…'))

  let specPath: string
  try {
    const result = await runPromptStep({
      ...sharedOpts,
      template: 'generate-convoy',
      filePath: prdPath,
      outputPath: opts.outputSpec ? resolve(process.cwd(), opts.outputSpec) : undefined,
    })
    specPath = result.outputPath!
  } catch (err) {
    console.error(`\n  ✗ Step ${genStep} failed: ${err instanceof Error ? err.message : String(err)}`)
    process.exit(1)
  }

  console.log(c.green(`  ✓ Convoy spec written to ${relPath(specPath)}\n`))

  if (opts.skipValidation) {
    printFinalSummary(prdPath, specPath)
    return
  }

  // ── Step 4: Validate convoy spec ──────────────────────────────────────────
  console.log(stepLabel(4, totalSteps, 'Validating convoy spec…'))

  const specContent = await readFile(specPath, 'utf8')
  let validationErrors: string

  {
    let result
    try {
      result = await runPromptStep({
        ...sharedOpts,
        template: 'validate-convoy',
        goalText: specContent,
      })
    } catch (err) {
      console.error(`\n  ✗ Step 4 failed: ${err instanceof Error ? err.message : String(err)}`)
      process.exit(1)
    }

    if (result.isValid) {
      console.log(c.green(`  ✓ Convoy spec is valid\n`))
      printFinalSummary(prdPath, specPath)
      return
    }

    validationErrors = result.errors ?? result.rawOutput
    console.log(c.yellow(`  ⚠ Spec has validation issues — attempting auto-fix…\n`))
    console.log(c.dim(validationErrors))
    console.log()
  }

  // ── Step 5: Fix convoy spec (up to 2 retries) ─────────────────────────────
  const MAX_FIX_RETRIES = 2
  let fixedSpecContent = specContent

  for (let attempt = 1; attempt <= MAX_FIX_RETRIES; attempt++) {
    const label = `Fix attempt ${attempt}/${MAX_FIX_RETRIES}…`
    console.log(stepLabel(5, totalSteps, label))

    let fixResult
    try {
      fixResult = await runPromptStep({
        ...sharedOpts,
        template: 'fix-convoy',
        goalText: fixedSpecContent,
        contextText: validationErrors,
        outputPath: specPath, // overwrite in place
      })
    } catch (err) {
      console.error(`\n  ✗ Step 5 (attempt ${attempt}) failed: ${err instanceof Error ? err.message : String(err)}`)
      process.exit(1)
    }

    console.log(c.dim(`  Re-validating after fix…`))

    // Read the newly written spec
    fixedSpecContent = await readFile(specPath, 'utf8')

    let revalidation
    try {
      revalidation = await runPromptStep({
        ...sharedOpts,
        template: 'validate-convoy',
        goalText: fixedSpecContent,
      })
    } catch (err) {
      console.error(`\n  ✗ Re-validation failed: ${err instanceof Error ? err.message : String(err)}`)
      process.exit(1)
    }

    if (revalidation.isValid) {
      console.log(c.green(`  ✓ Spec fixed and validated\n`))
      printFinalSummary(prdPath, specPath)
      return
    }

    validationErrors = revalidation.errors ?? revalidation.rawOutput

    if (attempt < MAX_FIX_RETRIES) {
      console.log(c.yellow(`  ⚠ Still has issues after fix attempt ${attempt} — retrying…\n`))
      console.log(c.dim(validationErrors))
      console.log()
    }
  }

  // All retries exhausted
  console.log(c.red(`\n  ✗ Could not auto-fix the convoy spec after ${MAX_FIX_RETRIES} attempts.\n`))
  console.log(`  Remaining issues:\n`)
  console.log(validationErrors)
  console.log(
    c.dim(`\n  The spec has been saved to ${relPath(specPath)} with the best available fixes.\n`) +
      c.dim(`  Review the remaining issues above and edit the file manually, then validate with:\n`) +
      `    opencastle plan --file ${relPath(specPath)} --template validate-convoy\n`
  )
  process.exit(1)
}

function printFinalSummary(prdPath: string, specPath: string): void {
  const prd = relPath(prdPath)
  const spec = relPath(specPath)
  console.log(c.bold(c.green('  Pipeline complete!\n')))
  console.log(`  PRD:           ${prd}`)
  console.log(`  Convoy spec:   ${spec}\n`)
  console.log(
    `  ${c.dim('Preview:')} npx opencastle run -f ${spec} --dry-run\n` +
      `  ${c.dim('Execute:')} npx opencastle run -f ${spec}\n`
  )
}
