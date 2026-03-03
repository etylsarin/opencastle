import { resolve } from 'node:path';
import { readFile, access, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { readManifest } from './manifest.js';
import { getRequiredMcpEnvVars } from './stack-config.js';
import type { CliContext, Manifest, IdeChoice } from './types.js';

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
    return { ok: false, label: 'OpenCastle manifest (.opencastle.json)', detail: 'Not found. Run "npx opencastle init" first.' };
  }
  return { ok: true, label: 'OpenCastle manifest (.opencastle.json)', detail: `v${manifest.version}, IDE: ${manifest.ides?.join(', ') ?? manifest.ide}` };
}

async function checkCustomizations(projectRoot: string): Promise<CheckResult> {
  const dir = resolve(projectRoot, '.github', 'customizations');
  if (!existsSync(dir)) {
    return { ok: false, label: 'Customizations directory', detail: '.github/customizations/ not found' };
  }
  const files = await readdir(dir).catch(() => []);
  return { ok: true, label: 'Customizations directory', detail: `${files.length} entries` };
}

async function checkSkillMatrix(projectRoot: string): Promise<CheckResult> {
  const path = resolve(projectRoot, '.github', 'customizations', 'agents', 'skill-matrix.md');
  if (!existsSync(path)) {
    return { ok: false, label: 'Skill matrix', detail: 'File not found at .github/customizations/agents/skill-matrix.md' };
  }
  const content = await readFile(path, 'utf8');
  // Look for empty capability slots (pattern: | `domain` | | |)
  const emptySlots = content.match(/\| `\w+`\s*\|\s*\|\s*\|/g);
  if (emptySlots && emptySlots.length > 0) {
    return { ok: true, label: 'Skill matrix', detail: `${emptySlots.length} unresolved capability slot(s)`, warning: true };
  }
  return { ok: true, label: 'Skill matrix', detail: 'All capability slots populated' };
}

async function checkInstructions(projectRoot: string): Promise<CheckResult> {
  const dir = resolve(projectRoot, '.github', 'instructions');
  if (!existsSync(dir)) {
    return { ok: false, label: 'Instruction files', detail: '.github/instructions/ not found' };
  }
  const files = await readdir(dir).catch(() => []);
  const mdFiles = files.filter((f) => f.endsWith('.md'));
  if (mdFiles.length === 0) {
    return { ok: false, label: 'Instruction files', detail: 'No .md files in .github/instructions/' };
  }
  return { ok: true, label: 'Instruction files', detail: `${mdFiles.length} instruction files` };
}

async function checkAgents(projectRoot: string): Promise<CheckResult> {
  const dir = resolve(projectRoot, '.github', 'customizations', 'agents');
  if (!existsSync(dir)) {
    return { ok: false, label: 'Agent definitions', detail: 'agents/ directory not found in customizations' };
  }
  const files = await readdir(dir).catch(() => []);
  const agentFiles = files.filter((f) => f.endsWith('.agent.md'));
  if (agentFiles.length === 0) {
    return { ok: false, label: 'Agent definitions', detail: 'No .agent.md files found' };
  }
  return { ok: true, label: 'Agent definitions', detail: `${agentFiles.length} agents` };
}

async function checkSkills(projectRoot: string): Promise<CheckResult> {
  const dir = resolve(projectRoot, '.github', 'skills');
  if (!existsSync(dir)) {
    return { ok: false, label: 'Skills directory', detail: '.github/skills/ not found' };
  }
  const entries = await readdir(dir).catch(() => []);
  return { ok: true, label: 'Skills directory', detail: `${entries.length} skills` };
}

async function checkLogs(projectRoot: string): Promise<CheckResult> {
  const dir = resolve(projectRoot, '.github', 'customizations', 'logs');
  if (!existsSync(dir)) {
    return { ok: false, label: 'Observability logs', detail: 'logs/ directory not found — dashboard will be empty' };
  }
  const required = ['sessions.ndjson', 'delegations.ndjson', 'reviews.ndjson', 'panels.ndjson', 'disputes.ndjson'];
  const missing = required.filter((f) => !existsSync(resolve(dir, f)));
  if (missing.length > 0) {
    return { ok: true, label: 'Observability logs', detail: `Missing: ${missing.join(', ')}`, warning: true };
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

async function checkIdeConfigs(projectRoot: string, manifest: Manifest | null): Promise<CheckResult> {
  if (!manifest) {
    return { ok: false, label: 'IDE configuration files', detail: 'No manifest — cannot check' };
  }
  const ides = manifest.ides ?? [manifest.ide];
  const checks: Array<{ ide: string; file: string; found: boolean }> = [];

  for (const ide of ides) {
    let configFile: string;
    switch (ide as IdeChoice) {
      case 'vscode':
        configFile = '.github/copilot-instructions.md';
        break;
      case 'cursor':
        configFile = '.cursor/rules/opencastle.mdc';
        break;
      case 'claude-code':
        configFile = '.claude/settings.json';
        break;
      case 'opencode':
        configFile = '.opencode/agents.md';
        break;
      default:
        continue;
    }
    checks.push({ ide: ide as string, file: configFile, found: existsSync(resolve(projectRoot, configFile)) });
  }

  const missing = checks.filter((c) => !c.found);
  if (missing.length > 0) {
    return { ok: false, label: 'IDE configuration files', detail: `Missing: ${missing.map((m) => `${m.ide} (${m.file})`).join(', ')}` };
  }
  return { ok: true, label: 'IDE configuration files', detail: `${checks.length} IDE(s) configured` };
}

async function checkMcpConfig(projectRoot: string, manifest: Manifest | null): Promise<CheckResult> {
  if (!manifest) {
    return { ok: false, label: 'MCP configuration', detail: 'No manifest — cannot check' };
  }
  const ides = manifest.ides ?? [manifest.ide];
  const mcpPaths: Record<string, string> = {
    vscode: '.vscode/mcp.json',
    cursor: '.cursor/mcp.json',
    'claude-code': '.claude/mcp.json',
    opencode: 'mcp.json',
  };

  const found: string[] = [];
  for (const ide of ides) {
    const path = mcpPaths[ide as string];
    if (path && existsSync(resolve(projectRoot, path))) {
      found.push(ide as string);
    }
  }
  if (found.length === 0 && ides.length > 0) {
    return { ok: true, label: 'MCP configuration', detail: 'No MCP config files found (MCP tools will not be available)', warning: true };
  }
  return { ok: true, label: 'MCP configuration', detail: `${found.length} MCP config(s)` };
}

// ── Main doctor command ───────────────────────────────────────

export default async function doctor({ args: _args }: CliContext): Promise<void> {
  const projectRoot = process.cwd();

  console.log(`\n  🏰 ${BOLD('OpenCastle Doctor')}\n`);
  console.log(`  ${DIM('Checking your setup...')}\n`);

  const manifest = await readManifest(projectRoot);

  const results: CheckResult[] = [
    checkManifest(manifest),
    await checkCustomizations(projectRoot),
    await checkInstructions(projectRoot),
    await checkAgents(projectRoot),
    await checkSkills(projectRoot),
    await checkSkillMatrix(projectRoot),
    await checkLogs(projectRoot),
    await checkIdeConfigs(projectRoot, manifest),
    await checkMcpConfig(projectRoot, manifest),
    checkMcpEnvVars(manifest),
    await checkDotEnv(projectRoot, manifest),
  ];

  for (const r of results) {
    const icon = r.ok ? (r.warning ? WARN : PASS) : FAIL;
    const detail = r.detail ? `  ${DIM(r.detail)}` : '';
    console.log(`  ${icon} ${r.label}${detail}`);
  }

  const failures = results.filter((r) => !r.ok);
  const warnings = results.filter((r) => r.ok && r.warning);

  console.log();
  if (failures.length > 0) {
    console.log(`  ${BOLD(`${failures.length} issue(s) found.`)} Run "npx opencastle init" to fix.\n`);
    process.exit(1);
  } else if (warnings.length > 0) {
    console.log(`  ${BOLD('All checks passed')} with ${warnings.length} warning(s).\n`);
  } else {
    console.log(`  ${BOLD('All checks passed.')} Your setup is healthy.\n`);
  }
}
