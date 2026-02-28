/* global console, process */
import { resolve } from 'node:path'
import { readFile } from 'node:fs/promises'
import { readManifest, writeManifest } from './manifest.mjs'
import { confirm, closePrompts } from './prompt.mjs'

const ADAPTERS = {
  vscode: () => import('./adapters/vscode.mjs'),
  cursor: () => import('./adapters/cursor.mjs'),
  'claude-code': () => import('./adapters/claude-code.mjs'),
}

const VALID_IDES = Object.keys(ADAPTERS)

export default async function update({ pkgRoot, args }) {
  const projectRoot = process.cwd()

  const manifest = await readManifest(projectRoot)
  if (!manifest) {
    console.error(
      '  ✗ No OpenCastle installation found. Run "npx opencastle init" first.'
    )
    process.exit(1)
  }

  if (!manifest.ide || !VALID_IDES.includes(manifest.ide)) {
    console.error(
      `  ✗ Invalid IDE "${manifest.ide}" in .opencastle.json. Valid options: ${VALID_IDES.join(', ')}`
    )
    process.exit(1)
  }

  const pkg = JSON.parse(
    await readFile(resolve(pkgRoot, 'package.json'), 'utf8')
  )

  if (manifest.version === pkg.version && !args.includes('--force')) {
    console.log(`  Already up to date (v${pkg.version}).`)
    return
  }

  console.log(
    `\n  🏰 OpenCastle update: v${manifest.version} → v${pkg.version}\n`
  )
  console.log(`  IDE: ${manifest.ide}`)
  console.log('  Framework files will be overwritten.')
  console.log('  Customization files will be preserved.\n')

  const proceed = await confirm('Proceed with update?')
  if (!proceed) {
    console.log('  Aborted.')
    return
  }

  const adapter = await ADAPTERS[manifest.ide]()
  const results = await adapter.update(pkgRoot, projectRoot)

  // Update manifest
  manifest.version = pkg.version
  manifest.updatedAt = new Date().toISOString()
  manifest.managedPaths = adapter.getManagedPaths()
  await writeManifest(projectRoot, manifest)

  console.log(`\n  ✓ Updated ${results.copied.length} framework files`)
  if (results.created.length > 0) {
    console.log(`  + Created ${results.created.length} new files`)
  }
  console.log()

  closePrompts()
}
