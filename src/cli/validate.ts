import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { parseYaml, validateSpec } from './run/schema.js'
import { c } from './prompt.js'
import type { CliContext } from './types.js'

const HELP = `
  opencastle validate <file> [options]

  Validate a convoy YAML spec file without executing it.

  Arguments:
    <file>          Path to the convoy YAML spec file

  Options:
    --help, -h      Show this help
`

export default async function validate({ args }: CliContext): Promise<void> {
  if (args.includes('--help') || args.includes('-h')) {
    console.log(HELP)
    return
  }

  const filePath = args.find(a => !a.startsWith('--'))
  if (!filePath) {
    console.error('  ✗ A file path is required\n  Usage: opencastle validate <file>')
    process.exit(1)
  }

  const absPath = resolve(process.cwd(), filePath)
  if (!existsSync(absPath)) {
    console.error(`  ✗ File not found: ${absPath}`)
    process.exit(1)
  }

  let text: string
  try {
    text = readFileSync(absPath, 'utf8')
  } catch (err) {
    console.error(`  ✗ Could not read file: ${(err as Error).message}`)
    process.exit(1)
  }

  let parsed: unknown
  try {
    parsed = parseYaml(text)
  } catch (err) {
    console.error(`  ✗ YAML parse error: ${(err as Error).message}`)
    process.exit(1)
  }

  const result = validateSpec(parsed)

  if (result.valid) {
    console.log(`  ${c.green('✓')} ${filePath} is valid`)
  } else {
    console.error(`  ${c.red('✗')} ${filePath} has ${result.errors.length} error${result.errors.length === 1 ? '' : 's'}:\n`)
    for (const err of result.errors) {
      console.error(`    • ${err}`)
    }
    console.error()
    process.exit(1)
  }
}
