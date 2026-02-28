````markdown
# Dispute Records

Structured escalation records created when agents exhaust all automated resolution paths. Unlike the Dead Letter Queue (simple failure log), disputes are **formal action items for humans** — they package conflicting perspectives, prior attempts, and resolution options so a human can make an informed decision.

> **Review this file at the start of each session.** Pending disputes may block downstream work and need human input before proceeding.

---

## When to Create a Dispute

Create a dispute record when **any** of these occur:

| Trigger | Typical Path |
|---------|-------------|
| Panel review BLOCKs 3 times | Fast review 3x FAIL → Panel → Panel 3x BLOCK → **Dispute** |
| Agent and reviewer fundamentally disagree on approach | Agent retries with reviewer feedback but keeps failing because the feedback conflicts with other constraints → **Dispute** |
| Conflicting acceptance criteria | Reviewer flags an issue, but fixing it would violate another acceptance criterion → **Dispute** |
| Architectural ambiguity | Multiple valid approaches exist, automated agents can't converge → **Dispute** |
| External dependency blocks resolution | Fix requires upstream library change, API access, or infrastructure action → **Dispute** |

**Do NOT create a dispute for:**
- Simple tool errors (MCP server down, build timeout) → use the DLQ
- Scope creep → use the DLQ with a redirect
- First or second failure → retry automatically

## Dispute Record Format

```markdown
### DSP-XXX: Short description of the disagreement

| Field | Value |
|-------|-------|
| **Date** | YYYY-MM-DD |
| **Priority** | `critical` / `high` / `medium` / `low` |
| **Linear Issue** | PRJ-XX |
| **Trigger** | `panel-3x-block` / `approach-conflict` / `criteria-conflict` / `architectural-ambiguity` / `external-dependency` |
| **Implementing Agent** | Agent name |
| **Reviewing Agent(s)** | Agent name(s) |
| **Attempts** | Total attempts (fast review + panel) |
| **Est. Tokens Spent** | ~XXK across all attempts |
| **Status** | `pending` / `resolved` / `deferred` |

#### Context

Brief description of the task and what was being implemented.

#### Agent's Position

What the implementing agent produced and why it believes the approach is correct.
Include specific file paths and code references.

#### Reviewer's Position

What the reviewer(s) flagged and why they believe changes are needed.
Include the specific MUST-FIX items from the last review attempt.

#### Attempt History

| # | Type | Verdict | Key Feedback |
|---|------|---------|-------------|
| 1 | Fast review | FAIL | [one-line summary] |
| 2 | Fast review | FAIL | [one-line summary] |
| 3 | Fast review | FAIL → escalate | [one-line summary] |
| 4 | Panel (attempt 1) | BLOCK (1/3 PASS) | [one-line summary] |
| 5 | Panel (attempt 2) | BLOCK (0/3 PASS) | [one-line summary] |
| 6 | Panel (attempt 3) | BLOCK (1/3 PASS) | [one-line summary] |

#### Resolution Options

Present 2-3 concrete options for the human decision-maker:

1. **Option A: [Accept agent's approach]** — Rationale: ... Risk: ...
2. **Option B: [Accept reviewer's feedback]** — Rationale: ... Risk: ...
3. **Option C: [Alternative approach]** — Rationale: ... Risk: ...

#### Recommended Action

Which option the Team Lead recommends and why. Include specific next steps:
- [ ] Human decides on option A/B/C
- [ ] If A: merge as-is, create follow-up ticket for reviewer concerns
- [ ] If B: re-delegate with explicit instruction to [specific change]
- [ ] If C: [describe the alternative path]

#### Artifacts

Links to evidence for human review:
- Panel report: `customizations/logs/panel/[panel-key].md`
- Review log entries: `customizations/logs/reviews.ndjson` (filter by issue)
- Changed files: [list of files in the last attempt]
- DLQ entry (if any): `DLQ-XXX`
```

## Priority Guidelines

| Priority | Criteria | Expected Human Response Time |
|----------|----------|------------------------------|
| `critical` | Blocks other in-progress work; overnight run stopped | Same day |
| `high` | Blocks the current feature; no workaround | Within 2 days |
| `medium` | Feature can proceed without this subtask | Within 1 week |
| `low` | Nice-to-have; deferrable | Next planning session |

## Lifecycle

```
┌──────────────────────────────────────┐
│  Automated resolution exhausted      │
│  (3x panel BLOCK or approach conflict)│
└──────────────┬───────────────────────┘
               │
               ▼
┌──────────────────────────────────────┐
│  Team Lead creates dispute record     │
│  Status: pending                      │
│  Logs to disputes.ndjson              │
│  Links to Linear issue                │
└──────────────┬───────────────────────┘
               │
               ▼
┌──────────────────────────────────────┐
│  Human reviews dispute                │
│  Picks resolution option              │
│  Updates Status → resolved/deferred   │
└──────────────┬───────────────────────┘
               │
     ┌─────────┴──────────┐
     ▼                    ▼
  resolved             deferred
  (re-delegate          (create follow-up
   with human's          ticket, continue
   decision)             with other work)
```

## Integration with DLQ

Disputes and DLQ entries serve different purposes:

| | Dead Letter Queue | Dispute Record |
|--|-------------------|----------------|
| **Purpose** | Diagnostic failure log | Actionable human decision |
| **When** | Tool errors, timeouts, simple failures | Unresolvable agent/reviewer conflicts |
| **Action** | Retry or investigate root cause | Human picks a resolution option |
| **Urgency** | Can wait for pattern analysis | Needs human input to unblock |
| **File** | `AGENT-FAILURES.md` | `DISPUTES.md` (this file) |

A dispute MAY reference a DLQ entry if the dispute escalated from a logged failure. Use the `DLQ-XXX` ID in the Artifacts section.

---

## Disputes

<!-- Disputes are appended here by the Team Lead during sessions.
     Start numbering from DSP-001. -->

---

## Index

| ID | Date | Priority | Trigger | Linear Issue | Status |
|----|------|----------|---------|-------------|--------|

````
