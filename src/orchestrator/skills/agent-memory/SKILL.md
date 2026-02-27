---
name: agent-memory
description: "Agent expertise tracking and cross-session knowledge graph. Use when delegating tasks to track agent strengths/weaknesses, or when building context about file relationships and patterns."
---

# Agent Memory Protocol

## Purpose

Track which agents have expertise with which files, patterns, and tools across sessions. This information helps the Team Lead make better delegation decisions by matching tasks to agents with proven track records.

## Expertise File

Location: `.github/customizations/AGENT-EXPERTISE.md` — a structured record of agent performance per domain.

Template structure:

```markdown
# Agent Expertise Registry

## Developer
### Strong Areas
| Area | Evidence | Last Updated |
|------|----------|-------------|
| Feature implementation | Successfully built 5 pages (TAS-XX, TAS-YY) | YYYY-MM-DD |
| Server-side logic | Fixed auth flow (TAS-ZZ) | YYYY-MM-DD |

### Weak Areas
| Area | Evidence | Last Updated |
|------|----------|-------------|
| CSS Modules | Required 2 retries on styling task (TAS-AA) | YYYY-MM-DD |

### File Familiarity
- `apps/tastebeer.eu/app/places/` — 3 tasks completed
- `libs/queries/src/lib/` — 2 tasks completed
```

## Memory Update Triggers

| Trigger | Action |
|---------|--------|
| Agent completes task successfully on first attempt | Add/update Strong Area entry |
| Agent requires 2+ retries | Add/update Weak Area entry |
| Agent modifies a file | Update File Familiarity count |
| Agent fails a task entirely (DLQ) | Add Weak Area with failure reference |
| >3 months since last update in an area | Mark as "stale" — needs re-evaluation |

## Memory Retrieval Protocol

1. Before delegating, check `.github/customizations/AGENT-EXPERTISE.md` for the candidate agent
2. If the task matches a Strong Area, include in the prompt: *"You have prior experience with [area] from [TAS-XX]. Apply the same patterns."*
3. If the task matches a Weak Area, either: (a) add extra context to the prompt to compensate, or (b) consider a different agent
4. If the file has high familiarity, mention it: *"You've worked on [file] before in [TAS-XX]."*

## Memory Pruning Rules

- Remove entries older than 6 months without recent updates
- Consolidate similar entries (e.g., 5 "App Router pages" entries → 1 entry with count)
- Remove File Familiarity entries for files that no longer exist
- The Team Lead should prune at the start of major feature work (not every session)

## Integration with Delegation

Add relevant expertise context to delegation prompts. Example addition:

```
### Agent Context (from expertise registry)
- Strong: Server Components, GROQ queries (3 successful tasks)
- Weak: CSS Modules (1 retry on TAS-AA)
- Familiar files: libs/queries/src/lib/search/ (2 tasks)
```

## Cross-Session Knowledge Graph

### Purpose

Capture structured relationships between concepts, files, agents, and decisions. Goes beyond flat lesson lists to show how pieces of the system connect.

### Entity Types

| Entity Type | Examples | Notation |
|-------------|----------|----------|
| `File` | `libs/queries/src/lib/search/searchModule.ts` | `F:path` |
| `Agent` | Developer, Security Expert | `A:name` |
| `Pattern` | Server Component data fetching, RLS policy structure | `P:name` |
| `Decision` | "Use Jotai over Redux" (from DECISIONS.md) | `D:name` |
| `Bug` | Known issue KI-XXX | `B:id` |
| `Lesson` | LES-XXX from LESSONS-LEARNED.md | `L:id` |

### Relationship Types

| Relationship | Meaning | Example |
|-------------|---------|---------|
| `depends-on` | X requires Y to function | `F:places/page.tsx depends-on F:searchModule.ts` |
| `caused-by` | X was caused by Y | `B:KI-042 caused-by D:use-server-components` |
| `expert-in` | Agent X has expertise in Y | `A:Content Engineer expert-in P:GROQ-queries` |
| `related-to` | Loose conceptual connection | `L:LES-15 related-to P:RLS-policies` |
| `obsoletes` | X replaces/supersedes Y | `D:use-app-router obsoletes D:use-pages-router` |
| `blocks` | X prevents Y from working | `B:KI-099 blocks F:auth/middleware.ts` |

### Knowledge Graph File

Location: `.github/customizations/KNOWLEDGE-GRAPH.md` — an append-only relationship log.

Template structure:

```markdown
# Knowledge Graph

## Relationships

| Source | Relationship | Target | Added | Context |
|--------|-------------|--------|-------|---------|
| A:Security Expert | expert-in | P:RLS-policies | 2026-02-23 | Completed 3 RLS audits |
| F:searchModule.ts | depends-on | F:sanity-client.ts | 2026-02-23 | Search uses Sanity client |
| L:LES-15 | related-to | P:cookie-sessions | 2026-02-23 | Lesson about auth token format |
```

### When to Add Relationships

| Trigger | What to Record |
|---------|---------------|
| Agent completes a task touching multiple files | `depends-on` between the files |
| A lesson is added that relates to a pattern | `related-to` between lesson and pattern |
| An agent demonstrates expertise | `expert-in` between agent and domain |
| A decision causes a known issue | `caused-by` between bug and decision |
| A new pattern supersedes an old approach | `obsoletes` between decisions/patterns |

### Query Patterns

When gathering context for a delegation:

1. Find the target file(s) in the graph
2. Follow `depends-on` edges to identify related files the agent might need to read
3. Follow `expert-in` edges to confirm the right agent is assigned
4. Follow `related-to` edges from relevant lessons to discover applicable patterns
5. Check for `blocks` edges that might indicate known issues affecting the task

### Maintenance Rules

- Add relationships as you discover them — don't batch
- Review and prune at the start of major features (remove obsolete relationships)
- Keep the graph focused — max ~100 active relationships. Archive old ones quarterly
- Relationships are append-only during a session; pruning happens between sessions
