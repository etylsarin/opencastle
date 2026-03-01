# Panel Majority Vote — Consolidated Report

- **Run root**: `/Users/filip/repos/hospitality-sites/opencastle`
- **Panel key**: `cli-correctness`
- **Question**: "Are the OpenCastle CLI commands (init, update, diff, eject, run, dashboard) correct, robust, and free of bugs? Review all adapter implementations (VS Code, Cursor, Claude Code) for correctness of file generation, path references, stack filtering, re-initialization cleanup, and error handling."

---

## Overall Verdict: **BLOCK**

| Reviewer | Verdict | Confidence |
|----------|---------|------------|
| R1 (Logic & Correctness) | BLOCK | high |
| R2 (Error Handling & Edge Cases) | BLOCK | high |
| R3 (Security, Paths & Consistency) | BLOCK | high |

**Vote tally: 0 PASS / 3 BLOCK**

---

## MUST-FIX (unanimous — 3/3 reviewers)

### 1. `update.ts` does not pass `manifest.stack` to `adapter.update()` — stack filtering bypassed during updates

- **File**: `src/cli/update.ts`, line ~66
- **Current**: `const results = await adapter.update(pkgRoot, projectRoot)`
- **Expected**: `const results = await adapter.update(pkgRoot, projectRoot, manifest.stack)`
- **Impact**: When a user runs `opencastle update`, all skills and agents are reinstalled regardless of their CMS/DB/PM/Notifications selections made during `init`. Skills that were correctly excluded during init (e.g., `contentful-cms` when user chose Sanity) reappear after update.
- **Severity**: High — violates the core stack-filtering contract.
- **Fix**: One-line change.
- **Reviewers**: R1, R2, R3

---

## SHOULD-FIX (deduplicated)

### 1. `run.ts` `parseArgs` — missing value validation for flag arguments (3/3 reviewers)

- **File**: `src/cli/run.ts`
- **Issue**: `--file`, `--adapter`, `--report-dir` consume `args[++i]` without checking that the next element exists. If the flag is the last argument, the value becomes `undefined`, leading to confusing downstream errors (e.g., `resolve(cwd, undefined)` throws a TypeError).
- **Note**: `--concurrency` partially handles this (NaN fails `isFinite` check), but the error message doesn't mention the missing value.

### 2. `cursor.ts` update — stale root-level instruction `.mdc` files not cleaned (2/3 reviewers: R1, R3)

- **File**: `src/cli/adapters/cursor.ts`
- **Issue**: `FRAMEWORK_RULE_DIRS = ['agents', 'skills', 'agent-workflows', 'prompts']` doesn't account for root-level `.mdc` files in `.cursor/rules/` (e.g., `general.mdc`, `ai-optimization.mdc`). If an instruction file is renamed or removed upstream, the old `.mdc` persists after update.

### 3. `executor.ts` — timeout not cleared in catch block (1/3 reviewers: R2)

- **File**: `src/cli/run/executor.ts`, `executeTask` catch block
- **Issue**: When `adapter.execute()` throws (rejected promise), the catch block does not call `timeout.clear()`. The dangling timer continues until it fires (harmless to the race, but can delay process exit by up to the task's timeout duration).

### 4. `claude-code.ts` — prompt naming fallback logic (1/3 reviewers: R1)

- **File**: `src/cli/adapters/claude-code.ts`, prompts section
- **Issue**: `basename(file, '.prompt.md') || basename(file, '.md')` — for files without `.prompt.md` extension (e.g., `something.md`), the first `basename` returns `'something.md'` (truthy), so fallback never executes. Destination becomes `something.md.md`. Latent bug (only manifests with non-standard file naming).

### 5. `cursor.ts` update — inconsistent path format in results (1/3 reviewers: R1)

- **File**: `src/cli/adapters/cursor.ts`, `update()`
- **Issue**: `results.copied.push('.cursorrules')` uses a relative path while `install()` pushes the absolute resolved path. Inconsistency in the results array.

### 6. `dashboard.ts` `openUrl` — uses `exec` instead of `spawn` (1/3 reviewers: R3)

- **File**: `src/cli/dashboard.ts`
- **Issue**: `exec(\`${cmd} ${url}\`)` uses shell interpolation. Although the URL is internally constructed and not exploitable, `exec` with string interpolation is a security anti-pattern. Should use `spawn(cmd, [url])` or `execFile`.

### 7. Dynamic import type assertions are unsafe (1/3 reviewers: R3)

- **Files**: `src/cli/init.ts`, `src/cli/update.ts`, `src/cli/run/adapters/index.ts`
- **Issue**: `import('./adapters/vscode.js') as Promise<IdeAdapter>` casts a module namespace object to an interface. Works at runtime but TypeScript won't catch breaking changes. Should cast after await.

### 8. Run adapters — `which` not cross-platform (1/3 reviewers: R1)

- **Files**: `src/cli/run/adapters/*.ts`
- **Issue**: `which` command doesn't exist on Windows. All `isAvailable()` checks would fail.

---

## Disagreements

None. All 3 reviewers agreed on BLOCK verdict and on the single MUST-FIX item. SHOULD-FIX items varied by focus area but had no contradictions.

---

## Retry Summary

**To unblock**: Fix the single MUST-FIX item in `src/cli/update.ts` — pass `manifest.stack` to `adapter.update()`. This is a one-line change.

Recommended follow-up: Address SHOULD-FIX items #1 (parseArgs validation) and #2 (stale cursor instruction files) as they were flagged by multiple reviewers.
