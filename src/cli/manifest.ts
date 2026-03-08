import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import type { Manifest } from './types.js';

const MANIFEST_FILE = '.opencastle/manifest.json';

/**
 * Read the project's OpenCastle manifest, or null if not installed.
 * Tries the new location (.opencastle/manifest.json) first, then falls back
 * to the legacy location (.opencastle.json) for backward compatibility.
 */
export async function readManifest(
  projectRoot: string
): Promise<Manifest | null> {
  try {
    const content = await readFile(
      resolve(projectRoot, MANIFEST_FILE),
      'utf8'
    );
    return JSON.parse(content) as Manifest;
  } catch {
    // Fallback to legacy location
    try {
      const content = await readFile(
        resolve(projectRoot, '.opencastle.json'),
        'utf8'
      );
      return JSON.parse(content) as Manifest;
    } catch {
      return null;
    }
  }
}

/**
 * Write the manifest to .opencastle/manifest.json.
 * Creates the .opencastle/ directory if it doesn't exist.
 */
export async function writeManifest(
  projectRoot: string,
  manifest: Manifest
): Promise<void> {
  const path = resolve(projectRoot, MANIFEST_FILE);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify(manifest, null, 2) + '\n');
}

/**
 * Create a fresh manifest object.
 */
export function createManifest(version: string, ide: string, ides?: string[]): Manifest {
  return {
    version,
    ide,
    ides: ides ?? [ide],
    installedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}
