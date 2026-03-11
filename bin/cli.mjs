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
    destroy     Remove ALL OpenCastle files (reverse of init)
    run         Process a task queue from a spec file autonomously
    agents      Manage persistent agent identities
    dispute     Manage convoy dispute resolution
    plan        Generate a convoy spec from a task description file
    baselines   Manage visual regression baselines
    dashboard   View agent observability dashboard in your browser
    doctor      Validate your OpenCastle setup
    log         Append a structured event to the observability log
    lesson      Append a structured lesson to LESSONS-LEARNED.md

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
  destroy: () => import('../dist/cli/destroy.js'),
  run: () => import('../dist/cli/run.js'),
  plan: () => import('../dist/cli/plan.js'),
  dashboard: () => import('../dist/cli/dashboard.js'),
  doctor: () => import('../dist/cli/doctor.js'),
  log: () => import('../dist/cli/log.js'),
  lesson: () => import('../dist/cli/lesson.js'),
  agents: () => import('../dist/cli/agents.js'),
  dispute: () => import('../dist/cli/dispute.js'),
  baselines: () => import('../dist/cli/baselines.js'),
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
