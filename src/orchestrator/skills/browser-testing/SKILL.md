---
name: browser-testing
description: "Chrome DevTools MCP automation patterns for validating UI changes in real browsers. Use when performing E2E browser testing, validating visual changes, testing user interactions, or debugging UI issues with Chrome DevTools."
---

# Browser Testing with Chrome DevTools MCP

Generic browser testing methodology using Chrome DevTools MCP. For project-specific test app, selectors, suites, and breakpoint config, see [testing-config.md](../../customizations/stack/testing-config.md).

## Purpose

After any UI change, validate in a real browser:
1. Start dev server if not running.
2. Navigate to affected pages.
3. Interact with UI elements (click, fill, filter).
4. Validate behavior and appearance.
5. Test edge cases (empty states, errors, boundaries).
6. Document findings with screenshots and pass/fail.

## Pre-Test Build Verification

**CRITICAL: Always build before browser testing.** Testing stale code wastes time. See [testing-config.md](../../customizations/stack/testing-config.md) for the specific build and serve commands.

## Chrome MCP Tools Reference

### Navigation

```javascript
// Navigate to page
mcp_chrome-devtoo_navigate_page({ type: 'url', url: 'http://localhost:<port>/places' })
// Reload
mcp_chrome-devtoo_navigate_page({ type: 'reload' })
```

### Interaction

```javascript
mcp_chrome-devtoo_click({ uid: 'element_uid' })
mcp_chrome-devtoo_type({ uid: 'input_uid', text: 'search query' })
mcp_chrome-devtoo_wait_for({ text: 'Expected text' })
```

### Validation (preferred — lightweight)

```javascript
// Count elements
mcp_chrome-devtoo_evaluate_script({
  function: '() => document.querySelectorAll(".place-card").length'
})
// Check URL
mcp_chrome-devtoo_evaluate_script({
  function: '() => window.location.href'
})
// Verify element exists
mcp_chrome-devtoo_evaluate_script({
  function: '() => !!document.querySelector("[data-testid=filter-topbar]")'
})
// Get text content
mcp_chrome-devtoo_evaluate_script({
  function: '() => document.querySelector("h1")?.textContent'
})
// Check URL params
mcp_chrome-devtoo_evaluate_script({
  function: '() => new URL(window.location.href).searchParams.toString()'
})
```

### Screenshots (use sparingly — MAX 3 per session)

```javascript
mcp_chrome-devtoo_take_screenshot({ format: 'png' })
mcp_chrome-devtoo_take_snapshot()  // DOM snapshot, lighter than screenshot
```

### Performance

```javascript
mcp_chrome-devtoo_performance_start_trace({ reload: true, autoStop: true })
mcp_chrome-devtoo_performance_analyze_insight({ insightSetId: 'set_id', insightName: 'LCPBreakdown' })
```

## Testing Workflow

### 1. Setup

Start the dev server (see [testing-config.md](../../customizations/stack/testing-config.md) for app and port).

### 2. Initial State

```javascript
mcp_chrome-devtoo_navigate_page({ type: 'url', url: 'http://localhost:<port>/places' })
mcp_chrome-devtoo_wait_for({ text: 'places' })
mcp_chrome-devtoo_evaluate_script({
  function: '() => ({ url: window.location.href, title: document.title })'
})
```

### 3. Test Interactions

```javascript
mcp_chrome-devtoo_click({ uid: 'filter_uid' })
mcp_chrome-devtoo_evaluate_script({
  function: '() => document.querySelectorAll(".place-card").length'
})
```

### 4. Test Edge Cases

```javascript
mcp_chrome-devtoo_navigate_page({
  type: 'url', url: 'http://localhost:<port>/places?q=nonexistent-venue-xyz'
})
mcp_chrome-devtoo_evaluate_script({
  function: '() => !!document.querySelector("[data-testid=empty-state]")'
})
```

### 5. Console Error Check

```javascript
mcp_chrome-devtoo_list_console_messages()
```

### 6. Responsive Breakpoint Testing (MANDATORY)

**Every UI change MUST be tested at all responsive breakpoints.** Do not test at desktop only — most layout bugs surface at smaller viewports. Define your breakpoints in your project's testing config (e.g., `testing-config.md`).

#### How to Resize

```javascript
// Example breakpoints — adjust to your project's testing config
mcp_chrome-devtoo_resize_page({ width: 375, height: 812 })   // Mobile
mcp_chrome-devtoo_resize_page({ width: 768, height: 1024 })  // Tablet
mcp_chrome-devtoo_resize_page({ width: 1440, height: 900 })  // Desktop
```

#### Per-Breakpoint Verification

#### Per-Breakpoint Verification

At **each** breakpoint, check:

- [ ] Layout adapts correctly — no horizontal overflow
- [ ] Text truncates or wraps cleanly — no overlap
- [ ] Interactive elements have adequate spacing and touch targets
- [ ] Navigation and panels collapse/expand as expected
- [ ] Images and cards resize proportionally

#### Responsive Testing Anti-Patterns

| Anti-Pattern | Correct Approach |
|---|---|
| Testing only at desktop width | Test at all project-defined breakpoints |
| Skipping resize because "it uses Tailwind" | Tailwind classes can be wrong — always verify visually |
| Only checking layout, not interactions | Test filter drawers, dropdowns, and modals at each size |
| Taking 3 screenshots (one per breakpoint) | Use `evaluate_script()` to check layout; save screenshots for failures |

## Regression Re-Test Workflow

When re-testing after a fix:
1. Read previous `result.json` for failing tests.
2. Run build + lint to verify fix compiles.
3. Start dev server.
4. Re-run ALL tests from previous suite (fixes can regress other tests).
5. Compare results — every test must PASS.
6. Write updated `result.json`.

If any test still fails: analyze, fix, repeat. Do NOT stop.

## Validation Checklist

- [ ] Page loads without errors (check console)
- [ ] Changed component renders correctly
- [ ] Interactive elements respond to clicks/input
- [ ] Filters/sorting produce correct results
- [ ] URL parameters sync with UI state
- [ ] Empty states display when appropriate
- [ ] Error states handle gracefully
- [ ] Loading states appear during async operations
- [ ] Keyboard navigation works, focus is visible
- [ ] **Responsive: Tested at Mobile, Tablet, and Desktop breakpoints**
- [ ] **Responsive: No horizontal overflow at any breakpoint**
- [ ] **Responsive: Interactions work at every breakpoint (drawers, dropdowns, modals)**

## Context Management

- ONE focus area per session.
- MAX 3 screenshots — use `evaluate_script()` for most checks.
- Clear browser state between unrelated test flows.
