---
name: agent-hooks
description: "Lifecycle hooks for AI agent sessions — reusable actions that run at specific points (session start, session end, pre-delegation, post-delegation). Defines what to do at each lifecycle event so agents behave consistently."
---

<!-- ⚠️ This file is managed by OpenCastle. Edits will be overwritten on update. Customize in the .github/customizations/ directory instead. -->

# Agent Lifecycle Hooks

Hooks are **standardized actions** that agents execute at specific points during their lifecycle. They enforce consistency across sessions and prevent common oversights (missing lessons, forgotten checkpoints, untracked issues).

## Hook Execution Model

Hooks are **conventions, not automated triggers**. Agents must explicitly follow them. The Team Lead includes hook reminders in delegation prompts; specialist agents include them in their own workflow.

```
Session Lifecycle:
  on-session-start  →  [work loop]  →  on-session-end
                          ↓   ↑
                    on-pre-delegate → on-post-delegate
```

---

## Hook: on-session-start

**When:** First action in any agent session (Team Lead or specialist).

### Actions

1. **Read lessons learned** — Scan `.github/customizations/LESSONS-LEARNED.md` for entries relevant to the current task domain. Apply proactively.
2. **Check for checkpoint** — If `.github/customizations/SESSION-CHECKPOINT.md` exists, read it. Resume from last known state instead of re-analyzing.
3. **Check pending approvals** — If the checkpoint has a `## Pending Approvals` section, check for replies using the configured messaging provider's MCP tools (e.g., `conversations_replies` for Slack). Read `.opencastle.json` → `stack.teamTools` to determine the provider. If no messaging is configured, skip this step.
4. **Check dead letter queue** — Scan `.github/customizations/AGENT-FAILURES.md` for pending failures related to the current scope.
5. **Validate skill-matrix bindings** — Open `.github/customizations/agents/skill-matrix.md` and check whether the **Primary Stack** and **Tooling** tables have any filled-in rows (non-empty Technology/Skill columns). If all bindings are empty, **warn the user** that the bootstrap hasn't been run and capability slots will not resolve. Suggest running the *"Bootstrap Customizations"* prompt first. Do NOT silently continue with empty bindings.
6. **Load domain skills** — Based on the task description, load the appropriate skills before writing code. Don't start coding without the relevant skill loaded.

### Template for Delegation Prompts

Include this reminder in every delegation:

```
**Session Start:** Read `.github/customizations/LESSONS-LEARNED.md` before starting.
Check `.github/customizations/SESSION-CHECKPOINT.md` for prior state and pending approvals.
If pending approvals exist, check for replies via the messaging provider.
Validate `.github/customizations/agents/skill-matrix.md` — warn if skill bindings are empty (bootstrap not run).
Load relevant skills before writing code.
```

---

## Hook: on-session-end

**When:** Before the agent yields control back to the user — every time, unconditionally.

> **⛔ HARD GATE — Run the Pre-Response Quality Gate checklist from `general.instructions.md` before responding.**
> A session without log records is a failed session. A session without lessons captured after retries is a failed session.

### Actions

1. **Call Session Guard** (Team Lead only) — Delegate to the **Session Guard** agent with a session summary (delegations, retries, discoveries, files changed). Execute any fix commands it returns. This replaces the manual Pre-Response Quality Gate checklist — the guard runs it automatically with a fresh context window.
2. **For specialist agents** (not Team Lead) — Run the Pre-Response Quality Gate checklist from `general.instructions.md` manually. Specialist agents don't have access to the Session Guard.
3. **Save checkpoint** (Team Lead only) — If work is incomplete, write `.github/customizations/SESSION-CHECKPOINT.md` with current state so the next session can resume. Load **session-checkpoints** skill for format.
4. **Memory merge check** — If `LESSONS-LEARNED.md` has grown significantly (5+ new entries this session), flag for memory merge consideration.
5. **Clean up** — Remove any temporary files created during the session (e.g., test fixtures, debug outputs).

### Template for Delegation Prompts

```
**Session End:** Run the Pre-Response Quality Gate from general.instructions.md:
- Log your session to `.github/customizations/logs/sessions.ndjson` (Constitution rule #6)
- If you retried anything with a different approach that worked, add a lesson to `.github/customizations/LESSONS-LEARNED.md`
- Track any discovered issues in KNOWN-ISSUES.md or a tracker ticket
- Clean up temp files
```

> **Note for Team Lead:** You do NOT use this template yourself. Instead, call the **Session Guard** agent (step 10 in your role). This template is only for specialist agents you delegate to.

---

## Hook: on-pre-delegate

**When:** Team Lead only — before every delegation (sub-agent or background agent).

### Actions

1. **Tracker issue exists** — Verify the task has a tracker issue. If not, create one first.
2. **File partition clean** — Confirm no overlap with other active agents' file ownership.
3. **Dependencies verified** — All prerequisite tasks are marked Done with independent verification.
4. **Prompt is specific** — Includes: objective, file paths, acceptance criteria, patterns to follow, self-improvement reminder.
5. **Context map** (optional, for complex tasks) — If modifying 5+ files, generate a context map first (load **context-map** skill).
6. **Cost check** — Estimate token usage based on task complexity and model tier. Check against session budget.

### Quick Checklist

```
Pre-Delegate:
☐ Tracker issue ID included
☐ File partition specified
☐ Dependencies are Done
☐ Prompt has file paths + acceptance criteria
☐ Self-improvement reminder included
☐ Budget check passes
```

---

## Hook: on-post-delegate

**When:** Team Lead only — after receiving results from a delegated agent.

### Actions

0. **Log the delegation NOW** — Append a record to `.github/customizations/logs/delegations.ndjson` immediately. Do this BEFORE review or verification — logging must not depend on review passing.
   ```bash
   echo '{"timestamp":"...","session_id":"<branch>","agent":"...","model":"...","tier":"...","mechanism":"sub-agent","outcome":"...","retries":0,"phase":N,"file_partition":["..."]}' >> .github/customizations/logs/delegations.ndjson
   ```
1. **Fast review (mandatory)** — Run the `fast-review` skill against the agent's output. This is a **non-skippable gate**. See the fast-review skill for the full procedure (single reviewer sub-agent, automatic retry, escalation). Only after the fast review passes do you proceed to the remaining post-delegate actions below.
2. **Verify output** — Read changed files. Check that changes stay within the agent's file partition.
2. **Run verification** — Execute appropriate checks: lint, type-check, tests, or visual inspection.
3. **Check acceptance criteria** — Compare output against the tracker issue's acceptance criteria. Each criterion must be independently verified.
4. **Discovered issues tracked** — Verify the agent followed the Discovered Issues Policy. If they found issues, check that they're in KNOWN-ISSUES.md or a new tracker ticket.
5. **Lessons captured** — If the agent retried anything, verify a lesson was added to LESSONS-LEARNED.md.
6. **Update tracker** — Move the issue to Done (if passing) or add failure notes and re-delegate (if failing).

### Quick Checklist

```
Post-Delegate:
☐ Delegation logged to delegations.ndjson (FIRST — before anything else)
☐ Changed files reviewed
☐ Files within partition
☐ Lint/test/build passes
☐ Fast review PASS (mandatory — load fast-review skill)
☐ Acceptance criteria met
☐ Discovered issues tracked (not ignored)
☐ Lessons captured (if retries occurred)
☐ Issue updated
```

---

## Hook Integration

### For Team Lead

The on-pre-delegate and on-post-delegate hooks are already encoded in the Team Lead's orchestration workflow. Reference this skill to ensure consistency.

### For Specialist Agents

Include on-session-start and on-session-end actions in every delegation prompt. Use the templates above.

### For Workflow Templates

Each workflow's **Delivery phase** naturally serves as the on-session-end hook for that workflow type. The Delivery phase steps should include session logging, lesson verification, and memory merge checks.

---

## Anti-Patterns

- **Skipping on-session-start** — Leads to repeated mistakes already documented in lessons learned
- **Forgetting session logging** — Makes the observability dashboard empty and performance tracking impossible. This is the #1 most common failure.
- **Treating logging as optional** — Every session gets logged. No threshold, no exceptions.
- **Batch-logging retrospectively** — Log each task as it completes, not all at once at the end of a long conversation.
- **Partial post-delegate checks** — "It compiled, ship it" without checking acceptance criteria
- **No cleanup** — Temp files accumulate and confuse future sessions
- **Hooks as blockers** — Hooks should add ~2 minutes overhead, not 20. If a hook takes too long, skip the optional parts
