---
name: self-improvement
description: "Protocol for reading and updating the lessons-learned knowledge base. MUST be followed by ALL agents — read lessons before work, write lessons after retries. This makes the agent team self-improving across sessions."
---

# Self-Improvement Protocol

This skill defines how agents learn from mistakes and share knowledge so the same pitfalls are never repeated.

## Core Principle

**If you retry something with a different approach and it works, document the lesson immediately.** The cost of writing a lesson (2 minutes) is always less than the cost of someone else hitting the same pitfall (5-30 minutes).

## The Lessons File

Location: `.github/customizations/LESSONS-LEARNED.md`

This is the team's collective memory — a structured log of tool/command pitfalls, workarounds, and correct approaches discovered through execution.

## Protocol for All Agents

### BEFORE Starting Work (Mandatory)

1. **Read `.github/customizations/LESSONS-LEARNED.md`** — scan the full file or at minimum the categories relevant to your task
2. **Apply relevant lessons proactively** — don't wait to hit the same wall; use the documented correct approach from the start
3. **Check the Index by Category table** at the bottom of the file to quickly find relevant sections

### DURING Execution (Trigger-Based)

A lesson MUST be written when **any** of these triggers occur:

| Trigger | Example |
|---------|---------|
| **Retry with different approach** | Command fails, you try a different flag/syntax and it works |
| **Tool call fails unexpectedly** | MCP tool returns error, you discover the correct parameter format |
| **Workaround needed** | Platform limitation requires non-obvious solution |
| **Docs are misleading** | Official docs say X but reality is Y |
| **Configuration surprise** | Default behavior differs from expectation |
| **Error message is unhelpful** | Error says "failed" but the real cause was something else |

### AFTER Completing Work

1. If you wrote any new lessons during execution, **update the Index by Category table** at the bottom of `.github/customizations/LESSONS-LEARNED.md` to include the new lesson IDs.

2. **Log the session** — append one JSON line to `.github/customizations/logs/sessions.ndjson` with: `timestamp`, `agent`, `model`, `task`, `linear_issue`, `outcome` (success/partial/failed), `files_changed`, `retries`, `lessons_added`, `discoveries`. See `.github/customizations/logs/README.md` for the full schema.

   ```bash
   echo '{"timestamp":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'","agent":"Agent Name","model":"model-id","task":"Short description","outcome":"success","files_changed":N,"retries":0}' >> .github/customizations/logs/sessions.ndjson
   ```

   This is **mandatory** — session logging fuels the metrics dashboard (`metrics-report` prompt).

## How to Write a Lesson

### Step 1: Determine the next lesson ID

Look at the last `LES-XXX` entry in `.github/customizations/LESSONS-LEARNED.md` and increment by 1.

### Step 2: Write the entry

Add it **before** the `## Index by Category` section, following this template:

```markdown
### LES-XXX: Short descriptive title

| Field | Value |
|-------|-------|
| **Category** | `category-name` |
| **Added** | YYYY-MM-DD |
| **Severity** | `high` / `medium` / `low` |

**Problem:** What went wrong and what error/behavior was observed.

**Wrong approach:** The obvious/intuitive approach that fails (with code block).

**Correct approach:** The working solution (with code block).

**Why:** Root cause explanation (if known).
```

### Step 3: Update the index

Add the lesson ID to the appropriate category row in the `## Index by Category` table.

### Step 4: Update related instruction files (if applicable)

If the lesson reveals a gap in existing instruction/skill files, **also update those files** to include the correct approach. This prevents the pitfall at the source level, not just as a retroactive note.

Examples:
- Lesson about Linear tool → update `task-management/SKILL.md`
- Lesson about NX commands → update `nx-workspace/SKILL.md`
- Lesson about Sanity queries → update `sanity-cms/SKILL.md`
- Lesson about browser testing → update `browser-testing/SKILL.md`

## Categories

| Category | Covers |
|----------|--------|
| `linear` | Linear MCP tools, issue management, workflow states |
| `mcp-tools` | Any MCP server tool quirks (deferred loading, parameters) |
| `nx-commands` | NX CLI commands, task runner, caching |
| `terminal` | Shell commands, port management, process management |
| `next-js` | Next.js App Router, build, dev server, SSR |
| `sanity` | Sanity CMS, GROQ queries, schema deployment |
| `supabase` | Supabase auth, migrations, RLS, SQL |
| `git` | Git operations, branching, merge conflicts |
| `vercel` | Deployment, environment variables, edge config |
| `browser-testing` | E2E testing, screenshots, browser automation |
| `general` | Anything that doesn't fit above |

## Severity Guide

| Level | Meaning | Impact |
|-------|---------|--------|
| `high` | Blocks work entirely | Agent cannot proceed without the workaround |
| `medium` | Wastes 5+ minutes | Agent will eventually figure it out but wastes time |
| `low` | Minor friction | Slight annoyance, easy to work around |

## Quality Standards

- **Be specific** — include exact error messages, exact commands, exact tool parameters
- **Show both wrong and right** — the contrast is what makes lessons actionable
- **Explain why** — root cause helps agents reason about similar situations
- **Keep it concise** — one lesson per entry, no essays
- **Code blocks are mandatory** — for commands, tool calls, and configurations

## Anti-Patterns

- **Never skip reading lessons** before starting work — this is the #1 cause of repeated mistakes
- **Never "fix it and move on"** without documenting — your fix dies with your session
- **Never write vague lessons** like "Linear is tricky" — be specific about what fails and what works
- **Never duplicate existing lessons** — check the index first
- **Never wait until the end of a session** to write lessons — write them immediately when the retry succeeds

## Agent Memory Protocol

For agent expertise tracking and cross-session knowledge graphs, load the **agent-memory** skill. It covers memory templates, update triggers, retrieval protocols, and the knowledge graph format.
