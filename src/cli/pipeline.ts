import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { stringify } from 'yaml'
import { c, confirm, closePrompts } from './prompt.js'
import { runPromptStep } from './plan.js'
import type { CliContext } from './types.js'

export interface ConvoyGroup {
  name: string
  description: string
  phases: number[]
  depends_on: string[]
}

export interface ComplexityAssessment {
  total_tasks: number
  total_phases: number
  domains: string[]
  estimated_duration_minutes?: number
  complexity: 'low' | 'medium' | 'high'
  recommended_strategy: 'single' | 'chain'
  chain_rationale?: string
  convoy_groups: ConvoyGroup[]
}

export function parseComplexityAssessment(prdContent: string): ComplexityAssessment | null {
  const sectionMatch = prdContent.match(/## Complexity Assessment\s+([\s\S]*?)(?=\n## |\n# |$)/)
  if (!sectionMatch) return null

  const sectionContent = sectionMatch[1]
  const jsonMatch = sectionContent.match(/```json\s*([\s\S]*?)```/)
  if (!jsonMatch) return null

  try {
    const parsed = JSON.parse(jsonMatch[1].trim()) as ComplexityAssessment
    // Validate required fields
    if (
      typeof parsed.total_tasks !== 'number' ||
      typeof parsed.total_phases !== 'number' ||
      !Array.isArray(parsed.domains) ||
      !parsed.complexity ||
      !parsed.recommended_strategy ||
      !Array.isArray(parsed.convoy_groups)
    ) {
      return null
    }
    return parsed
  } catch {
    return null
  }
}

const HELP = `
  opencastle pipeline [options]

  Run the full convoy generation pipeline from a feature prompt:

    Step 1 — Generate PRD        (generate-prd)
    Step 2 — Validate PRD        (validate-prd)
    Step 3 — Fix PRD             (fix-prd, up to 2 retries if invalid)
    Step 4 — Generate convoy spec (generate-convoy, using PRD as BDO)
    Step 5 — Validate convoy spec (validate-convoy)
    Step 6 — Fix convoy spec      (fix-convoy, up to 2 retries if invalid)

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

  const totalSteps = opts.skipValidation ? 3 : 6
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
      let prdValidationErrors = result.errors ?? result.rawOutput
      console.log(c.yellow(`  ⚠ PRD has validation issues — attempting auto-fix…\n`))
      console.log(c.dim(prdValidationErrors))
      console.log()

      // ── Step 3: Fix PRD (up to 2 retries) ──────────────────────────────────
      const MAX_PRD_FIX_RETRIES = 2
      let fixedPrdContent = prdContent
      let prdFixed = false

      for (let attempt = 1; attempt <= MAX_PRD_FIX_RETRIES; attempt++) {
        const label = `Fix PRD attempt ${attempt}/${MAX_PRD_FIX_RETRIES}…`
        console.log(stepLabel(3, totalSteps, label))

        try {
          await runPromptStep({
            ...sharedOpts,
            template: 'fix-prd',
            goalText: fixedPrdContent,
            contextText: prdValidationErrors,
            outputPath: prdPath, // overwrite in place
          })
        } catch (err) {
          console.error(`\n  ✗ Step 3 (attempt ${attempt}) failed: ${err instanceof Error ? err.message : String(err)}`)
          process.exit(1)
        }

        console.log(c.dim(`  Re-validating after fix…`))

        fixedPrdContent = await readFile(prdPath, 'utf8')

        let revalidation
        try {
          revalidation = await runPromptStep({
            ...sharedOpts,
            template: 'validate-prd',
            goalText: fixedPrdContent,
          })
        } catch (err) {
          console.error(`\n  ✗ Re-validation failed: ${err instanceof Error ? err.message : String(err)}`)
          process.exit(1)
        }

        if (revalidation.isValid) {
          console.log(c.green(`  ✓ PRD fixed and validated\n`))
          prdFixed = true
          break
        }

        prdValidationErrors = revalidation.errors ?? revalidation.rawOutput

        if (attempt < MAX_PRD_FIX_RETRIES) {
          console.log(c.yellow(`  ⚠ Still has issues after fix attempt ${attempt} — retrying…\n`))
          console.log(c.dim(prdValidationErrors))
          console.log()
        }
      }

      if (!prdFixed) {
        console.log(c.red(`\n  ✗ Could not auto-fix the PRD after ${MAX_PRD_FIX_RETRIES} attempts.\n`))
        console.log(`  Remaining issues:\n`)
        console.log(prdValidationErrors)
        console.log(
          c.dim(`\n  The PRD has been saved to ${relPath(prdPath)} with the best available fixes.\n`) +
            c.dim(`  Review the remaining issues above and edit the file manually, then re-run with:\n`) +
            `    opencastle pipeline --prd ${relPath(prdPath)}${opts.adapter ? ` --adapter ${opts.adapter}` : ''}\n`
        )
        process.exit(1)
      }
    } else {
      console.log(c.green(`  ✓ PRD is valid\n`))
    }
  }

  // ── Complexity-aware strategy decision ────────────────────────────────────
  const prdContentForComplexity = await readFile(prdPath, 'utf8')
  const complexity = parseComplexityAssessment(prdContentForComplexity)

  if (complexity) {
    if (complexity.recommended_strategy === 'chain' && complexity.convoy_groups.length > 1) {
      console.log(
        c.cyan(`  ℹ`) +
          ` Complexity: ${complexity.complexity} | Strategy: chain | ${complexity.convoy_groups.length} convoy groups\n`
      )
      console.log(`  Chain plan:`)
      for (let i = 0; i < complexity.convoy_groups.length; i++) {
        const g = complexity.convoy_groups[i]
        const depStr =
          g.depends_on.length > 0 ? ` → depends on: ${g.depends_on.join(', ')}` : ''
        console.log(
          `    ${i + 1}. ${g.name.padEnd(20)} (phases: ${g.phases.join(', ')})${depStr}`
        )
      }
      console.log()

      const convoyDir = resolve(process.cwd(), '.opencastle', 'convoys')
      await mkdir(convoyDir, { recursive: true })

      const genBaseStep = opts.skipValidation ? 2 : 4
      const groupSpecPaths: string[] = []
      const totalGroupSteps =
        (opts.skipValidation ? 2 : 3) + complexity.convoy_groups.length * (opts.skipValidation ? 1 : 2)

      for (let i = 0; i < complexity.convoy_groups.length; i++) {
        const group = complexity.convoy_groups[i]
        const groupStep = genBaseStep + i * (opts.skipValidation ? 1 : 2)

        console.log(
          stepLabel(
            groupStep,
            totalGroupSteps,
            `Generating convoy spec for group: ${group.name}…`
          )
        )

        const chainContext = JSON.stringify({
          mode: 'chain_subset',
          group_name: group.name,
          group_description: group.description,
          group_phases: group.phases,
          depends_on_groups: group.depends_on,
          total_groups: complexity.convoy_groups.length,
          group_index: i + 1,
        })

        const groupSpecPath = resolve(convoyDir, `${group.name}.convoy.yml`)

        let groupResult
        try {
          groupResult = await runPromptStep({
            ...sharedOpts,
            template: 'generate-convoy',
            filePath: prdPath,
            contextText: chainContext,
            outputPath: groupSpecPath,
          })
        } catch (err) {
          console.error(
            `\n  ✗ Step ${groupStep} failed: ${err instanceof Error ? err.message : String(err)}`
          )
          process.exit(1)
        }

        const resolvedGroupSpecPath = groupResult.outputPath ?? groupSpecPath
        groupSpecPaths.push(resolvedGroupSpecPath)

        console.log(c.green(`  ✓ Group spec written to ${relPath(resolvedGroupSpecPath)}\n`))

        if (!opts.skipValidation) {
          const valStep = groupStep + 1
          console.log(stepLabel(valStep, totalGroupSteps, `Validating spec: ${group.name}…`))

          const groupSpecContent = await readFile(resolvedGroupSpecPath, 'utf8')
          let groupValidation
          try {
            groupValidation = await runPromptStep({
              ...sharedOpts,
              template: 'validate-convoy',
              goalText: groupSpecContent,
            })
          } catch (err) {
            console.error(
              `\n  ✗ Validation failed for group ${group.name}: ${err instanceof Error ? err.message : String(err)}`
            )
            process.exit(1)
          }

          if (!groupValidation.isValid) {
            console.log(c.yellow(`  ⚠ Spec has issues — attempting one auto-fix…\n`))
            console.log(c.dim(groupValidation.errors ?? groupValidation.rawOutput))
            console.log()

            try {
              await runPromptStep({
                ...sharedOpts,
                template: 'fix-convoy',
                goalText: groupSpecContent,
                contextText: groupValidation.errors ?? groupValidation.rawOutput,
                outputPath: resolvedGroupSpecPath,
              })
            } catch (err) {
              console.error(
                `\n  ✗ Fix failed for group ${group.name}: ${err instanceof Error ? err.message : String(err)}`
              )
              process.exit(1)
            }

            console.log(c.dim(`  Applied fix for ${group.name}\n`))
          } else {
            console.log(c.green(`  ✓ Spec valid\n`))
          }
        }
      }

      // Build master pipeline spec (version 2)
      const featureNameMatch = prdContentForComplexity.match(/^# (.+?)\s*(?:—|-)?\s*PRD/m)
      const featureName = featureNameMatch
        ? featureNameMatch[1].trim().toLowerCase().replace(/[^a-z0-9]+/g, '-')
        : 'feature'

      const branchMatch = prdContentForComplexity.match(/`feat\/([^`]+)`/)
      const branch = branchMatch ? `feat/${branchMatch[1]}` : `feat/${featureName}`

      const masterSpec = {
        name: featureNameMatch ? featureNameMatch[1].trim() : 'Feature Pipeline',
        version: 2,
        branch,
        on_failure: 'stop',
        depends_on_convoy: groupSpecPaths.map(p => relPath(p)),
      }

      const masterSpecPath = resolve(convoyDir, `${featureName}-pipeline.convoy.yml`)
      await writeFile(masterSpecPath, stringify(masterSpec), 'utf8')

      console.log(c.green(`  ✓ Generated convoy chain:\n`))
      for (const p of groupSpecPaths) {
        console.log(`    ${relPath(p)}`)
      }
      console.log(`    ${relPath(masterSpecPath)} ${c.dim('(master)')}`)
      console.log()
      console.log(
        `  ${c.dim('Preview:')} npx opencastle run -f ${relPath(masterSpecPath)} --dry-run\n` +
          `  ${c.dim('Execute:')} npx opencastle run -f ${relPath(masterSpecPath)}\n`
      )

      try {
        const shouldRun = await confirm('Run the convoy chain now?', true)
        if (shouldRun) {
          closePrompts()
          const runModule = await import('./run.js')
          const runArgs = ['-f', masterSpecPath]
          if (opts.adapter) runArgs.push('-a', opts.adapter)
          if (opts.verbose) runArgs.push('--verbose')
          await runModule.default({ args: runArgs, pkgRoot })
        }
      } finally {
        closePrompts()
      }
      return
    } else {
      console.log(
        c.cyan(`  ℹ`) + ` Complexity: ${complexity.complexity} | Strategy: single\n`
      )
    }
  }

  // ── Step 4: Generate convoy spec ──────────────────────────────────────────
  const genStep = opts.skipValidation ? 2 : 4
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
    await printFinalSummary(prdPath, specPath, opts, pkgRoot)
    return
  }

  // ── Step 5: Validate convoy spec ──────────────────────────────────────────
  console.log(stepLabel(5, totalSteps, 'Validating convoy spec…'))

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
      console.error(`\n  ✗ Step 5 failed: ${err instanceof Error ? err.message : String(err)}`)
      process.exit(1)
    }

    if (result.isValid) {
      console.log(c.green(`  ✓ Convoy spec is valid\n`))
      await printFinalSummary(prdPath, specPath, opts, pkgRoot)
      return
    }

    validationErrors = result.errors ?? result.rawOutput
    console.log(c.yellow(`  ⚠ Spec has validation issues — attempting auto-fix…\n`))
    console.log(c.dim(validationErrors))
    console.log()
  }

  // ── Step 6: Fix convoy spec (up to 2 retries) ─────────────────────────────
  const MAX_FIX_RETRIES = 2
  let fixedSpecContent = specContent

  for (let attempt = 1; attempt <= MAX_FIX_RETRIES; attempt++) {
    const label = `Fix attempt ${attempt}/${MAX_FIX_RETRIES}…`
    console.log(stepLabel(6, totalSteps, label))

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
      console.error(`\n  ✗ Step 6 (attempt ${attempt}) failed: ${err instanceof Error ? err.message : String(err)}`)
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
      await printFinalSummary(prdPath, specPath, opts, pkgRoot)
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

async function printFinalSummary(
  prdPath: string,
  specPath: string,
  opts: PipelineOptions,
  pkgRoot: string,
): Promise<void> {
  const prd = relPath(prdPath)
  const spec = relPath(specPath)
  console.log(c.bold(c.green('  Pipeline complete!\n')))
  console.log(`  PRD:           ${prd}`)
  console.log(`  Convoy spec:   ${spec}\n`)
  console.log(
    `  ${c.dim('Preview:')} npx opencastle run -f ${spec} --dry-run\n` +
      `  ${c.dim('Execute:')} npx opencastle run -f ${spec}\n`
  )

  try {
    const shouldRun = await confirm('Run the convoy now?', true)
    if (shouldRun) {
      closePrompts()
      const runModule = await import('./run.js')
      const runArgs = ['-f', specPath]
      if (opts.adapter) runArgs.push('-a', opts.adapter)
      if (opts.verbose) runArgs.push('--verbose')
      await runModule.default({ args: runArgs, pkgRoot })
    }
  } finally {
    closePrompts()
  }
}
