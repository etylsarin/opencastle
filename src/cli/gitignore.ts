import { resolve } from 'node:path'
import { readFile, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import type { ManagedPaths } from './types.js'

const START_MARKER = '# >>> OpenCastle managed (do not edit) >>>'
const END_MARKER = '# <<< OpenCastle managed <<<'

/**
 * Build the gitignore block for OpenCastle-managed files.
 *
 * Ignores all framework-managed paths plus the manifest file.
 * Explicitly un-ignores customizable directories so user edits
 * are committed even when a parent directory is ignored.
 */
function buildBlock(managed: ManagedPaths): string {
  const lines: string[] = [START_MARKER]

  // Framework-managed paths (overwritten on `opencastle update`)
  for (const p of managed.framework) {
    lines.push(p)
  }

  // Manifest file
  lines.push('.opencastle.json')

  // Un-ignore customizable paths so they stay tracked
  for (const p of managed.customizable) {
    lines.push(`!${p}`)
  }

  lines.push(END_MARKER)
  return lines.join('\n')
}

/**
 * Create or update the project's `.gitignore` with OpenCastle entries.
 *
 * - If no `.gitignore` exists, creates one with the managed block.
 * - If `.gitignore` exists but has no OpenCastle block, appends it.
 * - If `.gitignore` already contains an OpenCastle block, replaces it
 *   (handles re-init or IDE switch cleanly).
 */
export async function updateGitignore(
  projectRoot: string,
  managed: ManagedPaths
): Promise<'created' | 'updated' | 'unchanged'> {
  const gitignorePath = resolve(projectRoot, '.gitignore')
  const block = buildBlock(managed)

  if (!existsSync(gitignorePath)) {
    await writeFile(gitignorePath, block + '\n', 'utf8')
    return 'created'
  }

  const existing = await readFile(gitignorePath, 'utf8')

  // Replace existing block
  const startIdx = existing.indexOf(START_MARKER)
  const endIdx = existing.indexOf(END_MARKER)

  if (startIdx !== -1 && endIdx !== -1) {
    const before = existing.slice(0, startIdx)
    const after = existing.slice(endIdx + END_MARKER.length)
    const updated = before + block + after

    if (updated === existing) return 'unchanged'

    await writeFile(gitignorePath, updated, 'utf8')
    return 'updated'
  }

  // Append block to existing file
  const separator = existing.endsWith('\n') ? '\n' : '\n\n'
  await writeFile(gitignorePath, existing + separator + block + '\n', 'utf8')
  return 'updated'
}
