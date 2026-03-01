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
    npx opencastle <command> [options]

  Commands:
    init        Set up OpenCastle in your project
    update      Update framework files (preserves customizations)
    eject       Remove dependency, keep all files standalone
    run         Process a task queue from a spec file autonomously
    dashboard   View agent observability dashboard in your browser

  Options:
    --dry-run        Preview what a command would change without writing files
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
  init: () => import('../dist/cli/init.js'),
  update: () => import('../dist/cli/update.js'),
  eject: () => import('../dist/cli/eject.js'),
  run: () => import('../dist/cli/run.js'),
  dashboard: () => import('../dist/cli/dashboard.js'),
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
