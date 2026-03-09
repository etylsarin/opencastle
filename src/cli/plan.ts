import { readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { resolve, join, basename } from 'node:path'
import { mkdir, writeFile } from 'node:fs/promises'
import { getAdapter, detectAdapter } from './run/adapters/index.js'
import { parseTaskSpecText } from './run/schema.js'
import { c } from './prompt.js'
import type { CliContext, Task } from './types.js'

const HELP = `
  opencastle plan [options]

  Generate a convoy spec from a task description file by running it through the
  generate-convoy prompt via an AI adapter.

  Options:
    --file, -f <path>        Path to a text file with the task description (required)
    --context <path>         Optional path to an additional context file
    --output, -o <path>      Output path for the generated convoy spec
    --adapter, -a <name>     Override agent runtime adapter
    --verbose                Show full agent output
    --dry-run                Print the prompt that would be sent without executing
    --help, -h               Show this help
`

interface PlanOptions {
  file: string | null
  context: string | null
  output: string | null
  adapter: string | null
  verbose: boolean
  dryRun: boolean
  help: boolean
}

function parseArgs(args: string[]): PlanOptions {
  const opts: PlanOptions = {
    file: null,
    context: null,
    output: null,
    adapter: null,
    verbose: false,
    dryRun: false,
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
        if (i + 1 >= args.length) { console.error('  ✗ --file requires a path'); process.exit(1) }
        opts.file = args[++i]
        break
      case '--context':
        if (i + 1 >= args.length) { console.error('  ✗ --context requires a path'); process.exit(1) }
        opts.context = args[++i]
        break
      case '--output':
      case '-o':
        if (i + 1 >= args.length) { console.error('  ✗ --output requires a path'); process.exit(1) }
        opts.output = args[++i]
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
      default:
        console.error(`  ✗ Unknown option: ${arg}`)
        console.log(HELP)
        process.exit(1)
    }
  }

  return opts
}

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
        `    Or specify an adapter explicitly: opencastle plan --adapter <name>`
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
 * Strip YAML frontmatter (everything between first and second --- lines).
 */
function stripFrontmatter(text: string): string {
  const lines = text.split('\n')
  if (lines[0]?.trim() !== '---') return text
  const closingIdx = lines.findIndex((line, i) => i > 0 && line.trim() === '---')
  if (closingIdx === -1) return text
  return lines.slice(closingIdx + 1).join('\n').trimStart()
}

/**
 * Extract YAML content from a fenced code block (```yaml or ```yml).
 */
function extractYamlBlock(text: string): string | null {
  const match = text.match(/```ya?ml\s*\n([\s\S]*?)```/)
  if (!match) return null
  return match[1].trim()
}

/**
 * Derive an output filename from YAML content.
 * Checks for a comment on the first line, then falls back to the `name` field.
 */
function deriveOutputFilename(yaml: string): string {
  // First line comment: # .opencastle/convoys/some-name.convoy.yml
  const firstLine = yaml.split('\n')[0] ?? ''
  const commentMatch = firstLine.match(/^#\s*(.+\.convoy\.ya?ml)\s*$/)
  if (commentMatch) {
    return basename(commentMatch[1])
  }

  // Fall back to `name:` field
  const nameMatch = yaml.match(/^name:\s*['"]?([^'"\n]+)['"]?\s*$/m)
  if (nameMatch) {
    const kebab = nameMatch[1].trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    if (kebab) return `${kebab}.convoy.yml`
  }

  return 'convoy-plan.convoy.yml'
}

export default async function plan({ args, pkgRoot }: CliContext): Promise<void> {
  const opts = parseArgs(args)

  if (opts.help) {
    console.log(HELP)
    return
  }

  // ── Validate required --file arg ──────────────────────────────
  if (!opts.file) {
    console.error(`  ✗ --file is required. Specify a text file with the task description.`)
    console.log(HELP)
    process.exit(1)
  }

  const filePath = resolve(process.cwd(), opts.file)
  if (!existsSync(filePath)) {
    console.error(`  ✗ File not found: ${opts.file}`)
    process.exit(1)
  }

  // ── Read task description ──────────────────────────────────────
  const taskDescription = await readFile(filePath, 'utf8')

  // ── Read optional context file ─────────────────────────────────
  let contextContent = ''
  if (opts.context) {
    const contextPath = resolve(process.cwd(), opts.context)
    if (!existsSync(contextPath)) {
      console.error(`  ✗ Context file not found: ${opts.context}`)
      process.exit(1)
    }
    contextContent = await readFile(contextPath, 'utf8')
  }

  // ── Load and assemble the prompt template ─────────────────────
  const promptTemplatePath = join(pkgRoot, 'src', 'orchestrator', 'prompts', 'generate-convoy.prompt.md')
  if (!existsSync(promptTemplatePath)) {
    console.error(`  ✗ Prompt template not found: ${promptTemplatePath}`)
    process.exit(1)
  }

  const rawTemplate = await readFile(promptTemplatePath, 'utf8')
  const template = stripFrontmatter(rawTemplate)
  const assembledPrompt = template
    .replace('{{goal}}', taskDescription.trim())
    .replace('{{context}}', contextContent.trim())

  // ── Dry-run: print prompt and exit ────────────────────────────
  if (opts.dryRun) {
    console.log(c.bold(c.cyan('  Assembled prompt (dry-run):\n')))
    console.log(assembledPrompt)
    return
  }

  // ── Resolve adapter ───────────────────────────────────────────
  let adapterName: string
  if (opts.adapter) {
    adapterName = opts.adapter
  } else {
    const detected = await detectAdapter()
    if (!detected) {
      printAdapterError(true, '')
      process.exit(1)
    }
    adapterName = detected
  }

  let adapter
  try {
    adapter = await getAdapter(adapterName)
  } catch {
    printAdapterError(false, adapterName)
    process.exit(1)
  }

  const available = await adapter.isAvailable()
  if (!available) {
    printAdapterError(false, adapterName)
    process.exit(1)
  }

  console.log(c.dim(`  Using adapter: ${adapterName}`))
  console.log(c.dim(`  Generating convoy spec from: ${opts.file}\n`))

  // ── Execute the prompt through the adapter ────────────────────
  const task: Task = {
    id: 'generate-convoy',
    prompt: assembledPrompt,
    agent: 'team-lead',
    timeout: '10m',
    depends_on: [],
    files: [],
    description: 'Generate convoy spec from task description',
    max_retries: 1,
  }

  const result = await adapter.execute(task, { verbose: opts.verbose })

  // ── Extract YAML from the response ────────────────────────────
  const yamlContent = extractYamlBlock(result.output)
  if (!yamlContent) {
    const preview = result.output.slice(0, 500)
    console.error(`  ✗ No YAML code block found in the agent response.\n`)
    console.error(c.dim(`  Raw output (truncated):\n${preview}`))
    process.exit(1)
  }

  // ── Validate YAML ─────────────────────────────────────────────
  let validationWarning = false
  try {
    parseTaskSpecText(yamlContent)
  } catch (err) {
    validationWarning = true
    const msg = err instanceof Error ? err.message : String(err)
    console.warn(c.yellow(`  ⚠ YAML validation warning: ${msg}`))
    console.warn(c.dim(`    The file will still be written — you may need to edit it before running.\n`))
  }

  // ── Determine output path ─────────────────────────────────────
  let outputPath: string
  if (opts.output) {
    outputPath = resolve(process.cwd(), opts.output)
  } else {
    const convoyDir = resolve(process.cwd(), '.opencastle', 'convoys')
    await mkdir(convoyDir, { recursive: true })
    const filename = deriveOutputFilename(yamlContent)
    outputPath = join(convoyDir, filename)
  }

  await mkdir(resolve(outputPath, '..'), { recursive: true })
  await writeFile(outputPath, yamlContent + '\n', 'utf8')

  const relPath = outputPath.startsWith(process.cwd())
    ? outputPath.slice(process.cwd().length + 1)
    : outputPath

  console.log(c.green(`  ✓ Convoy spec written to ${relPath}`))
  if (validationWarning) {
    console.log(c.yellow(`    (contains validation warnings — review before running)`))
  }
  console.log(`
  ${c.dim('Preview:')} npx opencastle run -f ${relPath} --dry-run
  ${c.dim('Execute:')} npx opencastle run -f ${relPath}
`)
}
