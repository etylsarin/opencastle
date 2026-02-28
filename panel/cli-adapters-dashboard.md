# Panel Report

## Context
- Run root (must be a single run):
  - `opencastle/`
- Panel key: `cli-adapters-dashboard`
- Question asked (exact text): "Are the CLI command flows and IDE adapters production-ready? Specifically: (1) Does init correctly generate files for all 3 IDEs (VS Code, Cursor, Claude Code) without errors? (2) Does update correctly refresh framework files while preserving customizations for all 3 IDEs? (3) Is the diff command correct — does it handle version comparison accurately? (4) Does eject cleanly remove the manifest and leave files standalone? (5) Is the dashboard server correct — path traversal protection, MIME types, seed mode, port collision handling? (6) Are the three IDE adapters (vscode, cursor, claude-code) consistent — do they all expose the same interface (install, update, getManagedPaths)? (7) Is the prompt.mjs module robust for interactive input? (8) Is the manifest.mjs module handling reads/writes correctly? (9) Are there any error handling gaps across the CLI flows?"
- Artifacts in scope (must all be under the same run root):
  - `opencastle/src/cli/init.mjs`
  - `opencastle/src/cli/update.mjs`
  - `opencastle/src/cli/diff.mjs`
  - `opencastle/src/cli/eject.mjs`
  - `opencastle/src/cli/dashboard.mjs`
  - `opencastle/src/cli/adapters/vscode.mjs`
  - `opencastle/src/cli/adapters/cursor.mjs`
  - `opencastle/src/cli/adapters/claude-code.mjs`
  - `opencastle/src/cli/prompt.mjs`
  - `opencastle/src/cli/manifest.mjs`
  - `opencastle/src/cli/copy.mjs`
  - `opencastle/src/cli/mcp.mjs`
  - `opencastle/bin/cli.mjs`
- Reviewer runs:
  - N = 3
- Reviewer outputs source:
  - `opencastle/panel/cli-adapters-dashboard-reviewer-outputs.md`

## Panel verdict
- Overall: **PASS**

## Vote tally
- PASS: 3
- BLOCK: 0

## Must-fix
None. All 3 reviewers returned PASS with no must-fix items.

## Should-fix

| # | Item | Flagged by | Severity |
|---|------|-----------|----------|
| 1 | **prompt.mjs: `select()` infinite loop on stdin EOF** — When stdin closes (pipe ends, CTRL+D), `select()` loops forever because `nextLine()` returns `''`, `parseInt('')` is `NaN`, fails range check, and re-prompts indefinitely. Add max-attempts guard or detect EOF and throw. | 3/3 | medium |
| 2 | **update.mjs: No validation of `manifest.ide` against ADAPTERS** — Corrupted manifest with invalid IDE value causes opaque `TypeError: undefined is not a function`. Add `if (!ADAPTERS[manifest.ide])` guard with clear error. | 3/3 | medium |
| 3 | **vscode/cursor adapters: update() doesn't remove stale framework files** — Unlike claude-code (which deletes dirs then re-installs), vscode and cursor only overwrite existing files. Renamed/removed framework files persist as orphans. Consider aligning to delete-then-install strategy. | 2/3 | medium |
| 4 | **dashboard.mjs: Missing MIME types for web fonts** — `.woff`, `.woff2`, `.ttf`, `.eot` absent from `MIME_TYPES`. Falls back to `application/octet-stream` which may cause font loading issues in some browsers. | 2/3 | low |
| 5 | **cursor.mjs update() pushes relative path for `.cursorrules`** — `results.copied.push('.cursorrules')` is relative while other entries are absolute paths. Inconsistent with the results object contract. | 1/3 | low |
| 6 | **dashboard.mjs: `--port` value not validated** — `parseInt('abc', 10)` returns `NaN`, causing `server.listen(NaN)` which may bind to a random port or throw. | 1/3 | low |
| 7 | **manifest.mjs: `readManifest` swallows all errors** — Both ENOENT and JSON parse errors return `null`. Corrupted manifest silently appears as "no installation" instead of warning the user. | 1/3 | low |
| 8 | **claude-code.mjs: Redundant dynamic imports** — `update()` dynamically imports `unlink` and `rm` from `node:fs/promises` which is already statically imported at the top. Use the static import. | 1/3 | low |
| 9 | **init.mjs: `closePrompts()` not called on error paths** — If `adapter.install()` throws, readline stays open. Not a real leak since `process.exit(1)` cleans up, but inconsistent. | 1/3 | low |
| 10 | **dashboard.mjs: `exec()` for openUrl without error callback** — Errors opening browser (e.g., headless server) are silently swallowed. | 1/3 | low |

## Questions / Ambiguities
- Is the `diff` command intentionally a "preview" of managed paths rather than actual file content diffs? The name may mislead users expecting `git diff`-style output. (2/3 flagged)
- Should `eject` mention that MCP config files remain after ejection? (1/3 flagged)
- Is `src/cli/run.mjs` implemented? It's referenced in the CLI help and commands map but not in scope. (1/3 flagged)
- Does `tryListen` need to call `server.close()` between failed port attempts? (1/3 flagged)

## Disagreements
- **diff command naming**: 1 reviewer flagged the "diff" name as misleading (it's really a "status" or "preview"); the other 2 accepted it as a reasonable command name given the context.
- **manifest error handling**: 1 reviewer flagged `readManifest` swallowing JSON parse errors as a concern; the other 2 accepted the current behavior as pragmatic for a CLI tool.

## Determinize next
1. **Add test for stdin EOF handling** — Write a test that pipes empty/insufficient input to `select()` and asserts it times out or throws rather than looping
2. **Add adapter interface conformance test** — Programmatically import all 3 adapters and assert `install`, `update`, `getManagedPaths` are exported functions with correct signatures
3. **Add path traversal test** — Send encoded traversal paths to dashboard server and assert 403 responses
4. **Add port collision test** — Occupy ports 4300-4309, start dashboard, confirm it finds port 4310
5. **Add manifest validation test** — Write invalid JSON or invalid IDE to `.opencastle.json`, run update, assert clear error message
