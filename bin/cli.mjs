#!/usr/bin/env node
/* global console, process */

import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { readFile } from 'node:fs/promises'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const pkgRoot = resolve(__dirname, '..')

const [, , command, ...args] = process.argv

const HELP = `
  🏰 opencastle — Multi-agent orchestration framework

  Usage:
    npx opencastle <command>

  Commands:
    init     Set up OpenCastle in your project
    update   Update framework files (preserves customizations)
    diff     Preview what an update would change
    eject    Remove dependency, keep all files standalone
    run      Process a task queue from a spec file autonomously

  Options:
    --help, -h       Show this help message
    --version, -v    Show version number
`

if (!command || command === '--help' || command === '-h') {
  console.log(HELP)
  process.exit(0)
}

if (command === '--version' || command === '-v') {
  const pkg = JSON.parse(
    await readFile(resolve(pkgRoot, 'package.json'), 'utf8')
  )
  console.log(pkg.version)
  process.exit(0)
}

const commands = {
  init: () => import('../src/cli/init.mjs'),
  update: () => import('../src/cli/update.mjs'),
  diff: () => import('../src/cli/diff.mjs'),
  eject: () => import('../src/cli/eject.mjs'),
  run: () => import('../src/cli/run.mjs'),
}

if (!commands[command]) {
  console.error(
    `  Unknown command: ${command}\n  Run "opencastle --help" for usage.`
  )
  process.exit(1)
}

try {
  const mod = await commands[command]()
  await mod.default({ pkgRoot, args })
} catch (err) {
  console.error(`\n  ✗ ${err.message}\n`)
  if (args.includes('--debug')) console.error(err)
  process.exit(1)
}
