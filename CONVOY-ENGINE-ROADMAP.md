# Convoy Engine — Roadmap

> Gas Town-inspired deterministic orchestrator for OpenCastle.
> TypeScript, Copilot SDK-first, crash-safe, observable.

---

## Vision

Replace the current `opencastle run` command and Team Lead agent-driven orchestration with a **deterministic, crash-recoverable convoy engine** inspired by [Gas Town](https://github.com/steveyegge/gastown). The engine reads a YAML spec, spawns isolated worker sessions, tracks all state in SQLite, and drives tasks to completion — surviving crashes, context exhaustion, and agent failures without human intervention.

### Design Principles (from spec)

| # | Principle | Implementation |
|---|-----------|---------------|
| 1 | **Persistence First** | SQLite WAL-mode DB — every state transition is a transaction |
| 2 | **Observable** | All state queryable via SQL; NDJSON event log for dashboard |
| 3 | **Propulsion** | Workers start executing the moment they are assigned (GUPP) |
| 4 | **Isolation** | Git worktree per worker — no shared mutable state |
| 5 | **Self-Management** | Workers self-destruct on completion; engine cleans worktrees |
| 6 | **Simplicity** | Single YAML spec in, deterministic execution out |

### Gas Town Mapping

| Gas Town | OpenCastle Convoy Engine | Notes |
|----------|--------------------------|-------|
| Mayor | Team Lead agent / user | Creates the spec, launches the engine |
| Polecat | Worker session | Copilot SDK session, Claude subprocess, etc. |
| Hook | SQLite row + git worktree | Persistent slot for worker state |
| Convoy | Spec file (`convoy.yml`) | Group of tasks with dependency graph |
| Bead | Task entry in SQLite | Unit of work with status, output, timing |
| GUPP | Propulsion loop | Engine assigns → worker starts immediately |
| Deacon | Health monitor | Detects stuck/zombie workers, triggers handoff |
| Refinery | Merge queue | Serializes worktree merges back to feature branch |
| MEOW | Spec → Phases → Tasks | Molecular Expression of Work |

---

## Persistence Decision: SQLite

### Options Evaluated

| Option | Crash-safe | Queryable | Dependencies | Verdict |
|--------|-----------|-----------|-------------|---------|
| **Beads** (Dolt + Go CLI) | ✅ | ✅ SQL | ❌ Go + Dolt + bd CLI | Too heavyweight for embedded use |
| **SQLite** (Node.js 22+ native) | ✅ WAL | ✅ SQL | ✅ Zero (built-in `node:sqlite`) | **Selected** |
| **JSON files** | ❌ Corrupt on crash | ❌ Manual | ✅ Zero | Insufficient durability |
| **NDJSON** (append-only) | ✅ Append-safe | ❌ Grep only | ✅ Zero | Good for logs, not state |
| **YAML** | ❌ Not atomic | ❌ Manual | ✅ Zero | Good for spec, not state |

### Why SQLite

- **ACID transactions** — state survives `kill -9`, power loss, OOM
- **WAL mode** — concurrent readers + single writer, no locks for dashboard queries
- **Zero dependencies** — `node:sqlite` is stable in Node.js 22+ (already engine target)
- **Queryable** — dashboard can read convoy state directly with SQL
- **Single file** — `.opencastle/convoy.db`, easy to inspect, backup, gitignore
- **Schema migrations** — versioned `CREATE TABLE` with `user_version` pragma

### Schema (v1)

```sql
-- Convoy: one per spec execution
CREATE TABLE convoy (
  id          TEXT PRIMARY KEY,  -- ulid or timestamp-based
  name        TEXT NOT NULL,
  spec_hash   TEXT NOT NULL,     -- sha256 of spec YAML
  status      TEXT NOT NULL DEFAULT 'pending',  -- pending | running | done | failed
  branch      TEXT,              -- git feature branch
  created_at  TEXT NOT NULL,
  started_at  TEXT,
  finished_at TEXT,
  spec_yaml   TEXT NOT NULL      -- full spec stored for crash recovery
);

-- Task: one per task in the spec
CREATE TABLE task (
  id          TEXT PRIMARY KEY,  -- from spec task.id
  convoy_id   TEXT NOT NULL REFERENCES convoy(id),
  phase       INTEGER NOT NULL,  -- computed from topo sort
  prompt      TEXT NOT NULL,
  agent       TEXT NOT NULL DEFAULT 'developer',
  model       TEXT,              -- model override
  timeout_ms  INTEGER NOT NULL DEFAULT 1800000,
  status      TEXT NOT NULL DEFAULT 'pending',
    -- pending | assigned | running | done | failed | timed-out | skipped
  worker_id   TEXT,              -- FK to worker
  worktree    TEXT,              -- git worktree path
  output      TEXT,
  exit_code   INTEGER,
  started_at  TEXT,
  finished_at TEXT,
  retries     INTEGER NOT NULL DEFAULT 0,
  max_retries INTEGER NOT NULL DEFAULT 1,
  files       TEXT,              -- JSON array of file paths
  depends_on  TEXT               -- JSON array of task IDs
);

-- Worker: ephemeral agent session
CREATE TABLE worker (
  id          TEXT PRIMARY KEY,  -- ulid
  task_id     TEXT REFERENCES task(id),
  adapter     TEXT NOT NULL,     -- 'copilot' | 'claude-code' | 'cursor' | 'opencode'
  pid         INTEGER,           -- OS process ID (for subprocess adapters)
  session_id  TEXT,              -- Copilot SDK session ID
  status      TEXT NOT NULL DEFAULT 'spawned',
    -- spawned | running | done | failed | killed
  worktree    TEXT,              -- git worktree path
  created_at  TEXT NOT NULL,
  finished_at TEXT,
  last_heartbeat TEXT            -- for stuck detection
);

-- Event log (mirrors NDJSON but queryable)
CREATE TABLE event (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  convoy_id   TEXT REFERENCES convoy(id),
  task_id     TEXT,
  worker_id   TEXT,
  type        TEXT NOT NULL,     -- task_started | task_done | task_failed | worker_spawned | ...
  data        TEXT,              -- JSON payload
  created_at  TEXT NOT NULL
);
```

---

## Spec Format: `convoy.yml`

Enhanced YAML spec that replaces the current `opencastle.tasks.yml` format while keeping backward compatibility.

```yaml
# convoy.yml — Convoy Engine spec
name: "Feature X — Auth System"
version: 1                       # spec schema version

# Execution settings
concurrency: 3                   # max parallel workers per phase
on_failure: continue             # continue | stop
adapter: copilot                 # copilot | claude-code | cursor | opencode | auto
branch: feat/auth-system         # git branch (created if missing)

# Worker defaults (can be overridden per task)
defaults:
  timeout: 30m
  model: gpt-5
  max_retries: 1

# Tasks (dependency DAG — topologically sorted into phases at runtime)
tasks:
  - id: db-migration
    prompt: |
      Create a database migration for the auth_tokens table.
      Columns: id (uuid), user_id (uuid FK), token_hash (text), ...
    agent: database-engineer
    model: claude-sonnet-4-6
    timeout: 10m
    files: [db/migrations/]

  - id: token-service
    prompt: |
      Implement TokenService class with refresh logic.
      Read the migration from db/migrations/ for the schema.
    agent: developer
    depends_on: [db-migration]
    files: [src/auth/]

  - id: auth-component
    prompt: |
      Build the LoginForm React component with token refresh.
    agent: ui-expert
    depends_on: [token-service]
    files: [src/components/auth/]

  - id: auth-tests
    prompt: |
      Write E2E tests for the auth flow: login, token refresh, logout.
    agent: testing-expert
    depends_on: [auth-component]
    files: [tests/e2e/]

  - id: security-audit
    prompt: |
      Audit the auth implementation for OWASP Top 10 vulnerabilities.
    agent: security-expert
    model: claude-opus-4-6
    depends_on: [token-service]
    files: [src/auth/, db/migrations/]

# Validation gates (run after all tasks complete)
gates:
  - npm run lint
  - npm run type-check
  - npm run test
```

### Backward Compatibility

The engine will support both the new `convoy.yml` format and the existing `opencastle.tasks.yml` format. The parser detects `version: 1` for the new format and falls back to legacy parsing for files without it.

---

## Architecture

```
┌─────────────────────────────────────────────┐
│                User / Team Lead             │
│  (creates convoy.yml or uses chat prompt)   │
└──────────────────┬──────────────────────────┘
                   │
        opencastle run convoy.yml
                   │
┌──────────────────▼──────────────────────────┐
│              Convoy Engine                   │
│                                              │
│  ┌──────────┐  ┌──────────┐  ┌───────────┐  │
│  │  Parser  │→ │ Planner  │→ │ Scheduler │  │
│  │ (YAML)   │  │ (DAG +   │  │ (phases + │  │
│  │          │  │  phases)  │  │  workers)  │  │
│  └──────────┘  └──────────┘  └─────┬─────┘  │
│                                     │        │
│  ┌──────────────────────────────────▼─────┐  │
│  │           Worker Pool                   │  │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐   │  │
│  │  │Worker 1 │ │Worker 2 │ │Worker 3 │   │  │
│  │  │copilot  │ │copilot  │ │copilot  │   │  │
│  │  │worktree │ │worktree │ │worktree │   │  │
│  │  └─────────┘ └─────────┘ └─────────┘   │  │
│  └─────────────────────────────────────────┘  │
│                                              │
│  ┌──────────┐  ┌──────────┐  ┌───────────┐  │
│  │  SQLite  │  │  Health  │  │   Merge   │  │
│  │  State   │  │  Monitor │  │   Queue   │  │
│  │  Store   │  │ (Deacon) │  │ (Refinery)│  │
│  └──────────┘  └──────────┘  └───────────┘  │
│                                              │
│  ┌──────────────────────────────────────────┐│
│  │  NDJSON Event Emitter (→ dashboard)      ││
│  └──────────────────────────────────────────┘│
└──────────────────────────────────────────────┘
```

### Key Components

| Component | Responsibility |
|-----------|---------------|
| **Parser** | Validates YAML spec, checks DAG, resolves defaults |
| **Planner** | Topological sort → phases, file partition validation |
| **Scheduler** | Assigns tasks to workers respecting concurrency + deps |
| **Worker Pool** | Manages worker lifecycle (spawn, monitor, kill, cleanup) |
| **Adapter Layer** | Runtime abstraction (Copilot SDK, Claude CLI, Cursor CLI, etc.) |
| **State Store** | SQLite WAL — all transitions are transactions |
| **Health Monitor** | Heartbeat checks, stuck detection, timeout enforcement |
| **Merge Queue** | Serializes worktree → branch merges, handles conflicts |
| **Event Emitter** | Dual-writes to SQLite `event` table + NDJSON file |

### Copilot SDK Integration (Primary Runtime)

```typescript
// Single CopilotClient shared across all workers
const client = new CopilotClient();
await client.start();

// Each worker gets its own session
const session = await client.createSession({
  model: task.model ?? defaults.model,
  systemMessage: {
    content: buildSystemPrompt(task.agent, task.files),
  },
  hooks: {
    onSessionStart: async () => logEvent('worker_started', task.id),
    onSessionEnd: async () => logEvent('worker_finished', task.id),
    onErrorOccurred: async (input) => {
      logEvent('worker_error', task.id, input.error);
      return { errorHandling: 'abort' };
    },
  },
  infiniteSessions: { enabled: true },  // automatic context management
});

// Execute task
const result = await session.sendAndWait({
  prompt: task.prompt,
  attachments: task.files?.map(f => ({ type: 'file', path: f })),
});
```

### Git Worktree Isolation

```
feature-branch
├── .opencastle/convoy.db          # SQLite state
├── .opencastle/worktrees/
│   ├── worker-01abc/              # git worktree for task "db-migration"
│   │   ├── db/migrations/...
│   │   └── ...
│   ├── worker-02def/              # git worktree for task "auth-component"
│   │   ├── src/components/auth/...
│   │   └── ...
│   └── ...
└── src/...                        # main working tree (untouched during run)
```

Each worker operates in its own git worktree branched from the feature branch. On task completion, the merge queue rebases the worktree changes back onto the feature branch in dependency order.

---

## What Already Exists

The current `src/cli/run/` already provides substantial machinery we reuse directly:

| Existing Component | File(s) | Reuse Strategy |
|--------------------|---------|----------------|
| **Spec parser** | `run/schema.ts` | Extend — add `version`, `defaults`, `gates`, `branch` fields |
| **DAG validation** | `run/schema.ts` | Reuse as-is — cycle detection, dependency resolution |
| **Topological sort + phase builder** | `run/executor.ts` → `buildPhases()` | Extract into shared utility; reuse in convoy planner |
| **Phase-based executor** | `run/executor.ts` | Reuse concurrency batching + failure cascading logic |
| **Copilot SDK adapter** | `run/adapters/copilot.ts` | Reuse — shared `CopilotClient`, per-task sessions, streaming |
| **Claude Code adapter** | `run/adapters/claude-code.ts` | Reuse — subprocess spawn, output capture, kill |
| **Cursor adapter** | `run/adapters/cursor.ts` | Reuse — subprocess spawn |
| **Adapter interface** | `run/adapters/index.ts` | Extend — add worktree `cwd` support |
| **Timeout enforcement** | `run/executor.ts` | Reuse — `Promise.race` + adapter `kill()` |
| **Reporter / event logging** | `run/reporter.ts` | Extend — dual-write to SQLite + NDJSON |

**Key insight:** The convoy engine is primarily new **infrastructure around** the existing executor — not a rewrite of it. The genuinely new pieces are: SQLite state store, git worktree isolation, merge queue, health monitor, and crash recovery.

---

## Phased Roadmap

### Phase 0: Research & Design (this document)
**Status: ✅ Done**

- [x] Research Gas Town, Simple Gas Town, Copilot SDK, Beads
- [x] Evaluate persistence options → SQLite
- [x] Design spec format, SQLite schema, component architecture
- [x] Map Gas Town concepts to OpenCastle
- [x] Audit existing code — identify reusable components

---

### Phase 1: SQLite State Store + Enhanced Spec
**Status: ✅ Done** — PR [#43](https://github.com/etylsarin/opencastle/pull/43)

**Scope:** Persistence layer and spec extensions. No execution changes yet.

#### 1.1 SQLite State Store
- [x] Create `src/cli/convoy/store.ts` — typed wrapper around `node:sqlite`
- [x] WAL mode, `journal_mode=wal`, `synchronous=normal`
- [x] Schema creation with `user_version` pragma for migrations
- [x] CRUD operations for `convoy`, `task`, `worker`, `event` tables
- [x] Transaction helpers (`withTransaction(fn)`)
- [x] `initDb(path)` → creates `.opencastle/convoy.db` if missing
- [x] Query helpers: `getReadyTasks(convoyId)` (tasks with all deps done + status pending)

#### 1.2 Extend Existing Spec Parser
- [x] **Edit** `src/cli/run/schema.ts` — add `version: 1` detection
- [x] Add `defaults` block parsing (merge into tasks)
- [x] Add `gates` array and `branch` field
- [x] Add `max_retries` per task (default: 1)
- [x] Backward-compatible: files without `version` still parse as before

#### 1.3 Types
- [x] Create `src/cli/convoy/types.ts` — convoy-specific interfaces
- [x] `ConvoyRecord`, `TaskRecord`, `WorkerRecord`, `EventRecord` (DB row types)
- [x] Status enums: `ConvoyStatus`, `TaskStatus`, `WorkerStatus`

#### 1.4 Event Emitter
- [x] Create `src/cli/convoy/events.ts` — dual-write to SQLite `event` table + NDJSON
- [x] Reuse existing `reporter.ts` NDJSON format for dashboard compatibility
- [x] `emitEvent(type, data)` → inserts into both stores in a transaction

**Acceptance criteria:**
- ✅ SQLite store creates DB, inserts convoy+tasks, queries ready tasks
- ✅ Extended spec parser handles both legacy and `version: 1` specs
- ✅ Dual-write events land in both SQLite and NDJSON
- ✅ Unit tests ≥95% coverage for new code (100% on store.ts + events.ts)

**Delivered:** 5 new files in `src/cli/convoy/`, edits to `run/schema.ts` + `types.ts`. Node.js engine bumped to `>=22.5.0`. 327 tests (48 new), 0 failures.

---

### Phase 2: Git Worktree Isolation + Merge Queue
**Status: ✅ Done** — PR [#TBD](https://github.com/etylsarin/opencastle/pulls)

**Scope:** The biggest genuinely new capability — isolated workspaces per worker.

#### 2.1 Worktree Manager
- [x] Create `src/cli/convoy/worktree.ts`
- [x] `createWorktreeManager(basePath)` factory with `create`, `remove`, `list`, `removeAll`
- [x] Creates `.opencastle/worktrees/<worker-id>/` from feature branch
- [x] `remove(path)` — cleanup after merge, with path validation
- [x] `list()` — active convoy worktrees (filters out main worktree)
- [x] `removeAll()` — bulk cleanup for crash recovery
- [x] Input validation: worker ID regex, path traversal protection

#### 2.2 Merge Queue (Refinery)
- [x] Create `src/cli/convoy/merge.ts`
- [x] After task completion: stage worktree changes, create merge commit
- [x] Merge in dependency order (caller-controlled)
- [x] Conflict detection + abort cleanly (returns `conflicted: true`)
- [x] Path validation: rejects worktree paths outside managed directory

#### 2.3 Adapter `cwd` Support
- [x] **Edit** existing adapter interface — add optional `cwd` parameter to `ExecuteOptions`
- [x] Copilot SDK adapter: documented per-session cwd limitation (shared singleton client)
- [x] Subprocess adapters (Claude Code, Cursor): spawn with `cwd: options?.cwd ?? process.cwd()`

**Acceptance criteria:**
- ✅ Each worker operates in a unique git worktree
- ✅ Worktrees cleaned up after merge
- ✅ Merge order respects dependency graph (caller-controlled)
- ✅ No changes to main working tree during execution
- ✅ Existing adapter tests still pass (cwd is optional, defaults to `process.cwd()`)

**Delivered:** 2 new files in `src/cli/convoy/` (worktree.ts, merge.ts), edits to types.ts + 3 adapters. 357 tests (30 new), 0 failures.

---

### Phase 3: Convoy Engine + Crash Recovery
**Status: ✅ Done**

**Scope:** The orchestrator loop that ties SQLite + worktrees + existing executor together.

#### 3.1 Engine Loop
- [x] Create `src/cli/convoy/engine.ts` — main orchestrator
- [x] Reuse `buildPhases()` from existing executor (imported directly)
- [x] For each phase: use existing concurrency batching + timeout enforcement
- [x] Before each task: insert `worker` row in SQLite, create worktree
- [x] After each task: update SQLite status, merge worktree, emit events
- [x] On failure: reuse existing `on_failure` cascading logic

#### 3.2 Health Monitor (Deacon)
- [x] Create `src/cli/convoy/health.ts`
- [x] Periodic heartbeat check (interval from config, default 30s)
- [x] Stuck detection: worker with no heartbeat update for 2× timeout
- [x] Zombie detection: PID no longer running but worker status still `running`
- [x] On stuck: kill worker, mark task as `failed`, schedule retry if retries < max

#### 3.3 Crash Recovery
- [x] On engine start: check for `convoy.db` with `status = 'running'`
- [x] Resume: re-read spec from `convoy.spec_yaml`, re-plan remaining tasks
- [x] Clean up orphaned worktrees (worker status `running` but no PID)
- [x] Reset `assigned`/`running` tasks back to `pending` for re-execution

#### 3.4 Validation Gates
- [x] After all tasks complete: run `gates` commands sequentially
- [x] Each gate is a shell command that must exit 0
- [x] On gate failure: convoy status → `gate-failed`, log which gate failed
- [x] Gates run in the main working tree (after all merges)

**Acceptance criteria:**
- ✅ Full convoy execution: parse → plan → worktree → execute → merge → gates
- ✅ Engine recovers from crash via `resume()` and resumes where it left off
- ✅ Stuck workers detected and retried automatically via health monitor
- ✅ Orphaned worktrees cleaned up on recovery (`removeAll()`)
- ✅ Comprehensive test suite: 80 new tests (46 engine + 34 health), 437 total, 0 failures

**Delivered:** 4 new files in `src/cli/convoy/` (engine.ts, engine.test.ts, health.ts, health.test.ts). No edits to existing files. Coverage: engine.ts 97.54% stmts / health.ts 100% stmts.

---

### Phase 4: CLI Integration + Remove Loop Mode
**Status: ✅ Done** — PR [#46](https://github.com/etylsarin/opencastle/pull/46)

**Scope:** Wire the convoy engine into the CLI, remove loop mode for simplicity.

#### 4.1 CLI Command
- [x] **Edit** `src/cli/run.ts` — detect `version: 1` → convoy engine; else → legacy
- [x] `opencastle run convoy.yml` → convoy engine
- [x] `opencastle run opencastle.tasks.yml` → legacy executor (unchanged)
- [x] `opencastle run --resume` → resume last interrupted convoy from `.opencastle/convoy.db`
- [x] `opencastle run --status` → query SQLite, print convoy state summary
- [x] `opencastle run --dry-run` → parse + plan, print phases, don't execute (both paths)

#### 4.2 Remove Loop Mode
- [x] Delete `loop-executor.ts` and `loop-reporter.ts` entirely
- [x] Remove all loop-related types from `types.ts` (`LoopConfig`, `BackpressureResult`, `LoopIterationResult`, `LoopRunReport`, `LoopReporter`, `LoopExecutor`)
- [x] Remove `mode` and `loop` fields from `TaskSpec` and `RunOptions`
- [x] Remove loop validation from `schema.ts` (`validateSpec` and `applyDefaults`)
- [x] Remove loop tests from `schema.test.ts`

#### 4.3 Spec Parser Refactor
- [x] Extract `parseTaskSpecText(text: string)` from `parseTaskSpec(filePath)` for raw YAML reuse
- [x] `run.ts` reads file text, passes to both parser and convoy engine (for crash recovery storage)
- [x] Add `getLatestConvoy()` to convoy store for `--resume` and `--status`

**Acceptance criteria:**
- ✅ `opencastle run convoy.yml` (version: 1) → convoy engine end-to-end
- ✅ `opencastle run opencastle.tasks.yml` (no version) → legacy executor unchanged
- ✅ `--resume` recovers interrupted convoy from SQLite
- ✅ `--status` prints convoy state, branch, task breakdown
- ✅ `--dry-run` works for both convoy and legacy specs
- ✅ Loop mode completely removed — zero references in source
- ✅ 421 tests passing, 0 failures, zero type errors

**Delivered:** 7 files changed (+391 −889, net −498 lines). Rewrote `run.ts`, edited `types.ts` + `schema.ts` + `schema.test.ts` + `store.ts`, deleted `loop-executor.ts` + `loop-reporter.ts`.

---

### Phase 5: Team Lead Integration + VS Code Chat
**Status: ✅ Done**

**Scope:** Team Lead agent creates convoy specs and launches engine via CLI.

#### 5.1 Spec Generation
- [x] Updated `generate-task-spec` prompt to output `.convoy.yml` format with `version: 1`
- [x] Dynamic naming: `<goal-kebab>.convoy.yml` (e.g., `auth-refactor.convoy.yml`)
- [x] Added convoy-specific fields: `branch`, `defaults`, `gates`
- [x] Backward-compatible: `.tasks.yml` files without `version` still use legacy executor

#### 5.2 Team Lead Integration
- [x] Updated Team Lead handoff to reference `.convoy.yml` format
- [x] Team Lead generates spec → writes file → launches `opencastle run -f <name>.convoy.yml`
- [x] Single-task work: Team Lead delegates directly via sub-agent (no convoy overhead)
- [x] Multi-task work: Team Lead uses `generate-task-spec` prompt → convoy engine

#### 5.3 Convoy Chaining (Convention)
- [x] Each convoy spec has a unique, descriptive filename: `<goal>.convoy.yml`
- [x] Naming convention enables future convoy chaining by filename reference
- [x] No code changes needed — `run.ts` already routes `version: 1` to convoy engine

**Acceptance criteria:**
- ✅ `generate-task-spec` prompt outputs valid `.convoy.yml` specs with `version: 1`
- ✅ Team Lead handoff references `.convoy.yml` format
- ✅ Dynamic naming convention supports convoy chaining
- ✅ No code changes — all existing tests still pass

**Delivered:** 3 files updated (prompt, agent config, roadmap). Zero code changes — Phase 5 is pure prompt/config.

---

### Phase 6: Multi-Runtime + OpenCode Adapter
**Scope:** Add OpenCode adapter. Mixed-runtime convoys.

#### 6.1 OpenCode Adapter
- [ ] Create new adapter for OpenCode CLI (subprocess-based)
- [ ] Follows existing adapter interface — already supports Copilot SDK, Claude Code, Cursor

#### 6.2 Mixed-Runtime Convoys
- [ ] Per-task `adapter` override in spec
- [ ] `adapter: auto` per task → auto-detect available runtime
- [ ] Different workers can use different runtimes in the same convoy

**Acceptance criteria:**
- Convoy with mixed runtimes works
- Per-task adapter override works

---

### Phase 7: Dashboard + Observability
**Scope:** Real-time convoy monitoring in the existing dashboard.

#### 7.1 Convoy Dashboard Page
- [ ] Add convoy status page to `src/dashboard/`
- [ ] Read from SQLite `convoy.db` directly (read-only WAL connection)
- [ ] Show: convoy progress, phase breakdown, task statuses, worker health
- [ ] Auto-refresh via SSE or polling

#### 7.2 TUI Feed (optional)
- [ ] `opencastle feed` command for terminal-based monitoring
- [ ] Show phase progress, active workers, recent events
- [ ] Modeled after `gt feed` from Gas Town

---

## File Structure (Target)

New files live in `src/cli/convoy/`. Existing `src/cli/run/` code is reused — not duplicated.

```
src/cli/convoy/                    # NEW — convoy engine layer
├── engine.ts                      # Main orchestrator loop (entry point)
├── store.ts                       # SQLite state store (node:sqlite)
├── worktree.ts                    # Git worktree lifecycle
├── merge.ts                       # Merge queue (Refinery)
├── health.ts                      # Health monitor (Deacon)
├── events.ts                      # Event emitter (SQLite + NDJSON dual-write)
├── types.ts                       # Convoy-specific interfaces + DB row types
└── __tests__/
    ├── store.test.ts
    ├── worktree.test.ts
    └── engine.test.ts

src/cli/run/                       # EXISTING — extended, not replaced
├── schema.ts                      # EDIT — add version, defaults, gates, branch
├── executor.ts                    # REUSE — buildPhases(), concurrency, failure cascade
├── reporter.ts                    # REUSE — NDJSON event format
└── adapters/
    ├── index.ts                   # EDIT — add optional cwd param to execute()
    ├── copilot.ts                 # REUSE — shared CopilotClient, sessions
    ├── claude-code.ts             # REUSE — subprocess adapter
    └── cursor.ts                  # REUSE — subprocess adapter
```

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|-----------|
| `node:sqlite` stability | Node 22 marks it stable; Node 20 is experimental | Require Node 22+ engine in `package.json`. Already at `>=18` — bump needed |
| Copilot SDK breaking changes | v0.1.x, Technical Preview | Pin SDK version; abstract behind adapter interface |
| Git worktree conflicts | Parallel workers touch overlapping files | File partition validation in planner; fail-fast on conflict |
| Worker context exhaustion | Long tasks exceed context window | Copilot SDK `infiniteSessions` handles this automatically |
| SQLite concurrent access | Multiple readers + dashboard | WAL mode handles concurrent reads; single writer in engine |
| Large spec files | 50+ tasks → complex DAG | Phase limit warnings; concurrency tuning guidance |

---

## Open Questions

1. **Node.js version bump**: Current engine requirement is `>=18`. SQLite native requires `>=22.5.0`. Should we bump or provide a fallback (e.g., `better-sqlite3`)?

2. **Worktree strategy for Copilot SDK**: The SDK manages its own workspace concept. Do we use its `workspacePath` or force our worktree via `cwd`? Needs experimentation.

3. **Beads integration (future)**: Should we optionally integrate with `bd` CLI for projects already using Beads? Could map bead IDs to convoy task IDs.

4. **Cost tracking**: Copilot SDK charges per premium request. Should the engine track token usage per task and include in the run report?

5. **Convoy chaining**: Should a convoy spec support referencing another convoy spec as a dependency? (Multi-convoy pipelines for large features.)

---

## Priority Order

| Phase | Priority | Dependency | Scope |
|-------|----------|-----------|-------|
| Phase 1 | Critical | None | 3–4 new files + edits to `schema.ts` |
| Phase 2 | Critical | Phase 1 | 2–3 new files + small adapter edits |
| Phase 3 | High | Phase 2 | 2–3 new files (engine, health) |
| Phase 4 | High | Phase 3 | Edits to `run.ts` — CLI wiring |
| Phase 5 | Medium | Phase 4 | Agent config + prompts |
| Phase 6 | Medium | Phase 2 | 1 new adapter file |
| Phase 7 | Low | Phase 4 | Dashboard pages |

Phases 1–3 are the MVP. Phase 4 makes it the default. Phases 5–7 are integration and polish.

**Total new code estimate:** ~6–8 new files in `src/cli/convoy/`, edits to ~4 existing files in `src/cli/run/`. The spec parser, DAG planner, adapter layer, concurrency executor, and timeout/kill logic are already built.
