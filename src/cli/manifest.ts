import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { Manifest } from './types.js';

const MANIFEST_FILE = '.opencastle.json';

/**
 * Read the project's OpenCastle manifest, or null if not installed.
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
    return null;
  }
}

/**
 * Write the manifest to the project root.
 */
export async function writeManifest(
  projectRoot: string,
  manifest: Manifest
): Promise<void> {
  const path = resolve(projectRoot, MANIFEST_FILE);
  await writeFile(path, JSON.stringify(manifest, null, 2) + '\n');
}

/**
 * Create a fresh manifest object.
 */
export function createManifest(version: string, ide: string): Manifest {
  return {
    version,
    ide,
    installedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}
