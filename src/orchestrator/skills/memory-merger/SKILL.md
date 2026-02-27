---
name: memory-merger
description: "Protocol for graduating mature lessons from LESSONS-LEARNED.md into permanent instruction and skill files. Closes the self-improvement loop by codifying validated knowledge at the source level."
---

# Skill: Memory Merger

This skill automates the final step of the self-improvement cycle: promoting validated lessons into the instruction and skill files where they have structural, permanent impact.

## Why Merge?

`.github/customizations/LESSONS-LEARNED.md` is a flatfile that grows over time. Lessons buried in a 400+ line file lose their impact — agents skim past them or miss relevant entries. The most valuable lessons should **graduate** into the instruction/skill files where they're encountered naturally during every task.

## When to Run

Invoke a memory merge when:

- **LESSONS-LEARNED.md exceeds 50 entries** — periodic cleanup
- **A lesson has been cited 3+ times** — it's clearly a recurring pattern
- **A lesson is older than 60 days** — mature enough to be considered stable
- **After a major feature ships** — good checkpoint to extract patterns
- **Team Lead's discretion** — any time the lessons file feels stale

## Merge Protocol

### Step 1: Scan for Merge Candidates

Read `.github/customizations/LESSONS-LEARNED.md` and identify lessons that meet any of these criteria:

| Criterion | Signal |
|-----------|--------|
| **High frequency** | Cited or re-discovered 3+ times |
| **High severity** | Marked `high` severity |
| **Age** | Added more than 60 days ago and still relevant |
| **Category concentration** | 5+ lessons in the same category → extract a pattern |
| **Tool-specific** | Lesson about a specific MCP tool, NX command, or framework pattern |

### Step 2: Map Lessons to Target Files

Each lesson has a natural home in the instruction/skill hierarchy:

| Lesson Category | Target File |
|----------------|-------------|
| `linear` | `.github/skills/task-management/SKILL.md` |
| `mcp-tools` | The corresponding agent file or skill that uses the tool |
| `nx-commands` | `.github/skills/nx-workspace/SKILL.md` |
| `sanity` | `.github/skills/sanity-cms/SKILL.md` |
| `supabase` | `.github/skills/supabase-database/SKILL.md` |
| `browser-testing` | `.github/skills/browser-testing/SKILL.md` |
| `git-workflow` | `.github/instructions/general.instructions.md` |
| `deployment` | `.github/skills/deployment-infrastructure/SKILL.md` |
| `delegation` | `.github/agents/team-lead.agent.md` or `.github/skills/team-lead-reference/SKILL.md` |
| `testing` | `.github/skills/testing-workflow/SKILL.md` |
| `react` / `nextjs` | Corresponding global skill file |
| Cross-cutting pattern | `.github/instructions/general.instructions.md` |

### Step 3: Draft the Merge

For each candidate lesson, draft a concrete edit to the target file:

```markdown
**Lesson:** LES-XXX — [title]
**Target:** [target file path]
**Section:** [which section to add to or modify]
**Edit:** [exact text to add or modify]
**Rationale:** [why this belongs here rather than staying in lessons]
```

#### Merge Strategies

- **Add a rule** — if the lesson reveals a new "always do X" or "never do Y", add it to the target file's rules section
- **Add an anti-pattern** — if the lesson describes a common mistake, add it to an anti-patterns or "Common Mistakes" section
- **Add a code example** — if the lesson includes a correct approach with a code block, add it as a documented pattern
- **Expand existing rule** — if a rule already exists but the lesson adds nuance (edge case, exception), update the rule
- **Add a table row** — if the target has a reference table, add the lesson as a new row

### Step 4: Apply Edits

1. Edit each target file with the drafted changes
2. Add a comment or note attributing the source: `<!-- Merged from LES-XXX -->`
3. Verify the edit reads naturally in context (not just pasted in)

### Step 5: Archive the Merged Lessons

Move merged lessons from the main body of `LESSONS-LEARNED.md` to an `## Archived (Merged)` section at the bottom of the file:

```markdown
## Archived (Merged)

Lessons below have been merged into instruction/skill files. They are kept here for historical reference.

### LES-XXX: [title] → Merged to `[target file]` on YYYY-MM-DD
```

**Do NOT delete lessons.** Archive them so they remain searchable and traceable.

### Step 6: Update the Index

Update the `## Index by Category` table in `LESSONS-LEARNED.md` to reflect which lessons are now archived.

## Quality Gates

Before finalizing a merge:

- [ ] The merged content reads naturally in the target file (not copy-pasted)
- [ ] The target file's structure and tone are preserved
- [ ] No duplicate information created (check if a similar rule already exists)
- [ ] The archived lesson references the target file
- [ ] The lesson's core insight is preserved — don't lose nuance when summarizing

## Anti-Patterns

- **Don't merge too eagerly** — a lesson needs to prove itself (3+ citations or 60+ days) before graduating
- **Don't copy verbatim** — lessons are written as incident reports; instruction files should read as rules/guidelines
- **Don't merge conflicting lessons** — if two lessons contradict, resolve the conflict first
- **Don't merge without context** — if the lesson only makes sense with the full story, either include enough context in the target file or keep it in LESSONS-LEARNED.md
- **Don't create new files for merged content** — merge INTO existing files; only create new skills if a genuinely new domain emerges

## Frequency

- **Quarterly review** — schedule a full scan of LESSONS-LEARNED.md every ~3 months
- **Post-feature review** — after major features ship, scan for relevant lessons
- **Ad-hoc** — any time an agent notices "this lesson should be a permanent rule"
