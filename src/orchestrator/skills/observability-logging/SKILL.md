---
name: observability-logging
description: "Session logging, delegation records, review/panel/dispute NDJSON logging, pre-response checklists. Load before responding to verify all logs are written."
---

# Observability Logging

## Observability Logging (Mandatory)

> **⛔ HARD GATE — This is a blocking requirement, not a suggestion.**
> Do NOT respond to the user until you have appended the required log records.
> A session without log records is a failed session — regardless of code quality.

**Every agent MUST log every session to the observability NDJSON files.** No exceptions. No threshold. No "too small to log." The dashboard depends on this data.

### What to log

| File | Event types | Who appends | When |
|------|------------|------------|------|
| `events.ndjson` | `session`, `delegation`, `review`, `panel`, `dispute` | All agents / Team Lead / Panel runner | After every applicable event — use `--type` to discriminate |

See `.opencastle/logs/README.md` for the full schema of each record type.

### How to log

Use the `opencastle log` CLI to append events to `.opencastle/logs/events.ndjson`. When the Team Lead works directly, use the agent role that best describes the work (e.g., `--agent Developer`, `--agent "UI-UX Expert"`). If a single conversation involves multiple distinct tasks, log one record per task.

**Session record** (ALL agents, EVERY session):
```sh
opencastle log --type session --agent Developer --model claude-opus-4-6 \
  --task "Fix login redirect bug" --outcome success --duration_min 15 \
  --files_changed 3 --retries 0
```

**Delegation record** (Team Lead only, **immediately after each delegation — not at session end**):
```sh
opencastle log --type delegation --session_id feat/prj-57 --agent Developer \
  --model claude-sonnet-4-6 --tier quality --mechanism sub-agent \
  --tracker_issue PRJ-57 --outcome success --retries 0 --phase 2 \
  --file_partition "src/components/"
```
Verify: `tail -1 .opencastle/logs/events.ndjson`

> **`model` and `tier` must reflect the delegated agent's assignment from the agent registry** — not the Team Lead's own model.

**Fast review record** (Team Lead, **immediately after each fast review**):
```sh
opencastle log --type review --tracker_issue PRJ-42 --agent Developer \
  --reviewer_model gpt-5-mini --verdict pass --attempt 1 \
  --issues_critical 0 --issues_major 0 --issues_minor 2 \
  --confidence high --escalated false --duration_sec 45
```
Verify: `tail -1 .opencastle/logs/events.ndjson`

**Panel record** (Panel runner, **immediately after each panel majority vote**):
```sh
opencastle log --type panel --panel_key auth-review --verdict pass \
  --pass_count 3 --block_count 0 --must_fix 0 --should_fix 3 \
  --reviewer_model claude-opus-4-6 --weighted false --attempt 1 \
  --tracker_issue PRJ-42 --artifacts_count 5
```
Verify: `tail -1 .opencastle/logs/events.ndjson`

**Dispute record** (Team Lead, **immediately after each dispute**):
```sh
opencastle log --type dispute --dispute_id DSP-001 --tracker_issue PRJ-42 \
  --priority high --trigger panel-3x-block --implementing_agent Developer \
  --reviewing_agents "Reviewer,Panel (3x)" --total_attempts 6 --status pending
```
Verify: `tail -1 .opencastle/logs/events.ndjson`

### Pre-Response Logging Checklist

**STOP before responding to the user.** Verify each applicable item:

- [ ] **Session logged** — `events.ndjson` has a new `session` record for this session (ALWAYS required)
- [ ] **Delegations logged** — `events.ndjson` has a `delegation` record for **each** delegation (Team Lead only). Count delegations → count records → must match
- [ ] **Reviews logged** — `events.ndjson` has a `review` record for **each** fast review performed. Count reviews → count records → must match
- [ ] **Panels logged** — `events.ndjson` has a `panel` record for **each** panel review performed. Count panels → count records → must match
- [ ] **Disputes logged** — `events.ndjson` has a `dispute` record for **each** dispute created. Count disputes → count records → must match

If ANY required log is missing, run `opencastle log --type <type> ...` NOW before responding.

### Rules

- **Log before yielding to the user** — logging is the LAST action before responding. This is Constitution rule #6.
- **Log per task**, not per conversation. Multiple tasks = multiple records.
- **Never batch-log retrospectively** across sessions.
- **Verify the append succeeded** — if unsure, `tail -1` the file to confirm.

## Universal Agent Rules

These rules apply to ALL specialist agents automatically. **Do not duplicate them in individual agent files.**

1. **Never delegate** — Specialist agents complete their own work and return results. Never invoke the Team Lead or spawn sub-agents. If work requires another domain, document the need in your output contract.
2. **Follow the Discovered Issues Policy** — Track any pre-existing bugs found during your work (see the **git-workflow** skill).
3. **Read and update lessons** — Read `.opencastle/LESSONS-LEARNED.md` before starting. If you retry anything with a different approach that works, use the **self-improvement** skill to add a lesson immediately.
4. **Log every session** — Append to `.opencastle/logs/events.ndjson` after every session using `opencastle log --type session ...`. No exceptions. This is Constitution rule #6 — a blocking gate, not optional.

## Base Output Contract

Every specialist agent's Output Contract MUST end with these standard items (in addition to domain-specific items above them):

- **Observability Logged** — Confirm ALL applicable log records were appended to `events.ndjson` (Constitution rule #6):
  - `--type session` — ALWAYS (every agent, every session)
  - `--type delegation` — if delegations occurred (Team Lead only)
  - `--type review` — if fast reviews occurred
  - `--type panel` — if panel reviews occurred
  - `--type dispute` — if disputes were created
- **Discovered Issues** — Pre-existing bugs or anomalies found during work, with tracking action taken per the Discovered Issues Policy
- **Lessons Applied** — Lessons from `.opencastle/LESSONS-LEARNED.md` that influenced this work, and any new lessons added

Agents reference this contract with: `See **Base Output Contract** in the observability-logging skill for the standard closing items.`

## Pre-Response Quality Gate

> **⛔ STOP before responding to the user.** Run through this checklist. If ANY required item is missing, fix it NOW.

This is the single exit gate for every session. All items are mandatory unless marked conditional.

- [ ] **Lessons read** — `.opencastle/LESSONS-LEARNED.md` was read at session start (Self-Improvement Protocol)
- [ ] **Lessons captured** — If any retry occurred, a new lesson was added via the **self-improvement** skill
- [ ] **Discovered issues tracked** — Any pre-existing bugs found were added to `KNOWN-ISSUES.md` or a tracker ticket was created (Discovered Issues Policy)
- [ ] **Lint/type/test pass** — No new errors introduced; verification ran after code changes (Constitution rule #5)
- [ ] **Session logged** — `events.ndjson` has a new `session` record for this session (Constitution rule #6 — ALWAYS required)
- [ ] **Delegations logged** — `events.ndjson` has a `delegation` record for each delegation (Team Lead only)
- [ ] **Reviews logged** — `events.ndjson` has a `review` record for each fast review performed (if any)
- [ ] **Panels logged** — `events.ndjson` has a `panel` record for each panel review performed (if any)
- [ ] **Disputes logged** — `events.ndjson` has a `dispute` record for each dispute created (if any)
