import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtemp, writeFile, mkdir, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { detectRepoInfo, mergeStackIntoRepoInfo, formatRepoInfo } from './detect.js'
import type { StackConfig, RepoInfo } from './types.js'

// ── detectRepoInfo (filesystem-backed) ─────────────────────────

describe('detectRepoInfo', () => {
  let tempDir: string

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'opencastle-test-'))
  })

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true })
  })

  it('detects npm from package-lock.json', async () => {
    await writeFile(join(tempDir, 'package-lock.json'), '{}')
    const info = await detectRepoInfo(tempDir)
    expect(info.packageManager).toBe('npm')
  })

  it('detects pnpm from pnpm-lock.yaml', async () => {
    await writeFile(join(tempDir, 'pnpm-lock.yaml'), '')
    const info = await detectRepoInfo(tempDir)
    expect(info.packageManager).toBe('pnpm')
  })

  it('detects yarn from yarn.lock', async () => {
    await writeFile(join(tempDir, 'yarn.lock'), '')
    const info = await detectRepoInfo(tempDir)
    expect(info.packageManager).toBe('yarn')
  })

  it('detects TypeScript from tsconfig.json', async () => {
    await writeFile(join(tempDir, 'tsconfig.json'), '{}')
    const info = await detectRepoInfo(tempDir)
    expect(info.language).toBe('typescript')
  })

  it('detects JavaScript from jsconfig.json', async () => {
    await writeFile(join(tempDir, 'jsconfig.json'), '{}')
    const info = await detectRepoInfo(tempDir)
    expect(info.language).toBe('javascript')
  })

  it('detects Next.js from next.config.mjs', async () => {
    await writeFile(join(tempDir, 'next.config.mjs'), 'export default {}')
    const info = await detectRepoInfo(tempDir)
    expect(info.frameworks).toContain('next')
  })

  it('detects Astro from astro.config.mjs', async () => {
    await writeFile(join(tempDir, 'astro.config.mjs'), 'export default {}')
    const info = await detectRepoInfo(tempDir)
    expect(info.frameworks).toContain('astro')
  })

  it('detects NX monorepo from nx.json', async () => {
    await writeFile(join(tempDir, 'nx.json'), '{}')
    const info = await detectRepoInfo(tempDir)
    expect(info.monorepo).toBe('nx')
  })

  it('detects Supabase from supabase/config.toml', async () => {
    await mkdir(join(tempDir, 'supabase'), { recursive: true })
    await writeFile(join(tempDir, 'supabase', 'config.toml'), '')
    const info = await detectRepoInfo(tempDir)
    expect(info.databases).toContain('supabase')
  })

  it('detects Prisma from prisma/schema.prisma', async () => {
    await mkdir(join(tempDir, 'prisma'), { recursive: true })
    await writeFile(join(tempDir, 'prisma', 'schema.prisma'), '')
    const info = await detectRepoInfo(tempDir)
    expect(info.databases).toContain('prisma')
  })

  it('detects Vercel from vercel.json', async () => {
    await writeFile(join(tempDir, 'vercel.json'), '{}')
    const info = await detectRepoInfo(tempDir)
    expect(info.deployment).toContain('vercel')
  })

  it('detects Docker from Dockerfile', async () => {
    await writeFile(join(tempDir, 'Dockerfile'), 'FROM node:22')
    const info = await detectRepoInfo(tempDir)
    expect(info.deployment).toContain('docker')
  })

  it('detects Playwright from playwright.config.ts', async () => {
    await writeFile(join(tempDir, 'playwright.config.ts'), 'export default {}')
    const info = await detectRepoInfo(tempDir)
    expect(info.testing).toContain('playwright')
  })

  it('detects GitHub Actions from .github/workflows/', async () => {
    await mkdir(join(tempDir, '.github', 'workflows'), { recursive: true })
    const info = await detectRepoInfo(tempDir)
    expect(info.cicd).toContain('github-actions')
  })

  it('detects Tailwind from tailwind.config.js', async () => {
    await writeFile(join(tempDir, 'tailwind.config.js'), 'module.exports = {}')
    const info = await detectRepoInfo(tempDir)
    expect(info.styling).toContain('tailwind')
  })

  it('detects MCP config from .vscode/mcp.json', async () => {
    await mkdir(join(tempDir, '.vscode'), { recursive: true })
    await writeFile(join(tempDir, '.vscode', 'mcp.json'), '{}')
    const info = await detectRepoInfo(tempDir)
    expect(info.mcpConfig).toBe(true)
  })

  it('detects packages from package.json dependencies', async () => {
    await writeFile(
      join(tempDir, 'package.json'),
      JSON.stringify({
        dependencies: { next: '^14.0.0', '@supabase/supabase-js': '^2.0.0' },
        devDependencies: { vitest: '^1.0.0', tailwindcss: '^3.0.0' },
      })
    )
    const info = await detectRepoInfo(tempDir)
    expect(info.frameworks).toContain('next')
    expect(info.databases).toContain('supabase')
    expect(info.testing).toContain('vitest')
    expect(info.styling).toContain('tailwind')
  })

  it('detects corepack packageManager field', async () => {
    await writeFile(
      join(tempDir, 'package.json'),
      JSON.stringify({ packageManager: 'pnpm@9.0.0' })
    )
    const info = await detectRepoInfo(tempDir)
    expect(info.packageManager).toBe('pnpm')
  })

  it('returns clean object for empty directory', async () => {
    const info = await detectRepoInfo(tempDir)
    expect(info).toBeDefined()
    // No undefined values — only populated fields
    for (const value of Object.values(info)) {
      expect(value).not.toBeUndefined()
    }
  })

  it('deduplicates config files', async () => {
    await writeFile(join(tempDir, 'package-lock.json'), '{}')
    await writeFile(join(tempDir, 'tsconfig.json'), '{}')
    const info = await detectRepoInfo(tempDir)
    const unique = new Set(info.configFiles)
    expect(info.configFiles?.length).toBe(unique.size)
  })

  it('sorts arrays for stable output', async () => {
    await writeFile(
      join(tempDir, 'package.json'),
      JSON.stringify({
        dependencies: { next: '1', express: '1' },
      })
    )
    const info = await detectRepoInfo(tempDir)
    if (info.frameworks && info.frameworks.length > 1) {
      const sorted = [...info.frameworks].sort()
      expect(info.frameworks).toEqual(sorted)
    }
  })

  it('detects Sanity CMS from sanity.config.ts', async () => {
    await writeFile(join(tempDir, 'sanity.config.ts'), 'export default {}')
    const info = await detectRepoInfo(tempDir)
    expect(info.cms).toContain('sanity')
  })

  it('auto-adds supabase-auth when supabase is detected', async () => {
    await mkdir(join(tempDir, 'supabase'), { recursive: true })
    await writeFile(join(tempDir, 'supabase', 'config.toml'), '')
    const info = await detectRepoInfo(tempDir)
    expect(info.auth).toContain('supabase-auth')
  })

  it('detects multiple tools simultaneously', async () => {
    await writeFile(join(tempDir, 'next.config.mjs'), '')
    await writeFile(join(tempDir, 'vercel.json'), '{}')
    await writeFile(join(tempDir, 'tsconfig.json'), '{}')
    await writeFile(join(tempDir, 'tailwind.config.js'), '')
    const info = await detectRepoInfo(tempDir)
    expect(info.frameworks).toContain('next')
    expect(info.deployment).toContain('vercel')
    expect(info.language).toBe('typescript')
    expect(info.styling).toContain('tailwind')
  })
})

// ── mergeStackIntoRepoInfo ─────────────────────────────────────

describe('mergeStackIntoRepoInfo', () => {
  const emptyStack: StackConfig = { ides: [], techTools: [], teamTools: [] }

  it('returns original info when stack is empty', () => {
    const info: RepoInfo = { language: 'typescript' }
    const merged = mergeStackIntoRepoInfo(info, emptyStack)
    expect(merged.language).toBe('typescript')
  })

  it('adds CMS tools from techTools', () => {
    const merged = mergeStackIntoRepoInfo(
      {},
      { ides: [], techTools: ['sanity'], teamTools: [] }
    )
    expect(merged.cms).toContain('sanity')
  })

  it('adds database tools from techTools', () => {
    const merged = mergeStackIntoRepoInfo(
      {},
      { ides: [], techTools: ['supabase'], teamTools: [] }
    )
    expect(merged.databases).toContain('supabase')
  })

  it('adds deployment tools from techTools', () => {
    const merged = mergeStackIntoRepoInfo(
      {},
      { ides: [], techTools: ['vercel'], teamTools: [] }
    )
    expect(merged.deployment).toContain('vercel')
  })

  it('sets NX monorepo from techTools', () => {
    const merged = mergeStackIntoRepoInfo(
      {},
      { ides: [], techTools: ['nx'], teamTools: [] }
    )
    expect(merged.monorepo).toBe('nx')
  })

  it('does not overwrite existing monorepo with NX', () => {
    const merged = mergeStackIntoRepoInfo(
      { monorepo: 'turborepo' },
      { ides: [], techTools: ['nx'], teamTools: [] }
    )
    expect(merged.monorepo).toBe('turborepo')
  })

  it('adds PM tools from teamTools', () => {
    const merged = mergeStackIntoRepoInfo(
      {},
      { ides: [], techTools: [], teamTools: ['linear'] }
    )
    expect(merged.pm).toContain('linear')
  })

  it('adds notification tools from teamTools', () => {
    const merged = mergeStackIntoRepoInfo(
      {},
      { ides: [], techTools: [], teamTools: ['slack'] }
    )
    expect(merged.notifications).toContain('slack')
  })

  it('deduplicates when tool already exists', () => {
    const merged = mergeStackIntoRepoInfo(
      { cms: ['sanity'] },
      { ides: [], techTools: ['sanity'], teamTools: [] }
    )
    expect(merged.cms).toEqual(['sanity'])
  })

  it('preserves existing values while adding new ones', () => {
    const merged = mergeStackIntoRepoInfo(
      { databases: ['prisma'], language: 'typescript' },
      { ides: [], techTools: ['supabase'], teamTools: ['linear'] }
    )
    expect(merged.databases).toContain('prisma')
    expect(merged.databases).toContain('supabase')
    expect(merged.language).toBe('typescript')
    expect(merged.pm).toContain('linear')
  })
})

// ── formatRepoInfo ─────────────────────────────────────────────

describe('formatRepoInfo', () => {
  it('formats empty info as empty string', () => {
    expect(formatRepoInfo({})).toBe('')
  })

  it('includes package manager', () => {
    const output = formatRepoInfo({ packageManager: 'pnpm' })
    expect(output).toContain('pnpm')
  })

  it('includes frameworks', () => {
    const output = formatRepoInfo({ frameworks: ['next', 'astro'] })
    expect(output).toContain('next')
    expect(output).toContain('astro')
  })

  it('includes all populated fields', () => {
    const output = formatRepoInfo({
      packageManager: 'npm',
      monorepo: 'nx',
      language: 'typescript',
      frameworks: ['next'],
      databases: ['supabase'],
      cms: ['sanity'],
      deployment: ['vercel'],
      testing: ['vitest'],
      cicd: ['github-actions'],
      styling: ['tailwind'],
      auth: ['clerk'],
    })
    expect(output).toContain('npm')
    expect(output).toContain('nx')
    expect(output).toContain('typescript')
    expect(output).toContain('next')
    expect(output).toContain('supabase')
    expect(output).toContain('sanity')
    expect(output).toContain('vercel')
    expect(output).toContain('vitest')
    expect(output).toContain('github-actions')
    expect(output).toContain('tailwind')
    expect(output).toContain('clerk')
  })

  it('indents lines with 4 spaces', () => {
    const output = formatRepoInfo({ packageManager: 'npm' })
    expect(output).toMatch(/^ {4}/)
  })
})
