# Panel Report: Architecture Quality

| Field | Value |
|-------|-------|
| Panel key | `architecture-quality` |
| Date | 2026-03-01 |
| Verdict | **PASS** |
| Vote tally | 3 PASS / 0 BLOCK |
| MUST-FIX | 2 |
| SHOULD-FIX | 16 |
| Confidence | high (all 3 reviewers) |

## Verdict Summary

All three reviewers voted **PASS**. The OpenCastle codebase is architecturally sound with clean separation of concerns, a well-designed adapter pattern, strong error messaging, and correct DAG execution logic. The two MUST-FIX items are edge-case correctness bugs in the custom YAML parser and dashboard port listener — neither is security-critical or likely to manifest in normal usage, but both should be fixed before the parser is considered production-grade.

## MUST-FIX Items

| # | Issue | File | Reviewer |
|---|-------|------|----------|
| 1 | **`parseFlowSequence` splits on comma without respecting quoted strings** — `[a, "b, c", d]` parses as 4 items instead of 3. Latent correctness bug in YAML parser. | `src/cli/run/schema.ts` L349–353 | R1 |
| 2 | **`tryListen` can theoretically call `resolve()` twice** — Previous `once('error')` listeners accumulate across retries. Second resolve is ignored by Node.js Promises, but is an anti-pattern. | `src/cli/dashboard.ts` L82–98 | R1 |

## SHOULD-FIX Items

| # | Issue | File(s) | Reviewer |
|---|-------|---------|----------|
| 1 | Run adapters ~90% duplicated — extract `createSpawnAdapter` factory | `src/cli/run/adapters/*.ts` | R2 |
| 2 | `stripFrontmatter`/`parseFrontmatter` duplicated across cursor & claude-code IDE adapters | `src/cli/adapters/cursor.ts`, `claude-code.ts` | R2 |
| 3 | `readManifest` catches ALL errors as null — should distinguish ENOENT from EACCES / corrupt JSON | `src/cli/manifest.ts` | R1 |
| 4 | `which` command for availability checks doesn't exist on Windows | `src/cli/run/adapters/*.ts` | R1 |
| 5 | YAML `parseMapping` silently skips lines with excessive indent (silent data loss) | `src/cli/run/schema.ts` L224–226 | R1 |
| 6 | No SIGTERM handler in dashboard (only SIGINT) | `src/cli/dashboard.ts` | R3 |
| 7 | IDE adapter `as Promise<IdeAdapter>` type assertion bypasses structural checking | `src/cli/init.ts`, `update.ts` | R2 |
| 8 | Block scalar only supports `\|` — no `>`, `\|-`, `\|+` support or clear error | `src/cli/run/schema.ts` | R3 |
| 9 | `applyDefaults` mutates input object in-place (side-effect anti-pattern) | `src/cli/run/schema.ts` L527–543 | R2 |
| 10 | Summary counting uses fragile double-cast `as unknown as Record<string, number>` | `src/cli/run/executor.ts` L187–191 | R3 |
| 11 | Dashboard `openUrl` is fire-and-forget with no error handling | `src/cli/dashboard.ts` L60–66 | R2 |
| 12 | No validation of `task.agent` field against known personas — typos pass silently | `src/cli/run/schema.ts` | R1 |
| 13 | Output capping at 10000 chars gives no truncation indicator to user | `src/cli/run/adapters/*.ts` | R3 |
| 14 | `getManagedPaths` manually maintained — could drift from actual dirs in install/update | `src/cli/adapters/vscode.ts` | R2 |
| 15 | `init.ts` doesn't validate pkgRoot exists — opaque JSON parse error on corrupt install | `src/cli/init.ts` | R3 |
| 16 | `parseBlock` recursion depth unbounded — no stack overflow guard | `src/cli/run/schema.ts` | R3 |

## Architectural Strengths

- **Clean command structure**: Each CLI command (`init`, `update`, `diff`, `eject`, `run`, `dashboard`) is a self-contained module with clear responsibility
- **Adapter pattern**: Both IDE adapters and agent runtime adapters use consistent lazy-loading via `import()` with registry maps
- **DAG executor correctness**: Kahn's algorithm for topological sort + 3-color DFS cycle detection are both correctly implemented
- **Timeout enforcement**: Race-based timeout with proper cleanup (`SIGTERM` → 5s → `SIGKILL`) is a solid pattern
- **Path traversal protection**: Dashboard correctly validates `filePath.startsWith(distDir)` after `resolve()`
- **Stack configuration**: Declarative maps for skill/agent/MCP exclusion based on user choices — easy to extend
- **Error messages**: Consistently actionable (e.g., "Run 'npx opencastle init' first")
- **Graceful degradation**: Prompt system handles piped stdin correctly with line buffering

## Key Test Gaps

The YAML parser and DAG executor are critical paths with zero test files in scope. Priority test areas:

1. YAML parser: flow sequences with quoted commas, block scalars, edge indentation
2. DAG executor: diamond dependencies, concurrent timeout, `on_failure: stop` with batch
3. IDE adapters: install → update → diff → eject lifecycle roundtrip
4. Stack config: all CMS×DB×PM×Notif combinations produce valid exclusion sets

## Reviewer Outputs

Full reviewer outputs: [`panel/architecture-quality-reviewer-outputs.md`](architecture-quality-reviewer-outputs.md)
