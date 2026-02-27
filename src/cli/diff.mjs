/* global console, process */
import { resolve } from 'node:path'
import { readFile } from 'node:fs/promises'
import { readManifest } from './manifest.mjs'

export default async function diff({ pkgRoot }) {
  const projectRoot = process.cwd()

  const manifest = await readManifest(projectRoot)
  if (!manifest) {
    console.error(
      '  ✗ No OpenCastle installation found. Run "npx opencastle init" first.'
    )
    process.exit(1)
  }

  const pkg = JSON.parse(
    await readFile(resolve(pkgRoot, 'package.json'), 'utf8')
  )

  if (manifest.version === pkg.version) {
    console.log(
      `  No changes — installed version matches package version (v${pkg.version}).`
    )
    return
  }

  console.log(
    `\n  🏰 OpenCastle diff: v${manifest.version} → v${pkg.version}\n`
  )
  console.log('  Framework files that would be updated:\n')

  for (const path of manifest.managedPaths?.framework || []) {
    console.log(`    ↻ ${path}`)
  }

  console.log('\n  Customization files that would be preserved:\n')

  for (const path of manifest.managedPaths?.customizable || []) {
    console.log(`    ✓ ${path}`)
  }

  console.log(`\n  Run "npx opencastle update" to apply.\n`)
}
