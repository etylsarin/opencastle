---
name: testing-workflow
description: "Comprehensive testing workflow including test planning, unit/integration/E2E testing patterns, coverage requirements, and common testing mistakes. Use when writing tests, planning test strategies, or validating feature completeness."
---

<!-- ⚠️ This file is managed by OpenCastle. Edits will be overwritten on update. Customize in the customizations/ directory instead. -->

# Testing Workflow

## Core Principles

- Test implementations thoroughly before claiming completion.
- Every feature must be validated through comprehensive testing covering happy paths, edge cases, error conditions, and user interactions.
- **Mandatory**: Every feature implementation must be tested in the browser using Chrome DevTools MCP automation before marking as complete.

## E2E Testing Context Management

**Problem:** Comprehensive E2E tests with Chrome MCP accumulate context that can exceed AI context limits (413 errors).

**Rules:**
1. **ONE suite per session** — never run all suites in one conversation.
2. **MAX 3 screenshots** per session.
3. **Use `evaluate_script()` over `take_snapshot()`** — returns less data.
4. **Reload between major test flows** to clear state.
5. **Log results separately** — append to `docs/testing/E2E-RESULTS.md`.

### Suite Files

See `project.instructions.md` for the full list of E2E test suite files.

## Pre-Implementation Test Plan

Before implementing any feature, create a plan covering:

### 1. Initial State Tests
- Page loads with default values.
- Components render in expected initial state.

### 2. User Interaction Tests
- Buttons trigger expected actions.
- Dropdowns respond to selection.
- Filters update URL params and trigger data refetch.
- Forms accept and validate input.

### 3. State Transition Tests
- Changing filter values produces different results.
- Data updates on user interaction.
- UI reflects backend state changes.
- Loading states appear during async operations.

### 4. Edge Case Tests
- Empty results.
- Maximum/minimum boundaries.
- Invalid input handling.
- Network errors and timeouts.

### 5. Integration Tests
- Component interactions work correctly.
- Data flows from server to UI properly.
- URL parameters sync with component state.
- Server-side vs client-side filtering works.

### 6. Responsive Breakpoint Tests (MANDATORY for UI changes)

**Every UI feature must be tested at all responsive breakpoints** defined in your project's testing config. Most layout bugs only surface at smaller viewports.

> **Detailed breakpoint definitions, resize commands, and per-breakpoint checklists:** See the **browser-testing** skill. The **validation-gates** skill (Gate 3) defines the mandatory testing protocol.

**Anti-pattern:** Testing only at desktop (or only at the default browser width) and assuming responsive classes work. Tailwind classes can be incorrect — always verify visually at every breakpoint.

## Coverage Requirements

### Unit Tests (Jest)
- **Minimum 95% coverage** for all new code.
- All exported functions, React components, custom hooks.
- Edge cases and error conditions. Input validation.

### Integration Tests
- Component integration, data flow, state updates across boundaries.
- URL synchronization.

### E2E Tests (Browser Automation)
- Complete user journeys. All interactive elements.
- State transitions. Error handling. Performance.

## Testing Anti-Patterns

| Anti-Pattern | Correct Approach |
|---|---|
| Testing only initial page load | Test filter changes, interactions, different results |
| Assuming filters work because they render | Verify each filter option changes results |
| Client-side only testing | Verify server requests triggered correctly |
| Single scenario testing | Test urban, rural, edge of coverage, out of range |
| Visual inspection only | Verify data values, counts, distances programmatically |

## Comprehensive Testing Example

```markdown
### ✅ Correct Approach
1. ✅ Load page with Prague coords (50.0755, 14.4378) → 3 places at 10km
2. ✅ Change distance 10km → 100km → 5 places (added 2 at 44km, 83km)
3. ✅ Change distance 100km → 25km → 3 places (removed beyond 25km)
4. ✅ Rural coordinates (49.2, 15.5) → 0 places, auto-expanded to 100km
5. ✅ Verified filter changes trigger new server requests
```

## Post-Implementation Browser Testing

After completing any feature:

1. Start dev server (see `project.instructions.md` for app/port details).
2. Open browser to the dev URL.
3. Test all critical user flows with Chrome DevTools MCP.
4. Test edge cases (empty results, max/min values, errors).
5. Document results with screenshots.

### Verify Before Completion

- [ ] Opened app in browser
- [ ] Tested all interactive elements
- [ ] Verified data changes match expectations
- [ ] Checked edge cases
- [ ] Confirmed empty states display correctly
- [ ] **Tested at all project-defined responsive breakpoints**
- [ ] **No horizontal overflow or layout breakage at any breakpoint**
- [ ] Taken screenshots of key scenarios
- [ ] Verified URL parameters are correct

## Commands

```bash
yarn nx run <project>:test                 # Run tests
yarn nx run <project>:test --coverage      # With coverage
yarn nx run <project>:test -u              # Update snapshots
yarn nx affected -t test                   # Affected tests
```
