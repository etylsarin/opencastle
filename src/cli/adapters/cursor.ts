import { resolve, basename } from 'node:path'
import { mkdir, writeFile, readdir, readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { copyDir, getOrchestratorRoot, removeDirIfExists } from '../copy.js'
import { scaffoldMcpConfig } from '../mcp.js'
import { getExcludedSkills, getExcludedAgents, getCustomizationsTransform } from '../stack-config.js'
import type { CopyResults, ManagedPaths, StackConfig } from '../types.js'

/**
 * Cursor adapter.
 *
 * Transforms Copilot-format orchestrator files into Cursor's .mdc rule format.
 *
 *   copilot-instructions.md    → .cursorrules
 *   instructions/*.md          → .cursor/rules/*.mdc            (alwaysApply: true)
 *   agents/*.agent.md          → .cursor/rules/agents/*.mdc     (description-triggered)
 *   skills/\*\/SKILL.md         → .cursor/rules/skills/*.mdc     (alwaysApply: false)
 *   agent-workflows/*.md       → .cursor/rules/agent-workflows/*.mdc
 *   prompts/*.prompt.md        → .cursor/rules/prompts/*.mdc
 *   customizations/            → .cursor/rules/customizations/  (scaffolded once)
 */

export const IDE_ID = 'cursor'
export const IDE_LABEL = 'Cursor'

// ─── Helpers ──────────────────────────────────────────────────────

interface FrontmatterResult {
  frontmatter: string
  body: string
}

function stripFrontmatter(content: string): FrontmatterResult {
  const m = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/)
  return m
    ? { frontmatter: m[1], body: m[2] }
    : { frontmatter: '', body: content }
}

function parseFrontmatter(fm: string): Record<string, string> {
  const result: Record<string, string> = {}
  for (const line of fm.split('\n')) {
    const m = line.match(/^(\w[\w-]*):\s*['"]?(.+?)['"]?\s*$/)
    if (m) result[m[1]] = m[2]
  }
  return result
}

interface MdcOptions {
  description?: string
  globs?: string[]
  alwaysApply: boolean
  body: string
}

function toMdc({ description, globs, alwaysApply, body }: MdcOptions): string {
  const lines = ['---']
  if (description) lines.push(`description: "${description}"`)
  if (globs) lines.push(`globs: ${JSON.stringify(globs)}`)
  lines.push(`alwaysApply: ${alwaysApply ? 'true' : 'false'}`)
  lines.push('---', '', body.trim(), '')
  return lines.join('\n')
}

/** Convert a source filename to .mdc, stripping intermediate extensions. */
function mdcName(name: string): string {
  // Handle compound extensions like .agent.md, .instructions.md, .prompt.md
  const compound = name.replace(/\.(agent|instructions|prompt)\.md$/, '.mdc')
  if (compound !== name) return compound
  // Handle plain .md files
  return name.replace(/\.md$/, '.mdc')
}

interface ConvertFileOptions {
  alwaysApply?: boolean
  descriptionFallback?: string
}

/** Read a source .md and produce an .mdc string. */
async function convertFile(
  srcPath: string,
  { alwaysApply = false, descriptionFallback = '' }: ConvertFileOptions = {}
): Promise<string> {
  const content = await readFile(srcPath, 'utf8')
  const { frontmatter, body } = stripFrontmatter(content)
  const meta = parseFrontmatter(frontmatter)

  // Description: frontmatter > fallback > first heading
  let description = meta['description'] ?? descriptionFallback
  if (!description) {
    const heading = body.match(/^#\s+(.+)/m)
    if (heading) description = heading[1]
  }

  // If applyTo is '**' the rule should always apply
  const globs = meta['applyTo'] ? [meta['applyTo']] : undefined
  const apply = meta['applyTo'] === '**' ? true : alwaysApply

  return toMdc({ description, globs, alwaysApply: apply, body: body.trim() })
}

/** Write a converted file; skip if it already exists (unless overwrite). */
async function writeConverted(
  srcPath: string,
  destPath: string,
  opts: ConvertFileOptions,
  results: CopyResults,
  overwrite = false
): Promise<void> {
  if (!overwrite && existsSync(destPath)) {
    results.skipped.push(destPath)
    return
  }
  const existed = existsSync(destPath)
  const mdc = await convertFile(srcPath, opts)
  await writeFile(destPath, mdc)
  results[existed ? 'copied' : 'created'].push(destPath)
}

// ─── Install ──────────────────────────────────────────────────────

export async function install(
  pkgRoot: string,
  projectRoot: string,
  stack?: StackConfig
): Promise<CopyResults> {
  const srcRoot = getOrchestratorRoot(pkgRoot)
  const results: CopyResults = { copied: [], skipped: [], created: [] }

  const excludedSkills = stack ? getExcludedSkills(stack) : new Set<string>()
  const excludedAgents = stack ? getExcludedAgents(stack) : new Set<string>()

  // 1. .cursorrules  ← copilot-instructions.md (body only)
  const cursorrules = resolve(projectRoot, '.cursorrules')
  if (!existsSync(cursorrules)) {
    const { body } = stripFrontmatter(
      await readFile(resolve(srcRoot, 'copilot-instructions.md'), 'utf8')
    )
    await writeFile(cursorrules, body.trim() + '\n')
    results.created.push(cursorrules)
  } else {
    results.skipped.push(cursorrules)
  }

  const rulesRoot = resolve(projectRoot, '.cursor', 'rules')
  await mkdir(rulesRoot, { recursive: true })

  // 2. Instructions → .cursor/rules/*.mdc  (alwaysApply: true)
  await convertDir(srcRoot, 'instructions', rulesRoot, results, {
    alwaysApply: true,
  })

  // 3. Agents → .cursor/rules/agents/*.mdc
  await convertDir(srcRoot, 'agents', resolve(rulesRoot, 'agents'), results, {
    descriptionPrefix: 'Agent: ',
    removeExt: '.agent.md',
    excludeFiles: excludedAgents,
  })

  // 4. Skills → .cursor/rules/skills/*.mdc
  await convertSkills(srcRoot, resolve(rulesRoot, 'skills'), results, false, excludedSkills)

  // 5. Agent Workflows → .cursor/rules/agent-workflows/*.mdc
  await convertDir(
    srcRoot,
    'agent-workflows',
    resolve(rulesRoot, 'agent-workflows'),
    results,
    { descriptionPrefix: 'Workflow: ' }
  )

  // 6. Prompts → .cursor/rules/prompts/*.mdc
  await convertDir(srcRoot, 'prompts', resolve(rulesRoot, 'prompts'), results, {
    descriptionPrefix: 'Prompt: ',
    removeExt: '.prompt.md',
  })

  // 7. Customizations (scaffold once, pre-populated with stack choices)
  const custSrc = resolve(srcRoot, 'customizations')
  if (existsSync(custSrc)) {
    const custDest = resolve(rulesRoot, 'customizations')
    const custTransform = stack ? getCustomizationsTransform(stack) : undefined
    const sub = await copyDir(custSrc, custDest, { transform: custTransform })
    results.created.push(...sub.created)
    results.skipped.push(...sub.skipped)
  }

  // 8. MCP server config → .cursor/mcp.json (scaffold once)
  const mcpResult = await scaffoldMcpConfig(
    pkgRoot,
    projectRoot,
    '.cursor/mcp.json',
    stack
  )
  results[mcpResult.action].push(mcpResult.path)

  return results
}

// ─── Update ───────────────────────────────────────────────────────

export async function update(
  pkgRoot: string,
  projectRoot: string,
  stack?: StackConfig
): Promise<CopyResults> {
  const srcRoot = getOrchestratorRoot(pkgRoot)
  const results: CopyResults = { copied: [], skipped: [], created: [] }

  const excludedSkills = stack ? getExcludedSkills(stack) : new Set<string>()
  const excludedAgents = stack ? getExcludedAgents(stack) : new Set<string>()

  // Overwrite .cursorrules
  const { body } = stripFrontmatter(
    await readFile(resolve(srcRoot, 'copilot-instructions.md'), 'utf8')
  )
  await writeFile(resolve(projectRoot, '.cursorrules'), body.trim() + '\n')
  results.copied.push('.cursorrules')

  const rulesRoot = resolve(projectRoot, '.cursor', 'rules')

  // Remove existing framework rule directories to clear stale files
  const FRAMEWORK_RULE_DIRS = ['agents', 'skills', 'agent-workflows', 'prompts']
  for (const dir of FRAMEWORK_RULE_DIRS) {
    await removeDirIfExists(resolve(rulesRoot, dir))
  }

  // Overwrite framework rules
  await convertDir(srcRoot, 'instructions', rulesRoot, results, {
    alwaysApply: true,
    overwrite: true,
  })
  await convertDir(
    srcRoot,
    'agents',
    resolve(rulesRoot, 'agents'),
    results,
    { descriptionPrefix: 'Agent: ', removeExt: '.agent.md', overwrite: true, excludeFiles: excludedAgents }
  )
  await convertSkills(srcRoot, resolve(rulesRoot, 'skills'), results, true, excludedSkills)
  await convertDir(
    srcRoot,
    'agent-workflows',
    resolve(rulesRoot, 'agent-workflows'),
    results,
    { descriptionPrefix: 'Workflow: ', overwrite: true }
  )
  await convertDir(
    srcRoot,
    'prompts',
    resolve(rulesRoot, 'prompts'),
    results,
    { descriptionPrefix: 'Prompt: ', removeExt: '.prompt.md', overwrite: true }
  )

  // Customizations are NEVER overwritten.

  // All re-installed framework files count as "updated" (copied), not "created"
  results.copied.push(...results.created)
  results.created = []

  return results
}

// ─── Managed paths ────────────────────────────────────────────────

export function getManagedPaths(): ManagedPaths {
  return {
    framework: [
      '.cursorrules',
      '.cursor/rules/agents/',
      '.cursor/rules/skills/',
      '.cursor/rules/agent-workflows/',
      '.cursor/rules/prompts/',
      '.cursor/rules/general.mdc',
      '.cursor/rules/ai-optimization.mdc',
    ],
    customizable: [
      '.cursor/rules/customizations/',
      '.cursor/mcp.json',
    ],
  }
}

// ─── Internal helpers ─────────────────────────────────────────────

interface ConvertDirOptions {
  alwaysApply?: boolean
  descriptionPrefix?: string
  removeExt?: string
  overwrite?: boolean
  excludeFiles?: Set<string>
}

async function convertDir(
  srcRoot: string,
  dirName: string,
  destDir: string,
  results: CopyResults,
  {
    alwaysApply,
    descriptionPrefix,
    removeExt,
    overwrite,
    excludeFiles,
  }: ConvertDirOptions = {}
): Promise<void> {
  const srcDir = resolve(srcRoot, dirName)
  if (!existsSync(srcDir)) return

  await mkdir(destDir, { recursive: true })

  for (const file of await readdir(srcDir)) {
    if (!file.endsWith('.md')) continue
    if (excludeFiles?.has(file)) continue
    const fallback = descriptionPrefix
      ? `${descriptionPrefix}${basename(file, removeExt ?? '.md')}`
      : ''
    const destPath = resolve(destDir, mdcName(file))
    await writeConverted(
      resolve(srcDir, file),
      destPath,
      { alwaysApply: alwaysApply ?? false, descriptionFallback: fallback },
      results,
      overwrite
    )
  }
}

async function convertSkills(
  srcRoot: string,
  destDir: string,
  results: CopyResults,
  overwrite = false,
  excludedSkills?: Set<string>
): Promise<void> {
  const skillsDir = resolve(srcRoot, 'skills')
  if (!existsSync(skillsDir)) return

  await mkdir(destDir, { recursive: true })

  const subdirs = await readdir(skillsDir, { withFileTypes: true })
  for (const entry of subdirs) {
    if (!entry.isDirectory()) continue
    if (excludedSkills?.has(entry.name)) continue
    const skillFile = resolve(skillsDir, entry.name, 'SKILL.md')
    if (!existsSync(skillFile)) continue

    // Main skill → skills/<name>.mdc
    const destPath = resolve(destDir, `${entry.name}.mdc`)
    await writeConverted(
      skillFile,
      destPath,
      { descriptionFallback: `Skill: ${entry.name}` },
      results,
      overwrite
    )

    // Extra files in the skill directory (e.g. templates)
    const files = await readdir(resolve(skillsDir, entry.name))
    const extras = files.filter((f) => f !== 'SKILL.md' && f.endsWith('.md'))
    if (extras.length > 0) {
      const subDest = resolve(destDir, entry.name)
      await mkdir(subDest, { recursive: true })
      for (const file of extras) {
        const extraDest = resolve(subDest, mdcName(file))
        await writeConverted(
          resolve(skillsDir, entry.name, file),
          extraDest,
          { descriptionFallback: `${entry.name}: ${basename(file, '.md')}` },
          results,
          overwrite
        )
      }
    }
  }
}
