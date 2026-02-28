---
name: jira-management
description: "Jira board conventions for tracking feature work — issue naming, labels, priorities, status workflow, and session continuity via Atlassian Rovo MCP. Use when decomposing features into tasks or resuming interrupted sessions."
---

# Task Management with Jira

Conventions for tracking feature work on Jira via the Atlassian Rovo MCP server. For project-specific project keys, workflow state IDs, and board configuration, see [jira-config.md](../../customizations/project/jira-config.md).

## Atlassian Rovo MCP Server

The Atlassian Rovo MCP server connects to Jira (and Confluence) via `https://mcp.atlassian.com/v2/sse`. It uses OAuth authentication — users authenticate through their Atlassian account when the MCP connection is first established.

**Available capabilities:**
- Search Jira issues with JQL
- Create and update issues
- Read issue details, comments, and attachments
- Search Confluence pages for context
- Create Confluence pages

**Rate limits** (per hour):
- Free: 500 calls
- Standard: 1,000 calls
- Premium/Enterprise: 1,000 + 20 per user (up to 10,000)

## Discovered Issues (Bug Tickets)

When an agent encounters a pre-existing bug or issue unrelated to the current task, it must be tracked. Follow this flow:

1. **Check** known issues docs and Jira (search for open bugs) to see if it's already tracked
2. **If tracked** — skip it, continue with current work
3. **If NOT tracked:**
   - **Unfixable limitation** — add to known issues with Issue ID, Status, Severity, Evidence, Root Cause, Solution Options
   - **Fixable bug** — create a Jira issue:
     - **Summary:** `[Area] Short description of the symptom`
     - **Type:** Bug
     - **Priority:** High if it affects users, Medium if cosmetic or non-blocking
     - **Description:** Include symptoms, reproduction steps, affected files, and any error messages or screenshots
     - **Status:** Backlog (unless it's blocking current work, then To Do)

## Issue Naming

Use `[Area] Short description` format in the Summary field:

```
[Schema] Add priceRange field to place type
[DB] Add price_range column and migration
[Query] Update query with priceRange filter
[UI] Build PriceRangeFilter component
[Page] Integrate price filter into /places
[Test] E2E test price range filtering
[Docs] Update data model documentation
```

**Area prefixes:** `[Schema]`, `[DB]`, `[Query]`, `[UI]`, `[Page]`, `[API]`, `[Auth]`, `[Test]`, `[Docs]`, `[Deploy]`, `[Data]`, `[Perf]`, `[Security]`

## Priority

| Jira Priority | Meaning | When to use |
|---------------|---------|-------------|
| Highest | Blocker | Blocks other tasks, critical path |
| High | Important | Core feature work, on critical path |
| Medium | Normal | Supporting tasks, can be parallelized |
| Low | Nice-to-have | Docs, cleanup, polish |
| Lowest | Backlog | Captured for future consideration |

## Status Workflow

```
Backlog → To Do → In Progress → In Review → Done
```

- **Backlog** — Captured but not yet planned
- **To Do** — Planned for current sprint/feature, ready to start
- **In Progress** — Actively being worked on by an agent
- **In Review** — PR opened, awaiting review/merge
- **Done** — Completed and verified

### Status Drivers

Issue status is driven by **two sources** — the Team Lead agent (via MCP) and the Jira automation/GitHub integration (automatically).

**Agent-driven transitions (via MCP):**
- **To Do → In Progress** — when the agent starts working on a task
- **In Progress → Done** — when non-PR tasks are verified (e.g., docs, config changes)

**Automation-driven transitions:**
If your Jira project has GitHub integration or automation rules configured, PR lifecycle events can auto-update issue status. Configure these in Jira under *Project settings → Automation*.

**Linking issues to PRs:** Include the Jira issue key (e.g., `PROJ-123`) in the branch name or PR title. Use the branch name format: `<type>/<issue-key>-<short-description>`.

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

**Dependencies:** PROJ-XX (if any)
```

The **Files (partition)** section defines which files this agent is allowed to modify. This prevents merge conflicts when multiple agents work in parallel — no two issues in the same phase should list overlapping files.

## Feature Grouping

- Use a **Jira Epic** for each major feature
- All related issues (Stories/Tasks) belong to that Epic
- Issues track individual subtasks within the feature
- Use components or labels for domain grouping (e.g., `frontend`, `backend`, `database`)

## Session Workflow

### Starting a new feature

1. Search the board (JQL) to check for existing in-progress work
2. Decompose the feature into issues following the conventions above
3. Create all issues in Jira with correct naming, type, priority, and descriptions
4. Link dependencies between issues using Jira issue links
5. Begin delegation

### During execution

- Move issue to **In Progress** before delegating to an agent
- Move issue to **Done** immediately after the agent completes and output is verified
- Add comments to the issue if a task is blocked, explaining the blocker

### Resuming an interrupted session

1. Search issues by status (In Progress, To Do) in the project
2. Read issue descriptions to restore context
3. Pick up where work left off — no need to re-analyze from scratch

### Completing a feature

1. Verify all issues in the Epic are **Done** or closed
2. Run final build/lint/test checks
3. Close the Epic

## JQL Quick Reference

Common queries for agent workflows:

```jql
# Find in-progress work
project = PROJ AND status = "In Progress" ORDER BY priority DESC

# Find planned work
project = PROJ AND status = "To Do" ORDER BY priority DESC

# Find bugs
project = PROJ AND type = Bug AND status != Done ORDER BY priority DESC

# Find work in current sprint
project = PROJ AND sprint in openSprints() ORDER BY priority DESC

# Find blockers
project = PROJ AND priority = Highest AND status != Done
```

Replace `PROJ` with the actual project key from [jira-config.md](../../customizations/project/jira-config.md).
