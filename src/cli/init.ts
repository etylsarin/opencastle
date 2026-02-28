import { resolve } from 'node:path'
import { readFile } from 'node:fs/promises'
import { select, confirm, closePrompts } from './prompt.js'
import { readManifest, writeManifest, createManifest } from './manifest.js'
import type { CliContext, IdeAdapter } from './types.js'

const ADAPTERS: Record<string, () => Promise<IdeAdapter>> = {
  vscode: () => import('./adapters/vscode.js') as Promise<IdeAdapter>,
  cursor: () => import('./adapters/cursor.js') as Promise<IdeAdapter>,
  'claude-code': () =>
    import('./adapters/claude-code.js') as Promise<IdeAdapter>,
}

export default async function init({ pkgRoot }: CliContext): Promise<void> {
  const projectRoot = process.cwd()

  // Check for existing installation
  const existing = await readManifest(projectRoot)
  if (existing) {
    const proceed = await confirm(
      `OpenCastle already installed (v${existing.version}, ${existing.ide}). Re-initialize?`,
      false
    )
    if (!proceed) {
      console.log('  Aborted.')
      return
    }
  }

  const pkg = JSON.parse(
    await readFile(resolve(pkgRoot, 'package.json'), 'utf8')
  ) as { version: string }

  console.log(`\n  🏰 OpenCastle v${pkg.version}`)
  console.log(
    '  Multi-agent orchestration framework for AI coding assistants\n'
  )

  // ── IDE selection ───────────────────────────────────────────────
  const ide = await select('Which IDE are you using?', [
    {
      label: 'VS Code',
      hint: 'GitHub Copilot — .github/ agents, instructions, skills',
      value: 'vscode',
    },
    {
      label: 'Cursor',
      hint: '.cursorrules & .cursor/rules/*.mdc',
      value: 'cursor',
    },
    {
      label: 'Claude Code',
      hint: 'CLAUDE.md & .claude/ commands, skills',
      value: 'claude-code',
    },
  ])

  console.log(`\n  Installing for ${ide}...\n`)

  // ── Run adapter ─────────────────────────────────────────────────
  const adapter = await ADAPTERS[ide]()
  const results = await adapter.install(pkgRoot, projectRoot)

  // ── Write manifest ──────────────────────────────────────────────
  const manifest = createManifest(pkg.version, ide)
  manifest.managedPaths = adapter.getManagedPaths()
  await writeManifest(projectRoot, manifest)

  // ── Summary ─────────────────────────────────────────────────────
  const created = results.created.length
  const skipped = results.skipped.length

  console.log(`  ✓ Created ${created} files`)
  if (skipped > 0) {
    console.log(`  → Skipped ${skipped} existing files`)
  }

  console.log(`\n  Next steps:`)
  console.log(
    '  1. Run the "Bootstrap Customizations" prompt to configure for your project'
  )
  console.log('  2. Customize agent definitions for your tech stack')
  console.log('  3. Commit the generated files to your repository')
  console.log()

  closePrompts()
}
