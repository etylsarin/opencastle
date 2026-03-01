---
name: session-checkpoints
description: "Protocol for saving and restoring session state across agent sessions. Enables replay, fork, and resume of interrupted work — inspired by Sandcastle Run Time Machine."
---

<!-- ⚠️ This file is managed by OpenCastle. Edits will be overwritten on update. Customize in the customizations/ directory instead. -->

# Skill: Session Checkpoints

Use this skill when working on multi-session features or when a session may be interrupted. Checkpoints allow any future session to resume work without re-analyzing the entire codebase.

## When to Checkpoint

Create a checkpoint:

- **Before delegation** — After decomposition but before first agent delegation
- **After each phase** — When a group of parallel tasks completes
- **Before risky work** — Before DB migrations, large refactors, or security changes
- **On session end** — Always checkpoint before ending a session with incomplete work
- **On interruption** — If context is running low, checkpoint immediately

## Checkpoint Format

Create or update the file `docs/SESSION-CHECKPOINT.md` with this structure:

```markdown
# Session Checkpoint

**Last Updated:** YYYY-MM-DD HH:MM
**Feature:** Short feature name
**Branch:** git branch name
**Linear Issues:** TAS-XX, TAS-YY, TAS-ZZ

## Current Phase

Phase N of M — Brief description of what this phase does

## Completed Work

| Task | Linear | Agent | Status | Files |
|------|--------|-------|--------|-------|
| Description | TAS-XX | Agent Name | ✅ Done | file1.ts, file2.ts |
| Description | TAS-YY | Agent Name | ✅ Done | file3.ts |

## In Progress

| Task | Linear | Agent | Status | Notes |
|------|--------|-------|--------|-------|
| Description | TAS-ZZ | Agent Name | 🔄 In Progress | What's been done so far |

## Remaining Work

| Task | Linear | Agent | Dependencies | Files |
|------|--------|-------|-------------|-------|
| Description | TAS-AA | Agent Name | TAS-ZZ | file4.ts, file5.ts |

## Pending Approvals

Approval requests posted to the messaging provider that haven't been answered yet.
The `on-session-start` hook checks for replies when a new session begins.

| Provider | Channel | Thread ID | Question | Posted At |
|----------|---------|-----------|----------|-----------|
| slack | C0AHAQFJ7C1 | 1772393542.345149 | Run migration on production? | 2026-03-01 14:30 |

If the user answered in the VS Code chat during the previous session, remove
the row from this table — the approval was already resolved.

## Key Decisions Made

- Decision 1: Why this approach was chosen
- Decision 2: Why alternative X was rejected

## Blockers & Issues

- Blocker 1: Description and what's needed to unblock
- Issue found: DLQ-XXX reference if logged

## Delegation Cost Log

Track each delegation to monitor budget and optimize future model assignments:

| # | Agent | Linear | Model Tier | Est. Tokens | Duration | Status |
|---|-------|--------|------------|-------------|----------|--------|
| 1 | Content Engineer | TAS-XX | Standard | ~20K | 8 min | ✅ Done |
| 2 | DB Engineer | TAS-YY | Standard | ~25K | 12 min | ✅ Done |
| 3 | UI Expert | TAS-ZZ | Standard | ~30K | ❌ Failed → retry |

**Running totals:** 3 delegations / ~75K tokens / 0 panel reviews

## File Partitions

```
Agent A: dir1/, dir2/
Agent B: dir3/, dir4/
Agent C: docs/
```

## Resume Instructions

Step-by-step instructions for a new session to pick up where this one left off:

1. Check out branch `feat/xxx`
2. Read Linear issues TAS-XX, TAS-YY for context
3. Start Phase N+1: [specific instructions]
```

## Resuming from a Checkpoint

When starting a new session:

1. **Check for checkpoint** — Read `docs/SESSION-CHECKPOINT.md` if it exists
2. **Verify state** — Run `git status`, check branch, verify files match checkpoint
3. **Check Linear** — List in-progress and todo issues for current feature
4. **Follow resume instructions** — Execute the specific steps listed in the checkpoint
5. **Update checkpoint** — After resuming, update the checkpoint with current progress

## Fork Points

When a checkpoint reveals multiple possible paths forward, document them as fork points:

```markdown
## Fork Point: Feature X Implementation

### Option A: Server-side approach
- Pros: Better SEO, simpler client code
- Cons: More server load, slower interactions
- Files: api/route.ts, lib/server-utils/

### Option B: Client-side approach
- Pros: Faster interactions, less server load
- Cons: No SEO, complex client state
- Files: components/Feature.tsx, hooks/useFeature.ts

**Decision needed from:** User or Architect agent
```

## Cleanup

After a feature is fully complete (all Linear issues Done):

1. Archive the checkpoint content to the relevant Linear issue comments
2. Delete `docs/SESSION-CHECKPOINT.md` to keep the workspace clean
3. The next feature starts with a fresh checkpoint

## Integration with Team Lead

The Team Lead should:

- Create a checkpoint after Step 2 (Decompose & Partition) of the Decomposition Flow
- Update the checkpoint after each verification pass
- Include checkpoint reading in session resume workflow
- Reference the checkpoint file in delegation prompts for context

## Step Output Log (Time-Travel Replay)

Record the output of each completed delegation step. When a later step fails, replay from the failure point using cached outputs instead of re-running everything.

### Why This Matters

A multi-phase feature might complete phases 1-3 successfully before phase 4 fails. Without step logs, retrying requires re-running all 4 phases. With logs, the retry starts at phase 4 with cached context from phases 1-3.

### Step Log Format

Add a `## Step Output Log` section to the checkpoint file:

```markdown
## Step Output Log

### Step 1: [Short description]
- **Agent:** [Agent Name]
- **Linear:** TAS-XX
- **Status:** ✅ Completed
- **Duration:** ~X minutes
- **Key Outputs:**
  - Created `path/to/file.ts` — [description]
  - Modified `path/to/other.ts` — [what changed]
- **Verification:** Lint ✅ | Tests ✅ | Build ✅
- **Cached Context:** [1-3 sentence summary of what this step produced that downstream steps depend on]

### Step 2: [Short description]
- **Agent:** [Agent Name]
- **Linear:** TAS-YY
- **Status:** ❌ Failed (attempt 1)
- **Error:** [Specific error message or failure reason]
- **Cached Context from Step 1:** [Reference what Step 1 produced]
```

### Replay Protocol

When retrying a failed step:

1. **Read the step log** — identify the last successful step and its cached context
2. **Build replay context** — concatenate cached context from all completed steps into the retry prompt
3. **Scope the retry** — only re-delegate the failed step, not earlier completed steps
4. **Include the error** — add the specific failure reason to the retry prompt so the agent knows what went wrong
5. **Update the log** — record the retry attempt with attempt number

### Replay Prompt Template

```
**Retry: TAS-XX (attempt N)**

Previous steps completed successfully. Here is the cached context:
- Step 1 produced: [cached context from log]
- Step 2 produced: [cached context from log]

Step 3 failed with: [error from log]

Your task: [re-state the failed step's objective with additional guidance based on the error]

[Include the original delegation spec/prompt with corrections]
```

### When NOT to Replay

- If the failure invalidates earlier steps (e.g., Step 1's output is wrong), re-run from Step 1
- If 3+ steps need replay, consider checkpointing and starting a fresh session instead
- If the codebase changed significantly since the cached steps ran (e.g., another PR merged)
