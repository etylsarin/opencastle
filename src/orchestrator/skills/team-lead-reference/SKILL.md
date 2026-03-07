---
name: team-lead-reference
description: "Reference data for Team Lead orchestration — model routing, pre-delegation checks, cost tracking template, and DLQ format. Load when starting a delegation session."
---

<!-- ⚠️ This file is managed by OpenCastle. Edits will be overwritten on update. Customize in the .github/customizations/ directory instead. -->

# Team Lead Reference

For the specialist agent registry and model assignments, see [agent-registry.md](../../customizations/agents/agent-registry.md).

## Cost-Aware Model Routing

Choose models deliberately based on task complexity. Not every task needs the most expensive model.

### Model Cost Tiers

| Tier | Cost | Use For |
|------|------|---------|
| **Premium** | $$$$ | Team Lead orchestration, highest-stakes decisions |
| **Quality** | $$$ | Feature implementation, UI/frontend, security audits, architecture, complex reasoning |
| **Standard** | $$ | Large-scale analysis, schema design, cost-efficient coding, repo-level exploration |
| **Fast** | $$ | Terminal-heavy tasks, E2E tests, data pipelines, agentic workflows |
| **Economy** | $ | Documentation, simple config changes, formatting, boilerplate |

### Selection Rules

1. **Default to the agent's assigned model** — the registry maps tasks to appropriate tiers
2. **Downgrade when possible** — If a task is pure docs/config with no reasoning needed, prefer Economy tier
3. **Upgrade for ambiguity** — If the task involves security, architecture decisions, or complex tradeoffs, use Quality/Premium
4. **Never use Premium/Quality for boilerplate** — Writing test scaffolding, updating docs, or config changes should use Economy/Fast/Standard
5. **Parallel sub-agents are cost multipliers** — When firing 3+ parallel sub-agents, prefer Economy/Fast/Standard unless precision is critical

## Complexity-Based Task Scoring

During decomposition, assign a **complexity score** (Fibonacci: 1, 2, 3, 5, 8, 13) to each subtask. The score determines which model tier handles the task.

### Scoring Criteria

| Factor | Low (1-2) | Medium (3-5) | High (8-13) |
|--------|-----------|--------------|-------------|
| **Files touched** | 1-2 files | 3-5 files | 6+ files or cross-library |
| **Reasoning depth** | Mechanical / boilerplate | Pattern matching, moderate logic | Architecture decisions, security, tradeoffs |
| **Ambiguity** | Clear spec, obvious approach | Some judgment calls | Multiple valid approaches, needs exploration |
| **Risk** | No data loss, easily reversible | Moderate impact, testable | DB migrations, auth changes, breaking changes |
| **Dependencies** | None | 1-2 upstream tasks | Complex dependency chain |

### Score to Model Tier Mapping

| Score | Tier | Examples |
|-------|------|----------|
| **1-2** | Economy/Fast | Docs update, config tweak, rename, simple test |
| **3-5** | Standard/Quality | Component build, CMS query, API route, migration |
| **8** | Quality | Architecture decision, security audit, complex refactor |
| **13** | Quality + Panel | DB migration with data transform, auth flow redesign |

### Override Rules

- **Blocker tasks** (blocking 2+ downstream tasks): Upgrade one tier regardless of score
- **Security-touching tasks**: Always Quality or higher, regardless of score
- **Pure documentation**: Always Economy, regardless of estimated scope
- The agent registry default model takes precedence unless the task complexity clearly warrants an upgrade/downgrade

## Deepen-Plan Protocol

After initial decomposition, **enrich the plan** with concrete codebase evidence before delegating. This prevents agents from wasting time on discovery that the Team Lead can do upfront.

### When to Deepen

| Plan Complexity | Action |
|----------------|--------|
| 1-2 subtasks, familiar area | Skip — proceed directly to delegation |
| 3-5 subtasks, mixed familiarity | Quick deepen — single Researcher sub-agent |
| 6+ subtasks, unfamiliar area | Full deepen — parallel Researcher sub-agents |

### Quick Deepen (Single Researcher)

Fire one **Researcher** sub-agent with this prompt:

```
Research the following planned subtasks and enrich each with:
1. Exact file paths and line numbers for code that will change
2. Existing patterns to follow (with file:line examples)
3. Related lessons from .github/customizations/LESSONS-LEARNED.md
4. Risks or blockers (missing dependencies, known issues)

Subtasks:
- [Subtask 1 description]
- [Subtask 2 description]
- ...

Return a structured report per subtask.
```

### Full Deepen (Parallel Researchers)

For large plans, split research by domain and fire parallel Researcher sub-agents. See [agent-registry.md](../../customizations/agents/agent-registry.md) for project-specific scope examples.

### What Deepening Produces

After deepening, each subtask in the plan should have:

| Field | Before Deepen | After Deepen |
|-------|--------------|--------------|
| **Files** | "some component" | Exact file path with line range |
| **Pattern** | "follow existing style" | Specific file:line reference to follow |
| **Risks** | unknown | Known issues identified |
| **Lessons** | unchecked | Relevant lessons applied |
| **Dependencies** | assumed | Verified with exact imports |

### Integrating Results

Take the Researcher output and update delegation prompts with concrete file paths, patterns, and lessons. This transforms vague prompts into precise instructions that agents can execute without discovery overhead.

## Pre-Delegation Policy Checks

See the Team Lead agent file § Pre-Delegation Checks for the mandatory 5-point checklist (tracker issue, file partition, dependencies, prompt specifics, self-improvement reminder).

**Additional checks for feature work:** (6) Known issues reviewed, (7) Architecture docs read, (8) Existing code searched.

**Additional checks for high-risk work:** (9) Panel review planned, (10) Rollback path identified.

## Cost Tracking Convention

After completing a feature (all tracker issues Done), add a cost summary to the roadmap update:

```markdown
**Cost Summary:**
| Metric | Value |
|--------|-------|
| Sub-agent delegations | X |
| Background agent delegations | X |
| Panel reviews | X |
| Model tiers used | Premium: X, Standard: X, Utility: X, Economy: X |
| Upgrades/downgrades | [reason if any] |
| Est. total tokens | ~XXK |
```

This data helps optimize future model assignments. If no meaningful data was collected, skip the summary.

During execution, maintain a running delegation log in the session checkpoint (see the **session-checkpoints** skill § Delegation Cost Log). Update it after each delegation completes or fails.

## Context Source Tagging

When collecting results from multiple sub-agents or background agents, **tag each result by its source** to prevent context confusion:

```markdown
### [Content Engineer] TAS-42 Schema
- Created `schemas/review.ts` with star rating field
- Deployed to CMS studio
- Verification: lint ✅, type-check ✅

### [DB Engineer] TAS-43 Migration
- Created migration file for reviews table
- RLS policies for authenticated users
- Verification: migration applied ✅, tests ✅
```

**Rules:**
- Prefix each agent's output summary with `### [Agent Name] TAS-XX Description`
- Never merge outputs from different agents into a single undifferentiated block
- When referencing prior agent output in a delegation prompt, cite the source: *"The Content Engineer created `schemas/review.ts` — follow that pattern"*
- In the session checkpoint "Completed Work" table, always include the Agent column

This prevents the Team Lead from confusing which agent produced what, especially after 5+ delegations when context is dense.

## Dead Letter Queue Format

Log to `.github/customizations/AGENT-FAILURES.md` when:
- A delegated agent fails to complete its task after 2+ attempts
- A background agent produces output that fails all verification gates
- An agent encounters an unrecoverable error (e.g., MCP server down, tool unavailable)

> **Note:** When a panel review BLOCKs 3 times, create a **dispute record** instead of a DLQ entry. See § Dispute Protocol below.

### Failure Entry Format

```markdown
### DLQ-XXX: Short description

| Field | Value |
|-------|-------|
| **Date** | YYYY-MM-DD |
| **Agent** | Agent name |
| **Tracker Issue** | TAS-XX (if applicable) |
| **Failure Type** | `verification-fail` / `tool-error` / `panel-block` / `timeout` / `scope-creep` |
| **Attempts** | Number of attempts before logging |
| **Est. Tokens Spent** | ~XXK across all attempts |
| **Model Tier** | Economy / Utility / Standard / Premium |

**Task:** What was the agent supposed to do?

**Failure Details:** What went wrong? Include error messages, failed checks, or panel BLOCK reasons.

**Root Cause:** Why did it fail? (if known)

**Resolution:** How was it eventually resolved? (or "pending" if unresolved)
```

### Review Cadence

At the start of each session, scan the agent failures doc for:
- **Pending failures** that need retry
- **Patterns** — same agent failing repeatedly may indicate a prompt or skill issue
- **Tool issues** — MCP servers or external dependencies that need attention

## Error Recovery

For common failure modes and recovery procedures, load the **orchestration-protocols** skill.

## Dispute Protocol

When automated resolution is exhausted (panel 3x BLOCK, approach conflicts, or criteria contradictions), create a **formal dispute record** in `.github/customizations/DISPUTES.md`. Inspired by the [Steroids CLI](https://github.com/UnlikeOtherAI/steroids-cli) dispute/escalation pattern.

### When to Create a Dispute (vs. DLQ Entry)

| Scenario | Action |
|----------|--------|
| Tool error, timeout, MCP failure | DLQ entry |
| Scope creep | DLQ entry + redirect |
| Agent fails 2+ times (simple) | DLQ entry |
| Panel BLOCKs 3 times | **Dispute record** |
| Agent and reviewer fundamentally disagree | **Dispute record** |
| Acceptance criteria contradict each other | **Dispute record** |
| Multiple valid approaches, agents can't converge | **Dispute record** |
| Fix requires external/human action | **Dispute record** |

### Dispute Creation Procedure

1. **Number the dispute** — Increment from the last `DSP-XXX` ID in the Index table
2. **Set priority** — Use the priority guidelines in DISPUTES.md (critical/high/medium/low)
3. **Document both perspectives** — Agent's position AND reviewer's position with specific file/code references
4. **Build attempt history** — List every fast review and panel attempt with one-line verdict summaries
5. **Present resolution options** — At least 2 concrete options with rationale and risk for each
6. **Recommend an action** — Which option the Team Lead thinks is best, with specific next steps
7. **Link artifacts** — Panel reports, review logs, changed files, DLQ entries
8. **Log to events.ndjson** — Use the **observability-logging** skill's dispute record command
9. **Update the tracker issue** — Add the dispute ID and link to the dispute record
10. **Update the Index table** — Add the new dispute to the bottom of the Index

### After Human Resolution

When a human resolves a dispute:
1. Update the dispute `Status` → `resolved` or `deferred`
2. Record which option was chosen and any additional instructions
3. If `resolved` → re-delegate the task with the human's decision as an explicit constraint
4. If `deferred` → create a follow-up tracker issue and continue with other work
5. Log the resolution in `events.ndjson` using the **observability-logging** skill's dispute record command (update or append a resolution event)

### Session Start: Check Disputes

At the start of each session, after checking the DLQ, also check `DISPUTES.md` for:
- **Pending disputes** that a human has resolved since the last session → act on the resolution
- **Critical/high disputes** that are still pending → flag to the user before proceeding
- **Patterns** — recurring disputes may indicate a skill gap, ambiguous instructions, or a need for a new validation gate

## Background Agent Git Merge Strategy

Background agents work in isolated Git worktrees. When merging their output:

1. **Merge order matters:** Merge the most foundational changes first (DB migrations -> queries -> components -> pages -> tests -> docs)
2. **Test after each merge:** Run affected tests after merging each agent's work
3. **Resolve conflicts immediately:** Don't accumulate multiple agent outputs before merging
4. **Discard stale worktrees:** If an agent's output is no longer compatible with the main branch (due to other agents' changes merging first), re-delegate rather than force-merge
5. **Atomic merge preference:** Use `git merge --no-ff` to keep agent work traceable in history
