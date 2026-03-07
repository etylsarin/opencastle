---
description: 'Investigate and fix a reported bug with proper triage, root cause analysis, issue tracking, and verification.'
agent: 'Team Lead (OpenCastle)'
---

<!-- ⚠️ This file is managed by OpenCastle. Edits will be overwritten on update. Customize in the .github/customizations/ directory instead. -->

# Fix Bug

You are the Team Lead. Investigate and fix the bug described below. Bugs are real defects that affect users — treat them seriously with proper triage, tracking, and verification.

## Bug Report

{{bugDescription}}

---

> **Canonical workflow:** `.github/agent-workflows/bug-fix.md` defines the phase structure. This prompt expands each phase with delegation-specific detail. If the two diverge, update the workflow first (SSOT) then sync the prompt.

## How Bug Fixes Differ from Other Workflows

| Aspect | Roadmap Task | Follow-Up | Bug Fix |
|--------|-------------|-----------|---------|
| Issue tracking | Required | Not required | **Required** |
| Urgency | Planned | Low | Can be critical |
| Root cause analysis | Feature design | Not needed | **Required** |
| Reproduction steps | N/A | N/A | **Required** |
| Panel review | High-stakes only | Rarely | If security-related |
| Documentation | Roadmap + ADRs | Minimal | Known issues if needed |
| Scope | Multi-step feature | Focused tweak | Focused fix |

## Workflow

### 1. Triage & Reproduce

Before fixing anything, understand the bug:

1. **Check known issues** — Search `.github/customizations/KNOWN-ISSUES.md` for an existing entry. If found, note workarounds and decide if a fix is now feasible
2. **Check tracker** — Search for existing bug tickets. If one exists, take it over instead of creating a duplicate
3. **Read lessons learned** — Check `.github/customizations/LESSONS-LEARNED.md` for related pitfalls
4. **Reproduce the bug** — Start the dev server and confirm you can trigger the issue:
   - Start the dev server (see the **codebase-tool** skill for the serve command)
   - Navigate to the affected page in Chrome
   - Follow the reproduction steps from the bug report
   - Take a screenshot of the broken state as evidence
5. **Determine scope** — Which apps are affected? (see `project.instructions.md` for the app inventory)
6. **Assess severity**:
   - **Critical** — App crashes, data loss, auth bypass, page won't load
   - **High** — Feature broken but workaround exists, significant UI breakage
   - **Medium** — Minor functional issue, cosmetic but noticeable
   - **Low** — Edge case, minor visual glitch

### 2. Create Tracker Issue

Every bug gets tracked. Create a tracker issue with:

- **Title**: `[Bug] Short description of the symptom`
- **Label**: `bug`
- **Priority**: Based on severity assessment above
- **Description**:
  - **Symptom**: What the user sees
  - **Reproduction steps**: Exact steps to trigger
  - **Expected behavior**: What should happen
  - **Actual behavior**: What happens instead
  - **Affected apps**: which apps from the project inventory
  - **Affected files** (once identified): File paths for the partition
  - **Screenshot**: Link or description of the broken state

### 3. Root Cause Analysis

Find WHY the bug happens, not just WHERE:

1. **Search the codebase** — Find the components, queries, styles, and logic involved
2. **Trace the data flow** — Follow the data from source (CMS/database) → query → component → render
3. **Check recent changes** — Use `git log` on suspected files to see if a recent commit introduced the issue
4. **Identify the root cause** — Distinguish between:
   - **Code bug** — Logic error, wrong condition, missing null check
   - **Data issue** — Unexpected data shape, missing field, bad reference
   - **Race condition** — Timing issue, hydration mismatch, async ordering
   - **CSS/Layout** — Specificity conflict, missing responsive rule, overflow
   - **Integration** — API contract mismatch, schema drift, stale cache
5. **Update the tracker issue** — Add root cause findings and affected file paths

### 4. Implement the Fix

Delegate to the appropriate specialist agent via **sub-agent** (inline). For bugs that are clearly isolated and well-understood, a single delegation is usually sufficient.

#### Delegation Prompt Must Include

- **Tracker issue ID and title** — e.g., `TAS-XX — [Bug] Description`
- **Root cause** — What's wrong and why
- **Fix approach** — How to fix it (be specific)
- **File paths** — Exact files to read and modify
- **Reproduction steps** — So the agent can verify the fix
- **Boundaries** — "Only modify files listed above. Fix the bug, do not refactor surrounding code."
- **Self-improvement reminder** — include per the **self-improvement** skill

#### Implementation Rules

- **Minimal change** — Fix the bug with the smallest correct change. Resist the urge to refactor
- **Fix the cause, not the symptom** — A CSS `!important` or silent `catch {}` is not a fix
- **DRY** — If the fix involves logic that exists elsewhere, reuse it
- **Add a test** — If no test covers this scenario, add one. Bugs that aren't tested come back
- **Cross-app awareness** — If the fix is in shared code (`libs/`), verify it works for both apps

### 5. Validate

> Load the **validation-gates** skill for detailed steps on each gate.

Every bug fix must pass ALL applicable gates:

1. **Gate 1: Secret Scanning** — scan diff for API keys, tokens, passwords, connection strings — block immediately if found
2. **Gate 2: Deterministic Checks** — run lint, test, and build for all affected projects (see the **codebase-tool** skill for commands) — all zero errors
3. **Gate 3: Blast Radius Check** — verify the fix is minimal and scoped (bug fixes should be ≤100 lines, ≤3 files; escalate if larger)
4. **Gate 4: Dependency Audit** (when `package.json` or lockfiles change) — vulnerability scan, license check, bundle size, duplicates
5. **Gate 5: Fast Review** (MANDATORY) — single reviewer sub-agent validates the fix. No auto-PASS for sensitive files
6. **Gate 6: Bug-Specific Verification** (MANDATORY) — start dev server, reproduce original bug (should be gone), verify correct behavior, test edge cases, screenshot before/after, check both apps if shared code
7. **Gate 7: Browser Testing** (for UI-related bugs) — clear cache, start server, verify fix + responsive + screenshots
8. **Gate 8: Regression Testing** — run tests for all projects consuming modified files, browser-test adjacent functionality
9. **Gate 9: Panel Review** (only if needed) — use **panel-majority-vote** skill if fix touches auth/authorization, RLS, security headers/CSP, or sensitive data

### 6. Delivery

Follow the **Delivery Outcome** defined in the **git-workflow** skill — commit, push, open PR (not merged), and link to the tracker.

### 7. Wrap Up

1. **Move tracker issue to Done** — Only after all validation passes
2. **Update Known Issues** — If this was a documented known issue, remove or update the entry in `.github/customizations/KNOWN-ISSUES.md`
3. **Capture lessons** — If the root cause reveals a pattern that other agents should know about, use the **self-improvement** skill to add a lesson
4. **Note prevention** — If this class of bug could be caught earlier (by a lint rule, test, or type check), note that in the tracker issue as a follow-up suggestion

### 8. Completion Criteria

The bug fix is complete when:

- [ ] Bug is reproduced and root cause identified
- [ ] Tracker issue created with full details
- [ ] Fix implemented with minimal change
- [ ] Test added covering the bug scenario
- [ ] Lint, test, and build pass for all affected projects
- [ ] Bug verified fixed in the browser
- [ ] No regressions in adjacent functionality
- [ ] Both apps checked if shared code was modified
- [ ] Delivery Outcome completed (see the **git-workflow** skill) — branch pushed, PR opened (not merged), tracker linked
- [ ] Tracker issue moved to Done
- [ ] Known issues updated if applicable
- [ ] Lessons learned captured if any retries occurred
