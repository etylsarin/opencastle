import { mkdtempSync, rmSync, realpathSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { execFile as execFileCb } from 'node:child_process'
import { promisify } from 'node:util'
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { createWorktreeManager } from './worktree.js'
import type { WorktreeManager } from './worktree.js'

const execFile = promisify(execFileCb)

// ── helpers ───────────────────────────────────────────────────────────────────

let tmpDir: string
let manager: WorktreeManager

async function initGitRepo(dir: string): Promise<void> {
  await execFile('git', ['init'], { cwd: dir })
  await execFile('git', ['config', 'user.email', 'test@test.com'], { cwd: dir })
  await execFile('git', ['config', 'user.name', 'Test User'], { cwd: dir })
  await execFile('git', ['commit', '--allow-empty', '-m', 'Initial commit'], { cwd: dir })
}

beforeEach(async () => {
  tmpDir = realpathSync(mkdtempSync(join(tmpdir(), 'convoy-worktree-test-')))
  await initGitRepo(tmpDir)
  manager = createWorktreeManager(tmpDir)
})

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true })
})

// ── create ────────────────────────────────────────────────────────────────────

describe('create', () => {
  it('creates a worktree and returns its absolute path', async () => {
    const worktreePath = await manager.create('worker1', 'HEAD')
    expect(worktreePath).toBe(join(tmpDir, '.opencastle', 'worktrees', 'worker1'))
  })

  it('creates the .opencastle/worktrees directory when it does not exist', async () => {
    const { existsSync } = await import('node:fs')
    const worktreePath = await manager.create('worker1', 'HEAD')
    expect(existsSync(worktreePath)).toBe(true)
  })

  it('creates the new branch in the worktree', async () => {
    await manager.create('worker1', 'HEAD')
    const { stdout } = await execFile('git', ['branch', '--list', 'convoy-worker1'], { cwd: tmpDir })
    // git prefixes branches checked out in a worktree with '+ '
    expect(stdout.trim().replace(/^[*+]\s+/, '')).toBe('convoy-worker1')
  })

  it('throws when featureBranch does not exist', async () => {
    await expect(manager.create('worker1', 'nonexistent-branch')).rejects.toThrow()
  })

  it('throws when workerId is already in use', async () => {
    await manager.create('worker1', 'HEAD')
    await expect(manager.create('worker1', 'HEAD')).rejects.toThrow()
  })

  it('throws for workerId with path traversal characters', async () => {
    await expect(manager.create('../escape', 'HEAD')).rejects.toThrow(/Invalid workerId/)
  })

  it('throws for workerId with slashes', async () => {
    await expect(manager.create('a/b', 'HEAD')).rejects.toThrow(/Invalid workerId/)
  })
})

// ── remove ────────────────────────────────────────────────────────────────────

describe('remove', () => {
  it('removes the worktree so it no longer appears in list()', async () => {
    const path = await manager.create('worker1', 'HEAD')
    await manager.remove(path)
    const worktrees = await manager.list()
    expect(worktrees).toHaveLength(0)
  })

  it('deletes the convoy branch after removing the worktree', async () => {
    const path = await manager.create('worker1', 'HEAD')
    await manager.remove(path)
    const { stdout } = await execFile('git', ['branch', '--list', 'convoy-worker1'], { cwd: tmpDir })
    expect(stdout.trim()).toBe('')
  })

  it('is idempotent — does not throw for a non-existent worktree path', async () => {
    const nonExistent = join(tmpDir, '.opencastle', 'worktrees', 'ghost')
    await expect(manager.remove(nonExistent)).resolves.toBeUndefined()
  })

  it('re-throws git errors that are not "not a working tree"', async () => {
    const path = await manager.create('worker1', 'HEAD')
    // Lock the worktree so that single --force removal fails
    await execFile('git', ['worktree', 'lock', path], { cwd: tmpDir })
    await expect(manager.remove(path)).rejects.toThrow()
    // Cleanup: unlock and remove manually
    await execFile('git', ['worktree', 'unlock', path], { cwd: tmpDir })
  })

  it('throws when path is outside the managed worktrees directory', async () => {
    await expect(manager.remove('/some/arbitrary/path')).rejects.toThrow(
      /outside the managed worktrees directory/,
    )
  })
})

// ── list ──────────────────────────────────────────────────────────────────────

describe('list', () => {
  it('returns an empty array when no convoy worktrees exist', async () => {
    const worktrees = await manager.list()
    expect(worktrees).toHaveLength(0)
  })

  it('does not include the main worktree', async () => {
    const worktrees = await manager.list()
    for (const wt of worktrees) {
      expect(wt.path).toContain('.opencastle/worktrees')
    }
  })

  it('returns the correct WorktreeInfo for a created worktree', async () => {
    await manager.create('worker1', 'HEAD')
    const worktrees = await manager.list()
    expect(worktrees).toHaveLength(1)
    expect(worktrees[0].path).toBe(join(tmpDir, '.opencastle', 'worktrees', 'worker1'))
    expect(worktrees[0].branch).toBe('refs/heads/convoy-worker1')
    expect(worktrees[0].head).toMatch(/^[0-9a-f]{40}$/)
  })

  it('returns multiple worktrees when several have been created', async () => {
    await manager.create('worker1', 'HEAD')
    await manager.create('worker2', 'HEAD')
    const worktrees = await manager.list()
    expect(worktrees).toHaveLength(2)
    const paths = worktrees.map(w => w.path)
    expect(paths).toContain(join(tmpDir, '.opencastle', 'worktrees', 'worker1'))
    expect(paths).toContain(join(tmpDir, '.opencastle', 'worktrees', 'worker2'))
  })

  it('handles detached HEAD worktrees by returning empty branch string', async () => {
    // git worktree list --porcelain outputs 'detached' (not 'branch refs/...') for
    // detached-HEAD worktrees — this exercises the else-if fallthrough in parseWorktreeList
    const { existsSync, mkdirSync } = await import('node:fs')
    const detachedPath = join(tmpDir, '.opencastle', 'worktrees', 'detached-test')
    if (!existsSync(join(tmpDir, '.opencastle', 'worktrees'))) {
      mkdirSync(join(tmpDir, '.opencastle', 'worktrees'), { recursive: true })
    }
    const { stdout: sha } = await execFile('git', ['rev-parse', 'HEAD'], { cwd: tmpDir })
    await execFile('git', ['worktree', 'add', '--detach', detachedPath, sha.trim()], { cwd: tmpDir })
    const worktrees = await manager.list()
    const detached = worktrees.find(w => w.path === detachedPath)
    expect(detached).toBeDefined()
    expect(detached!.branch).toBe('')
    expect(detached!.head).toMatch(/^[0-9a-f]{40}$/)
  })
})

// ── removeAll ─────────────────────────────────────────────────────────────────

describe('removeAll', () => {
  it('removes all convoy worktrees', async () => {
    await manager.create('worker1', 'HEAD')
    await manager.create('worker2', 'HEAD')
    await manager.removeAll()
    const worktrees = await manager.list()
    expect(worktrees).toHaveLength(0)
  })

  it('is a no-op when no convoy worktrees exist', async () => {
    await expect(manager.removeAll()).resolves.toBeUndefined()
  })
})
