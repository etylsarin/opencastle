---
description: 'Collaborative brainstorm to explore requirements, approaches, and trade-offs BEFORE committing to a plan. Use when the task has ambiguity, multiple valid approaches, or significant design decisions.'
agent: Team Lead
---

<!-- ⚠️ This file is managed by OpenCastle. Edits will be overwritten on update. Customize in the customizations/ directory instead. -->

# Brainstorm

You are the Team Lead. Before planning or writing any code, run a structured brainstorm to explore the request described below. The goal is to **surface assumptions, alternative approaches, and trade-offs** before locking in a plan.

## Request

{{request}}

---

## Why Brainstorm?

Planning too early locks in assumptions. A brainstorm phase catches misunderstandings, reveals better approaches, and aligns on scope — paying for 10 minutes of thinking instead of hours of rework.

## Workflow

### 1. Clarify the Problem

Before exploring solutions, make sure the problem is well-understood:

1. **Restate the request** in your own words — verify you understand what's being asked
2. **Identify the user's goals** — what outcome do they want? (not just what they asked for)
3. **Surface assumptions** — what are you assuming about scope, constraints, and priorities?
4. **Ask clarifying questions** — if anything is ambiguous, ask now (max 3 questions, batch them)

### 2. Explore the Solution Space

Research before proposing. Gather data, don't guess:

1. **Search existing code** — is there already a partial implementation, similar pattern, or relevant utility?
2. **Check documentation** — read `docs/PROJECT.md`, `docs/DECISIONS.md`, `docs/KNOWN-ISSUES.md` for constraints
3. **Check lessons learned** — read `.github/customizations/LESSONS-LEARNED.md` for pitfalls in this area
4. **Identify affected layers** — which apps, libs, data stores, and third-party services are involved?

### 3. Generate Alternatives

Propose 2-3 approaches, not just the obvious one:

| Approach | Description | Pros | Cons | Effort |
|----------|-------------|------|------|--------|
| A | ... | ... | ... | S/M/L |
| B | ... | ... | ... | S/M/L |
| C | ... | ... | ... | S/M/L |

For each approach, consider:
- **Simplicity** — which is the boring, proven solution? (prefer this per Constitution #2)
- **Reversibility** — which is easiest to undo if wrong?
- **Impact on future work** — which makes the next task easier or harder?
- **Risk** — which has the most unknowns?

### 4. Evaluate Trade-offs

Pick the recommended approach and defend it:

1. **Why this approach?** — articulate the key reason (1-2 sentences)
2. **What are we giving up?** — name the trade-off explicitly
3. **What could go wrong?** — the biggest risk and how to mitigate it
4. **What's the exit strategy?** — if this approach fails, what's plan B?

### 5. Define Scope

Draw a clear boundary:

- **In scope:** What this task will deliver
- **Out of scope:** What it explicitly will NOT do (and why)
- **Deferred:** What could be done later as a follow-up

### 6. Output

Summarize the brainstorm as a **Brainstorm Report** — this becomes the input for the planning/decomposition phase:

```markdown
## Brainstorm Report: [Title]

**Request:** One-sentence summary
**Recommended Approach:** [A/B/C] — [one-sentence rationale]
**Trade-off:** [what we're giving up]
**Risk:** [biggest risk + mitigation]

### Scope
- **In:** [list]
- **Out:** [list]
- **Deferred:** [list]

### Affected Areas
- Apps: [list]
- Libs: [list]
- Data: [which data layers are affected — see `project.instructions.md` for the tech stack]
- Routes: [list]

### Open Questions
- [Any unresolved questions for the user]
```

## When to Skip Brainstorming

Not every task needs a brainstorm. Skip this prompt and go directly to `implement-feature` or `quick-refinement` when:

- The task is a well-defined bug with clear reproduction steps
- The task is a simple config change or docs update
- The technical approach is obvious and unambiguous
- The scope is a single file or component with no design decisions

## After Brainstorming

Once the brainstorm is complete and the user confirms (or you're confident in the approach):

1. **Transition to planning** — use the brainstorm report as input for `implement-feature` or the appropriate workflow
2. **Preserve context** — include the brainstorm report in delegation prompts so agents understand *why* an approach was chosen
3. **Reference in Linear** — link the brainstorm findings in the Linear issue description
