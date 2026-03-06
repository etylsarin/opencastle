import { resolve } from 'node:path'
import { unlink } from 'node:fs/promises'
import { readManifest } from './manifest.js'
import { confirm, closePrompts } from './prompt.js'
import type { CliContext } from './types.js'

export default async function eject({
  pkgRoot: _pkgRoot,
  args,
}: CliContext): Promise<void> {
  const projectRoot = process.cwd()
  const dryRun = args.includes('--dry-run') || args.includes('--dryRun')

  const manifest = await readManifest(projectRoot)
  if (!manifest) {
    console.error('  ✗ No OpenCastle installation found.')
    process.exit(1)
  }

  console.log(`\n  🏰 OpenCastle eject\n`)
  console.log('  This will:')
  console.log('    • Remove .opencastle.json (manifest)')
  console.log('    • Keep ALL generated files as standalone')
  console.log(
    '    • You can safely uninstall the opencastle package after this\n'
  )

  if (dryRun) {
    console.log('  [dry-run] No files were changed.\n')
    return
  }

  const proceed = await confirm('Continue?')
  if (!proceed) {
    console.log('  Aborted.')
    return
  }

  await unlink(resolve(projectRoot, '.opencastle.json'))

  console.log('\n  ✓ Ejected. Files are now standalone.')
  console.log('  You can uninstall: npm uninstall opencastle\n')

  closePrompts()
}
