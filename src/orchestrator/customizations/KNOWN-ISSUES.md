<!-- Populated by agents. Add known issues here during sessions. -->

# Known Issues

Tracked issues, limitations, and accepted risks discovered during agent sessions. Agents check this file before starting work to avoid known pitfalls, and update it when new issues are found or existing ones are resolved.

## How to Use

- **Before starting work:** Scan for entries relevant to your task area
- **When discovering an issue:** Add a new row with the next available ID
- **When fixing an issue:** Update the status to `Closed` and add the resolution date

## Issues

| Issue ID | Status | Severity | Summary | Evidence | Root Cause | Solution Options |
|----------|--------|----------|---------|----------|------------|------------------|
| KI-001 | Open | Medium | Convoy engine run()/resume() don't catch unexpected errors from runConvoy() — convoy DB records can get stuck in 'running' status | `src/cli/convoy/engine.ts` lines 452-510 (run) and 520-570 (resume): if `runConvoy()` throws, the convoy record is never updated to 'failed' | The try/finally block exports and closes the store but doesn't catch to update convoy status | Add a catch block before finally that calls `store.updateConvoyStatus(convoyId, 'failed', ...)` before rethrowing |

### Status Values

- **Open** — Issue is active and unresolved
- **Mitigated** — Workaround is in place but root cause remains
- **Closed** — Issue is fully resolved

### Severity Levels

- **Critical** — Blocks core functionality or causes data loss
- **High** — Significant impact on user experience or developer workflow
- **Medium** — Noticeable issue with a reasonable workaround
- **Low** — Minor inconvenience or cosmetic issue
