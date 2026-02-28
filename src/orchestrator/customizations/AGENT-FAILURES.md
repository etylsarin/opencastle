````markdown
# Agent Failure Log (Dead Letter Queue)

Structured log of failed agent delegations for diagnosis and retry. Prevents failed work from silently disappearing.

> **Review this file at the start of each session.** Check for pending failures that need retry and patterns that indicate systemic issues.

---

## How to Use This File

### When to add an entry

Add an entry when **any** of these occur:

- A delegated agent fails to complete its task after 2+ attempts
- A background agent produces output that fails all verification gates
- A panel review BLOCKs 3 times and requires escalation → **create a dispute record** in `DISPUTES.md` instead (see below)
- An agent encounters an unrecoverable error (e.g., MCP server down, tool unavailable)

> **Disputes vs. DLQ:** When a panel BLOCKs 3 times or agents fundamentally disagree on an approach, create a **dispute record** in `DISPUTES.md` — not a DLQ entry. Disputes package both perspectives and resolution options for human decision-making. DLQ entries are for simple failures (tool errors, timeouts, scope creep).

### Entry format

```markdown
### DLQ-XXX: Short description

| Field | Value |
|-------|-------|
| **Date** | YYYY-MM-DD |
| **Agent** | Agent name |
| **Linear Issue** | PREFIX-XX (if applicable) |
| **Failure Type** | `verification-fail` / `tool-error` / `panel-block` / `timeout` / `scope-creep` |
| **Attempts** | Number of attempts before logging |

**Task:** What was the agent supposed to do?

**Failure Details:** What went wrong? Include error messages, failed checks, or panel BLOCK reasons.

**Root Cause:** Why did it fail? (if known)

**Resolution:** How was it eventually resolved? (or "pending" if unresolved)
```

### Failure types

| Type | Description |
|------|-------------|
| `verification-fail` | Agent completed but output fails lint/test/build/browser checks |
| `tool-error` | MCP server down, tool unavailable, API error |
| `panel-block` | Panel review blocked 3+ times |
| `timeout` | Agent ran out of context or took too long |
| `scope-creep` | Agent modified files outside its partition or went off-task |

---

## Failures

<!-- Failures are appended here by the Team Lead during sessions.
     Start numbering from DLQ-001. -->

---

## Index

| ID | Date | Agent | Type | Status |
|----|------|-------|------|--------|

````
