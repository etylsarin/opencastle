---
name: self-improvement
description: "Protocol for reading and updating the lessons-learned knowledge base. MUST be followed by ALL agents — read lessons before work, write lessons after retries. This makes the agent team self-improving across sessions."
---

<!-- ⚠️ This file is managed by OpenCastle. Edits will be overwritten on update. Customize in the .github/customizations/ directory instead. -->

# Self-Improvement Protocol

This skill defines how agents learn from mistakes and share knowledge so the same pitfalls are never repeated.

## Core Principle

**If you retry something with a different approach and it works, document the lesson immediately.** The cost of writing a lesson (2 minutes) is always less than the cost of someone else hitting the same pitfall (5-30 minutes).

## The Lessons File

Location: `.github/customizations/LESSONS-LEARNED.md`

This is the team's collective memory — a structured log of tool/command pitfalls, workarounds, and correct approaches discovered through execution.

## Protocol for All Agents

The core protocol (read lessons → write on retry → log session) is defined in `general.instructions.md` § Self-Improvement Protocol. This skill provides the detailed reference material for writing lessons.

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
- Lesson about task tracker tools → update the skill mapped by the `task-management` slot in the skill matrix
- Lesson about codebase-tool commands → update the skill mapped by the `codebase-tool` slot in the skill matrix
- Lesson about CMS queries → update the skill mapped by the `cms` slot in the skill matrix
- Lesson about browser testing → update the skill mapped by the `e2e-testing` slot in the skill matrix

## Categories

| Category | Covers |
|----------|--------|
| `task-management` | Task tracker tools, issue management, workflow states |
| `jira` | Jira MCP tools (Atlassian Rovo), issue management, workflows |
| `mcp-tools` | Any MCP server tool quirks (deferred loading, parameters) |
| `codebase-tool` | Task runner CLI commands, caching, build tools |
| `terminal` | Shell commands, port management, process management |
| `framework` | App framework, build, dev server, SSR |
| `cms` | CMS content queries, schema deployment |
| `database` | Database auth, migrations, RLS, SQL |
| `git` | Git operations, branching, merge conflicts |
| `deployment` | Deployment, environment variables, edge config |
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
- **Never write vague lessons** like "the tracker is tricky" — be specific about what fails and what works
- **Never duplicate existing lessons** — check the index first
- **Never wait until the end of a session** to write lessons — write them immediately when the retry succeeds

## Agent Memory Protocol

For agent expertise tracking and cross-session knowledge graphs, load the **agent-memory** skill. It covers memory templates, update triggers, retrieval protocols, and the knowledge graph format.
