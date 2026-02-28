# Panel Reviewer Outputs — cli-adapters-dashboard

## Metadata
- **Run root:** `opencastle/`
- **Panel key:** `cli-adapters-dashboard`
- **Question:** "Are the CLI command flows and IDE adapters production-ready? Specifically: (1) Does init correctly generate files for all 3 IDEs (VS Code, Cursor, Claude Code) without errors? (2) Does update correctly refresh framework files while preserving customizations for all 3 IDEs? (3) Is the diff command correct — does it handle version comparison accurately? (4) Does eject cleanly remove the manifest and leave files standalone? (5) Is the dashboard server correct — path traversal protection, MIME types, seed mode, port collision handling? (6) Are the three IDE adapters (vscode, cursor, claude-code) consistent — do they all expose the same interface (install, update, getManagedPaths)? (7) Is the prompt.mjs module robust for interactive input? (8) Is the manifest.mjs module handling reads/writes correctly? (9) Are there any error handling gaps across the CLI flows?"
- **Artifacts in scope:**
  1. `src/cli/init.mjs`
  2. `src/cli/update.mjs`
  3. `src/cli/diff.mjs`
  4. `src/cli/eject.mjs`
  5. `src/cli/dashboard.mjs`
  6. `src/cli/adapters/vscode.mjs`
  7. `src/cli/adapters/cursor.mjs`
  8. `src/cli/adapters/claude-code.mjs`
  9. `src/cli/prompt.mjs`
  10. `src/cli/manifest.mjs`
  11. `src/cli/copy.mjs`
  12. `src/cli/mcp.mjs`
  13. `bin/cli.mjs`

---

## Reviewer 1 — Security & Error Handling Focus

1) VERDICT: PASS

2) MUST-FIX:
- None

3) SHOULD-FIX:
- **prompt.mjs: select() infinite loop on stdin EOF** — If stdin closes (e.g., pipe ends before valid input is given), `select()` will loop infinitely: `nextLine()` returns `''` on close, `parseInt('')` is NaN, fails the range check, re-prompts, but stdin is closed so `ensureRL()` creates a new readline that immediately closes again. Add a max-attempts guard or detect EOF and throw. (3/3 reviewers flagged)
- **dashboard.mjs: Missing MIME types for web fonts** — `.woff`, `.woff2`, `.ttf`, `.eot` are absent from `MIME_TYPES`. Falls back to `application/octet-stream` which works but some browsers may refuse to load fonts with wrong MIME type. (2/3 reviewers flagged)
- **update.mjs: No validation of manifest.ide against ADAPTERS** — If `.opencastle.json` is manually corrupted with an invalid IDE value (`manifest.ide = 'vim'`), `ADAPTERS[manifest.ide]` returns `undefined` and calling `()` on it throws an unhelpful `TypeError: undefined is not a function`. Add a validation check with a clear error message. (3/3 reviewers flagged)
- **vscode/cursor adapters: update() doesn't remove stale framework files** — Unlike claude-code which deletes framework dirs before re-running install(), vscode and cursor adapters only overwrite existing files. If a framework file was renamed/removed in a newer version, the old file persists as an orphan. (2/3 reviewers flagged)
- **manifest.mjs: readManifest swallows all errors** — Both ENOENT (file not found) and JSON parse errors return `null`. A corrupted manifest silently appears as "no installation." Consider distinguishing corrupted manifest from missing manifest for better diagnostics. (1/3 reviewers flagged)
- **init.mjs: closePrompts() not called on error paths** — If `adapter.install()` throws mid-execution, the error propagates to cli.mjs but `closePrompts()` is never called, leaving readline open. The process exits via `process.exit(1)` so this is not a leak in practice, but it's inconsistent. (1/3 reviewers flagged)
- **claude-code.mjs: Redundant dynamic imports** — `update()` dynamically imports `unlink` and `rm` from `node:fs/promises` which is already imported at the top of the file. Use the static import instead. (1/3 reviewers flagged)
- **dashboard.mjs: exec() for openUrl without error handling** — `exec()` callback is not provided, so spawn errors (e.g., on a headless Linux server) are silently swallowed. (1/3 reviewers flagged)

4) QUESTIONS:
- Is the `diff` command intentionally a "preview" (listing managed paths) rather than showing actual file content diffs? The name suggests `git diff`-like output, but it only lists categories.
- Should `eject` mention that MCP config files (`.vscode/mcp.json`, `.cursor/mcp.json`, `.claude/mcp.json`) remain after ejection, or is that the intended behavior?

5) TEST IDEAS:
- **EOF test for prompt.mjs**: Pipe an empty string or closed stdin to init() and verify it doesn't hang
- **Path traversal test**: Send requests like `GET /../../etc/passwd` and `GET /%2e%2e%2f%2e%2e%2fetc/passwd` to dashboard server and verify 403
- **Port collision test**: Start a server on port 4300, then start dashboard on 4300, verify it auto-increments to 4301
- **Corrupted manifest test**: Write invalid JSON to `.opencastle.json`, run `update`, verify clear error
- **Update orphan test**: Install vscode, add extra `.github/agents/old-agent.md`, run update, verify old file persists (documents the behavior)
- **Seed mode test**: Run dashboard with `--seed`, verify `/data/sessions.ndjson` returns content from dist/data/
- **Reinit test**: Run init twice with same IDE, verify it asks for confirmation and re-installs correctly

6) CONFIDENCE: high

---

## Reviewer 2 — Interface Consistency & Correctness Focus

1) VERDICT: PASS

2) MUST-FIX:
- None

3) SHOULD-FIX:
- **prompt.mjs: select() can infinite-loop on EOF** — When stdin is exhausted (pipe ends, CTRL+D in TTY), select() loops forever waiting for valid numeric input. Needs EOF detection or max retry limit. (3/3 reviewers flagged)
- **Inconsistent update strategy across adapters** — claude-code deletes framework dirs then re-runs install() (clean slate). vscode and cursor only overwrite in-place via `copyDir({overwrite: true})`. This means vscode/cursor can leave orphaned files from previous versions if files were renamed or removed. Recommend aligning all 3 adapters to the delete-then-recreate strategy. (2/3 reviewers flagged)
- **update.mjs: Invalid IDE in manifest not validated** — `ADAPTERS[manifest.ide]()` will throw `TypeError` if `manifest.ide` has been manually edited to a non-existent adapter. Add guard: `if (!ADAPTERS[manifest.ide]) { console.error(...); process.exit(1) }`. (3/3 reviewers flagged)
- **Dashboard missing .woff/.woff2 MIME types** — The Astro dist directory may contain web fonts. Without proper MIME types, font loading could fail in some browsers. (2/3 reviewers flagged)
- **diff.mjs doesn't show actual file diffs** — The "diff" command only lists which paths would be affected based on `manifest.managedPaths`, not the actual content changes. This is misleading if users expect `git diff`-style output. Either rename to `preview`/`status`, or add actual content diffing. (1/3 reviewers flagged)
- **cursor.mjs update() pushes relative path '.cursorrules' while install() pushes absolute path** — In `update()`, `results.copied.push('.cursorrules')` pushes a relative path, while other entries (from `writeConverted`) push absolute paths. This inconsistency could confuse downstream consumers of the results object. (1/3 reviewers flagged)

4) QUESTIONS:
- Is it intentional that customizations are NOT cleaned up by the cursor and vscode `update()` functions? The current behavior is correct (preserve customizations), but it means `.cursor/rules/customizations/` could contain stale template files.
- The `run` command is referenced in the CLI help text and commands map but `src/cli/run.mjs` is not in scope — is it implemented?

5) TEST IDEAS:
- **Adapter interface conformance test**: Programmatically import all 3 adapters, assert each exports `install`, `update`, `getManagedPaths` as functions
- **Update idempotency test**: Run update twice in a row, verify no errors and same result
- **Cross-IDE test**: Install for vscode, eject, install for cursor, verify no cross-contamination
- **Select prompt with piped valid input**: `echo "1" | npx opencastle init` should install for VS Code without hanging
- **Invalid port value**: `--port abc` should handle gracefully (currently parseInt returns NaN → listen fails)
- **Max port collision test**: Block ports 4300-4310, verify error after 10 attempts

6) CONFIDENCE: high

---

## Reviewer 3 — Robustness & Edge Cases Focus

1) VERDICT: PASS

2) MUST-FIX:
- None

3) SHOULD-FIX:
- **prompt.mjs select() hangs on EOF/pipe exhaustion** — In CI or piped scenarios where stdin delivers fewer lines than expected, `select()` enters an infinite loop. `confirm()` correctly handles this (empty → default), but `select()` has no such fallback. Guard with attempt counting or detect readline 'close' event to reject the pending promise with an error. (3/3 reviewers flagged)
- **manifest.ide validation in update.mjs** — No guard against corrupted/unknown IDE value in manifest. Would produce an opaque TypeError. (3/3 reviewers flagged)
- **Dashboard font MIME types missing** — `.woff`, `.woff2` not in MIME_TYPES map. Could cause incorrect content types. (2/3 reviewers flagged)
- **Orphaned file risk for vscode/cursor update** — Only claude-code adapter does a clean delete-then-install for updates. vscode and cursor only overwrite existing files, leaving removed/renamed framework files as orphans. (2/3 reviewers flagged)
- **dashboard.mjs parseArgs: no validation for --port value** — `parseInt('abc', 10)` returns `NaN`, which would cause `server.listen(NaN)` to bind to a random port or throw an error. Should validate that the parsed port is a valid number. (1/3 reviewers flagged)
- **copy.mjs: No symlink handling** — `copyDir` follows symlinks transparently via `readdir` and `copyFile`. This is generally fine but could cause unexpected behavior if the source orchestrator directory contains symlinks (copies the target content, not the symlink itself). Low risk. (1/3 reviewers flagged)
- **eject.mjs accepts but ignores `pkgRoot` and `args`** — Minor interface inconsistency. Not harmful since the CLI entry point passes them uniformly. (1/3 reviewers flagged)

4) QUESTIONS:
- Does `tryListen` correctly clean up the previous listener before attempting the next port? `server.listen()` is called sequentially but `server.once('error', ...)` means the first error handler is consumed — subsequent attempts create new `.once('error')` handlers, which seems correct. But should `server.close()` be called between attempts?
- Is there an integration test suite for these CLI commands, or is this purely manual testing?

5) TEST IDEAS:
- **EOF/SIGPIPE test**: `echo "" | node bin/cli.mjs init` — should error gracefully, not hang
- **Double-decoded path traversal**: Send `GET /..%252f..%252fetc/passwd` to dashboard and verify 403
- **Concurrent init**: Run two `opencastle init` processes simultaneously in the same directory — verify no manifest corruption (race condition on writeManifest)
- **Missing orchestrator source**: Delete `src/orchestrator/` and run init — should produce clear error about missing source files, not ENOENT stack trace
- **NaN port**: `--port xyz` should produce clear error
- **Large project test**: Run init in a directory with thousands of existing files to ensure no performance issues

6) CONFIDENCE: high
