import { resolve } from 'node:path'
import { unlink } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { readManifest } from './manifest.js'
import { removeDirIfExists } from './copy.js'
import { removeGitignoreBlock } from './gitignore.js'
import { confirm, closePrompts, c } from './prompt.js'
import type { CliContext } from './types.js'

const DESTROY_HELP = `
  opencastle destroy [options]

  Remove ALL OpenCastle files from your project (reverse of init).

  Options:
    --dry-run       Preview what would be removed without deleting files
    --help, -h      Show this help
`

export default async function destroy({
  pkgRoot: _pkgRoot,
  args,
}: CliContext): Promise<void> {
  if (args.includes('--help') || args.includes('-h')) {
    console.log(DESTROY_HELP)
    return
  }

  const projectRoot = process.cwd()
  const dryRun = args.includes('--dry-run') || args.includes('--dryRun')

  const manifest = await readManifest(projectRoot)
  if (!manifest) {
    console.error('  ✗ No OpenCastle installation found.')
    process.exit(1)
  }

  const frameworkPaths = manifest.managedPaths?.framework ?? []
  const customizablePaths = manifest.managedPaths?.customizable ?? []
  const legacyManifestPath = resolve(projectRoot, '.opencastle.json')
  const hasLegacy = existsSync(legacyManifestPath)

  console.log(`\n  🏰 OpenCastle destroy\n`)
  console.log('  This will permanently remove:\n')

  for (const p of frameworkPaths) {
    console.log(`    ${c.dim(p)}`)
  }
  for (const p of customizablePaths) {
    console.log(`    ${c.dim(p)}`)
  }
  console.log(`    ${c.dim('.opencastle/')}`)
  if (hasLegacy) {
    console.log(`    ${c.dim('.opencastle.json')}`)
  }
  console.log(`    ${c.dim('.gitignore block')}\n`)

  if (dryRun) {
    console.log('  [dry-run] No files were changed.\n')
    return
  }

  const proceed = await confirm(
    'This will permanently delete all OpenCastle files. Continue?',
    false
  )
  if (!proceed) {
    console.log('  Aborted.')
    closePrompts()
    return
  }

  let removed = 0

  for (const p of [...frameworkPaths, ...customizablePaths]) {
    if (p.endsWith('/')) {
      const dir = resolve(projectRoot, p)
      await removeDirIfExists(dir)
      removed++
    } else {
      const file = resolve(projectRoot, p)
      if (existsSync(file)) {
        await unlink(file)
        removed++
      }
    }
  }

  await removeDirIfExists(resolve(projectRoot, '.opencastle'))
  removed++

  if (hasLegacy) {
    await unlink(legacyManifestPath)
    removed++
  }

  const gitignoreResult = await removeGitignoreBlock(projectRoot)

  console.log(`\n  ${c.green('✓')} Removed ${removed} path(s)${gitignoreResult === 'removed' ? ' + .gitignore block' : ''}.`)
  console.log(`  You can uninstall: ${c.bold('npm uninstall opencastle')}\n`)

  closePrompts()
}
