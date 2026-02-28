#!/usr/bin/env tsx
/**
 * Generate realistic seed data for the Agent Dashboard.
 *
 * Writes NDJSON files to docs/ai-agents/logs/:
 *   - sessions.ndjson   (50 records)
 *   - delegations.ndjson (35 records)
 *   - panels.ndjson      (12 records + preserves existing)
 *
 * Usage: npx tsx opencastle/src/dashboard/scripts/generate-seed-data.ts
 */

import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

const REPO_ROOT = join(__dirname, '..', '..', '..', '..');
const LOGS_DIR = join(REPO_ROOT, 'docs', 'ai-agents', 'logs');

// --- Constants ---

const AGENTS = [
  'Developer',
  'UI/UX Expert',
  'Content Engineer',
  'Database Engineer',
  'Testing Expert',
  'Security Expert',
  'Performance Expert',
  'DevOps Expert',
  'Data Expert',
  'Architect',
  'Documentation Writer',
];

const MODELS = ['claude-opus-4-6', 'gpt-5.3-codex', 'gemini-3.1-pro', 'gpt-5-mini'];

const TIERS: Array<{ name: string; weight: number }> = [
  { name: 'utility', weight: 0.4 },
  { name: 'standard', weight: 0.25 },
  { name: 'economy', weight: 0.2 },
  { name: 'premium', weight: 0.15 },
];

const _MECHANISMS = ['sub-agent', 'background'];

const LINEAR_ISSUES = Array.from({ length: 30 }, (_, i) => `TAS-${i + 30}`);

const FILE_PARTITIONS = [
  ['libs/ui-kit/'],
  ['apps/tastebeer.eu/app/'],
  ['libs/queries/'],
  ['libs/supabase-auth/'],
  ['libs/data-pipeline/'],
  ['apps/tastecoffee.eu/app/'],
  ['libs/server-utils/'],
  ['apps/cms-studio/'],
  ['libs/ui-kit/', 'apps/tastebeer.eu/app/'],
  ['libs/queries/', 'libs/server-utils/'],
  ['apps/tastebeer.eu/app/', 'apps/tastecoffee.eu/app/'],
  ['libs/data-pipeline/', 'libs/queries/'],
];

const PANEL_KEYS = [
  'auth-review',
  'security-audit',
  'perf-review',
  'a11y-audit',
  'schema-review',
  'api-review',
  'ui-review',
  'test-coverage',
  'csp-headers',
  'migration-review',
  'query-optimization',
  'deployment-checklist',
];

const TASK_DESCRIPTIONS = [
  'Fix header navigation',
  'Add filter component',
  'Update search API',
  'Refactor auth flow',
  'Add price filter',
  'Fix map markers',
  'Update CMS schema',
  'Add unit tests',
  'Fix SSR hydration',
  'Optimize bundle size',
  'Add geolocation',
  'Fix CORS headers',
  'Update RLS policies',
  'Add image optimization',
  'Fix pagination',
  'Add sort options',
  'Update venue detail',
  'Fix mobile layout',
  'Add analytics tracking',
  'Update SEO metadata',
  'Fix cookie consent',
  'Add venue suggestions',
  'Update contact form',
  'Fix redirect loop',
  'Add social links',
  'Update moderation UI',
  'Fix CSP violations',
  'Add cache headers',
  'Update scraper logic',
  'Fix slug generation',
];

const LESSON_IDS = ['LES-001', 'LES-002', 'LES-003', 'LES-004', 'LES-005', 'LES-006', 'LES-007', 'LES-008', 'LES-009', 'LES-010'];

// --- Helpers ---

/** Seeded PRNG for reproducible results */
class SeededRandom {
  private seed: number;
  constructor(seed: number) {
    this.seed = seed;
  }
  next(): number {
    this.seed = (this.seed * 16807 + 0) % 2147483647;
    return (this.seed - 1) / 2147483646;
  }
  int(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }
  pick<T>(arr: T[]): T {
    return arr[this.int(0, arr.length - 1)];
  }
  weighted<T extends { name: string; weight: number }>(items: T[]): string {
    const r = this.next();
    let cumulative = 0;
    for (const item of items) {
      cumulative += item.weight;
      if (r <= cumulative) return item.name;
    }
    return items[items.length - 1].name;
  }
}

const rng = new SeededRandom(20260225);

/** Generate a timestamp between start and end dates, offset by index */
function generateTimestamp(index: number, total: number, startDate: Date, endDate: Date): string {
  const range = endDate.getTime() - startDate.getTime();
  const base = startDate.getTime() + (range * index) / total;
  const jitter = rng.int(-1800000, 1800000); // +/- 30 min
  const ts = new Date(Math.max(startDate.getTime(), Math.min(endDate.getTime(), base + jitter)));
  return ts.toISOString();
}

const START_DATE = new Date('2026-02-20T08:00:00Z');
const END_DATE = new Date('2026-02-25T18:00:00Z');

// --- Generate Sessions ---

interface SessionRecord {
  timestamp: string;
  agent: string;
  model: string;
  task: string;
  linear_issue: string;
  outcome: string;
  duration_min: number;
  files_changed: number;
  retries: number;
  lessons_added: string[];
  discoveries: string[];
}

function generateSessions(count: number): SessionRecord[] {
  const records: SessionRecord[] = [];
  for (let i = 0; i < count; i++) {
    const issue = rng.pick(LINEAR_ISSUES);
    const outcomeRoll = rng.next();
    const outcome = outcomeRoll < 0.7 ? 'success' : outcomeRoll < 0.9 ? 'partial' : 'failed';
    const retries = outcome === 'failed' ? rng.int(1, 3) : outcome === 'partial' ? rng.int(0, 2) : rng.int(0, 1);
    const lessonsAdded = retries > 0 && rng.next() > 0.6 ? [rng.pick(LESSON_IDS)] : [];
    const discoveries = rng.next() > 0.7 ? [rng.pick(TASK_DESCRIPTIONS)] : [];

    records.push({
      timestamp: generateTimestamp(i, count, START_DATE, END_DATE),
      agent: rng.pick(AGENTS),
      model: rng.pick(MODELS),
      task: `${issue}: ${rng.pick(TASK_DESCRIPTIONS)}`,
      linear_issue: issue,
      outcome,
      duration_min: rng.int(5, 45),
      files_changed: rng.int(1, 15),
      retries,
      lessons_added: lessonsAdded,
      discoveries,
    });
  }
  return records.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
}

// --- Generate Delegations ---

interface DelegationRecord {
  timestamp: string;
  session_id: string;
  agent: string;
  model: string;
  tier: string;
  mechanism: string;
  linear_issue: string;
  outcome: string;
  retries: number;
  phase: number;
  file_partition: string[];
}

function generateDelegations(count: number): DelegationRecord[] {
  const records: DelegationRecord[] = [];
  for (let i = 0; i < count; i++) {
    const issue = rng.pick(LINEAR_ISSUES);
    const outcomeRoll = rng.next();
    const outcome = outcomeRoll < 0.75 ? 'success' : outcomeRoll < 0.9 ? 'partial' : 'failed';

    records.push({
      timestamp: generateTimestamp(i, count, START_DATE, END_DATE),
      session_id: `feat/${issue.toLowerCase()}`,
      agent: rng.pick(AGENTS),
      model: rng.pick(MODELS),
      tier: rng.weighted(TIERS),
      mechanism: rng.next() < 0.6 ? 'sub-agent' : 'background',
      linear_issue: issue,
      outcome,
      retries: outcome === 'failed' ? rng.int(1, 2) : rng.int(0, 1),
      phase: rng.int(1, 4),
      file_partition: rng.pick(FILE_PARTITIONS),
    });
  }
  return records.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
}

// --- Generate Panels ---

interface PanelRecord {
  timestamp: string;
  panel_key: string;
  verdict: string;
  pass_count: number;
  block_count: number;
  must_fix: number;
  should_fix: number;
  reviewer_model: string;
  weighted: boolean;
  attempt: number;
  linear_issue: string;
  artifacts_count: number;
  report_path: string;
}

function generatePanels(count: number): PanelRecord[] {
  const records: PanelRecord[] = [];
  for (let i = 0; i < count; i++) {
    const panelKey = PANEL_KEYS[i % PANEL_KEYS.length];
    const isPass = rng.next() < 0.75;
    const passCount = isPass ? rng.int(2, 3) : rng.int(0, 1);
    const blockCount = 3 - passCount;
    const issue = rng.pick(LINEAR_ISSUES);

    records.push({
      timestamp: generateTimestamp(i, count, START_DATE, END_DATE),
      panel_key: panelKey,
      verdict: isPass ? 'pass' : 'block',
      pass_count: passCount,
      block_count: blockCount,
      must_fix: isPass ? 0 : rng.int(1, 5),
      should_fix: rng.int(0, 8),
      reviewer_model: rng.pick(MODELS),
      weighted: rng.next() > 0.7,
      attempt: isPass ? 1 : rng.int(1, 3),
      linear_issue: issue,
      artifacts_count: rng.int(3, 20),
      report_path: `docs/ai-agents/panel/${panelKey}.md`,
    });
  }
  return records.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
}

// --- Main ---

function main() {
  mkdirSync(LOGS_DIR, { recursive: true });

  // Read existing panel records to preserve them
  const panelsPath = join(LOGS_DIR, 'panels.ndjson');
  let existingPanels: string[] = [];
  try {
    const content = readFileSync(panelsPath, 'utf-8').trim();
    if (content) {
      existingPanels = content.split('\n').filter(Boolean);
    }
  } catch {
    // File doesn't exist yet
  }

  // Generate data
  const sessions = generateSessions(50);
  const delegations = generateDelegations(35);
  const panels = generatePanels(12);

  // Write sessions
  const sessionsPath = join(LOGS_DIR, 'sessions.ndjson');
  writeFileSync(sessionsPath, sessions.map((r) => JSON.stringify(r)).join('\n') + '\n');
  console.log(`Wrote ${sessions.length} session records to ${sessionsPath}`);

  // Write delegations
  const delegationsPath = join(LOGS_DIR, 'delegations.ndjson');
  writeFileSync(delegationsPath, delegations.map((r) => JSON.stringify(r)).join('\n') + '\n');
  console.log(`Wrote ${delegations.length} delegation records to ${delegationsPath}`);

  // Write panels (preserve existing + add new, sorted by timestamp)
  const allPanelLines = [
    ...existingPanels,
    ...panels.map((r) => JSON.stringify(r)),
  ];
  // Parse and sort all panel records by timestamp
  const allPanelRecords = allPanelLines
    .map((line) => JSON.parse(line))
    .sort((a: { timestamp: string }, b: { timestamp: string }) => a.timestamp.localeCompare(b.timestamp));
  writeFileSync(panelsPath, allPanelRecords.map((r: unknown) => JSON.stringify(r)).join('\n') + '\n');
  console.log(`Wrote ${allPanelRecords.length} panel records to ${panelsPath} (${existingPanels.length} existing + ${panels.length} new)`);

  // Summary
  console.log('\n--- Seed Data Summary ---');
  console.log(`Sessions:    ${sessions.length}`);
  console.log(`Delegations: ${delegations.length}`);
  console.log(`Panels:      ${allPanelRecords.length} (${existingPanels.length} existing + ${panels.length} generated)`);

  // Outcome distribution
  const sessionOutcomes = sessions.reduce<Record<string, number>>((acc, s) => {
    acc[s.outcome] = (acc[s.outcome] || 0) + 1;
    return acc;
  }, {});
  console.log(`\nSession outcomes: ${JSON.stringify(sessionOutcomes)}`);

  const tierDist = delegations.reduce<Record<string, number>>((acc, d) => {
    acc[d.tier] = (acc[d.tier] || 0) + 1;
    return acc;
  }, {});
  console.log(`Delegation tiers: ${JSON.stringify(tierDist)}`);

  const panelVerdicts = allPanelRecords.reduce((acc: Record<string, number>, p: { verdict: string }) => {
    acc[p.verdict] = (acc[p.verdict] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  console.log(`Panel verdicts: ${JSON.stringify(panelVerdicts)}`);
}

main();
