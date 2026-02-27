---
name: task-management
description: "Linear board conventions for tracking feature work — issue naming, labels, priorities, status workflow, and session continuity. Use when decomposing features into tasks or resuming interrupted sessions."
---

# Task Management with Linear

Conventions for tracking feature work on the Linear board via MCP tools. For project-specific team ID, workflow state UUIDs, and label UUIDs, see [linear-config.md](../../customizations/project/linear-config.md).

## Discovered Issues (Bug Tickets)

When an agent encounters a pre-existing bug or issue unrelated to the current task, it must be tracked. Follow this flow:

1. **Check** known issues docs and Linear (search for open bugs) to see if it's already tracked
2. **If tracked** — skip it, continue with current work
3. **If NOT tracked:**
   - **Unfixable limitation** — add to known issues with Issue ID, Status, Severity, Evidence, Root Cause, Solution Options
   - **Fixable bug** — create a Linear ticket:
     - **Name:** `[Bug] Short description of the symptom`
     - **Label:** `bug` (plus the relevant domain label, e.g., `ui`, `nextjs`)
     - **Priority:** P2 if it affects users, P3 if cosmetic or non-blocking
     - **Description:** Include symptoms, reproduction steps, affected files, and any error messages or screenshots
     - **Status:** Backlog (unless it's blocking current work, then Todo)

## Issue Naming

Use `[Area] Short description` format:

```
[Schema] Add priceRange field to place type
[DB] Add price_range column and migration
[Query] Update GROQ query with priceRange filter
[UI] Build PriceRangeFilter component
[Page] Integrate price filter into /places
[Test] E2E test price range filtering
[Docs] Update data model documentation
```

**Area prefixes:** `[Schema]`, `[DB]`, `[Query]`, `[UI]`, `[Page]`, `[API]`, `[Auth]`, `[Test]`, `[Docs]`, `[Deploy]`, `[Data]`, `[Perf]`, `[Security]`

## Priority

| Level | Meaning | When to use |
|-------|---------|-------------|
| P1 (Urgent) | Blocker | Blocks other tasks, critical path |
| P2 (High) | Important | Core feature work, on critical path |
| P3 (Medium) | Normal | Supporting tasks, can be parallelized |
| P4 (Low) | Nice-to-have | Docs, cleanup, polish |

## Status Workflow

```
Backlog -> Todo -> In Progress -> In Review -> Done -> Cancelled
```

- **Backlog** — Captured but not yet planned
- **Todo** — Planned for current feature, ready to start
- **In Progress** — Actively being worked on by an agent
- **In Review** — PR opened, awaiting review/merge
- **Done** — Completed and verified
- **Cancelled** — Dropped or no longer relevant

### Status Drivers

Issue status is driven by **two sources** — the Team Lead agent (via MCP) and the GitHub integration (automatically). Both can move issues through the workflow.

**Agent-driven transitions (via MCP):**
- **Todo -> In Progress** — when the agent starts working on a task
- **In Progress -> Done** — when non-PR tasks are verified (e.g., docs, config changes)
- **Any -> Cancelled** — when a task is dropped

**GitHub-driven transitions (automatic):**

The Linear-GitHub integration auto-updates issue status based on PR lifecycle events. This is configured in Linear under *Settings -> Team -> Issue statuses & automations -> Pull request and commit automation*.

| PR Event | Linear Status Change |
|----------|---------------------|
| Branch pushed / PR drafted | -> **In Progress** |
| PR opened | -> **In Progress** |
| Review requested | -> **In Review** |
| PR ready for merge (all checks pass) | -> **In Review** |
| PR merged to `main` | -> **Done** |

**Linking issues to PRs:** Include the Linear issue ID (e.g., `TAS-123`) in the branch name or PR title. Linear auto-detects the link and begins status automation. Use the branch name format from Linear: copy with `Cmd+Shift+.` on any issue.

**Multiple PRs per issue:** When multiple PRs are linked to one issue, the status only advances to Done when the *last* linked PR is merged.

**Important:** When GitHub automation handles status transitions, the agent does not need to update status manually — avoid conflicting updates. Only use MCP to move status when there is no linked PR (e.g., documentation-only tasks, config changes, schema deploys).

## Issue Descriptions

Every issue must include:

```markdown
**Objective:** One sentence describing the deliverable

**Files (partition):**
- `path/to/relevant/file.ts`
- `path/to/another/file.ts`

**Acceptance Criteria:**
- [ ] Specific, verifiable outcome 1
- [ ] Specific, verifiable outcome 2

**Dependencies:** #TAS-XX (if any)
```

The **Files (partition)** section defines which files this agent is allowed to modify. This prevents merge conflicts when multiple agents work in parallel — no two issues in the same phase should list overlapping files.

## Feature Grouping

- Use a **Linear project** for each major feature
- Create projects via the Linear UI — no create_project API is available via MCP
- All related issues belong to that project
- Issues track individual subtasks within the feature

## Session Workflow

### Starting a new feature

1. Read the board to check for existing in-progress work
2. Decompose the feature into issues following the conventions above
3. Create all issues on Linear with correct naming, labels, priority, and descriptions
4. Note dependencies in issue descriptions — Linear MCP has no dependency API
5. Begin delegation

### During execution

- Move issue to **In Progress** before delegating to an agent
- Move issue to **Done** immediately after the agent completes and output is verified
- If a task is blocked, update the issue description explaining the blocker (Linear MCP has no comment API)

### Resuming an interrupted session

1. List issues filtered by **In Progress** and **Todo** status
2. Read issue descriptions to restore context
3. Pick up where work left off — no need to re-analyze from scratch

### Completing a feature

1. Verify all issues are **Done** or **Cancelled**
2. Run final build/lint/test checks
3. Mark all project issues as Done or Cancelled (closing the project requires the Linear UI)
