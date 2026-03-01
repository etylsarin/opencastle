# Panel Majority Vote — Reviewer Outputs

- **Run root**: `/Users/filip/repos/hospitality-sites/opencastle`
- **Panel key**: `cli-correctness`
- **Question**: "Are the OpenCastle CLI commands (init, update, diff, eject, run, dashboard) correct, robust, and free of bugs? Review all adapter implementations (VS Code, Cursor, Claude Code) for correctness of file generation, path references, stack filtering, re-initialization cleanup, and error handling."

## Artifacts reviewed

| # | File |
|---|------|
| 1 | `src/cli/init.ts` |
| 2 | `src/cli/update.ts` |
| 3 | `src/cli/diff.ts` |
| 4 | `src/cli/eject.ts` |
| 5 | `src/cli/run.ts` |
| 6 | `src/cli/dashboard.ts` |
| 7 | `src/cli/adapters/vscode.ts` |
| 8 | `src/cli/adapters/cursor.ts` |
| 9 | `src/cli/adapters/claude-code.ts` |
| 10 | `src/cli/stack-config.ts` |
| 11 | `src/cli/manifest.ts` |
| 12 | `src/cli/prompt.ts` |
| 13 | `src/cli/copy.ts` |
| 14 | `src/cli/types.ts` |
| 15 | `src/cli/mcp.ts` |
| 16 | `src/cli/run/schema.ts` |
| 17 | `src/cli/run/executor.ts` |
| 18 | `src/cli/run/reporter.ts` |
| 19 | `src/cli/run/adapters/index.ts` |
| 20 | `src/cli/run/adapters/claude-code.ts` |
| 21 | `src/cli/run/adapters/copilot.ts` |
| 22 | `src/cli/run/adapters/cursor.ts` |
| 23 | `bin/cli.mjs` |

---

## Reviewer 1 — Logic & Correctness

**Focus**: Functional correctness of every command and adapter, data flow, stack filtering, file generation mapping.

### Analysis

**bin/cli.mjs** — Entry point routes commands correctly. `pkgRoot` derived from `dirname(__filename)/..` is correct for `bin/cli.mjs`. Top-level await for version is fine in ESM. Unknown commands handled. Error handler shows message, `--debug` for stack trace. ✓

**init.ts** — Checks for existing installation and offers re-init. On re-init, cleans up framework paths from manifest and MCP configs from all IDEs (defensive). Runs `adapter.install()` then writes manifest with managed paths and stack. `closePrompts()` at the end. ✓

**update.ts** — **BUG FOUND**: `adapter.update(pkgRoot, projectRoot)` is called WITHOUT passing `manifest.stack`. The `update` methods on all three adapters accept an optional `stack` parameter and use it for `getExcludedSkills(stack)` / `getExcludedAgents(stack)` filtering. When `stack` is `undefined`, the adapters create empty exclusion sets (no filtering), meaning ALL skills and agents are reinstalled during update — ignoring the user's stack selection. The fix is trivial: `adapter.update(pkgRoot, projectRoot, manifest.stack)`.

**diff.ts** — Reads manifest, compares versions, lists managed paths. Simple and correct. ✓

**eject.ts** — Deletes `.opencastle.json`. Unused params prefixed `_`. Clean. ✓

**run.ts** — Parses args, reads task spec, builds phases, executes. The `parseArgs` function uses `args[++i]` for flags like `--file`, `--adapter`, `--report-dir`, `--concurrency` without checking that `args[i+1]` exists. If a flag is the last argument (e.g., `opencastle run --file`), `opts.file` becomes `undefined`, and `resolve(process.cwd(), undefined)` will throw a confusing error later. Not a crash-level bug but poor UX.

**adapters/vscode.ts** — Native format adapter. Install copies framework dirs with stack filtering, scaffolds customizations once, creates MCP config. Update removes + recreates framework dirs, never touches customizations. `getManagedPaths()` accurate. ✓

**adapters/cursor.ts** — Converts MD → .mdc with frontmatter. `mdcName()` correctly handles compound extensions (`.agent.md` → `.mdc`). `convertFile()` correctly extracts description from frontmatter/heading and maps `applyTo: '**'` to `alwaysApply: true`.

In `update()`, `results.copied.push('.cursorrules')` uses a relative path string while `install()` pushes the absolute resolved path `cursorrules = resolve(projectRoot, '.cursorrules')`. This is an inconsistency in the results array that could confuse consumers.

The `FRAMEWORK_RULE_DIRS = ['agents', 'skills', 'agent-workflows', 'prompts']` used for cleanup during update does NOT include root-level instruction `.mdc` files (e.g., `general.mdc`, `ai-optimization.mdc`). While `convertDir` with `overwrite: true` handles existing files, stale instruction files (removed/renamed upstream) would persist.

**adapters/claude-code.ts** — Generates CLAUDE.md by combining instructions, agent index, and skill index. Agent files copied individually to `.claude/agents/`. Skills to `.claude/skills/`. Prompts and workflows to `.claude/commands/`.

In the prompts section: `const name = basename(file, '.prompt.md') || basename(file, '.md')`. If a file is `something.md` (without `.prompt`), `basename('something.md', '.prompt.md')` returns `'something.md'` (unchanged, truthy), so the fallback never executes. The destination becomes `something.md.md`. Latent bug if any prompt file doesn't use the `.prompt.md` convention.

Update correctly deletes CLAUDE.md + framework dirs, then re-runs install. Created → copied mapping is correct. ✓

**stack-config.ts** — Exclusion/inclusion maps are correct and comprehensive. `getCustomizationsTransform` fills skill-matrix.md rows using regex. ✓

**manifest.ts** — Read/write/create are straightforward. Error catch returns null. ✓

**prompt.ts** — Line-buffered readline for piped input is well-designed. Select handles EOF. Confirm uses defaults on empty input. ✓

**copy.ts** — Recursive copy with filter, transform, overwrite. `removeDirIfExists` uses `rm({ recursive: true })`. ✓

**types.ts** — Comprehensive type definitions. ✓

**mcp.ts** — Reads template, filters by stack, scaffolds once. ✓

**run/schema.ts** — Custom YAML parser handles key-value, lists, nested objects, block scalars, comments, quoted strings. Validation is thorough with cycle detection using DFS. `applyDefaults` sets sensible defaults. `parseTaskSpec` chains read → parse → validate → defaults. ✓

**run/executor.ts** — Topological sort via in-degree. Timeout enforcement via `Promise.race`. Recursive dependent skipping. Concurrency batching within phases. `formatDuration` correct. ✓

**run/reporter.ts** — Terminal progress with icons. JSON report written with timestamp filename. Dry-run plan printer. ✓

**run/adapters/** — All 3 follow identical pattern: `isAvailable()` via `which`, `execute()` via `spawn`, `kill()` via SIGTERM → SIGKILL. Consistent. ✓

### Output

1. **VERDICT**: BLOCK
2. **MUST-FIX**:
   - `update.ts` does not pass `manifest.stack` to `adapter.update()`. Stack-based skill/agent filtering is completely lost during updates. All excluded skills/agents are reinstalled. Fix: `adapter.update(pkgRoot, projectRoot, manifest.stack)`.
3. **SHOULD-FIX**:
   - `run.ts` `parseArgs`: `--file`, `--adapter`, `--report-dir`, `--concurrency` do not validate that a value follows the flag. `args[++i]` can be `undefined`.
   - `cursor.ts` `update()`: `results.copied.push('.cursorrules')` uses a relative path while `install()` uses absolute paths. Inconsistent result format.
   - `claude-code.ts` prompt naming: `basename(file, '.prompt.md') || basename(file, '.md')` — fallback never executes for `.md`-only files, producing `something.md.md`.
   - `cursor.ts` update: root-level instruction `.mdc` files (e.g., `general.mdc`) are not cleaned up when instructions are renamed/removed upstream.
   - Run adapters: `which` command doesn't exist on Windows. Not cross-platform.
4. **QUESTIONS**:
   - Is Windows support a goal? If so, `which` → `where` or a Node.js-based check is needed across all run adapters.
   - Are there any prompt files that don't use the `.prompt.md` convention? If so, the Claude Code adapter bug is active.
5. **TEST IDEAS**:
   - Test `opencastle update` after init with stack selections — verify excluded skills/agents stay excluded.
   - Test `opencastle run --file` (no value) — should show a clear error, not crash.
   - Test re-init with a different IDE — verify all previous IDE files are cleaned up.
   - Test Cursor adapter update after removing an instruction file from upstream — verify stale `.mdc` file is removed.
6. **CONFIDENCE**: high

---

## Reviewer 2 — Error Handling & Edge Cases

**Focus**: Error propagation, edge cases, resource cleanup, race conditions, failure modes.

### Analysis

**bin/cli.mjs** — Top-level try/catch with `process.exit(1)`. `--debug` flag for full stack trace. No SIGINT/SIGTERM handler at top level (dashboard handles its own). Adequate for CLI. ✓

**init.ts** — `readFile(resolve(pkgRoot, 'package.json'))` could throw if package.json is missing — caught by cli.mjs. Re-init cleanup has TOCTOU between `existsSync` and `unlink` — if another process deletes the file between checks, `unlink` throws. Low risk in practice. Stack prompts handle EOF via `select()`. `closePrompts()` called on all exit paths (after install, on abort). ✓

**update.ts** — `process.exit(1)` on missing manifest and invalid IDE. Error messages are clear. **SAME BUG**: `adapter.update(pkgRoot, projectRoot)` missing stack parameter. No error handling around `adapter.update()` itself — relies on cli.mjs catch-all. This is fine since adapter errors are exceptional. ✓ (except stack bug)

**diff.ts** — `process.exit(1)` on missing manifest. Handles version-match case cleanly. ✓

**eject.ts** — `process.exit(1)` on missing manifest. `unlink` could fail if `.opencastle.json` deleted between check and unlink. Low risk. ✓

**run.ts** — `parseArgs` missing value validation for `--file`, `--adapter`, `--report-dir`, `--concurrency`. The `--concurrency` case does validate `Number.isFinite` and `val < 1`, but if `args[++i]` is undefined, `parseInt(undefined, 10)` returns `NaN`, which fails the `isFinite` check and exits. So `--concurrency` without a value is handled (exits with error). But `--file` without a value silently sets `opts.file = undefined` which later causes a confusing `resolve()` error.

`process.exit(hasFailures ? 1 : 0)` — correct exit code semantics. ✓

**prompt.ts** — Line buffer is well-designed for piped input. `ensureRL()` is idempotent. `closePrompts()` clears all state. `select()` handles EOF: if stdin closes without valid selection, exits with error. `confirm()` on EOF returns default (because empty string maps to `defaultYes`). This is correct — piped input that runs out defaults to "yes" for confirm prompts. ✓

**executor.ts** — `buildPhases` throws on unresolvable order (belt-and-suspenders after cycle detection). 

**Timeout not cleared in catch**: In `executeTask`, the `timeout` promise is created, then `Promise.race` is awaited. If `adapter.execute()` throws (rejected promise), the catch block handles it but does NOT call `timeout.clear()`. The timer continues to run until it fires, at which point the race promise is already settled and the timer resolution is a no-op. However, the dangling timer can delay Node.js process exit. This is a real issue: if on_failure is "stop" and many tasks are skipped, old timeout timers could keep the process alive for up to the longest task timeout. **SHOULD-FIX**.

`skipTask` has cycle protection: `if (statuses.get(taskId) !== 'pending') return`. ✓

Summary counting: `if (r.status in summary)` — `'pending'` would match since `summary` has a `total` key that doesn't match status names. Actually wait, `'pending' in summary` — summary has `{ total, done, failed, skipped, 'timed-out' }`. `'pending' in summary` is `false` (no `pending` key), `'running' in summary` is `false`. So uncounted statuses are silently ignored. This is correct since all tasks should reach a terminal status. ✓

**dashboard.ts** — `tryListen` retries up to 10 ports. Error handling for EADDRINUSE is correct. Path traversal prevention with `startsWith` check. Request handler has try/catch returning 500. `fileExists` catches all errors. ✓

**run adapters** — `isAvailable()` handles both `close` (exit code check) and `error` (spawn failure) events. `execute()` handles `close` and `error` events on the spawned process. `proc.stdout/stderr` could emit `error` events that aren't handled — if the pipe breaks, the `error` event on the stream would be unhandled. In practice this is rare. ✓

**schema.ts** — `parseTaskSpec` wraps all steps with proper error messages. ENOENT check distinguishes file-not-found from other read errors. Empty file check. YAML parse errors. Validation errors with bullet list. ✓

### Output

1. **VERDICT**: BLOCK
2. **MUST-FIX**:
   - `update.ts` does not pass `manifest.stack` to `adapter.update()`. All adapters receive `undefined` for stack, causing empty exclusion sets. Every skill and agent is reinstalled during updates regardless of the user's stack selection from init.
3. **SHOULD-FIX**:
   - `executor.ts`: `timeout.clear()` not called in the catch block of `executeTask`. Dangling timers can delay process exit by up to the longest task timeout duration.
   - `run.ts` `parseArgs`: `--file`, `--adapter`, `--report-dir` do not validate that `args[i+1]` exists before consuming it. Leads to confusing downstream errors.
   - `init.ts` re-init cleanup: TOCTOU race between `existsSync` and `unlink`. Low risk but would throw an unhandled error if another process deletes the file in between.
4. **QUESTIONS**:
   - Should the `run` command support `--` to separate opencastle args from passthrough args?
   - Is there a mechanism to retry failed tasks in the run command, or is re-running the entire spec the intended workflow?
5. **TEST IDEAS**:
   - Test `opencastle update` with a manifest that has `stack: { cms: 'sanity', db: 'supabase', pm: 'linear', notifications: 'slack' }` — verify sanity/supabase skills are kept and contentful/convex/strapi/jira are excluded.
   - Test `opencastle run --file` (missing value) — should show a helpful error, not a stack trace.
   - Test executor with a task that throws during execution — verify timeout timer is cleared and process exits promptly.
   - Test piped input: `printf '1\n2\n3\n4\ny\n' | npx opencastle init` — verify all prompts are answered correctly from the buffer.
   - Test dashboard with all ports in range busy — verify it fails gracefully after 10 attempts.
6. **CONFIDENCE**: high

---

## Reviewer 3 — Security, Path Handling & Adapter Consistency

**Focus**: Security (injection, path traversal, secrets), path correctness, cross-adapter consistency, type safety.

### Analysis

**Path handling** — All paths use `resolve()` from `node:path`. `getOrchestratorRoot(pkgRoot)` = `resolve(pkgRoot, 'src', 'orchestrator')`. `projectRoot = process.cwd()`. Dashboard has path traversal protection with `startsWith` check. ✓

**Adapter consistency (init adapters)** — All 3 adapters export the same shape: `install()`, `update()`, `getManagedPaths()`. All accept `stack?: StackConfig`. All call `getExcludedSkills()`, `getExcludedAgents()`, `getCustomizationsTransform()`, `scaffoldMcpConfig()`. Consistent. ✓

**Adapter consistency (run adapters)** — All 3 export `name`, `isAvailable()`, `execute()`, `kill()`. Same spawn pattern. Same output cap (10000 chars). Same error handling. Consistent. ✓

**Stack filtering consistency** — All 3 init adapters correctly apply stack filtering during install. But **update.ts does not pass `manifest.stack`** to any adapter's `update()` method. This means:
- VS Code adapter: `update(pkgRoot, projectRoot)` → `stack` is `undefined` → `getExcludedSkills(undefined)` is not called (guarded by `stack ? ... : new Set()`) → empty exclusion set → all skills/agents copied
- Same for Cursor and Claude Code adapters
- **This is the same critical bug identified by all 3 reviewers.**

**File generation correctness** — 
- VS Code: 1:1 mapping, correct. ✓
- Cursor: .mdc conversion with proper frontmatter handling. `alwaysApply` correctly set based on `applyTo` frontmatter. ✓
- Claude Code: CLAUDE.md aggregation is correct. Agent index and skill index are properly generated. ✓

**Re-initialization cleanup** —
- init.ts removes framework paths from previous manifest. ✓
- MCP configs from all 3 IDEs are removed (defensive). ✓
- Customization directories preserved. ✓
- One gap: if re-initializing with a DIFFERENT IDE, the old IDE's customization files remain. E.g., switching from VS Code to Cursor leaves `.github/customizations/` in place while creating `.cursor/rules/customizations/`. This is arguably correct (don't delete user data) but could be confusing.

**Security** —
- Run adapters use `spawn()` (not `exec()`), preventing shell injection. ✓
- Dashboard `openUrl()` uses `exec(\`${cmd} ${url}\`)`. The URL is `http://localhost:${actualPort}` where `actualPort` is an integer. No injection risk in practice, but `exec` with string interpolation is a security anti-pattern. **SHOULD-FIX**: Use `spawn(cmd, [url])` instead.
- No secret exposure anywhere. ✓
- File operations scoped to project root. ✓

**Type safety** —
- `import('./adapters/vscode.js') as Promise<IdeAdapter>` — This is an unsafe cast. Dynamic `import()` returns a module namespace object, not an `IdeAdapter`. It works because the module's named exports happen to match the `IdeAdapter` interface properties. But TypeScript won't catch breaking changes. **SHOULD-FIX**: Use proper typing after import.
- Same pattern in `ADAPTERS` registry for run adapters: `import('./claude-code.js') as Promise<AgentAdapter>`. Same issue.

**YAML parser security** — The custom parser doesn't use `eval()` or `Function()`. It only handles safe scalar/list/mapping types. No code execution risk. ✓

**Process management** — `task._process` stores the child process reference on the task object (a mutable field on a typed interface). This is a deliberate design choice for kill support. The `_process` field is typed as optional in the `Task` interface. ✓

### Output

1. **VERDICT**: BLOCK
2. **MUST-FIX**:
   - `update.ts` does not pass `manifest.stack` to `adapter.update()`. Stack filtering is completely bypassed during updates. All skills and agents are reinstalled regardless of the user's CMS/DB/PM/Notifications selections.
3. **SHOULD-FIX**:
   - `dashboard.ts` `openUrl()`: Uses `exec()` with string interpolation. Should use `spawn(cmd, [url])` for security best practice, even though current usage is not exploitable.
   - Dynamic import type assertions: `as Promise<IdeAdapter>` and `as Promise<AgentAdapter>` are unsafe casts. Should use proper module typing or cast after await.
   - `run.ts` `parseArgs`: Missing value validation for `--file`, `--adapter`, `--report-dir` flags.
   - `cursor.ts` update: Root-level instruction `.mdc` files not cleaned during update. Stale files persist if instructions are renamed/removed upstream.
4. **QUESTIONS**:
   - Is there an integration test suite for the CLI? Manual testing of init/update/re-init flows across all 3 IDEs would be valuable.
   - Should the CLI detect IDE changes (e.g., manifest says `vscode` but user runs `opencastle init` and picks `cursor`) and clean up the old IDE's files?
5. **TEST IDEAS**:
   - Test `opencastle init` → select vscode → `opencastle init` → select cursor: verify `.github/` framework files are cleaned and `.cursor/` files are created.
   - Test `opencastle update` after init with `cms=sanity, db=none` — verify `supabase-database` and `convex-database` skills are excluded.
   - Test Cursor adapter with an instruction file that has `applyTo: 'src/**/*.ts'` — verify the `.mdc` gets `alwaysApply: false` and correct globs.
   - Fuzz the YAML parser with malformed inputs: unclosed quotes, tabs instead of spaces, mixed indentation.
   - Test `openUrl` by mocking `exec` to verify the command is safe.
6. **CONFIDENCE**: high
