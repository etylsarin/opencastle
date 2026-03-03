import { resolve } from 'node:path'
import { readFile } from 'node:fs/promises'
import { readManifest, writeManifest } from './manifest.js'
import { confirm, closePrompts, c } from './prompt.js'
import { isLegacyStack, migrateStackConfig } from './types.js'
import type { CliContext, IdeAdapter, IdeChoice } from './types.js'

const ADAPTERS: Record<string, () => Promise<IdeAdapter>> = {
  vscode: () => import('./adapters/vscode.js') as Promise<IdeAdapter>,
  cursor: () => import('./adapters/cursor.js') as Promise<IdeAdapter>,
  'claude-code': () =>
    import('./adapters/claude-code.js') as Promise<IdeAdapter>,
  opencode: () =>
    import('./adapters/opencode.js') as Promise<IdeAdapter>,
}

const VALID_IDES = Object.keys(ADAPTERS)

/** IDE display labels */
const IDE_DISPLAY: Record<IdeChoice, string> = {
  vscode: 'VS Code',
  cursor: 'Cursor',
  'claude-code': 'Claude Code',
  opencode: 'OpenCode',
}

export default async function update({
  pkgRoot,
  args,
}: CliContext): Promise<void> {
  const projectRoot = process.cwd()

  const manifest = await readManifest(projectRoot)
  if (!manifest) {
    console.error(
      `  ${c.red('✗')} No OpenCastle installation found. Run "npx opencastle init" first.`
    )
    process.exit(1)
  }

  // Determine list of IDEs to update (support legacy single-IDE manifests)
  const ides = manifest.ides?.length ? manifest.ides : [manifest.ide]
  const invalidIdes = ides.filter((id) => !VALID_IDES.includes(id))
  if (invalidIdes.length > 0) {
    console.error(
      `  ${c.red('✗')} Invalid IDE(s) "${invalidIdes.join(', ')}" in .opencastle.json. Valid: ${VALID_IDES.join(', ')}`
    )
    process.exit(1)
  }

  // Migrate legacy stack config if needed
  if (manifest.stack && isLegacyStack(manifest.stack)) {
    manifest.stack = migrateStackConfig(manifest.stack, manifest.ide)
    manifest.stack.ides = ides as IdeChoice[]
  }

  const pkg = JSON.parse(
    await readFile(resolve(pkgRoot, 'package.json'), 'utf8')
  ) as { version: string }

  const dryRun = args.includes('--dry-run')

  if (manifest.version === pkg.version && !args.includes('--force') && !dryRun) {
    console.log(`  Already up to date (v${pkg.version}).`)
    return
  }

  const ideNames = ides.map((id) => IDE_DISPLAY[id as IdeChoice] ?? id).join(', ')
  console.log(
    `\n  🏰 ${c.bold('OpenCastle')} ${dryRun ? 'dry-run' : 'update'}: ${c.dim(`v${manifest.version}`)} → ${c.green(`v${pkg.version}`)}\n`
  )
  console.log(`  IDEs: ${c.cyan(ideNames)}`)
  console.log(`  ${c.dim('Framework files will be overwritten.')}`)
  console.log(`  ${c.dim('Customization files will be preserved.')}\n`)

  if (dryRun) {
    console.log(`  ${c.dim('[dry-run]')} Framework files that would be updated:\n`)
    for (const p of manifest.managedPaths?.framework ?? []) {
      console.log(`    ${c.yellow('↻')} ${p}`)
    }
    console.log(`\n  ${c.dim('[dry-run]')} Customization files that would be preserved:\n`)
    for (const p of manifest.managedPaths?.customizable ?? []) {
      console.log(`    ${c.green('✓')} ${p}`)
    }
    console.log(`\n  ${c.dim('No files were written.')}\n`)
    return
  }

  const proceed = await confirm('Proceed with update?')
  if (!proceed) {
    console.log('  Aborted.')
    return
  }

  // Update each IDE
  let totalCopied = 0
  let totalCreated = 0
  const allManagedPaths = { framework: [] as string[], customizable: [] as string[] }

  for (const ide of ides) {
    const adapter = await ADAPTERS[ide]()
    const results = await adapter.update(pkgRoot, projectRoot, manifest.stack)
    totalCopied += results.copied.length
    totalCreated += results.created.length

    const managed = adapter.getManagedPaths()
    allManagedPaths.framework.push(...managed.framework)
    allManagedPaths.customizable.push(...managed.customizable)
  }

  // Refresh repo research on update
  const { detectRepoInfo, mergeStackIntoRepoInfo } = await import('./detect.js')
  const repoInfo = await detectRepoInfo(projectRoot)

  // Update manifest
  manifest.version = pkg.version
  manifest.ides = ides
  manifest.updatedAt = new Date().toISOString()
  manifest.managedPaths = allManagedPaths
  manifest.repoInfo = manifest.stack
    ? mergeStackIntoRepoInfo(repoInfo, manifest.stack)
    : repoInfo
  await writeManifest(projectRoot, manifest)

  console.log(`\n  ${c.green('✓')} Updated ${c.bold(String(totalCopied))} framework files`)
  if (totalCreated > 0) {
    console.log(`  ${c.green('+')} Created ${c.bold(String(totalCreated))} new files`)
  }

  // ── Reload window message ─────────────────────────────────────
  const needsReload = ides.filter((id) => ['vscode', 'cursor'].includes(id))
  if (needsReload.length > 0) {
    console.log()
    if (needsReload.includes('vscode')) {
      console.log(
        `  ${c.yellow('⟳')} Reload VS Code window (Cmd+Shift+P → "Developer: Reload Window") to pick up changes`
      )
    }
    if (needsReload.includes('cursor')) {
      console.log(
        `  ${c.yellow('⟳')} Reload Cursor window to pick up the updated rule files`
      )
    }
  }
  console.log()

  closePrompts()
}
