import { resolve, basename } from 'node:path'
import { mkdir, writeFile, readdir, readFile, unlink, rm } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { copyDir, getOrchestratorRoot, getPluginsRoot, getPluginSkillEntries } from '../copy.js'
import { scaffoldMcpConfig } from '../mcp.js'
import { getExcludedSkills, getExcludedAgents, getCustomizationsTransform, getIncludedPluginIds } from '../stack-config.js'
import type { CopyResults, ManagedPaths, RepoInfo, StackConfig } from '../types.js'

/**
 * OpenCode adapter.
 *
 * Generates AGENTS.md (root instructions) and .opencode/ structure.
 *
 *   copilot-instructions.md    → AGENTS.md  (combined with instructions/)
 *   skills/*\/SKILL.md          → .opencode/skills/<name>.md
 *   agents/*.agent.md          → .opencode/agents/<name>.md
 *   agent-workflows/*.md       → .opencode/workflows/<name>.md
 *   prompts/*.prompt.md        → .opencode/prompts/<name>.md
 *   customizations/            → .opencode/customizations/  (scaffolded once)
 *   mcp.json                   → opencode.json  (OpenCode format: type local/remote)
 */

export const IDE_ID = 'opencode'
export const IDE_LABEL = 'OpenCode'

// ─── Helpers ──────────────────────────────────────────────────────

function stripFrontmatter(content: string): string {
  const m = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/)
  return m ? m[2].trim() : content.trim()
}

function parseFrontmatterMeta(content: string): Record<string, string> {
  const m = content.match(/^---\n([\s\S]*?)\n---/)
  if (!m) return {}
  const meta: Record<string, string> = {}
  for (const line of m[1].split('\n')) {
    const kv = line.match(/^(\w[\w-]*):\s*['"]?(.+?)['"]?\s*$/)
    if (kv) meta[kv[1]] = kv[2]
  }
  return meta
}

// ─── Install ──────────────────────────────────────────────────────

export async function install(
  pkgRoot: string,
  projectRoot: string,
  stack?: StackConfig,
  repoInfo?: RepoInfo
): Promise<CopyResults> {
  const srcRoot = getOrchestratorRoot(pkgRoot)
  const results: CopyResults = { copied: [], skipped: [], created: [] }

  const excludedSkills = stack ? getExcludedSkills(stack) : new Set<string>()
  const excludedAgents = stack ? getExcludedAgents(stack) : new Set<string>()

  // 1. Build AGENTS.md ← instructions/* + agent index + skill index
  const agentsMd = resolve(projectRoot, 'AGENTS.md')
  if (!existsSync(agentsMd)) {
    const sections: string[] = []

    sections.push(
      '# Project Instructions\n\n' +
      'All conventions, architecture, and project context are embedded below. ' +
      'Skills are in `.opencode/skills/` — read them when a task matches. ' +
      'Agent definitions are in `.opencode/agents/` — read the relevant file when adopting a persona.'
    )

    // Always-loaded instruction files
    const instDir = resolve(srcRoot, 'instructions')
    if (existsSync(instDir)) {
      for (const file of (await readdir(instDir)).sort()) {
        if (!file.endsWith('.md')) continue
        const content = await readFile(resolve(instDir, file), 'utf8')
        sections.push(
          `\n---\n\n<!-- Source: instructions/${file} -->\n\n${stripFrontmatter(content)}`
        )
      }
    }

    // Agent reference
    const agentsDir = resolve(srcRoot, 'agents')
    if (existsSync(agentsDir)) {
      const agentLines: string[] = ['\n---\n\n## Agent Definitions\n']
      agentLines.push(
        'The following agent personas are available. Adopt the appropriate persona when asked.\n'
      )
      for (const file of (await readdir(agentsDir)).sort()) {
        if (!file.endsWith('.md')) continue
        if (excludedAgents.has(file)) continue
        const meta = parseFrontmatterMeta(
          await readFile(resolve(agentsDir, file), 'utf8')
        )
        const name = meta['name'] ?? basename(file, '.agent.md')
        const desc = meta['description'] ?? ''
        agentLines.push(`- **${name}**: ${desc}`)
      }
      agentLines.push(
        '\nFull agent definitions are in `.opencode/agents/`. Read the relevant file when adopting a persona.'
      )
      sections.push(agentLines.join('\n'))
    }

    // Skill index
    const skillsDir = resolve(srcRoot, 'skills')
    if (existsSync(skillsDir)) {
      const skillLines: string[] = ['\n---\n\n## Available Skills\n']
      skillLines.push(
        'Skills are on-demand knowledge files. Read the file when the task matches.\n'
      )
      const subdirs = (
        await readdir(skillsDir, { withFileTypes: true })
      ).filter((e) => e.isDirectory())
      for (const entry of subdirs.sort((a, b) =>
        a.name.localeCompare(b.name)
      )) {
        if (excludedSkills.has(entry.name)) continue
        const skillFile = resolve(skillsDir, entry.name, 'SKILL.md')
        if (!existsSync(skillFile)) continue
        const meta = parseFrontmatterMeta(await readFile(skillFile, 'utf8'))
        const desc = meta['description'] ?? ''
        skillLines.push(
          `- **${entry.name}** (\`.opencode/skills/${entry.name}.md\`): ${desc}`
        )
      }

      // Plugin skills
      const pluginsRoot = getPluginsRoot(pkgRoot)
      const includedPlugins = stack ? getIncludedPluginIds(stack) : undefined
      const pluginEntries = await getPluginSkillEntries(pluginsRoot, includedPlugins)
      for (const { id, skillPath } of pluginEntries.sort((a, b) => a.id.localeCompare(b.id))) {
        const pluginMeta = parseFrontmatterMeta(await readFile(skillPath, 'utf8'))
        const pluginDesc = pluginMeta['description'] ?? ''
        skillLines.push(
          `- **${id}** (\`.opencode/skills/${id}.md\`): ${pluginDesc}`
        )
      }

      sections.push(skillLines.join('\n'))
    }

    await writeFile(agentsMd, sections.join('\n') + '\n')
    results.created.push(agentsMd)
  } else {
    results.skipped.push(agentsMd)
  }

  const openDir = resolve(projectRoot, '.opencode')

  // 2. Agent definitions → .opencode/agents/
  const agentsDir = resolve(srcRoot, 'agents')
  if (existsSync(agentsDir)) {
    const destAgents = resolve(openDir, 'agents')
    await mkdir(destAgents, { recursive: true })
    for (const file of await readdir(agentsDir)) {
      if (!file.endsWith('.md')) continue
      if (excludedAgents.has(file)) continue
      const destPath = resolve(destAgents, file)
      if (existsSync(destPath)) {
        results.skipped.push(destPath)
        continue
      }
      const content = await readFile(resolve(agentsDir, file), 'utf8')
      await writeFile(destPath, stripFrontmatter(content) + '\n')
      results.created.push(destPath)
    }
  }

  // 3. Skills → .opencode/skills/<name>.md
  const skillsDir = resolve(srcRoot, 'skills')
  if (existsSync(skillsDir)) {
    const destSkills = resolve(openDir, 'skills')
    await mkdir(destSkills, { recursive: true })
    const subdirs = (
      await readdir(skillsDir, { withFileTypes: true })
    ).filter((e) => e.isDirectory())
    for (const entry of subdirs) {
      if (excludedSkills.has(entry.name)) continue
      const skillFile = resolve(skillsDir, entry.name, 'SKILL.md')
      if (!existsSync(skillFile)) continue
      const destPath = resolve(destSkills, `${entry.name}.md`)
      if (existsSync(destPath)) {
        results.skipped.push(destPath)
        continue
      }
      const content = await readFile(skillFile, 'utf8')
      await writeFile(destPath, stripFrontmatter(content) + '\n')
      results.created.push(destPath)
    }
  }

  // 3b. Plugin skills → .opencode/skills/<plugin-id>.md
  {
    const pluginsRoot = getPluginsRoot(pkgRoot)
    const includedPlugins = stack ? getIncludedPluginIds(stack) : undefined
    const pluginEntries = await getPluginSkillEntries(pluginsRoot, includedPlugins)
    const destSkills = resolve(openDir, 'skills')
    await mkdir(destSkills, { recursive: true })
    for (const { id, skillPath } of pluginEntries) {
      const destPath = resolve(destSkills, `${id}.md`)
      if (existsSync(destPath)) {
        results.skipped.push(destPath)
        continue
      }
      const content = await readFile(skillPath, 'utf8')
      await writeFile(destPath, stripFrontmatter(content) + '\n')
      results.created.push(destPath)
    }
  }

  // 4. Prompts → .opencode/prompts/<name>.md
  const promptDir = resolve(srcRoot, 'prompts')
  if (existsSync(promptDir)) {
    const destPrompts = resolve(openDir, 'prompts')
    await mkdir(destPrompts, { recursive: true })
    for (const file of await readdir(promptDir)) {
      if (!file.endsWith('.md')) continue
      const name = basename(file, '.prompt.md') || basename(file, '.md')
      const destPath = resolve(destPrompts, `${name}.md`)
      if (existsSync(destPath)) {
        results.skipped.push(destPath)
        continue
      }
      const content = await readFile(resolve(promptDir, file), 'utf8')
      await writeFile(destPath, stripFrontmatter(content) + '\n')
      results.created.push(destPath)
    }
  }

  // 5. Agent Workflows → .opencode/workflows/<name>.md
  const wfDir = resolve(srcRoot, 'agent-workflows')
  if (existsSync(wfDir)) {
    const destWf = resolve(openDir, 'workflows')
    await mkdir(destWf, { recursive: true })
    for (const file of await readdir(wfDir)) {
      if (!file.endsWith('.md')) continue
      if (file === 'README.md') continue
      const name = basename(file, '.md')
      const destPath = resolve(destWf, `${name}.md`)
      if (existsSync(destPath)) {
        results.skipped.push(destPath)
        continue
      }
      const content = await readFile(resolve(wfDir, file), 'utf8')
      await writeFile(destPath, stripFrontmatter(content) + '\n')
      results.created.push(destPath)
    }
  }

  // 6. Customizations (scaffold once, pre-populated with stack choices)
  const custDir = resolve(srcRoot, 'customizations')
  if (existsSync(custDir)) {
    const destCust = resolve(openDir, 'customizations')
    const custTransform = stack ? getCustomizationsTransform(stack) : undefined
    const sub = await copyDir(custDir, destCust, { transform: custTransform })
    results.created.push(...sub.created)
    results.skipped.push(...sub.skipped)
  }

  // 7. MCP server config → opencode.json (OpenCode format)
  const mcpResult = await scaffoldMcpConfig(
    projectRoot,
    'opencode.json',
    stack,
    repoInfo,
    'opencode'
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
  const results: CopyResults = { copied: [], skipped: [], created: [] }
  const openDir = resolve(projectRoot, '.opencode')

  // 1. Regenerate AGENTS.md (overwrite)
  const agentsMd = resolve(projectRoot, 'AGENTS.md')
  if (existsSync(agentsMd)) {
    await unlink(agentsMd)
  }

  // 2. Remove existing framework files so install() recreates them
  const frameworkDirs = ['agents', 'skills', 'prompts', 'workflows']
  for (const dir of frameworkDirs) {
    const dirPath = resolve(openDir, dir)
    if (existsSync(dirPath)) {
      await rm(dirPath, { recursive: true })
    }
  }

  // 3. Re-run full install
  const installResult = await install(pkgRoot, projectRoot, stack)
  results.copied.push(...installResult.created)
  results.skipped.push(...installResult.skipped)

  return results
}

// ─── Managed paths ────────────────────────────────────────────────

export function getManagedPaths(): ManagedPaths {
  return {
    framework: [
      'AGENTS.md',
      '.opencode/agents/',
      '.opencode/skills/',
      '.opencode/prompts/',
      '.opencode/workflows/',
    ],
    customizable: ['.opencode/customizations/', 'opencode.json'],
  }
}
