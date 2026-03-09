---
applyTo: '**'
---

<!-- ⚠️ This file is managed by OpenCastle. Edits will be overwritten on update. Customize in the .opencastle/ directory instead. -->

# Coding Standards

## Constitution

1. **Never expose secrets** — no tokens, keys, or passwords in code, logs, commits, or terminal output. Use environment variables.
2. **Prefer boring solutions** — choose proven, simple approaches over clever ones. Complexity must justify itself.
3. **Leave code better than you found it** — fix adjacent issues when the cost is low.
4. **Fail visibly** — surface errors clearly; never swallow exceptions silently.
5. **Verify, don't trust** — confirm outcomes with tools (tests, lint, build) rather than assuming success.
6. **Log every session** — append observability records to `.opencastle/logs/` before yielding to the user. No exceptions. Load the **observability-logging** skill for details.

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

Load the corresponding skill for detailed conventions before writing code in that domain. These are **not optional**. See `.opencastle/agents/skill-matrix.json` for the full domain-to-skill mapping.

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

See [ai-optimization.instructions.md](ai-optimization.instructions.md) for batch processing, tool efficiency, and anti-patterns.

## Project Context

For project-specific context (apps, libraries, tech stack, ports, URLs), see [project.instructions.md](../.opencastle/project.instructions.md).

## Git Workflow

**NEVER commit or push directly to the `main` branch.** All changes go through a feature/fix branch and a pull request. Load the **git-workflow** skill for branch naming, PR rules, and the Delivery Outcome checklist.

## Discovered Issues Policy

> **⛔ No issue gets ignored.** Untracked bugs discovered during work are a quality gate failure.

When you encounter a bug unrelated to the current task: check if already tracked in `KNOWN-ISSUES.md` or the task tracker. If NOT tracked, track it (known issue entry or bug ticket). Never assume a pre-existing issue is somebody else's problem. See the **git-workflow** skill for the full procedure.

## Observability Logging

> **⛔ HARD GATE — This is a blocking requirement, not a suggestion.**
> Do NOT respond to the user until you have appended the required log records.
> A session without log records is a failed session — regardless of code quality.

**Every agent MUST log every session** to `.opencastle/logs/events.ndjson`. No exceptions. No threshold. No "too small to log." Load the **observability-logging** skill for CLI commands, record schemas, and the full logging checklist.

## Self-Improvement Protocol

> **⛔ HARD GATE — Lessons are the team's collective memory. Skipping them causes repeated failures.**

1. **Before starting work:** Read `.opencastle/LESSONS-LEARNED.md` — apply relevant lessons proactively. This is NOT optional.
2. **During execution:** If you retry with a different approach and it works, use the **self-improvement** skill to add a lesson immediately.
3. **Update source files:** If the lesson reveals a gap in instruction/skill files, update those files too.

## Universal Agent Rules

These rules apply to ALL specialist agents automatically. **Do not duplicate them in individual agent files.**

1. **Never delegate** — Specialist agents complete their own work and return results. Never invoke the Team Lead or spawn sub-agents.
2. **Follow the Discovered Issues Policy** — Track any pre-existing bugs found during your work (see above).
3. **Read and update lessons** — See Self-Improvement Protocol above.
4. **Log every session** — See Observability Logging above. This is Constitution rule #6 — a blocking gate, not optional.

## Pre-Response Quality Gate

> **⛔ STOP before responding to the user.** Run through this checklist. If ANY required item is missing, fix it NOW.

- [ ] **Lessons read** — `LESSONS-LEARNED.md` was read at session start
- [ ] **Lessons captured** — If any retry occurred, a new lesson was added via the **self-improvement** skill
- [ ] **Discovered issues tracked** — Any pre-existing bugs found were tracked (Discovered Issues Policy)
- [ ] **Lint/type/test pass** — No new errors introduced; verification ran after code changes (Constitution rule #5)
- [ ] **Session logged** — `events.ndjson` has a new `session` record (Constitution rule #6 — ALWAYS required)
- [ ] **Delegations logged** — `events.ndjson` has a `delegation` record for each delegation (Team Lead only)
- [ ] **Reviews logged** — `events.ndjson` has a `review` record for each fast review (if any)
- [ ] **Panels logged** — `events.ndjson` has a `panel` record for each panel review (if any)
- [ ] **Agent expertise updated** — `AGENT-EXPERTISE.md` updated for each delegation (strong/weak areas + file familiarity) (Team Lead only)
- [ ] **Knowledge graph appended** — `KNOWLEDGE-GRAPH.md` has new rows for file relationships discovered (Team Lead only)

Load the **observability-logging** skill for CLI commands, Base Output Contract, and detailed schemas.

## Workflow & Governance Skills

These skills provide detailed procedures. Load when their phase is reached.

| Concern | Skill |
|---------|-------|
| Branch naming, PR rules, delivery outcome, task tracking | **git-workflow** |
| Log CLI commands, record schemas, output contracts | **observability-logging** |
| Lesson writing CLI, categories, quality standards | **self-improvement** |

<!-- End of Coding Standards -->
