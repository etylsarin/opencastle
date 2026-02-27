---
name: context-map
description: "Generate a structured file impact map before making changes. Identifies all files that will be affected, their relationships, and cascade effects — improving file partitioning for parallel work and reducing unexpected side effects."
---

# Skill: Context Map

Generate a structured **file impact map** before any code changes begin. This map identifies all files that will be touched, their relationships, and cascade effects — directly improving the Team Lead's file partitioning for parallel agents.

## When to Use

- Before **every feature implementation** (Phase 1: Research)
- Before **refactoring** (Phase 1: Scope & Baseline)
- Before **schema changes** that cascade through queries and components
- Before **any task touching shared libraries** (`libs/`)
- Optional for isolated bug fixes affecting 1-2 files

## How to Generate a Context Map

### Step 1: Identify the Entry Points

Start from the task description and identify the primary files that MUST change:

```
Entry Points:
- [file path] — [why it must change]
- [file path] — [why it must change]
```

### Step 2: Trace Dependencies (Outward)

For each entry point, trace what depends on it:

1. **Imports** — what files import this module? (`grep_search` or `list_code_usages`)
2. **Type consumers** — what files use types/interfaces defined here?
3. **Route references** — what pages render this component?
4. **Query consumers** — what components or pages call this query?
5. **Test files** — what test files cover this code?

### Step 3: Trace Sources (Inward)

For each entry point, trace what it depends on:

1. **Data sources** — which Sanity schemas, GROQ queries, or Supabase tables feed this code?
2. **Shared utilities** — which `libs/` modules does it use?
3. **Configuration** — which config files affect its behavior?

### Step 4: Build the Map

Produce a structured map in this format:

```markdown
## Context Map: [Task Name]

### Entry Points (MUST change)
| File | Reason | Owner |
|------|--------|-------|
| `libs/queries/src/lib/places.ts` | Add new query field | Content Engineer |
| `libs/ui-kit/src/lib/components/PlaceCard/` | Display new field | UI/UX Expert |

### Cascade Effects (WILL change)
| File | Triggered By | Reason | Owner |
|------|-------------|--------|-------|
| `apps/tastebeer.eu/app/places/page.tsx` | PlaceCard change | Update props | Frontend Dev |
| `apps/tastecoffee.eu/app/places/page.tsx` | PlaceCard change | Update props | Frontend Dev |
| `libs/queries/src/lib/__tests__/places.test.ts` | Query change | Update test | Testing Expert |

### Shared Boundaries (WATCH for conflicts)
| File | Risk | Mitigation |
|------|------|------------|
| `libs/ui-kit/src/lib/index.ts` | Barrel export — may conflict | Merge sequentially |

### Unaffected (explicitly safe)
| Area | Why |
|------|-----|
| `supabase/migrations/` | No DB changes |
| `libs/supabase-auth/` | No auth changes |
| `apps/cms-studio/` | No schema changes |
```

### Step 5: Derive File Partitions

From the context map, assign file ownership to agents:

```
Agent A (Content Engineer):    libs/queries/src/lib/places.ts
Agent B (UI/UX Expert):     libs/ui-kit/src/lib/components/PlaceCard/
Agent C (Frontend Dev):      apps/tastebeer.eu/app/places/, apps/tastecoffee.eu/app/places/
Agent D (Testing Expert):   **/*test*, **/*spec*
```

**Rules:**
- No file appears in two partitions
- Shared boundaries are assigned to ONE agent and merged first
- Test files belong to the Testing Expert unless tightly coupled to a specific change

## Context Map Depth Levels

Scale the depth to the task complexity:

| Task Complexity | Depth | What to Trace |
|----------------|-------|---------------|
| **Small** (1-3 files) | Entry points only | Direct imports/exports |
| **Medium** (4-8 files) | Entry + cascade | 1 hop of dependencies |
| **Large** (9+ files) | Full map | Complete dependency graph |

## Integration with Team Lead Workflow

The context map is produced in **Phase 1 (Research)** and consumed by:

1. **Decomposition (Step 2)** — the map directly informs file partitions
2. **Delegation prompts** — include the relevant section of the map so agents know their boundaries
3. **Verification (QA Gate)** — compare actual changed files against the map to detect scope creep

### Including in Delegation Prompts

```markdown
## Your File Partition (from Context Map)

You own these files — modify only these:
- `libs/queries/src/lib/places.ts`
- `libs/queries/src/lib/__tests__/places.test.ts`

Do NOT modify:
- `libs/ui-kit/` (owned by UI/UX Expert)
- `apps/` (owned by Developer)
```

## Anti-Patterns

- **Skipping the map for "obvious" tasks** — even small tasks can have unexpected cascades in shared libraries
- **Mapping without searching** — don't guess dependencies; use `grep_search`, `list_code_usages`, and import tracing
- **Over-mapping** — for a 2-file bug fix, don't trace the entire dependency graph. Match depth to complexity
- **Stale maps** — if the plan changes during execution, update the map. A stale map is worse than no map
- **Mapping files you won't change** — the "Unaffected" section is for explicitly noting what's safe, not for cataloging the entire codebase
