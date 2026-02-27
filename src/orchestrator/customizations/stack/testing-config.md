# Testing Configuration

<!-- Populated by the `bootstrap-customizations` prompt based on detected test infrastructure. -->

Project-specific testing details referenced by the `browser-testing` skill.

## Primary Test App

<!-- Specify which app to use for E2E testing and how to build/start it. -->

- **App:** _(app name)_ (port XXXX)
- **Pre-test build:** _(build command)_
- **Start server:** _(serve command)_

## Data Test IDs

<!-- List `data-testid` selectors used across the project for E2E testing. -->

| Selector | Element |
|----------|---------|
| | |

## Breakpoints

<!-- Define responsive breakpoints for UI testing. -->

| Breakpoint | Width | CSS prefix | Test viewport |
|-----------|-------|------------|---------------|
| Mobile | | (default) | |
| Tablet | | | |
| Desktop | | | |

## E2E Test Suites

<!-- List E2E test suite files and their focus areas. -->

| Suite | Focus |
|-------|-------|
| | |

## Reporting Format

```markdown
## Browser Test: [Feature Name]
**Date:** [Date] | **App:** [app] (localhost:XXXX)

| Test | Status | Notes |
|------|--------|-------|
| Page loads | ✅ PASS | |
| Interaction works | ⚠️ ISSUE | Description |
| Edge case handled | ✅ PASS | |
```

## Test Results Log

<!-- Specify where to log test results. -->
