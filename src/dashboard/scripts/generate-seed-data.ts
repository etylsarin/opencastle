#!/usr/bin/env tsx
/**
 * Generate realistic seed data for the Agent Dashboard.
 *
 * Writes a single NDJSON file to the configured logs directory:
 *   - events.ndjson  (50 session + 35 delegation + 12 panel records, sorted by timestamp)
 *
 * Usage: npx tsx opencastle/src/dashboard/scripts/generate-seed-data.ts
 */

import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

const REPO_ROOT = join(__dirname, '..', '..', '..', '..');
const LOGS_DIR = join(REPO_ROOT, 'docs', 'ai-agents', 'logs');
const SEED_DATA_DIR = join(__dirname, '..', 'seed-data');

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

const TRACKER_ISSUES = Array.from({ length: 30 }, (_, i) => `TAS-${i + 30}`);

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

const ADAPTERS = ['copilot', 'claude-code', 'cursor'];

const CONVOY_NAMES = [
  'Phase 3 — Engine + Health',
  'Phase 4 — CLI Integration',
  'Phase 5 — Run System',
  'Phase 6 — Adapters',
  'Phase 7 — Dashboard',
];

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
  type: 'session';
  timestamp: string;
  agent: string;
  model: string;
  task: string;
  tracker_issue: string;
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
    const issue = rng.pick(TRACKER_ISSUES);
    const outcomeRoll = rng.next();
    const outcome = outcomeRoll < 0.7 ? 'success' : outcomeRoll < 0.9 ? 'partial' : 'failed';
    const retries = outcome === 'failed' ? rng.int(1, 3) : outcome === 'partial' ? rng.int(0, 2) : rng.int(0, 1);
    const lessonsAdded = retries > 0 && rng.next() > 0.6 ? [rng.pick(LESSON_IDS)] : [];
    const discoveries = rng.next() > 0.7 ? [rng.pick(TASK_DESCRIPTIONS)] : [];

    records.push({
      type: 'session',
      timestamp: generateTimestamp(i, count, START_DATE, END_DATE),
      agent: rng.pick(AGENTS),
      model: rng.pick(MODELS),
      task: `${issue}: ${rng.pick(TASK_DESCRIPTIONS)}`,
      tracker_issue: issue,
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
  type: 'delegation';
  timestamp: string;
  session_id: string;
  agent: string;
  model: string;
  tier: string;
  mechanism: string;
  tracker_issue: string;
  outcome: string;
  retries: number;
  phase: number;
  file_partition: string[];
}

function generateDelegations(count: number): DelegationRecord[] {
  const records: DelegationRecord[] = [];
  for (let i = 0; i < count; i++) {
    const issue = rng.pick(TRACKER_ISSUES);
    const outcomeRoll = rng.next();
    const outcome = outcomeRoll < 0.75 ? 'success' : outcomeRoll < 0.9 ? 'partial' : 'failed';

    records.push({
      type: 'delegation',
      timestamp: generateTimestamp(i, count, START_DATE, END_DATE),
      session_id: `feat/${issue.toLowerCase()}`,      agent: rng.pick(AGENTS),
      model: rng.pick(MODELS),
      tier: rng.weighted(TIERS),
      mechanism: rng.next() < 0.6 ? 'sub-agent' : 'background',
      tracker_issue: issue,
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
  type: 'panel';
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
  tracker_issue: string;
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
    const issue = rng.pick(TRACKER_ISSUES);

    records.push({
      type: 'panel',
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
      tracker_issue: issue,
      artifacts_count: rng.int(3, 20),
      report_path: `docs/ai-agents/panel/${panelKey}.md`,
    });
  }
  return records.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
}

// --- Generate Convoys ---

type ConvoyStatus = 'pending' | 'running' | 'done' | 'failed' | 'cancelled';
type TaskStatus = 'pending' | 'running' | 'done' | 'failed' | 'skipped' | 'timed-out';

interface ConvoyTaskRecord {
  id: string;
  phase: number;
  agent: string;
  adapter: string;
  status: TaskStatus;
  started_at?: string;
  finished_at?: string;
  retries: number;
}

interface ConvoyRecord {
  id: string;
  name: string;
  status: ConvoyStatus;
  branch: string;
  created_at: string;
  started_at?: string;
  finished_at?: string;
  summary: {
    total: number;
    done: number;
    failed: number;
    skipped: number;
    timedOut: number;
  };
  tasks: ConvoyTaskRecord[];
  events_count: number;
}

const CONVOY_CONFIGS: Array<{
  status: ConvoyStatus;
  taskCount: number;
  createdAt: string;
  startedAt: string;
  finishedAt?: string;
  failIdx?: number;
  runningFromIdx?: number;
  cancelledFromIdx?: number;
}> = [
  { status: 'done',      taskCount: 6, createdAt: '2026-02-20T08:00:00.000Z', startedAt: '2026-02-20T08:05:00.000Z', finishedAt: '2026-02-20T14:30:00.000Z' },
  { status: 'done',      taskCount: 5, failIdx: 1, createdAt: '2026-02-21T09:00:00.000Z', startedAt: '2026-02-21T09:10:00.000Z', finishedAt: '2026-02-21T17:45:00.000Z' },
  { status: 'done',      taskCount: 4, createdAt: '2026-02-22T10:00:00.000Z', startedAt: '2026-02-22T10:05:00.000Z', finishedAt: '2026-02-22T15:20:00.000Z' },
  { status: 'running',   taskCount: 5, runningFromIdx: 3, createdAt: '2026-02-24T09:00:00.000Z', startedAt: '2026-02-24T09:05:00.000Z' },
  { status: 'cancelled', taskCount: 8, cancelledFromIdx: 3, createdAt: '2026-02-25T11:00:00.000Z', startedAt: '2026-02-25T11:05:00.000Z', finishedAt: '2026-02-25T12:30:00.000Z' },
];

function generateConvoys(count: number): ConvoyRecord[] {
  const records: ConvoyRecord[] = [];
  const configs = CONVOY_CONFIGS.slice(0, count);

  for (let i = 0; i < configs.length; i++) {
    const config = configs[i];
    const name = CONVOY_NAMES[i];
    const convoyId = `convoy-${String(i + 1).padStart(3, '0')}`;

    const tasks: ConvoyTaskRecord[] = [];
    const phaseCount = Math.ceil(config.taskCount / 2);
    let cursor = new Date(config.startedAt).getTime();

    for (let t = 0; t < config.taskCount; t++) {
      const phase = Math.min(Math.floor(t / 2) + 1, phaseCount);
      let taskStatus: TaskStatus;

      if (config.failIdx === t) {
        taskStatus = 'failed';
      } else if (config.runningFromIdx !== undefined && t === config.runningFromIdx) {
        taskStatus = 'running';
      } else if (config.runningFromIdx !== undefined && t > config.runningFromIdx) {
        taskStatus = 'pending';
      } else if (config.cancelledFromIdx !== undefined && t >= config.cancelledFromIdx) {
        taskStatus = 'skipped';
      } else {
        taskStatus = 'done';
      }

      const durationMs = rng.int(45, 120) * 60 * 1000;
      const hasStart = taskStatus === 'done' || taskStatus === 'failed' || taskStatus === 'running';
      const hasEnd   = taskStatus === 'done' || taskStatus === 'failed';

      const task: ConvoyTaskRecord = {
        id: `task-${String(i + 1).padStart(3, '0')}-${t + 1}`,
        phase,
        agent: rng.pick(AGENTS),
        adapter: rng.pick(ADAPTERS),
        status: taskStatus,
        ...(hasStart ? { started_at: new Date(cursor).toISOString() } : {}),
        ...(hasEnd   ? { finished_at: new Date(cursor + durationMs).toISOString() } : {}),
        retries: taskStatus === 'failed' ? rng.int(1, 3) : (taskStatus === 'done' && rng.next() > 0.7 ? 1 : 0),
      };

      if (hasEnd) cursor += durationMs + rng.int(5, 20) * 60 * 1000;
      tasks.push(task);
    }

    const summary = {
      total:    tasks.length,
      done:     tasks.filter((t) => t.status === 'done').length,
      failed:   tasks.filter((t) => t.status === 'failed').length,
      skipped:  tasks.filter((t) => t.status === 'skipped' || t.status === 'pending').length,
      timedOut: tasks.filter((t) => t.status === 'timed-out').length,
    };

    const record: ConvoyRecord = {
      id: convoyId,
      name,
      status: config.status,
      branch: `convoy/${name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`,
      created_at: config.createdAt,
      started_at: config.startedAt,
      ...(config.finishedAt ? { finished_at: config.finishedAt } : {}),
      summary,
      tasks,
      events_count: rng.int(15, 50),
    };

    records.push(record);
  }

  return records;
}

// --- Main ---

function main() {
  mkdirSync(LOGS_DIR, { recursive: true });
  mkdirSync(SEED_DATA_DIR, { recursive: true });

  // Generate data
  const sessions = generateSessions(50);
  const delegations = generateDelegations(35);
  const panels = generatePanels(12);
  const convoys = generateConvoys(5);

  // Merge and sort all events by timestamp
  type AnyRecord = SessionRecord | DelegationRecord | PanelRecord;
  const allEvents: AnyRecord[] = [...sessions, ...delegations, ...panels]
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp));

  // Write single events.ndjson
  const eventsPath = join(LOGS_DIR, 'events.ndjson');
  writeFileSync(eventsPath, allEvents.map((r) => JSON.stringify(r)).join('\n') + '\n');
  console.log(`Wrote ${allEvents.length} event records to ${eventsPath}`);

  // Write convoys.ndjson to logs dir and seed-data dir
  const convoysLine = convoys.map((r) => JSON.stringify(r)).join('\n') + '\n';
  const convoysLogsPath = join(LOGS_DIR, 'convoys.ndjson');
  writeFileSync(convoysLogsPath, convoysLine);
  console.log(`Wrote ${convoys.length} convoy records to ${convoysLogsPath}`);

  const convoysSeedPath = join(SEED_DATA_DIR, 'convoys.ndjson');
  writeFileSync(convoysSeedPath, convoysLine);
  console.log(`Wrote ${convoys.length} convoy records to ${convoysSeedPath}`);

  // Summary
  console.log('\n--- Seed Data Summary ---');
  console.log(`Sessions:    ${sessions.length}`);
  console.log(`Delegations: ${delegations.length}`);
  console.log(`Panels:      ${panels.length}`);
  console.log(`Convoys:     ${convoys.length}`);
  console.log(`Total:       ${allEvents.length}`);

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

  const panelVerdicts = panels.reduce<Record<string, number>>((acc, p) => {
    acc[p.verdict] = (acc[p.verdict] || 0) + 1;
    return acc;
  }, {});
  console.log(`Panel verdicts: ${JSON.stringify(panelVerdicts)}`);
}

main();
