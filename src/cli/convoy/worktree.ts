import { execFile as execFileCb } from 'node:child_process'
import { mkdir } from 'node:fs/promises'
import { realpathSync } from 'node:fs'
import { join, basename, resolve, sep } from 'node:path'
import { promisify } from 'node:util'

const execFile = promisify(execFileCb)

export interface WorktreeInfo {
  path: string
  branch: string
  head: string
}

export interface WorktreeManager {
  create(workerId: string, featureBranch: string): Promise<string>
  remove(worktreePath: string): Promise<void>
  list(): Promise<WorktreeInfo[]>
  removeAll(): Promise<void>
}

export function createWorktreeManager(basePath: string): WorktreeManager {
  const resolvedBase = realpathSync(resolve(basePath))
  const worktreesDir = join(resolvedBase, '.opencastle', 'worktrees')

  async function create(workerId: string, featureBranch: string): Promise<string> {
    if (!/^[a-zA-Z0-9_-]+$/.test(workerId)) {
      throw new Error(
        `Invalid workerId "${workerId}": must only contain alphanumeric characters, hyphens, and underscores`,
      )
    }
    const worktreePath = join(worktreesDir, workerId)
    await mkdir(worktreesDir, { recursive: true })
    await execFile(
      'git',
      ['worktree', 'add', worktreePath, '-b', `convoy-${workerId}`, featureBranch],
      { cwd: resolvedBase },
    )
    return worktreePath
  }

  async function remove(worktreePath: string): Promise<void> {
    let resolved: string
    try {
      resolved = realpathSync(worktreePath)
    } catch {
      resolved = resolve(worktreePath)
    }
    if (!resolved.startsWith(worktreesDir + sep)) {
      throw new Error(`Path "${worktreePath}" is outside the managed worktrees directory`)
    }
    const workerId = basename(resolved)
    try {
      await execFile('git', ['worktree', 'remove', resolved, '--force'], {
        cwd: resolvedBase,
      })
    } catch (err) {
      const stderr = (err as { stderr?: string }).stderr ?? ''
      if (stderr.includes('is not a working tree')) {
        return
      }
      throw err
    }
    try {
      await execFile('git', ['branch', '-D', `convoy-${workerId}`], { cwd: resolvedBase })
    } catch {
      // Branch may already be deleted — ignore
    }
  }


  async function list(): Promise<WorktreeInfo[]> {
    const { stdout } = await execFile('git', ['worktree', 'list', '--porcelain'], {
      cwd: resolvedBase,
    })
    return parseWorktreeList(stdout, worktreesDir)
  }

  async function removeAll(): Promise<void> {
    const worktrees = await list()
    for (const wt of worktrees) {
      await remove(wt.path)
    }
  }

  return { create, remove, list, removeAll }
}

function parseWorktreeList(output: string, worktreesDir: string): WorktreeInfo[] {
  const results: WorktreeInfo[] = []
  const blocks = output.trim().split(/\n\n+/).filter(Boolean)

  for (const block of blocks) {
    const lines = block.split('\n')
    let path = ''
    let head = ''
    let branch = ''

    for (const line of lines) {
      if (line.startsWith('worktree ')) {
        path = line.slice('worktree '.length)
      } else if (line.startsWith('HEAD ')) {
        head = line.slice('HEAD '.length)
      } else if (line.startsWith('branch ')) {
        branch = line.slice('branch '.length)
      }
    }

    // Only include worktrees that live under .opencastle/worktrees/
    if (path.startsWith(worktreesDir + sep)) {
      results.push({ path, branch, head })
    }
  }

  return results
}
