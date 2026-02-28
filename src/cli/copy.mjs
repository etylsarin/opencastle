import {
  readdir,
  readFile,
  mkdir,
  writeFile,
  copyFile,
  rm,
} from 'node:fs/promises'
import { resolve } from 'node:path'
import { existsSync } from 'node:fs'

/**
 * Recursively copy a directory tree.
 *
 * @param {string} src  - Source directory (absolute path)
 * @param {string} dest - Destination directory (absolute path)
 * @param {object} opts
 * @param {boolean}  opts.overwrite  - Overwrite existing files (default: false)
 * @param {Function} opts.filter     - (name, srcPath) => boolean
 * @param {Function} opts.transform  - (content, srcPath) => string | null
 * @returns {Promise<{ copied: string[], skipped: string[], created: string[] }>}
 */
export async function copyDir(
  src,
  dest,
  { overwrite = false, filter, transform } = {}
) {
  const entries = await readdir(src, { withFileTypes: true })
  await mkdir(dest, { recursive: true })

  const results = { copied: [], skipped: [], created: [] }

  for (const entry of entries) {
    const srcPath = resolve(src, entry.name)
    const destPath = resolve(dest, entry.name)

    if (filter && !filter(entry.name, srcPath)) continue

    if (entry.isDirectory()) {
      const sub = await copyDir(srcPath, destPath, {
        overwrite,
        filter,
        transform,
      })
      results.copied.push(...sub.copied)
      results.skipped.push(...sub.skipped)
      results.created.push(...sub.created)
    } else {
      const exists = existsSync(destPath)
      if (exists && !overwrite) {
        results.skipped.push(destPath)
        continue
      }

      if (transform) {
        const content = await readFile(srcPath, 'utf8')
        const transformed = await transform(content, srcPath)
        if (transformed !== null) {
          await writeFile(destPath, transformed)
          results[exists ? 'copied' : 'created'].push(destPath)
        }
      } else {
        await copyFile(srcPath, destPath)
        results[exists ? 'copied' : 'created'].push(destPath)
      }
    }
  }

  return results
}

/**
 * Resolve the orchestrator source directory from the CLI package root.
 */
export function getOrchestratorRoot(pkgRoot) {
  return resolve(pkgRoot, 'src', 'orchestrator')
}

/**
 * Remove a directory if it exists. No-op if it doesn't.
 * @param {string} dirPath - Absolute path to the directory
 */
export async function removeDirIfExists(dirPath) {
  if (existsSync(dirPath)) {
    await rm(dirPath, { recursive: true })
  }
}
