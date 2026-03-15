---
name: decomposition
description: "Task decomposition patterns for the Team Lead: dependency resolution, phase assignment, delegation spec templates, prompt quality examples, and orchestration patterns."
---

# Task Decomposition

Detailed decomposition and delegation patterns for the Team Lead. **Load at:** Decompose & Partition phase (Step 2) or when writing delegation prompts (Step 3).

## Dependency Resolution

Declare dependencies between subtasks using arrow notation: `TaskB → TaskA` means B depends on A (A must finish first).

**Topological sort rules:**
1. Tasks with no dependencies go in Phase 1 (can run in parallel)
2. Tasks depending only on Phase 1 tasks go in Phase 2
3. Continue until all tasks are assigned to phases
4. Tasks in the same phase with no mutual dependencies run in parallel

**Cycle detection:** If A → B → C → A, break the cycle by: (a) finding a task that can partially complete independently, (b) splitting that task into an independent part and a dependent part.

**Visual example:**

```
Dependency Graph:        Execution Plan:
E → C → A               Phase 1: A, B (parallel)
D → B                   Phase 2: C, D (parallel, depend on Phase 1)
F → C, D                Phase 3: E, F (parallel, depend on Phase 2)
```

Always draw the dependency graph before assigning phases. Missed dependencies cause agents to block on missing inputs; redundant sequencing wastes time.

## Delegation Spec Template

For complex tasks (score 5+), generate a structured spec rather than a free-form prompt:

```
## Delegation Spec: [Task Title]

**Tracker Issue:** TAS-XX — [Title]
**Complexity:** [score]/13 → [tier] tier
**Agent:** [Agent Name]

### Objective
What to build/change and why. 1-3 sentences max.

### Context
- Key files to read first: [list]
- Related patterns to follow: [file:line references]
- Prior phase output (compacted): [summary from Context Compaction protocol if this task depends on a prior phase]
- Relevant lessons: [LES-XXX references from LESSONS-LEARNED.md]

### Constraints
- File partition: Only modify files under [paths]
- Do NOT modify: [explicit exclusions]
- Dependencies: Requires [TAS-XX] to be Done first

### Acceptance Criteria
- [ ] Criterion 1 (copied from tracker issue)
- [ ] Criterion 2
- [ ] Criterion 3

### Expected Output
Return a structured summary with:
- Files changed (path + one-line description)
- Verification results (lint/test/build pass/fail)
- Acceptance criteria status (each item ✅/❌)
- Discovered issues (if any)
- Lessons applied or added

**Note:** Follow the Structured Output Contract from the team-lead-reference skill. Include all standard fields plus agent-specific extensions.

### Self-Improvement
Read `.opencastle/LESSONS-LEARNED.md` before starting. If you retry any command/tool with a different approach that works, use the **self-improvement** skill to add a lesson immediately.
```

For simpler tasks (score 1-3), the existing prompt format (objective + files + criteria) is sufficient. Don't over-engineer delegation for trivial work.

**For sub-agents** — also specify what information to return in the result message.

**For background agents** — include full self-contained context since they cannot ask follow-up questions.

## Prompt Quality Examples

**Strong prompt (simple task, score 2):**
> "**Tracker issue:** TAS-42 — [Auth] Fix token refresh logic
> Users report 'Invalid token' errors after 30 minutes. JWT tokens are configured with 1-hour expiration in `libs/auth/src/server.ts`. Investigate why tokens expire early and fix the refresh logic. Only modify files under `libs/auth/`. Run the auth library tests to verify."

**Strong prompt (complex task, score 8):**
> Use the Delegation Spec Template above. Fill in all sections for tasks scoring 5+.

**Weak prompt:**
> "Fix the authentication bug."

## Delegation Mechanism Selection

```
                         Need result immediately?
                        /                        \
                      YES                         NO
                       |                           |
              Is it a dependency              Expected duration
              for the next step?              > 5 minutes?
                /           \                  /          \
              YES            NO              YES           NO
               |              |               |             |
          Sub-Agent      Sub-Agent       Background     Sub-Agent
          (inline)    (if small enough,   Agent        (sequential)
                       else Background)
```

## Mixed Delegation Orchestration

Combine sub-agents and background agents for maximum efficiency:

```
Phase 1 (sub-agent):     Research — gather context, identify patterns, map files
Phase 2 (background):    Foundation — DB migration + Component scaffolding (parallel)
Phase 3 (sub-agent):     Integration — wire components to data (needs Phase 2 results)
Phase 4 (background):    Validation — Security audit + Tests + Docs (parallel)
Phase 5 (sub-agent):     QA gate — verify all phases, run builds, self-review
Phase 6 (sub-agent):     Panel review — load panel-majority-vote skill for high-stakes validation
```

## Foundation-First Decomposition

When decomposing a multi-page or multi-component project, always apply the Foundation-First Pattern to maintain cross-agent consistency:

### When to apply

- Goal involves 2+ pages, views, or UI sections
- Multiple agents (same or different phase) will produce visual output
- The project doesn't have an existing design system

### Phase structure

```
Phase 1: foundation-setup
├── Creates: design tokens, layout, UI component library
├── Defines: style guide brief (aesthetic, tone, terminology)
└── All visual tasks → depends_on: [foundation-setup]

Phase 2+: page tasks (parallel)
├── Each prompt includes 5 Foundation References
└── Agents consume tokens — never create new values
```

### Partition rules for foundation

- Foundation task owns: `src/styles/`, `src/components/Layout.*`, `src/components/ui/`
- Page tasks own: their specific page file + page-specific components only
- No page task may list a foundation-owned path in its `files[]`

### Common mistake

Decomposing pages as independent Phase 1 tasks (no foundation). This produces partition-clean, dependency-valid specs that fail aesthetically — each agent invents its own design. Always add the foundation task as the root of the DAG for visual work.

> Load the **project-consistency** skill for the full Foundation Phase pattern, prompt templates, and anti-patterns.
