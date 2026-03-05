---
name: orchestration-protocols
description: "Runtime orchestration patterns for the Team Lead: parallel research spawning, agent health monitoring, active steering, background agent management, and escalation paths."
---

# Orchestration Protocols

Runtime patterns for managing delegated agents. **Load at:** Execution phase (Step 4+), when monitoring active agents or spawning parallel work.

## Active Steering

Monitor agent sessions during execution. Intervene early when you spot:

- **Failing tests/builds** — the agent can't resolve a dependency or breaks existing code
- **Unexpected file changes** — files outside the agent's partition appear in the diff
- **Scope creep** — the agent starts refactoring code you didn't ask about
- **Circular behavior** — the agent retries the same failing approach without adjusting
- **Intent misunderstanding** — session log shows the agent interpreted the prompt differently

**When redirecting, be specific.** Explain *why* you're redirecting and *how* to proceed:

> "Don't modify `libs/data/src/lib/product.ts` — that file is shared across features. Instead, add the new query in `libs/data/src/lib/reviews.ts`. This keeps the change isolated."

**Timing matters.** Catching a problem 5 minutes in can save an hour. Don't wait until the agent finishes.

**Background agent caveat:** The drift signals above apply only to **sub-agents** (inline) where you see results in real-time. Background agents run autonomously — you cannot inspect their intermediate state or redirect mid-execution. For background agents, steering is **post-hoc**: invest more effort in prompt specificity and file partition constraints upfront, then review thoroughly when the agent returns its output.

## Background Agents

Background agents run autonomously in isolated Git worktrees. Use for well-scoped subtasks with clear acceptance criteria.

- **Spawn:** Delegate Session → Background → Select agent → Enter prompt
- **Auto-compaction:** At 95% token limit, context is automatically compressed
- **Resume:** Use `--resume` for previous sessions
- **Duration threshold:** Reserve for tasks expected to take >5 minutes
- **No real-time monitoring:** You cannot inspect intermediate state. Drift detection happens only at completion review. Mitigate with: (a) highly specific prompts, (b) strict file partition constraints, (c) acceptance criteria checklists in the prompt

## Parallel Research Protocol

When a task requires broad exploration before implementation, spawn multiple research sub-agents in parallel to gather context efficiently.

### When to Use

- 3+ independent research questions need answering before implementation can begin
- Broad codebase exploration across multiple libraries or domains
- Multi-area analysis (e.g., "How do we handle X in the frontend, backend, and CMS?")

### Spawn Strategy

- **Divide by topic/area**, not by file count — each researcher should own a coherent domain
- **Max 3-5 parallel researchers** — more than 5 creates diminishing returns and token waste
- **Each researcher gets a focused scope** — explicit directories, file patterns, or questions
- **Use Economy/Standard tier** for research sub-agents to manage cost

### Research Sub-Agent Prompt Template

```
Research: [specific question]
Scope: [files/directories to search]
Return: A structured summary with:
- Key findings (bullet list)
- Relevant file paths (with line numbers)
- Patterns observed
- Unanswered questions
```

### Result Merge Protocol

After all research sub-agents return:

1. **Collect** all sub-agent results into a single context
2. **Deduplicate** findings — same file/pattern reported by multiple agents counts once
3. **Resolve conflicts** — if agents report contradictory information, trust the one with more specific evidence (exact file paths + line numbers > general observations)
4. **Synthesize** into a single context block for the next phase — distill the combined findings into a concise summary that can be included in implementation delegation prompts

### When NOT to Use

- Single-file investigation — just read the file directly
- When the answer is in one known location — a single sub-agent or direct read is faster
- When results must be sequential (e.g., "find X, then based on X find Y")
- For fewer than 3 questions — overhead of parallel coordination exceeds time saved

## Batch Reviews

When multiple background agents complete work simultaneously, batch similar reviews to save time:

- Group reviews by domain (e.g., all UI changes together, all data changes together)
- Run fast reviews in parallel for independent outputs
- If multiple outputs share the same file partition boundary, review them sequentially to catch integration issues
- For panel reviews, combine related artifacts into a single panel question when they share acceptance criteria

## Agent Health-Check Protocol

Monitor delegated agents for failure signals. Intervene early rather than waiting for completion.

### Health Signals

| Signal | Detection | Threshold | Recovery |
|--------|-----------|-----------|----------|
| **Stuck** | No new terminal output or file changes | Sub-agent: 5 min / Background: 15 min | Check terminal output. If idle, nudge with clarification. If frozen, abort and re-delegate with simpler scope. |
| **Looping** | Same error message repeated 3+ times | 3 consecutive identical failures | Abort immediately. Analyze the error, add context the agent is missing, re-delegate with explicit fix path. |
| **Scope creep** | Files outside assigned partition appear in diff | Any file outside partition | Redirect: "Only modify files in [partition]. Revert changes to [file]." |
| **Context exhaustion** | Responses become repetitive, confused, or lose earlier instructions | Visible confusion or instruction amnesia | Checkpoint immediately. End session. Resume in fresh context. |
| **Permission loop** | Agent repeatedly asks for confirmation or waits for input | 2+ consecutive prompts without progress | Auto-approve if safe, or abort and re-delegate with `--dangerously-skip-permissions` flag or equivalent. |

### Health-Check Cadence

- **Sub-agents (inline):** Monitor continuously — you see output in real-time
- **Background agents:** Check terminal output after 10 minutes, then every 10 minutes
- **After completion:** Always review the full diff before accepting output

### Escalation Path

1. **First failure:** Re-delegate with more specific prompt + error context
2. **Second failure:** Downscope the task (split into smaller pieces) and re-delegate
3. **Third failure:** Log to Dead Letter Queue (`.github/customizations/AGENT-FAILURES.md`), escalate to Architect for root cause analysis. If the failure involves a panel 3x BLOCK or unresolvable agent/reviewer conflict, create a **dispute record** in `.github/customizations/DISPUTES.md` instead (see **team-lead-reference** skill § Dispute Protocol).

## Error Recovery Playbook

Common failure modes and how to recover:

### Agent Stuck in Retry Loop

**Symptom:** Agent retries the same failing command 3+ times without changing approach.
**Recovery:** Intervene immediately. Read the error output, identify the root cause, and re-delegate with explicit fix instructions. Add a lesson to lessons learned.

### MCP Tool Unavailable

**Symptom:** Tool calls fail with connection or timeout errors.
**Recovery:** (1) Check if the MCP server is running. (2) If transient, retry once. (3) If persistent, work around: use CLI tools as alternatives. Log to DLQ if critical.

### Background Agent Produces Broken Output

**Symptom:** Background agent returns, but files have lint/type/test errors.
**Recovery:** (1) Review the diff to understand intent. (2) If fixable with small edits, fix inline. (3) If fundamentally wrong, discard the worktree changes and re-delegate with a more specific prompt. (4) Log to DLQ after 2 failed attempts.

### Merge Conflict from Parallel Agents

**Symptom:** Two background agents modified overlapping files.
**Recovery:** (1) This should never happen if file partitioning was followed. (2) Accept one agent's changes first (the one with more complex work). (3) Re-delegate the simpler changes to adapt to the new state. (4) Add the conflict to your lessons learned.

### Context Window Exhausted

**Symptom:** Agent responses become confused, repetitive, or lose track of earlier instructions.
**Recovery:** (1) Save a session checkpoint immediately. (2) End the current session. (3) Resume in a new session, loading the checkpoint. (4) Reduce parallel work in the next session.

### Test Failures After Merge

**Symptom:** Tests pass individually but fail when multiple agent outputs are merged.
**Recovery:** (1) Run affected tests to identify which projects break. (2) Check for import conflicts, duplicate definitions, or state pollution. (3) Delegate fix to the agent whose changes are most likely the cause.
