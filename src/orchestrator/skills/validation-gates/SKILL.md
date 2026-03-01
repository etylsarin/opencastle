---
name: validation-gates
description: "Shared validation gates for all orchestration workflows — deterministic checks, browser testing, cache management, regression checks. Referenced by prompt templates to maintain single source of truth."
---

<!-- ⚠️ This file is managed by OpenCastle. Edits will be overwritten on update. Customize in the customizations/ directory instead. -->

# Validation Gates

Canonical reference for validation gates shared across all orchestration workflows. Prompt templates reference this skill to avoid duplication.

## Gate 1: Deterministic Checks

Run for every affected NX project:

```bash
yarn nx run <project>:lint --fix
yarn nx run <project>:test
yarn nx run <project>:build
```

All must pass with zero errors. Run for **every** project that consumed modified files, not just the primary project.

## Gate 1.5: Fast Review (MANDATORY)

> **HARD GATE:** Every agent delegation output must pass fast review before acceptance. This is non-negotiable — even for overnight/unattended runs. Load the **fast-review** skill for the full procedure.

After deterministic checks (Gate 1) pass:

1. **Spawn a single reviewer sub-agent** with the review prompt from the fast-review skill
2. **On PASS** — proceed to remaining gates
3. **On FAIL** — re-delegate to the same agent with reviewer feedback (up to 2 retries)
4. **On 3x FAIL** — escalate to panel review (Gate 5)

The reviewer validates: acceptance criteria met, file partition respected, no regressions, type safety, error handling, security basics, and edge cases.

**Auto-PASS conditions** (skip the reviewer sub-agent):
- Pure research/exploration with no code changes
- Only `.md` files were modified
- All deterministic gates passed AND the change is ≤10 lines across ≤2 files

## Gate 2: Cache Clearing (BEFORE Browser Testing)

**Always clear before testing.** Testing stale code wastes time and produces false results.

```bash
rm -rf apps/<app>/.next
yarn nx reset
```

Run these commands before starting the dev server for browser testing.

## Gate 3: Browser Testing (MANDATORY for UI Changes)

> **HARD GATE:** A task with UI changes is NOT done until you have screenshots in Chrome proving the feature works. "The code looks correct" is not proof. "Tests pass" is not proof. Only a screenshot of the working UI in Chrome is proof.

1. **Start the dev server** — `yarn nx run <app>:serve` — wait for it to be ready
2. **Navigate to affected pages** — Verify the new feature renders correctly
3. **Verify SPECIFIC features** — Check every feature listed in the acceptance criteria. If the criteria say "icons, groups, and AND/OR toggle", you must see all three in the browser
4. **Test interactions** — Click buttons, fill forms, toggle filters, submit data
5. **Test responsive** — Resize to each breakpoint defined in your project's testing config
6. **Test edge cases** — Empty states, error states, loading states, long content
7. **Screenshot evidence (REQUIRED)** — Take screenshots of key states. These are mandatory proof

> **Anti-pattern:** Testing only at desktop width and assuming responsive classes work. They can be wrong — always verify at all defined breakpoints.

Load the **browser-testing** skill for Chrome MCP commands, breakpoint details, and reporting format.

## Gate 4: Regression Testing

New features must not break existing functionality:

1. **Run full test suite** for affected projects — not just the new tests
2. **Browser-test adjacent pages** — If you changed a shared component, test pages that use it
3. **Verify navigation** — Ensure routing, links, and back-button behavior still work
4. **Check shared components** — If a component from a shared library was modified, test it in all apps that consume it

## Gate 5: Panel Review (High-Stakes Only)

Use the **panel-majority-vote** skill for:

- Security-sensitive changes (auth flows, RLS policies, API endpoints)
- Database migrations that alter production data or schema
- Architecture decisions or large refactors affecting multiple libraries
- Complex business logic without comprehensive test coverage

If the panel returns BLOCK, extract MUST-FIX items, re-delegate to the same agent, and re-run the panel. Never skip, never halt. Max 3 attempts, then escalate to Architect.

## Universal Completion Checklist

Use this checklist for any orchestration workflow:

- [ ] Lint, test, and build pass for all affected projects
- [ ] **Fast review passed** (mandatory — load **fast-review** skill)
- [ ] Dev server started with **clean cache** (`rm -rf .next && yarn nx reset`)
- [ ] UI changes verified in Chrome with screenshots at all breakpoints
- [ ] Every acceptance criteria item visually confirmed — not just "page loads"
- [ ] No regressions in adjacent functionality
- [ ] Shared code changes tested across all consuming apps
- [ ] No duplicated code — shared logic extracted to libraries
- [ ] Lessons learned captured if any retries occurred
- [ ] Known issues updated if new limitations were discovered
