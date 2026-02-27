# Workflow: Code Refactoring

Structured workflow for safe code refactoring — improving code quality without changing behavior.

## Phases

```
Phase 1: Scope & Baseline       (sub-agent, inline)
Phase 2: Test Coverage Gap       (sub-agent or background)
Phase 3: Refactor Implementation (sub-agent or background)
Phase 4: Verification            (sub-agent, inline)
Phase 5: Panel Review            (sub-agent, for large refactors)
Phase 6: Compound                (direct, Team Lead)
```

---

## Branch & Delivery Strategy

Follow the **Delivery Outcome** in `general.instructions.md` and the **Branch Ownership** rules in `team-lead.agent.md`. Branch naming: `refactor/<ticket-id>-<short-description>`.

---

## Phase 1: Scope & Baseline

**Agent:** Team Lead (self)
**Type:** Direct research

### Steps

1. Identify all files and modules in scope for refactoring
2. Document current behavior (screenshots, test outputs, API responses)
3. Run baseline tests: `yarn nx run <project>:test --coverage`
4. Run baseline lint: `yarn nx run <project>:lint`
5. Record baseline metrics (test count, coverage %, lint errors, bundle size)
6. Create Linear issues for the refactoring scope

### Exit Criteria

- [ ] Scope documented with file list
- [ ] Baseline metrics recorded
- [ ] Linear issues created

---

## Phase 2: Test Coverage Gap

**Agent:** Testing Expert
**Type:** Sub-agent (inline) or background

### Steps

1. Analyze test coverage for all files in scope
2. Write missing tests to cover existing behavior BEFORE refactoring
3. Ensure every function/component being refactored has test coverage
4. Run full test suite to confirm all new tests pass

### Exit Criteria

- [ ] All in-scope code has test coverage for existing behavior
- [ ] No test failures
- [ ] Coverage report saved

---

## Phase 3: Refactor Implementation

**Agent:** Appropriate specialist (Developer, UI/UX Expert, etc.)
**Type:** Sub-agent or background (depending on scope)

### Steps

1. Apply refactoring changes following project conventions
2. Maintain all existing public APIs and behavior
3. Run lint and type-check after each significant change
4. Commit atomic changes (one concern per commit when possible)

### File Partition

The refactoring agent owns only the scoped files. No changes outside the partition.

### Exit Criteria

- [ ] Refactoring complete per scope
- [ ] No lint or type errors
- [ ] All tests still pass (same count, same behavior)

---

## Phase 4: Verification

**Agent:** Team Lead (self) + Testing Expert
**Type:** Sub-agent (inline)

### Steps

1. Run full test suite: `yarn nx run <project>:test`
2. Run lint: `yarn nx run <project>:lint`
3. Run build: `yarn nx run <project>:build`
4. Compare metrics against Phase 1 baseline (test count, coverage, bundle size)
5. For UI refactors: start dev server and visually verify at all breakpoints
6. Verify no regressions in dependent code

### Exit Criteria

- [ ] All tests pass (count >= baseline)
- [ ] Coverage >= baseline
- [ ] No new lint errors
- [ ] Build succeeds
- [ ] visual verification passed (for UI changes)

---

## Phase 5: Panel Review (Large Refactors)

**Agent:** Panel (3 reviewers)
**Type:** Sub-agent (inline)

### When to use

- Refactoring touches >10 files
- Refactoring changes shared library interfaces
- Refactoring affects authentication or security code

### Steps

1. Load **panel-majority-vote** skill
2. Run panel with question: "Does this refactoring preserve all existing behavior while improving code quality?"
3. On BLOCK: extract MUST-FIX items and re-delegate

### Exit Criteria

- [ ] Panel PASS (2/3 majority)
- [ ] Delivery Outcome completed (see `general.instructions.md`) — branch pushed, PR opened (not merged), Linear linked

---

### Phase 6: Delivery (Compound)

> **See [shared-delivery-phase.md](shared-delivery-phase.md) for the standard delivery steps.**
>
> Commit → Push → PR → Linear linkage. Team Lead owns delivery.
