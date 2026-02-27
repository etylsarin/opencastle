import { resolve, basename } from 'node:path'
import { mkdir, writeFile, readdir, readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { copyDir, getOrchestratorRoot } from '../copy.mjs'
import { scaffoldMcpConfig } from '../mcp.mjs'

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

function stripFrontmatter(content) {
  const m = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/)
  return m ? { frontmatter: m[1], body: m[2] } : { frontmatter: '', body: content }
}

function parseFrontmatter(fm) {
  const result = {}
  for (const line of fm.split('\n')) {
    const m = line.match(/^(\w[\w-]*):\s*['"]?(.+?)['"]?\s*$/)
    if (m) result[m[1]] = m[2]
  }
  return result
}

function toMdc({ description, globs, alwaysApply, body }) {
  const lines = ['---']
  if (description) lines.push(`description: "${description}"`)
  if (globs) lines.push(`globs: ${JSON.stringify(globs)}`)
  lines.push(`alwaysApply: ${alwaysApply ? 'true' : 'false'}`)
  lines.push('---', '', body.trim(), '')
  return lines.join('\n')
}

/** Convert a source filename to .mdc, stripping intermediate extensions. */
function mdcName(name) {
  // Handle compound extensions like .agent.md, .instructions.md, .prompt.md
  const compound = name.replace(/\.(agent|instructions|prompt)\.md$/, '.mdc')
  if (compound !== name) return compound
  // Handle plain .md files
  return name.replace(/\.md$/, '.mdc')
}

/** Read a source .md and produce an .mdc string. */
async function convertFile(
  srcPath,
  { alwaysApply = false, descriptionFallback = '' } = {}
) {
  const content = await readFile(srcPath, 'utf8')
  const { frontmatter, body } = stripFrontmatter(content)
  const meta = parseFrontmatter(frontmatter)

  // Description: frontmatter > fallback > first heading
  let description = meta.description || descriptionFallback
  if (!description) {
    const heading = body.match(/^#\s+(.+)/m)
    if (heading) description = heading[1]
  }

  // If applyTo is '**' the rule should always apply
  const globs = meta.applyTo ? [meta.applyTo] : undefined
  const apply = meta.applyTo === '**' ? true : alwaysApply

  return toMdc({ description, globs, alwaysApply: apply, body: body.trim() })
}

/** Write a converted file; skip if it already exists (unless overwrite). */
async function writeConverted(srcPath, destPath, opts, results, overwrite = false) {
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

export async function install(pkgRoot, projectRoot) {
  const srcRoot = getOrchestratorRoot(pkgRoot)
  const results = { copied: [], skipped: [], created: [] }

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
  })

  // 4. Skills → .cursor/rules/skills/*.mdc
  await convertSkills(srcRoot, resolve(rulesRoot, 'skills'), results)

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

  // 7. Customizations (scaffold once, plain copy)
  const custSrc = resolve(srcRoot, 'customizations')
  if (existsSync(custSrc)) {
    const custDest = resolve(rulesRoot, 'customizations')
    const sub = await copyDir(custSrc, custDest)
    results.created.push(...sub.created)
    results.skipped.push(...sub.skipped)
  }

  // 8. MCP server config → .cursor/mcp.json (scaffold once)
  const mcpResult = await scaffoldMcpConfig(pkgRoot, projectRoot, '.cursor/mcp.json')
  results[mcpResult.action].push(mcpResult.path)

  return results
}

// ─── Update ───────────────────────────────────────────────────────

export async function update(pkgRoot, projectRoot) {
  const srcRoot = getOrchestratorRoot(pkgRoot)
  const results = { copied: [], skipped: [], created: [] }

  // Overwrite .cursorrules
  const { body } = stripFrontmatter(
    await readFile(resolve(srcRoot, 'copilot-instructions.md'), 'utf8')
  )
  await writeFile(resolve(projectRoot, '.cursorrules'), body.trim() + '\n')
  results.copied.push('.cursorrules')

  const rulesRoot = resolve(projectRoot, '.cursor', 'rules')

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
    { descriptionPrefix: 'Agent: ', removeExt: '.agent.md', overwrite: true }
  )
  await convertSkills(srcRoot, resolve(rulesRoot, 'skills'), results, true)
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

  return results
}

// ─── Managed paths ────────────────────────────────────────────────

export function getManagedPaths() {
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

async function convertDir(
  srcRoot,
  dirName,
  destDir,
  results,
  { alwaysApply, descriptionPrefix, removeExt, overwrite } = {}
) {
  const srcDir = resolve(srcRoot, dirName)
  if (!existsSync(srcDir)) return

  await mkdir(destDir, { recursive: true })

  for (const file of await readdir(srcDir)) {
    if (!file.endsWith('.md')) continue
    const fallback = descriptionPrefix
      ? `${descriptionPrefix}${basename(file, removeExt || '.md')}`
      : ''
    const destPath = resolve(destDir, mdcName(file))
    await writeConverted(
      resolve(srcDir, file),
      destPath,
      { alwaysApply: alwaysApply || false, descriptionFallback: fallback },
      results,
      overwrite
    )
  }
}

async function convertSkills(srcRoot, destDir, results, overwrite = false) {
  const skillsDir = resolve(srcRoot, 'skills')
  if (!existsSync(skillsDir)) return

  await mkdir(destDir, { recursive: true })

  const subdirs = await readdir(skillsDir, { withFileTypes: true })
  for (const entry of subdirs) {
    if (!entry.isDirectory()) continue
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
