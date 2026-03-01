# Architecture Quality — Reviewer Outputs

Panel key: `architecture-quality`
Generated: 2026-03-01

---

## Reviewer 1 — Security & Correctness Focus

### 1) VERDICT: PASS

### 2) MUST-FIX:

1. **`parseFlowSequence` naively splits on comma — breaks quoted strings** (`src/cli/run/schema.ts` L349–353)
   The flow sequence parser `inner.split(',')` doesn't respect quoted strings. Input `[a, "b, c", d]` would parse as 4 items instead of 3. While the current task spec format likely only uses simple identifiers in flow sequences (`files`, `depends_on`), this is a latent correctness bug in the YAML parser that will cause data corruption when a user includes a comma in a quoted value.

2. **`tryListen` can call `resolve` multiple times** (`src/cli/dashboard.ts` L82–98)
   Each retry calls `server.listen()` then registers `server.once('error', ...)`. If the listen succeeds on attempt N, the `'listening'` callback fires `res(port + attempt)`. But the previous `once('error')` listeners from earlier attempts are still registered — a late error event could theoretically cause `res()` to be called twice. Node.js technically ignores the second resolve, but this is an anti-pattern. Fix: remove previous error listener on each retry, or use a single error listener with internal state.

### 3) SHOULD-FIX:

1. **`readManifest` silently returns `null` on all errors** (`src/cli/manifest.ts` L14–20) — catches ALL exceptions (including `EACCES`, `EISDIR`, JSON parse errors) and returns `null`. Should distinguish `ENOENT` (not installed) from permission errors or corrupt JSON. A corrupt manifest could cause `init` to re-scaffold over existing files without warning.

2. **`which` command for availability checks doesn't exist on Windows** (`src/cli/run/adapters/*.ts`) — All three run adapters use `spawn('which', ['claude'])`. On Windows, this fails silently (resolves `false`). Use `process.platform === 'win32' ? 'where' : 'which'` or use Node's `child_process.execFileSync` with `command -v`.

3. **YAML `parseMapping` silently skips lines with excessive indent** (`src/cli/run/schema.ts` L224–226) — When a line has `indent > blockIndent`, it's skipped with `i++; continue`. This means malformed YAML like an extra-indented key is silently ignored rather than producing an error. Could cause hard-to-debug data loss in task specs.

4. **Process.exit in agent adapter spawn on error** — The run adapters resolve with `{ success: false }` on spawn error, which is correct for executor flow. However, if `process.cwd()` doesn't exist when spawning, the error message won't indicate the root cause clearly.

5. **No validation of `task.agent` field against known agent personas** — Any string is accepted, including empty-after-default. A typo in `agent: "devloper"` would silently produce a wrong prompt rather than warning the user.

### 4) QUESTIONS:

1. Is Windows support intended? If yes, `which` → `where` is blocking. If no, should be documented.
2. Should `parseFlowSequence` support nested structures or is flat `[a, b, c]` the design boundary?
3. Is there an integration test suite for the YAML parser? I see no test files in scope.

### 5) TEST IDEAS:

1. YAML parser: flow sequence with quoted commas `[a, "b, c", d]`
2. YAML parser: block scalar with `>` (folded) — should either parse or produce clear error
3. YAML parser: edge case with trailing colon in values (e.g., `url: http://localhost:3000`)
4. Cycle detection: self-referencing task (`depends_on: [self]`)
5. `tryListen` with all ports in use (exhaust maxAttempts)
6. Task spec with unknown fields (should they be silently ignored or warned?)
7. `buildPhases` with diamond dependency pattern (A→B, A→C, B→D, C→D)
8. Timeout exactly at 0ms boundary
9. `readManifest` with corrupt JSON — verify behavior
10. `parseTimeout` with edge inputs: `0s`, `999h`, negative values, non-matching strings

### 6) CONFIDENCE: high

---

## Reviewer 2 — Architecture & Design Patterns

### 1) VERDICT: PASS

### 2) MUST-FIX:

(None — no architectural correctness issues found)

### 3) SHOULD-FIX:

1. **Run adapters are nearly identical — extract common logic** (`src/cli/run/adapters/claude-code.ts`, `copilot.ts`, `cursor.ts`)
   ~90% code duplication across all three files. Only differences: CLI command name, CLI arguments (3-4 differences), adapter name string. Extract a `createSpawnAdapter(config)` factory that takes `{ name, command, buildArgs(prompt) }` and returns the adapter object. This would reduce ~300 lines to ~100.

2. **`stripFrontmatter` / `parseFrontmatter` duplicated** between `src/cli/adapters/cursor.ts` and `src/cli/adapters/claude-code.ts`. Extract to a shared `src/cli/frontmatter.ts` utility. The implementations are slightly different (cursor returns `{ frontmatter, body }` while claude-code returns just the body string), but they can share a single parser with different accessors.

3. **IDE adapter type assertion is unsafe** (`src/cli/init.ts` L10–14)
   `import('./adapters/vscode.js') as Promise<IdeAdapter>` bypasses TypeScript's structural type checking. If an adapter module is missing an export (e.g., `getManagedPaths`), the error won't surface until runtime. Consider adding a runtime shape check or using a registration pattern that enforces the interface.

4. **No adapter abstraction for IDE adapters** — Unlike run adapters which go through `getAdapter()` with an interface, IDE adapters are raw dynamic imports with type assertions. Consider a parallel `getIdeAdapter(name)` function for consistency.

5. **`FRAMEWORK_DIRS` / `CUSTOMIZABLE_DIRS` should be co-located with `getManagedPaths`** in the vscode adapter — Currently the `getManagedPaths` return value is manually maintained and could drift from the actual dirs used in `install`/`update`. Consider deriving managed paths from the constant arrays.

6. **Dashboard `openUrl` has no error handling** (`src/cli/dashboard.ts` L60–66) — `exec()` is fire-and-forget. If the browser launch fails (headless server, SSH session), no error is shown. Wrap in try/catch or check exit code.

7. **`applyDefaults` mutates the input object** (`src/cli/run/schema.ts` L527–543) — The function modifies the `spec` object in-place AND returns it. This is a side-effect anti-pattern. Should create a new object or document the mutation clearly.

### 4) QUESTIONS:

1. Why not use a proven YAML parser (e.g., `yaml` npm package) instead of a custom one? The custom parser adds maintenance burden and edge-case risk. Is it for zero-dependency goals?
2. Is the `run` command intended for production use or is it experimental? The adapter CLI commands (`claude`, `copilot`, `agent`) are not yet widely available.
3. Are `agent-workflows` and `prompts` directories optional or required for all IDEs?

### 5) TEST IDEAS:

1. IDE adapter install + update roundtrip — verify managed paths match actual files
2. Cursor adapter: `.mdc` conversion preserves all frontmatter fields correctly
3. Claude-code adapter: CLAUDE.md generation includes all instruction files
4. Stack config: verify excluded skills/agents for all CMS×DB×PM combinations
5. Adapter registry: `getAdapter('nonexistent')` throws descriptive error
6. Full init → update → diff → eject lifecycle test
7. `copyDir` with transform that returns null (should skip the file)

### 6) CONFIDENCE: high

---

## Reviewer 3 — Code Quality & Production Readiness

### 1) VERDICT: PASS

### 2) MUST-FIX:

(None — no production-blocking quality issues)

### 3) SHOULD-FIX:

1. **YAML parser block scalar only supports `|` (literal)** (`src/cli/run/schema.ts` L302–338) — No support for `>` (folded), `|-` (strip), `|+` (keep) indicators. While documented in the header comment, prompts with long text may naturally use `>` and the parser will silently misparse them. Either support `>` or produce a clear error when encountered.

2. **No SIGTERM handler in dashboard** (`src/cli/dashboard.ts`) — Only `SIGINT` (Ctrl+C) triggers graceful shutdown. In containerized or process-managed environments, `SIGTERM` is the standard shutdown signal. Add `process.on('SIGTERM', ...)` alongside SIGINT.

3. **Summary counting uses fragile cast** (`src/cli/run/executor.ts` L187–191)
   ```typescript
   (summary as unknown as Record<string, number>)[r.status]++
   ```
   This double-cast bypasses type safety. Use a `switch` or explicit status-to-field mapping instead. The current code works but would silently miscount if `TaskStatus` enum changes.

4. **`buildPhases` defensively throws but caller already validated** (`src/cli/run/executor.ts` L39) — The "Cannot resolve task order" error can only fire if cycle detection in `validateSpec` was bypassed. This is defensive programming (good), but the error message should reference the validation step for debuggability.

5. **Output capping at 10000 chars in adapters is arbitrary** — No indication to the user that output was truncated. Add a `[... truncated]` marker when capping, so users know context was lost.

6. **`init.ts` doesn't validate pkgRoot exists** — If `pkgRoot` points to a missing directory (e.g., corrupt installation), the error will be an opaque JSON parse error from reading `package.json`. Add an early existence check.

7. **`parseBlock` recursion depth unbounded** — Deeply nested YAML could cause stack overflow. For a task spec parser, nesting beyond 4-5 levels is unlikely, but a depth guard would be prudent for a general-purpose parser.

### 4) QUESTIONS:

1. What is the expected maximum size of a task spec file? The parser loads the entire file into memory and splits by lines — fine for reasonable sizes but could be an issue for very large specs.
2. Is there a CI pipeline running lint/typecheck on the opencastle package itself?
3. Are the run adapter CLI commands (`claude`, `copilot`, `agent`) stable APIs or subject to breaking changes?

### 5) TEST IDEAS:

1. YAML parser: deeply nested object (10+ levels) — verify no stack overflow
2. YAML parser: empty file, whitespace-only file, comment-only file
3. Task executor: all tasks timeout simultaneously — verify cleanup
4. Task executor: `on_failure: stop` with concurrent batch — verify all remaining tasks skipped
5. `formatDuration` edge cases: 0ms, 1ms, 59999ms, 3600000ms
6. Dashboard: concurrent requests for same data file
7. `parseTimeout` with `0s` — should return 0 (instant timeout, might cause issues)
8. `skipTask` with diamond dependency — verify no double-skip
9. `copyDir` with symlinks — current behavior (follows or ignores?)
10. YAML parser: tab characters as indentation (YAML spec forbids tabs)

### 6) CONFIDENCE: high

---
