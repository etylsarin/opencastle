# Panel Reviewer Outputs: task-queue-system

## Meta
- **Run root:** `/Users/filip/repos/hospitality-sites/opencastle`
- **Panel key:** `task-queue-system`
- **Question:** "Is the Task Queue system (YAML parser, schema validation, DAG executor, run adapters, reporter, and CLI integration) production-ready? Specifically: (1) Does the custom YAML parser handle all documented spec features correctly? (2) Are edge cases handled — empty files, missing required fields, circular dependencies, invalid timeouts? (3) Does the executor correctly handle timeout kills, failure policies (continue vs stop), dependent task skipping, and concurrency? (4) Are the three run adapters (claude-code, copilot, cursor) consistent and correct? (5) Does the reporter produce valid JSON reports? (6) Does the CLI correctly parse all flags and handle errors?"
- **In-scope artifacts:**
  1. `src/cli/run.mjs` — CLI entry for `run` command
  2. `src/cli/run/schema.mjs` — YAML parser + schema validation
  3. `src/cli/run/executor.mjs` — DAG executor with timeout, phases, concurrency
  4. `src/cli/run/reporter.mjs` — Terminal output + JSON report writer
  5. `src/cli/run/adapters/index.mjs` — Adapter registry
  6. `src/cli/run/adapters/claude-code.mjs` — Claude Code runtime adapter
  7. `src/cli/run/adapters/copilot.mjs` — Copilot CLI runtime adapter
  8. `src/cli/run/adapters/cursor.mjs` — Cursor CLI runtime adapter
  9. `README.md` — Documentation of the task queue

---

## Reviewer 1 (Correctness & Edge Cases Focus)

**1) VERDICT:** PASS

**2) MUST-FIX:**
- **CLI `--concurrency` bypasses schema validation:** `parseInt('abc', 10)` returns `NaN`. Since `NaN !== null` evaluates `true`, the CLI override sets `spec.concurrency = NaN` *after* schema validation. The executor then computes `eligible.slice(i, i + NaN)` which returns an empty array — no tasks execute, with no error reported. Must validate the parsed integer in `parseArgs`: reject if `isNaN` or `< 1`.

**3) SHOULD-FIX:**
- **`timeoutPromise` timer never cleared:** When a task completes normally, the `setTimeout` created by `timeoutPromise` persists until it fires. It won't cause incorrect behavior (the `Promise.race` already resolved), but it's a resource leak. Use `clearTimeout` on normal completion.
- **Adapters use `stdout || stderr`:** If both `stdout` and `stderr` contain data, `stderr` is silently discarded. Should concatenate rather than use logical OR: `const output = [stdout, stderr].filter(Boolean).join('\n')`.
- **CLI adapter error message incorrect for `cursor`:** The error says `"Make sure the 'cursor' CLI is installed"` but the cursor adapter checks for a binary named `agent`. User would look for the wrong binary. Should map adapter name → binary name explicitly.
- **`isAvailable()` uses `which`:** Not available on Windows. Limits cross-platform use. Consider `command -v` (POSIX) or a cross-platform lookup.
- **Missing `--file` value not validated:** `--file` without a following argument sets `opts.file = undefined`. `resolve(cwd, undefined)` produces an unexpected path. Should check `args[i+1]` exists for flags that expect a value.

**4) QUESTIONS:**
- What does the `-s` flag in the copilot adapter do? It's passed but undocumented.
- Is the cursor CLI actually called `agent`? The adapter's `isAvailable` checks for `agent` — should this be documented?

**5) TEST IDEAS:**
- Test `parseTaskSpec` with: empty file, whitespace-only file, comment-only file — verify correct error messages.
- Test `validateSpec` with circular deps: A→B→C→A (3-node cycle) and self-reference A→A.
- Test `buildPhases` with a linear chain (A→B→C) — verify 3 phases are produced.
- Test `executeTask` when a task completes faster than its timeout — verify no side effects from lingering timer.

**6) CONFIDENCE:** med

---

## Reviewer 2 (Robustness & Error Handling Focus)

**1) VERDICT:** PASS

**2) MUST-FIX:**
- **`--concurrency` CLI override bypasses schema validation:** `parseArgs` uses `parseInt(args[++i], 10)` with no validation. Non-numeric input → `NaN` → overrides the validated spec → executor's `eligible.slice(i, i + concurrency)` returns empty arrays → silent no-op. Fix: validate in `parseArgs` that the result is a finite integer ≥ 1, or reject and exit.

**3) SHOULD-FIX:**
- **`stdout || stderr` loses stderr:** All three adapters use logical OR — stderr data is discarded when stdout is non-empty. Failed processes often write errors to stderr while also producing partial stdout. Concatenate both.
- **`parseMapping` silently skips over-indented lines:** Lines with `indent > blockIndent` are silently skipped (`i++; continue`). A YAML file with an accidental extra-indent level would lose data without any warning. Consider logging a diagnostic or throwing a parse error.
- **Uncleaned `setTimeout` in `timeoutPromise`:** Timer persists after normal task completion. Should `clearTimeout` on the non-timeout path.
- **`skipTask` doesn't guard against undefined task:** `spec.tasks.find((t) => t.id === taskId)` could return `undefined` in edge cases. `reporter.onTaskSkipped(undefined, reason)` would throw. Add a guard check.
- **`parseFlowSequence` doesn't handle quoted commas:** `[a, "b, c", d]` would incorrectly split by `,` into 4 elements instead of 3. Since flow sequences are only used for simple values in task specs (file paths), this isn't critical for the documented use case but is a known limitation.
- **Cursor adapter error message says "cursor" but binary is "agent":** Misleading error when the adapter isn't available.

**4) QUESTIONS:**
- Should the YAML parser emit warnings for unrecognized constructs instead of silently ignoring them?
- What does the `-s` flag in the copilot adapter do? Is it documented somewhere?
- Should the executor support task retries (currently not implemented)?

**5) TEST IDEAS:**
- Test `--concurrency abc` → should produce a helpful error, not silently produce NaN.
- Test YAML: `key: "value with # hash"` — verify inline comment stripping respects quotes.
- Test `detectCycles` with self-referencing task: `depends_on: [self-id]`.
- Test timeout with a process that ignores SIGTERM to verify SIGKILL escalation works after 5s.
- Test `on_failure: stop` with a failing task in a concurrent batch — verify all pending tasks are skipped.
- Test that spec file not found → clear error message (not a stack trace).

**6) CONFIDENCE:** med

---

## Reviewer 3 (Production Readiness & Completeness Focus)

**1) VERDICT:** PASS

**2) MUST-FIX:**
- **CLI `--concurrency` validation gap:** `parseInt` returns `NaN` for non-numeric input, which bypasses the already-completed spec validation and breaks the executor's batch slicing (`eligible.slice(i, i + NaN)` → empty array → no tasks run, no error). Negative values are also not caught. Must add: `if (isNaN(c) || c < 1) { console.error('Invalid concurrency'); process.exit(1); }` in `parseArgs`.

**3) SHOULD-FIX:**
- **All adapters: `stdout || stderr` discards stderr:** Should concatenate both streams. This loses potentially critical error details when a CLI writes partial output to stdout before failing.
- **Cursor adapter error message:** Tells user to install "cursor" CLI but the binary is actually "agent". Fix the ternary in `run.mjs` to include cursor → agent mapping.
- **`timeoutPromise` should be clearable:** Dangling timers aren't functionally broken (process.exit kills them), but it's poor hygiene and could matter if the executor is used as a library.
- **No `--timeout` CLI override:** Users can only set timeout per-task in YAML — no global override from CLI. Adding `--default-timeout` would improve ergonomics.
- **Reporter timestamp filename could collide:** Two runs starting in the same second produce the same filename. Use milliseconds or append a random suffix.
- **`parseFlowSequence` doesn't handle nested brackets or quoted strings with commas:** `[a, "b, c"]` would mis-parse. Acceptable for task spec use (where flow sequences contain simple file paths), but worth documenting as a known limitation.

**4) QUESTIONS:**
- Are there any integration tests or end-to-end tests for the task queue system?
- Should the reporter support output formats other than JSON (e.g., Markdown summary)?
- What happens if a task's `depends_on` references a task in a later phase that also depends on it (should be caught by cycle detection, but is there a test)?

**5) TEST IDEAS:**
- Integration test: spec with 3 tasks (2 parallel, 1 dependent) using a mock adapter → verify JSON report structure (keys, types, summary counts).
- Test `parseYaml` with block scalar containing blank lines in the middle — verify blank lines are preserved.
- Test `validateSpec` with `tasks: []` (empty array) — should fail validation with "non-empty array" message.
- Test `on_failure: continue` with a middle task failing: verify downstream dependents skip but independent tasks still run.
- Test adapter `kill` with a process that takes >5s to respond to SIGTERM → verify SIGKILL escalation.
- Test `applyDefaults` to verify all defaults match README documentation.

**6) CONFIDENCE:** med
