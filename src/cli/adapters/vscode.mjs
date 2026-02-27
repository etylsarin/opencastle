import { resolve } from 'node:path'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { copyDir, getOrchestratorRoot } from '../copy.mjs'
import { scaffoldMcpConfig } from '../mcp.mjs'

/**
 * VS Code / GitHub Copilot adapter.
 *
 * This is the **native format** — the orchestrator source files map 1:1.
 *
 *   copilot-instructions.md    → .github/copilot-instructions.md
 *   agents/                    → .github/agents/
 *   instructions/              → .github/instructions/
 *   skills/                    → .github/skills/
 *   agent-workflows/           → .github/agent-workflows/
 *   prompts/                   → .github/prompts/
 *   customizations/            → .github/customizations/  (scaffolded once)
 */

export const IDE_ID = 'vscode'
export const IDE_LABEL = 'VS Code (GitHub Copilot)'

/** Directories whose contents are framework-managed (overwritten on update). */
const FRAMEWORK_DIRS = [
  'agents',
  'instructions',
  'skills',
  'agent-workflows',
  'prompts',
]

/** Directories scaffolded once and never overwritten. */
const CUSTOMIZABLE_DIRS = ['customizations']

export async function install(pkgRoot, projectRoot) {
  const srcRoot = getOrchestratorRoot(pkgRoot)
  const destRoot = resolve(projectRoot, '.github')

  await mkdir(destRoot, { recursive: true })

  const results = { copied: [], skipped: [], created: [] }

  // copilot-instructions.md
  const copilotSrc = resolve(srcRoot, 'copilot-instructions.md')
  const copilotDest = resolve(destRoot, 'copilot-instructions.md')
  if (!existsSync(copilotDest)) {
    await writeFile(copilotDest, await readFile(copilotSrc, 'utf8'))
    results.created.push(copilotDest)
  } else {
    results.skipped.push(copilotDest)
  }

  // Framework directories
  for (const dir of FRAMEWORK_DIRS) {
    const srcDir = resolve(srcRoot, dir)
    if (!existsSync(srcDir)) continue
    const destDir = resolve(destRoot, dir)
    const sub = await copyDir(srcDir, destDir)
    results.copied.push(...sub.copied)
    results.skipped.push(...sub.skipped)
    results.created.push(...sub.created)
  }

  // Customization templates (scaffold once)
  for (const dir of CUSTOMIZABLE_DIRS) {
    const srcDir = resolve(srcRoot, dir)
    if (!existsSync(srcDir)) continue
    const destDir = resolve(destRoot, dir)
    const sub = await copyDir(srcDir, destDir)
    results.copied.push(...sub.copied)
    results.skipped.push(...sub.skipped)
    results.created.push(...sub.created)
  }

  // MCP server config → .vscode/mcp.json (scaffold once)
  const mcpResult = await scaffoldMcpConfig(pkgRoot, projectRoot, '.vscode/mcp.json')
  results[mcpResult.action].push(mcpResult.path)

  return results
}

export async function update(pkgRoot, projectRoot) {
  const srcRoot = getOrchestratorRoot(pkgRoot)
  const destRoot = resolve(projectRoot, '.github')

  const results = { copied: [], skipped: [], created: [] }

  // Overwrite copilot-instructions.md
  const copilotDest = resolve(destRoot, 'copilot-instructions.md')
  await writeFile(
    copilotDest,
    await readFile(resolve(srcRoot, 'copilot-instructions.md'), 'utf8')
  )
  results.copied.push(copilotDest)

  // Overwrite framework directories
  for (const dir of FRAMEWORK_DIRS) {
    const srcDir = resolve(srcRoot, dir)
    if (!existsSync(srcDir)) continue
    const destDir = resolve(destRoot, dir)
    const sub = await copyDir(srcDir, destDir, { overwrite: true })
    results.copied.push(...sub.copied)
    results.skipped.push(...sub.skipped)
    results.created.push(...sub.created)
  }

  // Customizations are NEVER overwritten during update.

  return results
}

export function getManagedPaths() {
  return {
    framework: [
      '.github/copilot-instructions.md',
      ...FRAMEWORK_DIRS.map((d) => `.github/${d}/`),
    ],
    customizable: [
      ...CUSTOMIZABLE_DIRS.map((d) => `.github/${d}/`),
      '.vscode/mcp.json',
    ],
  }
}
