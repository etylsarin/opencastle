import { resolve } from 'node:path';
import { readdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { readManifest } from './manifest.js';
import { getRequiredMcpEnvVars } from './stack-config.js';
import { IDE_ADAPTERS } from './adapters/index.js';
import type { CliContext, DoctorCheck, IdeChoice, Manifest } from './types.js';
import { IDE_LABELS } from './types.js';

// ── Styled output helpers ─────────────────────────────────────

const PASS = '\x1b[32m✓\x1b[0m';
const FAIL = '\x1b[31m✗\x1b[0m';
const WARN = '\x1b[33m!\x1b[0m';
const DIM = (s: string) => `\x1b[2m${s}\x1b[0m`;
const BOLD = (s: string) => `\x1b[1m${s}\x1b[0m`;

interface CheckResult {
  ok: boolean;
  label: string;
  detail?: string;
  warning?: boolean;
}

// ── Individual checks ─────────────────────────────────────────

function checkManifest(manifest: Manifest | null): CheckResult {
  if (!manifest) {
    return { ok: false, label: 'OpenCastle manifest (.opencastle/manifest.json)', detail: 'Not found. Run "npx opencastle init" first.' };
  }
  return { ok: true, label: 'OpenCastle manifest (.opencastle/manifest.json)', detail: `v${manifest.version}, IDE: ${manifest.ides?.join(', ') ?? manifest.ide}` };
}

async function checkCustomizations(projectRoot: string): Promise<CheckResult> {
  const dir = resolve(projectRoot, '.opencastle');
  if (!existsSync(dir)) {
    return { ok: false, label: 'Customizations directory', detail: '.opencastle/ not found' };
  }
  const files = await readdir(dir).catch(() => []);
  return { ok: true, label: 'Customizations directory', detail: `${files.length} entries` };
}

async function checkSkillMatrix(projectRoot: string): Promise<CheckResult> {
  const path = resolve(projectRoot, '.opencastle', 'agents', 'skill-matrix.json');
  if (!existsSync(path)) {
    return { ok: false, label: 'Skill matrix', detail: 'File not found at .opencastle/agents/skill-matrix.json' };
  }
  const { readFile } = await import('node:fs/promises');
  const content = await readFile(path, 'utf8');
  try {
    const data = JSON.parse(content);
    const bindings = data.bindings ?? {};
    const emptySlots = Object.entries(bindings).filter(
      ([, slot]) => !Array.isArray((slot as { entries?: unknown[] }).entries) || ((slot as { entries: unknown[] }).entries).length === 0
    );
    if (emptySlots.length > 0) {
      return { ok: true, label: 'Skill matrix', detail: `${emptySlots.length} unresolved capability slot(s)`, warning: true };
    }
    return { ok: true, label: 'Skill matrix', detail: 'All capability slots populated' };
  } catch {
    return { ok: false, label: 'Skill matrix', detail: 'Invalid JSON in skill-matrix.json' };
  }
}

async function checkLogs(projectRoot: string): Promise<CheckResult> {
  const dir = resolve(projectRoot, '.opencastle', 'logs');
  if (!existsSync(dir)) {
    return { ok: false, label: 'Observability logs', detail: 'logs/ directory not found — dashboard will be empty' };
  }
  const required = ['sessions.ndjson', 'delegations.ndjson', 'reviews.ndjson', 'panels.ndjson', 'disputes.ndjson'];
  const missing = required.filter((f) => !existsSync(resolve(dir, f)));
  if (missing.length > 0) {
    for (const file of missing) {
      await writeFile(resolve(dir, file), '', { flag: 'wx' }).catch(() => {/* already exists */});
    }
    return { ok: true, label: 'Observability logs', detail: `Created missing: ${missing.join(', ')}` };
  }
  return { ok: true, label: 'Observability logs', detail: 'All log files present' };
}

function checkMcpEnvVars(manifest: Manifest | null): CheckResult {
  if (!manifest?.stack) {
    return { ok: true, label: 'MCP environment variables', detail: 'No stack config (skipped)' };
  }
  const required = getRequiredMcpEnvVars(manifest.stack, manifest.repoInfo);
  if (required.length === 0) {
    return { ok: true, label: 'MCP environment variables', detail: 'No env vars required' };
  }
  const missing = required.filter((r) => !process.env[r.envVar]);
  if (missing.length > 0) {
    const names = missing.map((m) => m.envVar).join(', ');
    return { ok: false, label: 'MCP environment variables', detail: `Missing: ${names}` };
  }
  return { ok: true, label: 'MCP environment variables', detail: `${required.length} var(s) set` };
}

async function checkDotEnv(projectRoot: string, manifest: Manifest | null): Promise<CheckResult> {
  const envPath = resolve(projectRoot, '.env');
  if (!existsSync(envPath)) {
    if (manifest?.stack) {
      const required = getRequiredMcpEnvVars(manifest.stack, manifest.repoInfo);
      if (required.length > 0) {
        return { ok: true, label: '.env file', detail: 'Not found — consider creating one for MCP secrets', warning: true };
      }
    }
    return { ok: true, label: '.env file', detail: 'Not found (not required)' };
  }
  return { ok: true, label: '.env file', detail: 'Present' };
}

// ── Generic adapter-driven checks ────────────────────────────────

/** Run a single DoctorCheck against the filesystem. */
export async function runDoctorCheck(projectRoot: string, check: DoctorCheck): Promise<CheckResult> {
  const fullPath = resolve(projectRoot, check.path);

  if (check.type === 'file') {
    if (!existsSync(fullPath)) {
      return { ok: false, label: check.label, detail: `${check.path} not found` };
    }
    return { ok: true, label: check.label };
  }

  // type === 'dir'
  if (!existsSync(fullPath)) {
    return { ok: false, label: check.label, detail: `${check.path} not found` };
  }

  if (check.countContents) {
    const entries = await readdir(fullPath).catch(() => [] as string[]);
    const filtered = check.countFilter
      ? entries.filter((e) => e.endsWith(check.countFilter!))
      : entries;
    if (filtered.length === 0) {
      return { ok: false, label: check.label, detail: `No files found in ${check.path}` };
    }
    return { ok: true, label: check.label, detail: `${filtered.length} file(s)` };
  }

  return { ok: true, label: check.label };
}

/** Check MCP config presence from the adapter's customizable paths. */
export function checkMcpFromPaths(projectRoot: string, mcpPaths: string[]): CheckResult {
  if (mcpPaths.length === 0) {
    return { ok: true, label: 'MCP configuration', detail: 'No MCP config path configured' };
  }
  const found = mcpPaths.filter((p) => existsSync(resolve(projectRoot, p)));
  if (found.length === 0) {
    return {
      ok: true,
      label: 'MCP configuration',
      detail: `No MCP config found (${mcpPaths.join(', ')}) — MCP tools unavailable`,
      warning: true,
    };
  }
  return { ok: true, label: 'MCP configuration', detail: `${found.length} MCP config(s)` };
}

// ── Main doctor command ───────────────────────────────────────

export default async function doctor({ args: _args }: CliContext): Promise<void> {
  const projectRoot = process.cwd();

  console.log(`\n  🏰 ${BOLD('OpenCastle Doctor')}\n`);
  console.log(`  ${DIM('Checking your setup...')}\n`);

  const manifest = await readManifest(projectRoot);

  // Shared checks (not IDE-specific)
  const sharedResults: CheckResult[] = [
    checkManifest(manifest),
    await checkCustomizations(projectRoot),
    await checkSkillMatrix(projectRoot),
    await checkLogs(projectRoot),
    checkMcpEnvVars(manifest),
    await checkDotEnv(projectRoot, manifest),
  ];

  // IDE-specific checks derived from each adapter
  type IdeGroup = { label: string; results: CheckResult[] };
  const ideGroups: IdeGroup[] = [];

  if (manifest) {
    const ides = manifest.ides ?? (manifest.ide ? [manifest.ide] : []);
    for (const ide of ides) {
      const loader = IDE_ADAPTERS[ide];
      if (!loader) continue;
      const adapter = await loader();
      const doctorChecks = adapter.getDoctorChecks();
      const managedPaths = adapter.getManagedPaths();

      const checkResults = await Promise.all(
        doctorChecks.map((c) => runDoctorCheck(projectRoot, c))
      );

      // MCP config check — non-directory entries in the adapter's customizable paths
      const mcpPaths = managedPaths.customizable.filter((p) => !p.endsWith('/'));
      checkResults.push(checkMcpFromPaths(projectRoot, mcpPaths));

      ideGroups.push({
        label: IDE_LABELS[ide as IdeChoice] ?? ide,
        results: checkResults,
      });
    }
  }

  // Print shared results
  for (const r of sharedResults) {
    const icon = r.ok ? (r.warning ? WARN : PASS) : FAIL;
    const detail = r.detail ? `  ${DIM(r.detail)}` : '';
    console.log(`  ${icon} ${r.label}${detail}`);
  }

  // Print IDE-specific results, grouped with a header when multiple IDEs are configured
  if (ideGroups.length > 0) {
    console.log();
    for (const group of ideGroups) {
      if (ideGroups.length > 1) {
        console.log(`  ${BOLD(`[${group.label}]`)}`);
      }
      for (const r of group.results) {
        const icon = r.ok ? (r.warning ? WARN : PASS) : FAIL;
        const detail = r.detail ? `  ${DIM(r.detail)}` : '';
        console.log(`  ${icon} ${r.label}${detail}`);
      }
      if (ideGroups.length > 1) console.log();
    }
  }

  const allResults = [...sharedResults, ...ideGroups.flatMap((g) => g.results)];
  const failures = allResults.filter((r) => !r.ok);
  const warnings = allResults.filter((r) => r.ok && r.warning);

  if (failures.length > 0) {
    console.log(`  ${BOLD(`${failures.length} issue(s) found.`)} Run "npx opencastle init" to fix.\n`);
    process.exit(1);
  } else if (warnings.length > 0) {
    console.log(`  ${BOLD('All checks passed')} with ${warnings.length} warning(s).\n`);
  } else {
    console.log(`  ${BOLD('All checks passed.')} Your setup is healthy.\n`);
  }
}
