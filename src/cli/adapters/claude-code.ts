import { resolve, basename } from 'node:path'
import { mkdir, writeFile, readdir, readFile, unlink, rm } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { copyDir, getOrchestratorRoot } from '../copy.js'
import { scaffoldMcpConfig } from '../mcp.js'
import { getExcludedSkills, getExcludedAgents, getCustomizationsTransform } from '../stack-config.js'
import type { CopyResults, ManagedPaths, StackConfig } from '../types.js'

/**
 * Claude Code adapter.
 *
 * Generates CLAUDE.md (root instructions) and .claude/ structure.
 *
 *   copilot-instructions.md    → CLAUDE.md  (combined with instructions/)
 *   skills/\*\/SKILL.md         → .claude/skills/<name>.md
 *   agent-workflows/*.md       → .claude/commands/workflow-<name>.md
 *   prompts/*.prompt.md        → .claude/commands/<name>.md
 *   customizations/            → .claude/customizations/  (scaffolded once)
 *
 * Note: Claude Code has no "agents" concept. Agent definitions are embedded
 *       as reference sections within CLAUDE.md so Claude can adopt personas
 *       when asked.
 */

export const IDE_ID = 'claude-code'
export const IDE_LABEL = 'Claude Code'

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
  stack?: StackConfig
): Promise<CopyResults> {
  const srcRoot = getOrchestratorRoot(pkgRoot)
  const results: CopyResults = { copied: [], skipped: [], created: [] }

  const excludedSkills = stack ? getExcludedSkills(stack) : new Set<string>()
  const excludedAgents = stack ? getExcludedAgents(stack) : new Set<string>()

  // 1. Build CLAUDE.md ← copilot-instructions + instructions/* + agent index + skill index
  const claudeMd = resolve(projectRoot, 'CLAUDE.md')
  if (!existsSync(claudeMd)) {
    const sections: string[] = []

    // Main instructions
    const main = await readFile(
      resolve(srcRoot, 'copilot-instructions.md'),
      'utf8'
    )
    sections.push(stripFrontmatter(main))

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

    // Agent reference (so Claude can adopt personas)
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
        '\nFull agent definitions are in `.claude/agents/`. Read the relevant file when adopting a persona.'
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
          `- **${entry.name}** (\`.claude/skills/${entry.name}.md\`): ${desc}`
        )
      }
      sections.push(skillLines.join('\n'))
    }

    await writeFile(claudeMd, sections.join('\n') + '\n')
    results.created.push(claudeMd)
  } else {
    results.skipped.push(claudeMd)
  }

  const claudeDir = resolve(projectRoot, '.claude')

  // 2. Agent definitions → .claude/agents/
  const agentsDir = resolve(srcRoot, 'agents')
  if (existsSync(agentsDir)) {
    const destAgents = resolve(claudeDir, 'agents')
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

  // 3. Skills → .claude/skills/<name>.md
  const skillsDir = resolve(srcRoot, 'skills')
  if (existsSync(skillsDir)) {
    const destSkills = resolve(claudeDir, 'skills')
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

  // 4. Prompts → .claude/commands/<name>.md
  const promptDir = resolve(srcRoot, 'prompts')
  if (existsSync(promptDir)) {
    const destCmds = resolve(claudeDir, 'commands')
    await mkdir(destCmds, { recursive: true })
    for (const file of await readdir(promptDir)) {
      if (!file.endsWith('.md')) continue
      const name = basename(file, '.prompt.md') || basename(file, '.md')
      const destPath = resolve(destCmds, `${name}.md`)
      if (existsSync(destPath)) {
        results.skipped.push(destPath)
        continue
      }
      const content = await readFile(resolve(promptDir, file), 'utf8')
      await writeFile(destPath, stripFrontmatter(content) + '\n')
      results.created.push(destPath)
    }
  }

  // 5. Agent Workflows → .claude/commands/workflow-<name>.md
  const wfDir = resolve(srcRoot, 'agent-workflows')
  if (existsSync(wfDir)) {
    const destCmds = resolve(claudeDir, 'commands')
    await mkdir(destCmds, { recursive: true })
    for (const file of await readdir(wfDir)) {
      if (!file.endsWith('.md')) continue
      const name = basename(file, '.md')
      const destPath = resolve(destCmds, `workflow-${name}.md`)
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
    const destCust = resolve(claudeDir, 'customizations')
    const custTransform = stack ? getCustomizationsTransform(stack) : undefined
    const sub = await copyDir(custDir, destCust, { transform: custTransform })
    results.created.push(...sub.created)
    results.skipped.push(...sub.skipped)
  }

  // 7. MCP server config → .claude/mcp.json (scaffold once)
  const mcpResult = await scaffoldMcpConfig(
    pkgRoot,
    projectRoot,
    '.claude/mcp.json',
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
  const results: CopyResults = { copied: [], skipped: [], created: [] }
  const claudeDir = resolve(projectRoot, '.claude')

  // 1. Regenerate CLAUDE.md (overwrite)
  const claudeMd = resolve(projectRoot, 'CLAUDE.md')
  if (existsSync(claudeMd)) {
    await unlink(claudeMd)
  }

  // 2. Remove existing framework files so install() recreates them
  const frameworkDirs = ['agents', 'skills', 'commands']
  for (const dir of frameworkDirs) {
    const dirPath = resolve(claudeDir, dir)
    if (existsSync(dirPath)) {
      await rm(dirPath, { recursive: true })
    }
  }

  // 3. Re-run full install (CLAUDE.md + agents + skills + commands)
  const installResult = await install(pkgRoot, projectRoot, stack)
  // Everything install created is an "update" copy
  results.copied.push(...installResult.created)
  results.skipped.push(...installResult.skipped)

  return results
}

// ─── Managed paths ────────────────────────────────────────────────

export function getManagedPaths(): ManagedPaths {
  return {
    framework: [
      'CLAUDE.md',
      '.claude/agents/',
      '.claude/skills/',
      '.claude/commands/',
    ],
    customizable: ['.claude/customizations/', '.claude/mcp.json'],
  }
}
