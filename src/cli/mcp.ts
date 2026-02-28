import { resolve, dirname } from 'node:path';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { getOrchestratorRoot } from './copy.js';
import type { ScaffoldResult } from './types.js';

/**
 * Scaffold the MCP server config into the target project.
 *
 * Reads the template from `opencastle/src/orchestrator/mcp.json`,
 * writes it to `<projectRoot>/<destRelPath>` (e.g. `.vscode/mcp.json`).
 *
 * This is a customizable file — scaffolded once, never overwritten on update.
 */
export async function scaffoldMcpConfig(
  pkgRoot: string,
  projectRoot: string,
  destRelPath: string
): Promise<ScaffoldResult> {
  const destPath = resolve(projectRoot, destRelPath);

  if (existsSync(destPath)) {
    return { path: destPath, action: 'skipped' };
  }

  const srcRoot = getOrchestratorRoot(pkgRoot);
  const templatePath = resolve(srcRoot, 'mcp.json');
  const content = await readFile(templatePath, 'utf8');

  await mkdir(dirname(destPath), { recursive: true });
  await writeFile(destPath, content);

  return { path: destPath, action: 'created' };
}
