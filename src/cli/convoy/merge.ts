import { execFile as execFileCb } from 'node:child_process'
import { resolve, join, sep } from 'node:path'
import { promisify } from 'node:util'

const execFile = promisify(execFileCb)

export interface MergeResult {
  success: boolean
  conflicted: boolean
  message: string
}

export class MergeConflictError extends Error {
  constructor(
    public readonly conflictingFiles: string[],
    message?: string,
  ) {
    super(message ?? `Merge conflict in: ${conflictingFiles.join(', ')}`)
    this.name = 'MergeConflictError'
  }
}

export interface MergeQueue {
  /**
   * Merge a single worktree's changes back onto the target branch.
   * Stages all changes in the worktree, commits them if necessary, then merges
   * the worktree branch into the target branch.
   */
  merge(worktreePath: string, worktreeBranch: string, targetBranch: string): Promise<MergeResult>
}

export function createMergeQueue(repoPath: string): MergeQueue {
  const worktreesDir = resolve(join(repoPath, '.opencastle', 'worktrees'))

  async function merge(
    worktreePath: string,
    worktreeBranch: string,
    targetBranch: string,
  ): Promise<MergeResult> {
    const resolvedWorktree = resolve(worktreePath)
    if (!resolvedWorktree.startsWith(worktreesDir + sep)) {
      throw new Error(`Path "${worktreePath}" is outside the managed worktrees directory`)
    }

    // Stage all untracked/modified files in the worktree
    await execFile('git', ['-C', resolvedWorktree, 'add', '-A'])

    // List staged files — non-empty output means there are changes to commit.
    // Uses --name-only (exits 0 regardless of diff size) rather than --quiet
    // (exits 1 when changes exist) so the check is output-based, not exit-code-based.
    const { stdout: staged } = await execFile('git', [
      '-C',
      resolvedWorktree,
      'diff',
      '--cached',
      '--name-only',
    ])
    const hasUncommitted = staged.trim().length > 0

    if (hasUncommitted) {
      await execFile('git', [
        '-C',
        resolvedWorktree,
        'commit',
        '-m',
        `convoy: ${worktreeBranch} completed`,
      ])
    }

    // Merge the worktree branch into the target branch in the main repo
    await execFile('git', ['-C', repoPath, 'checkout', targetBranch])

    try {
      const { stdout } = await execFile('git', [
        '-C',
        repoPath,
        'merge',
        worktreeBranch,
        '--no-edit',
      ])
      if (stdout.includes('Already up to date')) {
        return { success: true, conflicted: false, message: 'No changes to merge' }
      }
      return { success: true, conflicted: false, message: 'Merged successfully' }
    } catch (err) {
      const error = err as { code?: number | string; stderr?: string; stdout?: string }
      const isConflict =
        error.code === 1 &&
        ((error.stderr ?? '').includes('CONFLICT') || (error.stdout ?? '').includes('CONFLICT'))
      if (isConflict) {
        // Collect conflicting files before aborting
        let conflictingFiles: string[] = []
        try {
          const { stdout: conflictOut } = await execFile('git', [
            '-C', repoPath, 'diff', '--name-only', '--diff-filter=U',
          ])
          conflictingFiles = conflictOut.split('\n').filter(Boolean)
        } catch { /* ignore — we still abort */ }
        await execFile('git', ['-C', repoPath, 'merge', '--abort'])
        throw new MergeConflictError(conflictingFiles)
      }
      throw err
    }
  }

  return { merge }
}
