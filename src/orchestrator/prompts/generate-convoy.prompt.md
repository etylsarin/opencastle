---
description: 'Generate a .convoy.yml spec file for autonomous convoy execution based on a high-level goal.'
agent: 'Team Lead (OpenCastle)'
---

<!-- ⚠️ This file is managed by OpenCastle. Edits will be overwritten on update. Customize in the .opencastle/ directory instead. -->

# Generate Convoy Spec

You are the Team Lead. The user wants to run `opencastle run` to execute a batch of tasks autonomously via the convoy engine. Your job is to produce a valid `.convoy.yml` file they can feed to the CLI. Derive a short, descriptive, kebab-case filename from the user's goal (2–4 words max) and use it as the filename — for example `auth-refactor.convoy.yml` or `add-search.convoy.yml`. Always use the `.convoy.yml` extension. Store all generated convoy specs in the `.opencastle/convoys/` directory (create it if it doesn't exist).

## User Goal

{{goal}}

## Additional Context

{{context}}

---

## YAML Spec Schema Reference

The output file must conform to the following schema. Fields marked **(required)** cause validation errors if missing.

### Top-Level Fields

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `name` | string | **yes** | — | Human-readable name for the run |
| `version` | integer | **yes** | — | Spec schema version. `1` for convoy specs, `2` for pipeline chaining |
| `concurrency` | integer ≥ 1 or `"auto"` | no | `1` | Max tasks executing in parallel. `"auto"` enables swarm mode (dynamic scaling up to `defaults.max_swarm_concurrency`) |
| `on_failure` | `continue` \| `stop` | no | `continue` | Behaviour when a task fails |
| `adapter` | string | no | auto-detect | Default CLI adapter (`claude`, `copilot`, `cursor`, `opencode`). Omit to let the CLI auto-detect. |
| `branch` | string | no | — | Git feature branch name — created if missing |
| `defaults` | object | no | — | Worker defaults merged into each task (see Defaults below) |
| `gates` | array of strings | no | — | Shell commands run after all tasks complete; each must exit 0 |
| `gate_retries` | integer ≥ 0 | no | `0` | How many times to retry failing gates with an auto-fix task |
| `guard` | object | no | — | Post-convoy guard configuration (see Guard below) |
| `hooks` | array of Hook | no | — | Post-convoy lifecycle hooks (see Hooks below) |
| `watch` | object | no | — | Watch mode configuration for continuous re-runs (see Watch below) |
| `tasks` | list | **yes** | — | Non-empty list of task objects |
| `depends_on_convoy` | list of strings | no | — | (version 2 only) Other convoy spec names to run before this one |

### Defaults Object

All fields are optional. Values are merged into each task unless the task overrides them.

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `timeout` | duration | `30m` | Default task timeout (`<n><s\|m\|h>`) |
| `model` | string | — | AI model override for all tasks |
| `max_retries` | integer | `1` | Default max retry attempts |
| `agent` | string | `developer` | Default agent role |
| `adapter` | string | — | Default adapter override |
| `gates` | array of strings | — | Per-task gate commands run after adapter success |
| `review` | `auto` \| `fast` \| `panel` \| `none` | — | Review level for completed tasks |
| `reviewer_model` | string | — | Model used for reviews |
| `review_budget` | integer | — | Max review token budget |
| `on_review_budget_exceeded` | `skip` \| `downgrade` \| `stop` | — | Action when review budget exhausted |
| `max_concurrent_reviews` | integer | — | Parallel review limit |
| `review_heuristics` | object | — | Auto-routing rules (see Review Heuristics below) |
| `detect_drift` | boolean | — | Enable drift detection on streaming adapters |
| `on_dispute` | `continue` \| `stop` | — | Behavior on panel disputes |
| `on_exhausted` | `dlq` \| `skip` \| `stop` | — | Action when max_retries exhausted |
| `escalate_to` | string | — | Agent for DLQ escalation |
| `inject_lessons` | boolean | — | Auto-inject relevant lessons from LESSONS-LEARNED.md into prompts |
| `track_discovered_issues` | boolean | — | Enable discovered issues tracking in prompts |
| `avoid_weak_agents` | boolean | — | Skip assigning agents to tasks matching their weak areas |
| `max_swarm_concurrency` | integer (1–50) | `8` | Max parallel tasks in swarm mode (`concurrency: auto`) |
| `built_in_gates` | object | — | Built-in gate configuration (see Built-in Gates below) |
| `browser_test` | object | — | Default browser test gate config (see Browser Test below) |
| `circuit_breaker` | object | — | Circuit breaker config (see Circuit Breaker below) |
| `mcp_servers` | array of MCPServer | — | MCP servers available to tasks |
| `mcp_approve_all` | boolean | — | Auto-approve all MCP tool calls |
| `mcp_server_approval_timeout` | number | — | Timeout (seconds) for MCP approval prompts |

### Built-in Gates

Automated validation gates run after each task completes.

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `secret_scan` | boolean \| `"auto"` | — | Scan output for leaked secrets |
| `blast_radius` | boolean \| `"auto"` | — | Check number of files changed is reasonable |
| `dependency_audit` | boolean \| `"auto"` | — | Audit new dependencies |
| `regression_test` | boolean \| `"auto"` | — | Run regression tests |
| `browser_test` | boolean \| `"auto"` | — | Run browser-based tests |
| `gate_timeout` | number | — | Timeout (ms) for built-in gates |

### Browser Test Config

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `urls` | array of strings | **yes** | URLs to test |
| `check_console_errors` | boolean | no | Fail on console errors |
| `visual_diff_threshold` | number (0–1) | no | Visual regression threshold |
| `a11y` | boolean | no | Run accessibility audit |
| `severity_threshold` | `critical` \| `serious` \| `moderate` \| `minor` | no | Min a11y violation severity to fail |
| `baselines_dir` | string | no | Directory for visual regression baselines |

### Circuit Breaker

Protects against cascading agent failures.

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `threshold` | integer | `3` | Failures before circuit opens |
| `cooldown_ms` | integer | `300000` (5 min) | ms in Open state before Half-Open |
| `fallback_agent` | string | — | Agent to reassign tasks to when circuit opens |

### Review Heuristics

Routing rules for automatic review level assignment.

| Field | Type | Description |
|-------|------|-------------|
| `panel_paths` | array of strings | File path patterns that require panel review |
| `panel_agents` | array of strings | Agents whose output always gets panel review |
| `auto_pass_agents` | array of strings | Agents whose output can auto-pass |
| `auto_pass_max_lines` | integer | Max changed lines for auto-pass |
| `auto_pass_max_files` | integer | Max changed files for auto-pass |

### Guard Config

Post-convoy compliance guard.

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `enabled` | boolean | `true` | Enable/disable the guard |
| `agent` | string | — | Agent to run the guard (e.g. `session-guard`) |
| `checks` | array of strings | — | Checks to run (e.g. `observability`, `cleanup`, `cost-report`) |

### Hooks

Lifecycle hooks run at specific points during convoy execution.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `type` | `review` \| `guard` \| `agent` \| `command` \| `validate` | **yes** | Hook type |
| `name` | string | no | Human label |
| `prompt` | string | no | For `agent` hooks: prompt sent to the agent |
| `command` | string | no | For `command` hooks: shell command to run |
| `on` | `pre_task` \| `post_task` \| `post_convoy` | no | When to trigger |

### Watch Config

Enables continuous re-execution triggered by file changes, cron, or git push.

| Field | Type | Description |
|-------|------|-------------|
| `triggers` | array of WatchTrigger | Trigger definitions (see below) |
| `clear_scratchpad` | boolean | Clear scratchpad on watch start |
| `scratchpad_retention_days` | integer | Auto-clear scratchpad entries older than N days |

**WatchTrigger types:**

| Type | Fields | Description |
|------|--------|-------------|
| `file-change` | `glob`, `debounce_ms` (default: 500) | Re-run when matching files change |
| `cron` | `schedule` (5-field cron) | Re-run on cron schedule |
| `git-push` | `branch` | Re-run when new commits are pushed |

### Task Fields

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `id` | string | **yes** | — | Unique identifier (lowercase, kebab-case recommended) |
| `prompt` | string | **yes** | — | The instruction sent to the AI agent |
| `agent` | string | no | `developer` | Agent role hint (see Agent Roster below) |
| `description` | string | no | same as `id` | Short human label shown in progress output |
| `depends_on` | list of ids | no | `[]` | Task ids that must finish before this one starts |
| `files` | list of globs | no | `[]` | File scope the agent is allowed to modify |
| `timeout` | duration | no | `30m` | Max wall time (`<number><s\|m\|h>`, e.g. `10m`, `1h`) |
| `max_retries` | integer | no | from `defaults` or `1` | Max retry attempts for this task |
| `model` | string | no | — | AI model override for this task |
| `adapter` | string | no | — | Per-task adapter override |
| `gates` | list of strings | no | — | Per-task gate commands run after adapter success |
| `review` | `auto` \| `fast` \| `panel` \| `none` | no | from `defaults` | Review level for this task |
| `detect_drift` | boolean | no | — | Enable drift detection (streaming adapters only) |
| `persistent` | boolean | no | — | Enable persistent agent identity across convoy runs |
| `steps` | list of TaskStep | no | — | Multi-step sub-prompts (see Steps below) |
| `hooks` | list of Hook | no | — | Per-task lifecycle hooks |
| `outputs` | list of TaskOutput | no | — | Named artifacts this task produces |
| `inputs` | list of TaskInput | no | — | Named artifacts this task consumes from upstream tasks |
| `browser_test` | object | no | — | Per-task browser test config (same schema as defaults) |
| `built_in_gates` | object | no | — | Per-task built-in gates override |

### Task Steps

Break a task into sequential sub-prompts. Each step runs in the same session (if the adapter supports session continuity).

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | no | Step identifier for conditional references |
| `prompt` | string | **yes** | Instruction for this step |
| `gates` | list of strings | no | Gate commands to run after this step |
| `max_retries` | integer | no | Retry override for this step |
| `if` | StepCondition | no | Conditional execution (see below) |

**StepCondition:** `{ step: "<step-id>", exitCode: { eq?: n, ne?: n, gt?: n, lt?: n }, fileExists: { path: "<path>" } }`

### Task Outputs & Inputs (Artifact Passing)

Tasks can produce named artifacts and consume artifacts from upstream tasks.

**TaskOutput:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | **yes** | Artifact name |
| `type` | `file` \| `summary` \| `json` | **yes** | Artifact type |
| `description` | string | no | Human description |

**TaskInput:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `from` | string | **yes** | Source task id |
| `name` | string | **yes** | Artifact name from the source task |
| `as` | string | no | Rename the artifact in the consuming task |

### MCP Server Config

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | **yes** | Server identifier |
| `type` | string | **yes** | Server type (e.g. `stdio`, `http`) |
| `local` | boolean | no | Whether the server runs locally |
| `command` | string | no | Command to start the server |
| `args` | list of strings | no | Arguments for the command |
| `url` | string | no | URL for HTTP-based servers |
| `config` | object | no | Additional server configuration |

### Agent Roster

Available values for the `agent` field:

`api-designer` · `architect` · `content-engineer` · `copywriter` · `data-expert` · `database-engineer` · `developer` · `devops-expert` · `documentation-writer` · `performance-expert` · `release-manager` · `researcher` · `security-expert` · `seo-specialist` · `team-lead` · `testing-expert` · `ui-ux-expert`

### Adapter Options

| Adapter | CLI binary | Notes |
|---------|-----------|-------|
| `claude` | `claude` | JSON output, max-turns flag. |
| `copilot` | `copilot` | Uses the Copilot SDK for structured JSON-RPC sessions. |
| `cursor` | `agent` | Uses `--force` for unattended file writes. |
| `opencode` | `opencode` | OpenCode CLI agent. |

> **Auto-detection order:** `copilot` → `claude` → `cursor` → `opencode`. Omit the `adapter` field to auto-detect.

---

## Workflow

### 1. Analyse the Goal

- Read the user's goal carefully. Identify the **deliverables** — what must exist or change after the run completes.
- If context references a codebase, search it to understand current state, file layout, and conventions.
- List the high-level workstreams (e.g., "database changes", "UI components", "tests", "docs").

### 2. Decompose into Tasks

For each workstream, break it down into the smallest meaningful unit of work that can be expressed as a single AI prompt. Follow these rules:

1. **Single responsibility** — each task does exactly one thing.
2. **Self-contained prompt** — the `prompt` field must contain everything the agent needs: objective, file paths, constraints, acceptance criteria. The agent has no other context.
3. **Explicit file scopes** — list every directory or file the task may touch in `files`. This prevents conflicts between parallel tasks.
4. **Appropriate agent** — pick the agent whose speciality matches the task (e.g., `testing-expert` for tests, `database-engineer` for migrations).
5. **Realistic timeouts** — default 30 m is fine for most tasks; use `1h` for large refactors or test suites; use `10m` for small docs or config changes.

### 3. Define the Dependency Graph (DAG)

- Tasks with no dependencies go first (they run in parallel up to `concurrency`).
- Tasks that consume output of earlier tasks declare `depends_on` with the prerequisite ids.
- For data flow between tasks, use `outputs` and `inputs` to pass named artifacts.
- **Never create cycles** — if A depends on B, B must not depend on A (directly or transitively).
- Draw the implicit phase structure:
  ```
  Phase 1: [independent tasks]
  Phase 2: [tasks depending only on Phase 1]
  Phase 3: [tasks depending on Phase 2]
  ...
  ```

### 4. Set Global Options

- `concurrency` — set to 2–3 for overnight runs; keep at 1 if tasks share files or the machine is constrained. Use `"auto"` for swarm mode which dynamically scales concurrency.
- `on_failure` — use `continue` (default) when tasks are independent so one failure doesn't waste the whole run. Use `stop` when every subsequent task depends on success.
- `adapter` — **omit this field** to let the CLI auto-detect the first available adapter. Only set explicitly if the user requests a specific adapter.
- `branch` — derive from the goal, e.g., `feat/auth-refactor`. Use a descriptive branch name.
- `defaults` — set sensible defaults for timeout, max_retries, and review. Enable `inject_lessons: true` for self-improving runs, `track_discovered_issues: true` for issue discovery, and `avoid_weak_agents: true` to route around known weaknesses. Model can be left unset for auto-detection.
- `gates` — include standard validation gates (lint, type-check, test) unless the user specifies otherwise.
- `gate_retries` — set to 1–2 if you want the engine to auto-fix gate failures by spawning a fix-up task.
- `guard` — enable for post-convoy compliance checks (observability, cleanup, cost reporting).
- For security-sensitive or database migration tasks, use `review: panel` or set `review_heuristics.panel_paths` to target critical paths.
- For long-running or unreliable tasks, configure `circuit_breaker` with a `fallback_agent`.

### 5. Write the Prompts

Each task `prompt` must be a **complete, standalone instruction**. Include:

- **What** to build / change / fix.
- **Where** — exact file paths or directories.
- **Why** — business context so the agent can make good decisions.
- **Constraints** — coding standards, conventions, do-not-touch files.
- **Acceptance criteria** — bullet list of pass conditions.
- **Verification command** — e.g., `Run the project's test command with coverage` so the agent self-checks.

For complex tasks, consider using `steps` to break the prompt into sequential sub-prompts with individual gates at each step.

> **Weak prompt:** "Add tests for the auth module."
>
> **Strong prompt:** "Write unit tests for `libs/auth/src/server.ts` covering token refresh, expiry edge cases, and invalid signatures. Place tests in `libs/auth/src/__tests__/server.test.ts`. Follow the existing test conventions. Achieve ≥ 95 % coverage for `server.ts`. Run the project's test command with coverage and fix any failures."

### 6. Validate Before Outputting

Before presenting the YAML, mentally verify:
- [ ] Every task has a unique `id`
- [ ] Every `depends_on` reference points to a valid `id` defined earlier in the list
- [ ] No dependency cycles exist
- [ ] No two parallel tasks share the same `files` entries (partition check)
- [ ] Prompts are self-contained — an agent with zero context can execute them
- [ ] Timeouts are reasonable for the scope of each task
- [ ] `outputs`/`inputs` references are consistent (consuming task depends on producing task)

### 7. Output

Return the final YAML inside a fenced code block with a filename annotation:

````yaml
# .opencastle/convoys/<feature-name>.convoy.yml
name: <run name>
version: 1
concurrency: <n>
on_failure: <continue|stop>
branch: <branch-name>

defaults:
  timeout: 30m
  max_retries: 1
  review: fast
  inject_lessons: true
  track_discovered_issues: true

tasks:
  - id: <task-id>
    agent: <agent>
    description: <short label>
    timeout: <duration>
    files:
      - <glob>
    prompt: |
      <full self-contained instruction>

  - id: <next-task-id>
    depends_on:
      - <task-id>
    agent: <agent>
    files:
      - <glob>
    prompt: |
      <full self-contained instruction>

gates:
  - <lint command>
  - <type-check command>
  - <test command>

gate_retries: 1
````

Also provide:
1. A **DAG summary** showing the phase structure so the user can verify execution order.
2. An **estimated total duration** (sum of timeouts on the critical path).
3. A `--dry-run` command they can use to validate: `npx opencastle run -f .opencastle/convoys/<feature-name>.convoy.yml --dry-run`


