import { resolve, dirname } from 'node:path';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { getOrchestratorRoot } from './copy.js';
import { getIncludedMcpServers } from './stack-config.js';
import type { ScaffoldResult, StackConfig } from './types.js';

/**
 * Scaffold or merge the MCP server config into the target project.
 *
 * Reads the template from `opencastle/src/orchestrator/mcp.json`,
 * writes it to `<projectRoot>/<destRelPath>` (e.g. `.vscode/mcp.json`).
 *
 * When a StackConfig is provided, only servers relevant to the chosen
 * CMS/DB stack (plus core servers) are included.
 *
 * If the file already exists, missing servers are merged in without
 * overwriting any existing server configs.
 */
export async function scaffoldMcpConfig(
  pkgRoot: string,
  projectRoot: string,
  destRelPath: string,
  stack?: StackConfig
): Promise<ScaffoldResult> {
  const destPath = resolve(projectRoot, destRelPath);

  const srcRoot = getOrchestratorRoot(pkgRoot);
  const templatePath = resolve(srcRoot, 'mcp.json');
  const content = await readFile(templatePath, 'utf8');

  const template = JSON.parse(content) as { servers: Record<string, unknown> };

  // Filter servers based on stack config
  if (stack) {
    const included = getIncludedMcpServers(stack);
    template.servers = Object.fromEntries(
      Object.entries(template.servers).filter(([key]) => included.has(key))
    );
  }

  if (existsSync(destPath)) {
    // Merge: add missing servers without overwriting existing ones
    const existingContent = await readFile(destPath, 'utf8');
    const existing = JSON.parse(existingContent) as {
      servers?: Record<string, unknown>;
      [key: string]: unknown;
    };

    if (!existing.servers) {
      existing.servers = {};
    }

    let added = 0;
    for (const [key, value] of Object.entries(template.servers)) {
      if (!(key in existing.servers)) {
        existing.servers[key] = value;
        added++;
      }
    }

    if (added === 0) {
      return { path: destPath, action: 'skipped' };
    }

    await writeFile(destPath, JSON.stringify(existing, null, 2) + '\n');
    return { path: destPath, action: 'created' };
  }

  await mkdir(dirname(destPath), { recursive: true });
  await writeFile(destPath, JSON.stringify(template, null, 2) + '\n');

  return { path: destPath, action: 'created' };
}
