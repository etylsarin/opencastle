---
description: 'Handle follow-up refinements after a roadmap task — bug fixes, UI tweaks, polish, and adjustments that are too small for Linear tracking.'
agent: Team Lead
---

# Follow-Up Refinement

You are the Team Lead. Handle the follow-up refinement described below. This is a **post-task adjustment** — a bug fix, UI tweak, or polish item that came up after reviewing a completed roadmap task. It does NOT require Linear tracking.

## Request

{{followUpRequest}}

---

## How Follow-Ups Differ from Roadmap Tasks

| Aspect | Roadmap Task | Follow-Up |
|--------|-------------|-----------|
| Linear issues | Required (hard gate) | Depends on scope (see triage) |
| Panel review | For high-stakes changes | Only if security/data-related |
| Documentation updates | Roadmap + known issues + ADRs | Only if behavior changes significantly |
| Scope | Multi-step feature | Focused fix or adjustment |
| Branch strategy | Dedicated feature branch | Current branch (already in progress) |

**Despite being lighter-weight, follow-ups still require the same code quality and verification standards.** Never skip linting, testing, or browser checks just because the change is "small."

## Workflow

### 1. Triage: Decide Tracking Level

Before doing anything, decide whether this follow-up needs Linear tracking:

**Create a Linear issue if ANY of these are true:**
- The change affects user-visible behavior (not just cosmetic)
- It touches more than 2–3 files
- It modifies shared library code (`libs/`)
- It changes data queries, API routes, or Server Actions
- It could introduce regressions in other features
- You want a record for future reference (e.g., "why was this changed?")

**Skip Linear if ALL of these are true:**
- Pure cosmetic/spacing/copy tweak
- Isolated to a single component or page
- No behavioral change
- Trivial to verify visually

If creating a Linear issue, use:
- **Title**: `[Follow-up] Short description`
- **Label**: agent name + `follow-up`
- **Priority**: Low or Medium
- **Description**: What changed, why, and which files

### 2. Understand the Request

Before touching any code:

1. **Clarify scope** — Identify exactly which pages, components, or behaviors need to change
2. **Find affected files** — Search the codebase for the relevant components, styles, queries, and tests
3. **Check known issues** — Scan `docs/KNOWN-ISSUES.md` in case this is a documented limitation
4. **Read lessons learned** — Check `.github/customizations/LESSONS-LEARNED.md` for relevant pitfalls before starting
5. **Assess complexity** — If the request turns out to be larger than expected (touches >5 files, needs a migration, or affects auth/security), escalate it:
   - Inform the user that this should be a tracked task
   - Create a Linear issue (if not already created in triage) and switch to the `implement-feature` workflow

### 3. Plan the Fix

Think before you act:

1. **Identify root cause** — For bugs, find why it happens, not just where. For UI tweaks, understand the current styling/layout chain
2. **Check for shared impact** — Will the fix affect other pages or apps? Check component usage across the codebase
3. **Determine the minimal change** — Follow the principle of least surprise. Change only what's necessary
4. **Reuse existing patterns** — Use components, utilities, and styles that already exist in the codebase. Never introduce a new pattern for a one-off fix

### 4. Implement

Delegate to the appropriate specialist agent(s). Since follow-ups are scoped and focused, prefer **sub-agents** (inline) over background agents.

#### Delegation Prompt Must Include

- **What to fix** — clear description of the problem and desired outcome
- **Where** — exact file paths to read and modify
- **How to verify** — what the result should look like or how to test it
- **Boundaries** — "Only modify files listed above. Do not refactor unrelated code."
- **Self-improvement reminder** — include per `general.instructions.md` § Self-Improvement Protocol

#### Implementation Rules

- **No scope creep** — Fix what was asked. If you notice other issues, note them but don't fix them in this pass
- **DRY** — Search before creating. Reuse existing components and utilities
- **Visual consistency** — Match the existing design system (spacing, colors, typography)
- **Cross-app check** — If the change is in shared code (`libs/`), verify it works for both apps
- **Accessibility** — Don't regress keyboard navigation, screen reader support, or contrast ratios

### 5. Validate

> Load the **validation-gates** skill for detailed steps on each gate.

Every follow-up, no matter how small, must pass these checks:

1. **Deterministic Checks** — `yarn nx run <project>:lint --fix`, `:test`, `:build` — all zero errors
2. **Browser Testing** (MANDATORY for any visual change) — clear cache, start server, verify scenario + responsive + screenshot evidence
3. **Regression Check** — if shared component/library modified, run tests for all consuming projects and browser-test at least one page per affected app

### 6. Delivery

If triage determined this follow-up needs Linear tracking, follow the **Delivery Outcome** defined in `general.instructions.md` — commit, push, open PR (not merged), and link to Linear.

If triage determined no Linear tracking is needed (pure cosmetic/isolated/trivial), commit the changes to the current working branch. A dedicated branch and PR are not required because the Team Lead will include these changes in the parent task's existing PR — the "every change goes through a PR" rule is still satisfied via the parent PR.

### 7. Escalation Triggers

Stop the follow-up workflow and switch to a full roadmap task if:

- The fix requires a **database migration**
- The fix involves **authentication or authorization** changes
- The fix touches **more than 5 files** across multiple libraries
- The fix introduces a **new dependency** or **new API endpoint**
- The fix changes **data models** (CMS schemas, database tables)
- You discover the "small fix" is actually a **systemic issue** requiring architectural changes

When escalating, explain to the user what you found and why it needs proper tracking.

### 8. Completion

The follow-up is complete when:

- [ ] The specific request is resolved
- [ ] Linear issue created and moved to Done (if triage determined tracking was needed)
- [ ] Lint, test, and build pass for all affected projects
- [ ] **Dev server started with CLEAN cache** (`rm -rf .next && yarn nx reset` before serving)
- [ ] **Visual changes verified in Chrome with screenshot taken as proof**
- [ ] No regressions in adjacent functionality
- [ ] Shared component changes tested across all consuming apps
- [ ] Delivery Outcome completed if tracked (see `general.instructions.md`) — branch pushed, PR opened (not merged), Linear linked
- [ ] Lessons learned captured if any retries occurred
- [ ] Known issues updated if a new limitation was discovered
