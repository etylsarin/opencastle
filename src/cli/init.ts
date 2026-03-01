import { resolve } from 'node:path'
import { readFile, unlink } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { select, confirm, closePrompts } from './prompt.js'
import { readManifest, writeManifest, createManifest } from './manifest.js'
import { removeDirIfExists } from './copy.js'
import { updateGitignore } from './gitignore.js'
import { getRequiredMcpEnvVars } from './stack-config.js'
import type { CliContext, IdeAdapter, CmsChoice, DbChoice, PmChoice, NotifChoice, StackConfig } from './types.js'

const ADAPTERS: Record<string, () => Promise<IdeAdapter>> = {
  vscode: () => import('./adapters/vscode.js') as Promise<IdeAdapter>,
  cursor: () => import('./adapters/cursor.js') as Promise<IdeAdapter>,
  'claude-code': () =>
    import('./adapters/claude-code.js') as Promise<IdeAdapter>,
}

export default async function init({ pkgRoot, args }: CliContext): Promise<void> {
  const projectRoot = process.cwd()
  const dryRun = args.includes('--dry-run')

  // Check for existing installation
  const existing = await readManifest(projectRoot)
  let isReinit = false
  if (existing) {
    const proceed = await confirm(
      `OpenCastle already installed (v${existing.version}, ${existing.ide}). Re-initialize?`,
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

  console.log(`\n  🏰 OpenCastle v${pkg.version}`)
  console.log(
    '  Multi-agent orchestration framework for AI coding assistants\n'
  )

  // ── IDE selection ───────────────────────────────────────────────
  const ide = await select('Which IDE are you using?', [
    {
      label: 'VS Code',
      hint: 'GitHub Copilot — .github/ agents, instructions, skills',
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
  ])

  // ── CMS selection ───────────────────────────────────────────────
  const cms = await select('Which CMS are you using?', [
    { label: 'Sanity', hint: 'GROQ queries, real-time collaboration', value: 'sanity' },
    { label: 'Contentful', hint: 'GraphQL / REST API, structured content', value: 'contentful' },
    { label: 'Strapi', hint: 'Open-source headless CMS', value: 'strapi' },
    { label: 'None', hint: 'No CMS — skip CMS skills and agents', value: 'none' },
  ])

  // ── Database selection ──────────────────────────────────────────
  const db = await select('Which database are you using?', [
    { label: 'Supabase', hint: 'Postgres + Auth + RLS + Edge Functions', value: 'supabase' },
    { label: 'Convex', hint: 'Reactive backend with real-time sync', value: 'convex' },
    { label: 'None', hint: 'No database — skip DB skills and agents', value: 'none' },
  ])

  // ── Project management selection ────────────────────────────────
  const pm = await select('Which project management tool are you using?', [
    { label: 'Linear', hint: 'Issue tracking with MCP integration', value: 'linear' },
    { label: 'Jira', hint: 'Atlassian issue tracking via Rovo MCP', value: 'jira' },
    { label: 'None', hint: 'No project management — skip PM skills', value: 'none' },
  ])

  // ── Notifications selection ────────────────────────────────────
  const notifications = await select('Which notifications tool are you using?', [
    { label: 'Slack', hint: 'Agent notifications and bi-directional communication', value: 'slack' },
    { label: 'Microsoft Teams', hint: 'Agent notifications via Teams channels', value: 'teams' },
    { label: 'None', hint: 'No notifications — skip messaging skills', value: 'none' },
  ])

  const stack: StackConfig = { cms: cms as CmsChoice, db: db as DbChoice, pm: pm as PmChoice, notifications: notifications as NotifChoice }

  console.log(`\n  Installing for ${ide}...`)
  console.log(`  Stack: CMS=${stack.cms}, DB=${stack.db}, PM=${stack.pm}, Notifications=${stack.notifications}\n`)

  // ── Dry run ─────────────────────────────────────────────────────
  if (dryRun) {
    const adapter = await ADAPTERS[ide]()
    const managed = adapter.getManagedPaths()
    console.log('  [dry-run] Files that would be created:\n')
    for (const p of managed.framework) {
      console.log(`    + ${p}`)
    }
    for (const p of managed.customizable) {
      console.log(`    + ${p}`)
    }
    console.log(`    + .opencastle.json`)
    console.log(`    + .gitignore (OpenCastle entries)`)
    console.log('\n  No files were written.\n')
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
    // Remove MCP config so it gets regenerated with new stack
    const mcpCandidates = [
      '.vscode/mcp.json',
      '.cursor/mcp.json',
      '.claude/mcp.json',
    ]
    for (const mcpPath of mcpCandidates) {
      const fullPath = resolve(projectRoot, mcpPath)
      if (existsSync(fullPath)) {
        await unlink(fullPath)
      }
    }
  }

  // ── Run adapter ─────────────────────────────────────────────────
  const adapter = await ADAPTERS[ide]()
  const results = await adapter.install(pkgRoot, projectRoot, stack)

  // ── Write manifest ──────────────────────────────────────────────
  const manifest = createManifest(pkg.version, ide)
  manifest.managedPaths = adapter.getManagedPaths()
  manifest.stack = stack
  await writeManifest(projectRoot, manifest)

  // ── Update .gitignore ───────────────────────────────────────────
  const managedPaths = adapter.getManagedPaths()
  const gitignoreResult = await updateGitignore(projectRoot, managedPaths)

  // ── Summary ─────────────────────────────────────────────────────
  const created = results.created.length
  const skipped = results.skipped.length

  console.log(`  ✓ Created ${created} files`)
  if (gitignoreResult === 'created') {
    console.log('  ✓ Created .gitignore with OpenCastle entries')
  } else if (gitignoreResult === 'updated') {
    console.log('  ✓ Updated .gitignore with OpenCastle entries')
  }
  if (skipped > 0) {
    console.log(`  → Skipped ${skipped} existing files`)
  }

  // ── Env var notice ──────────────────────────────────────────────
  const envVars = getRequiredMcpEnvVars(stack)
  if (envVars.length > 0) {
    console.log(`\n  ⚠  Required environment variables for MCP servers:\n`)
    for (const { envVar, hint } of envVars) {
      console.log(`     ${envVar}`)
      console.log(`     └ ${hint}\n`)
    }
  }

  console.log(`\n  Next steps:`)
  if (ide === 'vscode') {
    console.log(
      '  0. Reload VS Code window (Cmd+Shift+P → "Reload Window") to pick up agents'
    )
  } else if (ide === 'cursor') {
    console.log(
      '  0. Reload Cursor window to pick up the new rule files'
    )
  }
  if (envVars.length > 0) {
    console.log(
      `  1. Set the environment variable${envVars.length > 1 ? 's' : ''} listed above`
    )
  }
  console.log(
    `  ${envVars.length > 0 ? '2' : '1'}. Run the "Bootstrap Customizations" prompt to configure for your project`
  )
  console.log(`  ${envVars.length > 0 ? '3' : '2'}. Customize agent definitions for your tech stack`)
  console.log(`  ${envVars.length > 0 ? '4' : '3'}. Commit the generated files to your repository`)
  console.log()

  closePrompts()
}
