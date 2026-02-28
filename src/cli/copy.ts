import {
  readdir,
  readFile,
  mkdir,
  writeFile,
  copyFile,
  rm,
} from 'node:fs/promises';
import { resolve } from 'node:path';
import { existsSync } from 'node:fs';
import type { CopyResults, CopyDirOptions } from './types.js';

/**
 * Recursively copy a directory tree.
 */
export async function copyDir(
  src: string,
  dest: string,
  { overwrite = false, filter, transform }: CopyDirOptions = {}
): Promise<CopyResults> {
  const entries = await readdir(src, { withFileTypes: true });
  await mkdir(dest, { recursive: true });

  const results: CopyResults = { copied: [], skipped: [], created: [] };

  for (const entry of entries) {
    const srcPath = resolve(src, entry.name);
    const destPath = resolve(dest, entry.name);

    if (filter && !filter(entry.name, srcPath)) continue;

    if (entry.isDirectory()) {
      const sub = await copyDir(srcPath, destPath, {
        overwrite,
        filter,
        transform,
      });
      results.copied.push(...sub.copied);
      results.skipped.push(...sub.skipped);
      results.created.push(...sub.created);
    } else {
      const exists = existsSync(destPath);
      if (exists && !overwrite) {
        results.skipped.push(destPath);
        continue;
      }

      if (transform) {
        const content = await readFile(srcPath, 'utf8');
        const transformed = await transform(content, srcPath);
        if (transformed !== null) {
          await writeFile(destPath, transformed);
          results[exists ? 'copied' : 'created'].push(destPath);
        }
      } else {
        await copyFile(srcPath, destPath);
        results[exists ? 'copied' : 'created'].push(destPath);
      }
    }
  }

  return results;
}

/**
 * Resolve the orchestrator source directory from the CLI package root.
 */
export function getOrchestratorRoot(pkgRoot: string): string {
  return resolve(pkgRoot, 'src', 'orchestrator');
}

/**
 * Remove a directory if it exists. No-op if it doesn't.
 */
export async function removeDirIfExists(dirPath: string): Promise<void> {
  if (existsSync(dirPath)) {
    await rm(dirPath, { recursive: true });
  }
}
