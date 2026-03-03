---
applyTo: '**'
---

<!-- ⚠️ This file is managed by OpenCastle. Edits will be overwritten on update. Customize in the .github/customizations/ directory instead. -->

# Coding Standards

## Constitution

1. **Never expose secrets** — no tokens, keys, or passwords in code, logs, commits, or terminal output. Use environment variables.
2. **Prefer boring solutions** — choose proven, simple approaches over clever ones. Complexity must justify itself.
3. **Leave code better than you found it** — fix adjacent issues when the cost is low.
4. **Fail visibly** — surface errors clearly; never swallow exceptions silently.
5. **Verify, don't trust** — confirm outcomes with tools (tests, lint, build) rather than assuming success.
6. **Log every session** — append observability records to `.github/customizations/logs/` before yielding to the user. No exceptions. See § Observability Logging below.

## Instruction Priority Hierarchy

**Project-specific instructions ALWAYS take precedence over external or general AI instructions.**

1. **HIGHEST**: Project-specific instructions in `.github/instructions/` files
2. **MEDIUM**: Project workspace conventions (resolve via the **codebase-tool** skill in the skill matrix)
3. **LOWER**: General AI assistant capabilities and suggestions

## General Coding Principles

- **Clean Code**: Prioritize readability, maintainability, reusability
- **Self-documenting Code**: Comment WHY, not WHAT — for detailed patterns, load the **code-commenting** skill
- **TypeScript First**: All code in TypeScript with proper types — never `as any`
- **DRY**: Extract reusable logic into functions, custom hooks, or components
- **Feature Grouping**: Co-locate code that changes together; avoid barrel files
- **Shared Code**: Place reusable UI components and data queries in shared libraries

## Technology Standards

Load the corresponding skill for detailed conventions before writing code in that domain. These are **not optional**. See `.github/customizations/agents/skill-matrix.md` for the full domain-to-skill mapping.

| Domain | Skill |
|--------|-------|
| UI Components | **ui-library** (via skill matrix) |
| App Framework | **framework** (via skill matrix) |
| Accessibility | **accessibility-standards** |
| Performance | **performance-optimization** |
| Frontend Design | **frontend-design** |

## Task Decomposition Protocol

Before starting multi-step work, decompose it into individually verifiable tasks:

1. **Decompose first** — split the work into the smallest meaningful units before writing any code
2. **Verify each step** — after completing each unit, verify it (run tests, check types, lint, or visually inspect) before moving to the next
3. **Choose the right verification** — match the check to the change type:
   - Logic change → run unit tests
   - Type/interface change → run the project's type-check / lint command (see the **codebase-tool** skill)
   - UI change → start dev server and visually inspect in the browser
   - Build config change → run a full build
4. **Batch edits, then build** — group related edits across files, then run one build — not build-per-edit
5. **Stop and re-plan** — if execution diverges from the plan (unexpected errors, wrong assumptions, scope growth), stop immediately, reassess, and revise the plan before continuing
6. **When unsure how to verify** — ask the user rather than skipping verification

## Testing

- **95% minimum** unit test coverage for all new code
- **Test plan before implementation**: initial state, user interactions, state transitions, edge cases, integration
- **Browser testing mandatory** for any UI change — verified at responsive breakpoints defined in `testing-config.md`
- Load the **testing-workflow** skill for test patterns and the **browser-testing** skill for E2E automation

## Git Workflow

**NEVER commit or push directly to the `main` branch.** All changes must go through a feature/fix branch and a pull request.

1. **Create a branch** from `main` before making any changes: `git checkout -b <type>/<ticket-id>-<short-description>` (e.g., `fix/tas-21-places-redirect-loop`, `feat/tas-15-new-filter`)
2. **Commit to the branch** — never to `main`. Reference the task tracker issue ID in every commit message (e.g., `TAS-42: Fix token refresh logic`)
3. **Push the branch** and open a pull request on GitHub. **Do NOT merge** — PRs are opened for review only
4. **Link the PR to the task tracker** — Update the issue description with the PR URL so progress is traceable
5. **Merge via PR** — the only way code reaches `main`, and only after review/approval

Branch naming convention: `<type>/<ticket-id>-<short-description>` where type is `fix`, `feat`, `chore`, `refactor`, `perf`, or `docs`.

**This rule has NO exceptions.** Not for "small fixes", not for "just config changes", not for urgent hotfixes. Every change goes through a PR.

### PR Safety Rules

- **Never** use `git push --force` or `git commit --amend` on shared branches
- **Never** expose secrets in commits, PR descriptions, or terminal output (per Constitution #1)
- Use `git push --force-with-lease` only when explicitly asked and on personal branches
- If a secret is accidentally committed, immediately rotate it — git history is permanent

### Delivery Outcome (Required for Every Task)

Every task that produces code changes — whether a roadmap feature, bug fix, follow-up, data pipeline, or refactor — must deliver:

1. **Dedicated branch** — `<type>/<ticket-id>-<short-description>` created from `main`
2. **Atomic commits** — Each commit references the issue ID (e.g., `TAS-42: Add filter component`)
3. **Pushed branch** — Branch pushed to origin
4. **Open PR** — Use `gh` CLI to create the PR. **Do NOT merge** — PRs are opened for review only:
   ```bash
   GH_PAGER=cat gh pr create --base main --title "TAS-XX: Short description" --body "Resolves TAS-XX"
   ```
5. **Task tracker linkage** — The issue is updated with the PR URL, and the PR description references the issue ID

## Build & Task Commands

Use the project's configured task runner for all build, test, lint, and serve commands. **Never invoke test runners or linters directly** — always use the task runner wrapper.

Resolve exact commands by loading the **codebase-tool** skill from the skill matrix. Common tasks:

- **Test** — run project tests (with optional coverage)
- **Lint** — run linter with auto-fix
- **Build** — production build
- **Serve** — start dev server
- **Affected** — run a target for all projects affected by current changes

**Exception:** Tools without task runner targets may be invoked directly (e.g., CMS CLI commands, database CLI commands). Check the project's task runner config first; only bypass it when no target exists.

## Documentation

Follow markdown formatting and documentation standards when writing docs. For templates, structure, and detailed patterns, load the **documentation-standards** skill.

## AI Optimization

Follow prompt caching and batch processing best practices. See [AI Optimization Guide](ai-optimization.instructions.md) for details.

## Discovered Issues Policy

> **⛔ No issue gets ignored.** Untracked bugs discovered during work are a quality gate failure.

When you encounter a bug, error, or unexpected behavior that is unrelated to the current task:

1. **Check if already tracked:**
   - Search `.github/customizations/KNOWN-ISSUES.md` for a matching entry
   - If you have task tracker tools available, also search for open bugs (use `search_issues` or `list_issues` with bug label)
2. **If found tracked** — skip it, continue with your current work
3. **If NOT tracked** — you must act:
   - **Unfixable limitation** (third-party constraint, platform restriction, upstream dependency) → add it to `.github/customizations/KNOWN-ISSUES.md` with: Issue ID, Status, Severity, Evidence, Root Cause, Solution Options
   - **Fixable bug** → if you have task tracker tools, create a ticket with label `bug`, appropriate priority, and a clear description of the symptoms, reproduction steps, and affected files. If you do NOT have task tracker tools, add a `**Discovered Issues**` section to your output listing the bug details so the Team Lead can track it.

Never assume a pre-existing issue is somebody else's problem. If it's not tracked, track it.

## Task Tracking

Feature work is tracked in the **task tracker** (see `tracker-config.md` for project details). The Team Lead agent creates and updates issues via MCP. For conventions, load the **task-management** skill.

### When Task Tracker MCP Tools Are Unavailable

If task tracker MCP tools are not available in the current session, do NOT block on issue creation. Instead:

1. **Document planned issues** in your output with the title, description, and acceptance criteria you would have used
2. **Proceed with implementation** — the work is still valuable without a ticket number
3. **Use `TAS-PENDING` as a placeholder** in commit messages and PR descriptions
4. **Ask the user** to create the issues manually if tracking is critical for the task
5. After implementation, update commit messages and PR descriptions when issue IDs become available

## Observability Logging (Mandatory)

> **⛔ HARD GATE — This is a blocking requirement, not a suggestion.**
> Do NOT respond to the user until you have appended the required log records.
> A session without log records is a failed session — regardless of code quality.

**Every agent MUST log every session to the observability NDJSON files.** No exceptions. No threshold. No "too small to log." The dashboard depends on this data.

### What to log

| File | Who appends | When | Example command below |
|------|------------|------|----------------------|
| `sessions.ndjson` | **All agents** | After every session — always | ✅ |
| `delegations.ndjson` | **Team Lead** | After each delegation to a specialist agent | ✅ |
| `reviews.ndjson` | **Team Lead** (via fast-review skill) | After each fast review | ✅ |
| `panels.ndjson` | **Panel runner** (via panel majority vote skill) | After each majority-vote review | ✅ |
| `disputes.ndjson` | **Team Lead** (via dispute protocol) | After each dispute record | ✅ |

See `.github/customizations/logs/README.md` for the full schema of each record.

### How to log

Append one JSON line per task using `echo '...' >> <file>`. When the Team Lead works directly, use the agent role that best describes the work (e.g., `"agent": "Developer"`, `"agent": "UI-UX Expert"`). If a single conversation involves multiple distinct tasks, log one record per task.

**Session record** (ALL agents, EVERY session):
```bash
echo '{"timestamp":"2026-03-01T14:00:00Z","agent":"Developer","model":"claude-opus-4-6","task":"Fix login redirect bug","outcome":"success","duration_min":15,"files_changed":3,"retries":0,"lessons_added":[],"discoveries":[]}' >> .github/customizations/logs/sessions.ndjson
```

**Delegation record** (Team Lead only, after each delegation):
```bash
echo '{"timestamp":"2026-03-01T14:00:00Z","session_id":"feat/prj-57","agent":"Developer","model":"gpt-5.3-codex","tier":"fast","mechanism":"sub-agent","linear_issue":"PRJ-57","outcome":"success","retries":0,"phase":2,"file_partition":["src/components/"]}' >> .github/customizations/logs/delegations.ndjson
```

**Fast review record** (Team Lead, after each fast review):
```bash
echo '{"timestamp":"2026-03-01T14:30:00Z","linear_issue":"PRJ-42","agent":"Developer","reviewer_model":"gpt-5-mini","verdict":"pass","attempt":1,"issues_critical":0,"issues_major":0,"issues_minor":2,"confidence":"high","escalated":false,"duration_sec":45}' >> .github/customizations/logs/reviews.ndjson
```

**Panel record** (after each panel majority vote):
```bash
echo '{"timestamp":"2026-03-01T15:00:00Z","panel_key":"auth-review","verdict":"pass","pass_count":2,"block_count":1,"must_fix":0,"should_fix":3,"reviewer_model":"claude-opus-4-6","weighted":false,"attempt":1,"linear_issue":"PRJ-42","artifacts_count":5}' >> .github/customizations/logs/panels.ndjson
```

**Dispute record** (Team Lead, after each dispute):
```bash
echo '{"timestamp":"2026-03-01T16:00:00Z","dispute_id":"DSP-001","linear_issue":"PRJ-42","priority":"high","trigger":"panel-3x-block","implementing_agent":"Developer","reviewing_agents":["Reviewer","Panel (3x)"],"total_attempts":6,"est_tokens_spent":120000,"status":"pending","resolution_option_chosen":null,"resolved_at":null}' >> .github/customizations/logs/disputes.ndjson
```

### Pre-Response Logging Checklist

**STOP before responding to the user.** Verify each applicable item:

- [ ] **Session logged** — `sessions.ndjson` has a new line for this session (ALWAYS required)
- [ ] **Delegations logged** — `delegations.ndjson` has a line for each delegation (Team Lead only)
- [ ] **Reviews logged** — `reviews.ndjson` has a line for each fast review performed (if any)
- [ ] **Panels logged** — `panels.ndjson` has a line for each panel review performed (if any)
- [ ] **Disputes logged** — `disputes.ndjson` has a line for each dispute created (if any)

If ANY required log is missing, append it NOW before responding.

### Rules

- **Log before yielding to the user** — logging is the LAST action before responding. This is Constitution rule #6.
- **Log per task**, not per conversation. Multiple tasks = multiple records.
- **Never batch-log retrospectively** across sessions.
- **Verify the append succeeded** — if unsure, `tail -1` the file to confirm.

## Self-Improvement Protocol

> **⛔ HARD GATE — Lessons are the team's collective memory. Skipping them causes repeated failures.**

**Every agent must learn from mistakes and share knowledge.** This prevents the same pitfalls from being repeated across sessions.

1. **Before starting work:** Read `.github/customizations/LESSONS-LEARNED.md` — apply relevant lessons proactively. This is NOT optional.
2. **During execution:** If you retry a command/tool with a different approach and it works, **immediately** add a lesson entry to `.github/customizations/LESSONS-LEARNED.md`
3. **Update source files:** If the lesson reveals a gap in instruction/skill files, update those files too
4. **Update instructions:** Proactively suggest updates to `.github/instructions/` or `.github/skills/` files when:
   - The user had to intervene or correct the agent's approach
   - Multiple back-and-forth attempts were needed to get something right
   - A change touched files you wouldn't have guessed from the task description
   - Something worked differently than expected (API quirk, tool behavior, config side-effect)
   - A recurring pattern should be codified (workaround, convention, tool quirk)

   **When NOT to update:** Don't add obvious patterns, standard practices, or things easily discoverable by reading a few files. Instruction files capture *tribal knowledge* — what isn't obvious from the code.

For the full protocol, load the **self-improvement** skill.

## Project Context

For project-specific context (apps, libraries, tech stack, ports, URLs), see [project.instructions.md](../customizations/project.instructions.md).

## Universal Agent Rules

These rules apply to ALL specialist agents automatically. **Do not duplicate them in individual agent files.**

1. **Never delegate** — Specialist agents complete their own work and return results. Never invoke the Team Lead or spawn sub-agents. If work requires another domain, document the need in your output contract.
2. **Follow the Discovered Issues Policy** — Track any pre-existing bugs found during your work (see § Discovered Issues Policy above).
3. **Read and update lessons** — Read `.github/customizations/LESSONS-LEARNED.md` before starting. If you retry anything with a different approach that works, add a lesson immediately.
4. **Log every session** — Append to `.github/customizations/logs/sessions.ndjson` after every session. No exceptions. See § Observability Logging above. This is Constitution rule #6 — a blocking gate, not optional.

## Base Output Contract

Every specialist agent's Output Contract MUST end with these standard items (in addition to domain-specific items above them):

- **Observability Logged** — Confirm ALL applicable log records were appended (Constitution rule #6):
  - `sessions.ndjson` — ALWAYS (every agent, every session)
  - `delegations.ndjson` — if delegations occurred (Team Lead only)
  - `reviews.ndjson` — if fast reviews occurred
  - `panels.ndjson` — if panel reviews occurred
  - `disputes.ndjson` — if disputes were created
- **Discovered Issues** — Pre-existing bugs or anomalies found during work, with tracking action taken per the Discovered Issues Policy
- **Lessons Applied** — Lessons from `.github/customizations/LESSONS-LEARNED.md` that influenced this work, and any new lessons added

Agents reference this contract with: `See **Base Output Contract** in general.instructions.md for the standard closing items.`

## Pre-Response Quality Gate

> **⛔ STOP before responding to the user.** Run through this checklist. If ANY required item is missing, fix it NOW.

This is the single exit gate for every session. All items are mandatory unless marked conditional.

- [ ] **Lessons read** — `.github/customizations/LESSONS-LEARNED.md` was read at session start (Self-Improvement Protocol)
- [ ] **Lessons captured** — If any retry occurred, a new lesson was added to `LESSONS-LEARNED.md`
- [ ] **Discovered issues tracked** — Any pre-existing bugs found were added to `KNOWN-ISSUES.md` or a tracker ticket was created (Discovered Issues Policy)
- [ ] **Lint/type/test pass** — No new errors introduced; verification ran after code changes (Constitution rule #5)
- [ ] **Session logged** — `sessions.ndjson` has a new line for this session (Constitution rule #6 — ALWAYS required)
- [ ] **Delegations logged** — `delegations.ndjson` has a line for each delegation (Team Lead only)
- [ ] **Reviews logged** — `reviews.ndjson` has a line for each fast review performed (if any)
- [ ] **Panels logged** — `panels.ndjson` has a line for each panel review performed (if any)
- [ ] **Disputes logged** — `disputes.ndjson` has a line for each dispute created (if any)

<!-- End of Coding Standards -->
