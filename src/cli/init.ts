import { resolve } from 'node:path'
import { readFile, unlink } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { multiselect, confirm, closePrompts, c } from './prompt.js'
import { readManifest, writeManifest, createManifest } from './manifest.js'
import { removeDirIfExists } from './copy.js'
import { updateGitignore } from './gitignore.js'
import { getRequiredMcpEnvVars } from './stack-config.js'
import { TECH_PLUGINS, TEAM_PLUGINS } from '../orchestrator/plugins/index.js'
import { detectRepoInfo, mergeStackIntoRepoInfo, formatRepoInfo } from './detect.js'
import type { CliContext, IdeAdapter, IdeChoice, TechTool, TeamTool, StackConfig } from './types.js'

const ADAPTERS: Record<string, () => Promise<IdeAdapter>> = {
  vscode: () => import('./adapters/vscode.js') as Promise<IdeAdapter>,
  cursor: () => import('./adapters/cursor.js') as Promise<IdeAdapter>,
  'claude-code': () =>
    import('./adapters/claude-code.js') as Promise<IdeAdapter>,
  opencode: () =>
    import('./adapters/opencode.js') as Promise<IdeAdapter>,
}

/** IDE display labels */
const IDE_DISPLAY: Record<IdeChoice, string> = {
  vscode: 'VS Code',
  cursor: 'Cursor',
  'claude-code': 'Claude Code',
  opencode: 'OpenCode',
}

export default async function init({ pkgRoot, args }: CliContext): Promise<void> {
  const projectRoot = process.cwd()
  const dryRun = args.includes('--dry-run')

  // Check for existing installation
  const existing = await readManifest(projectRoot)
  let isReinit = false
  if (existing) {
    const proceed = await confirm(
      `OpenCastle already installed (v${existing.version}). Re-initialize?`,
      false
    )
    if (!proceed) {
      console.log('  Aborted.')
      return
    }
    isReinit = true
  }

  const pkg = JSON.parse(
    await readFile(resolve(pkgRoot, 'package.json'), 'utf8')
  ) as { version: string }

  console.log(`\n  🏰 ${c.bold('OpenCastle')} ${c.dim(`v${pkg.version}`)}`)
  console.log(
    `  ${c.dim('Multi-agent orchestration framework for AI coding assistants')}\n`
  )

  // ── Repo research ───────────────────────────────────────────────
  console.log(`  ${c.dim('Scanning repository...')}`)
  const repoInfo = await detectRepoInfo(projectRoot)
  const summary = formatRepoInfo(repoInfo)
  if (summary) {
    console.log(`  ${c.green('Detected:')}\n` + summary + '\n')
  } else {
    console.log(`  ${c.dim('No tooling detected (empty project?)')}\n`)
  }

  // ── IDEs (multiselect, at least 1) ─────────────────────────────
  console.log(`  ${c.bold('── IDEs ──────────────────────────────────────')}`)
  let ides: string[] = []
  while (ides.length === 0) {
    ides = await multiselect('Which IDEs do you use?', [
      {
        label: 'VS Code',
        hint: 'GitHub Copilot agents, instructions, skills',
        value: 'vscode',
      },
      {
        label: 'Cursor',
        hint: '.cursorrules & .cursor/rules/*.mdc',
        value: 'cursor',
      },
      {
        label: 'Claude Code',
        hint: 'CLAUDE.md & .claude/ commands, skills',
        value: 'claude-code',
      },
      {
        label: 'OpenCode',
        hint: 'AGENTS.md & opencode.json',
        value: 'opencode',
      },
    ])
    if (ides.length === 0) {
      console.log(`  ${c.yellow('Please select at least one IDE.')}`)
    }
  }

  // ── Tech Tools (multiselect, 0-N) ──────────────────────────────
  // Pre-select tools already detected in the repo
  const detectedTools = new Set([
    ...(repoInfo.cms ?? []),
    ...(repoInfo.databases ?? []),
    ...(repoInfo.deployment ?? []),
    ...(repoInfo.monorepo ? [repoInfo.monorepo] : []),
  ])

  console.log(`  ${c.bold('── Tech Tools ────────────────────────────────')}`)
  const techTools = await multiselect('Which tools does your project use?',
    TECH_PLUGINS.map((p) => ({
      label: p.label,
      hint: p.hint,
      value: p.id,
      ...((p.preselected || detectedTools.has(p.id)) && { selected: true }),
    }))
  )

  // ── Team Tools (multiselect, 0-N) ──────────────────────────────
  console.log(`  ${c.bold('── Team Tools ────────────────────────────────')}`)
  const teamTools = await multiselect('Which team tools do you use?',
    TEAM_PLUGINS.map((p) => ({
      label: p.label,
      hint: p.hint,
      value: p.id,
      ...(p.preselected && { selected: true }),
    }))
  )

  const stack: StackConfig = {
    ides: ides as IdeChoice[],
    techTools: techTools as TechTool[],
    teamTools: teamTools as TeamTool[],
  }

  // ── Merge user choices into detected info ────────────────────
  const combinedRepoInfo = mergeStackIntoRepoInfo(repoInfo, stack)

  const ideNames = ides.map((id) => IDE_DISPLAY[id as IdeChoice]).join(', ')
  console.log(`\n  Installing for ${c.cyan(ideNames)}...`)
  if (techTools.length > 0) {
    console.log(`  Tech: ${c.green(techTools.join(', '))}`)
  }
  if (teamTools.length > 0) {
    console.log(`  Team: ${c.green(teamTools.join(', '))}`)
  }
  console.log()

  // ── Dry run ─────────────────────────────────────────────────────
  if (dryRun) {
    for (const ide of ides) {
      const adapter = await ADAPTERS[ide]()
      const managed = adapter.getManagedPaths()
      console.log(`  ${c.dim(`[dry-run] ${IDE_DISPLAY[ide as IdeChoice]} files:`)}\n`)
      for (const p of managed.framework) {
        console.log(`    ${c.green('+')} ${p}`)
      }
      for (const p of managed.customizable) {
        console.log(`    ${c.green('+')} ${p}`)
      }
    }
    console.log(`    ${c.green('+')} .opencastle.json`)
    console.log(`    ${c.green('+')} .gitignore (OpenCastle entries)`)
    console.log(`\n  ${c.dim('No files were written.')}\n`)
    closePrompts()
    return
  }

  // ── Clean up previous installation on re-init ────────────────
  if (isReinit && existing) {
    const frameworkPaths = existing.managedPaths?.framework ?? []
    for (const p of frameworkPaths) {
      const fullPath = resolve(projectRoot, p)
      if (p.endsWith('/')) {
        await removeDirIfExists(fullPath)
      } else if (existsSync(fullPath)) {
        await unlink(fullPath)
      }
    }
    // Remove MCP configs so they get regenerated with new stack
    const mcpCandidates = [
      '.vscode/mcp.json',
      '.cursor/mcp.json',
      '.claude/mcp.json',
      'opencode.json',
    ]
    for (const mcpPath of mcpCandidates) {
      const fullPath = resolve(projectRoot, mcpPath)
      if (existsSync(fullPath)) {
        await unlink(fullPath)
      }
    }
  }

  // ── Run adapters for each selected IDE ──────────────────────────
  let totalCreated = 0
  let totalSkipped = 0
  const allManagedPaths = { framework: [] as string[], customizable: [] as string[] }

  for (const ide of ides) {
    const adapter = await ADAPTERS[ide]()
    const results = await adapter.install(pkgRoot, projectRoot, stack, combinedRepoInfo)
    totalCreated += results.created.length
    totalSkipped += results.skipped.length

    const managed = adapter.getManagedPaths()
    allManagedPaths.framework.push(...managed.framework)
    allManagedPaths.customizable.push(...managed.customizable)
  }

  // ── Write manifest ──────────────────────────────────────────────
  const manifest = createManifest(pkg.version, ides[0], ides)
  manifest.managedPaths = allManagedPaths
  manifest.stack = stack
  manifest.repoInfo = combinedRepoInfo
  await writeManifest(projectRoot, manifest)

  // ── Update .gitignore ───────────────────────────────────────────
  const gitignoreResult = await updateGitignore(projectRoot, allManagedPaths)

  // ── Summary ─────────────────────────────────────────────────────
  console.log(`  ${c.green('✓')} Created ${c.bold(String(totalCreated))} files`)
  if (gitignoreResult === 'created') {
    console.log(`  ${c.green('✓')} Created .gitignore with OpenCastle entries`)
  } else if (gitignoreResult === 'updated') {
    console.log(`  ${c.green('✓')} Updated .gitignore with OpenCastle entries`)
  }
  if (totalSkipped > 0) {
    console.log(`  ${c.dim('→')} Skipped ${totalSkipped} existing files`)
  }

  // ── Env var notice ──────────────────────────────────────────────
  const envVars = getRequiredMcpEnvVars(stack, combinedRepoInfo)
  if (envVars.length > 0) {
    console.log(`\n  ${c.yellow('⚠')}  Required environment variables for MCP servers:\n`)
    for (const { envVar, hint } of envVars) {
      console.log(`     ${c.bold(envVar)}`)
      console.log(`     ${c.dim('└')} ${c.dim(hint)}\n`)
    }
  }

  // ── OAuth setup guides ────────────────────────────────────────
  if (teamTools.includes('slack')) {
    console.log(`  ${c.cyan('📖')} Slack MCP requires a Slack App with a bot token.`)
    console.log(`     Setup guide: ${c.cyan('https://www.opencastle.dev/guides/plugins#slack')}\n`)
  }

  console.log(`\n  ${c.bold('Next steps:')}`)

  let step = 0
  // Reload window messages for relevant IDEs
  const needsReload = ides.filter((id) => ['vscode', 'cursor'].includes(id))
  if (needsReload.length > 0) {
    step++
    if (needsReload.includes('vscode')) {
      console.log(
        `  ${step}. ${c.yellow('Reload VS Code window')} (Cmd+Shift+P → "Developer: Reload Window")`
      )
    }
    if (needsReload.includes('cursor')) {
      console.log(
        `  ${step}. ${c.yellow('Reload Cursor window')} to pick up the new rule files`
      )
    }
  }

  if (envVars.length > 0) {
    step++
    console.log(
      `  ${step}. Set the environment variable${envVars.length > 1 ? 's' : ''} listed above`
    )
  }
  step++
  console.log(
    `  ${step}. Run the ${c.cyan('"Bootstrap Customizations"')} prompt to configure for your project`
  )
  step++
  console.log(`  ${step}. Commit the customizations/ folder to your repository`)
  console.log()

  closePrompts()
}
