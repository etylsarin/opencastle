# Panel Report

## Context
- Run root (must be a single run):
  - `/Users/filip/repos/hospitality-sites/opencastle/`
- Panel key: `task-queue-system`
- Question asked (exact text): "Is the Task Queue system (YAML parser, schema validation, DAG executor, run adapters, reporter, and CLI integration) production-ready? Specifically: (1) Does the custom YAML parser handle all documented spec features correctly? (2) Are edge cases handled — empty files, missing required fields, circular dependencies, invalid timeouts? (3) Does the executor correctly handle timeout kills, failure policies (continue vs stop), dependent task skipping, and concurrency? (4) Are the three run adapters (claude-code, copilot, cursor) consistent and correct? (5) Does the reporter produce valid JSON reports? (6) Does the CLI correctly parse all flags and handle errors?"
- Artifacts in scope (must all be under the same run root):
  - `src/cli/run.mjs`
  - `src/cli/run/schema.mjs`
  - `src/cli/run/executor.mjs`
  - `src/cli/run/reporter.mjs`
  - `src/cli/run/adapters/index.mjs`
  - `src/cli/run/adapters/claude-code.mjs`
  - `src/cli/run/adapters/copilot.mjs`
  - `src/cli/run/adapters/cursor.mjs`
  - `README.md`
- Reviewer runs:
  - N = 3
- Reviewer outputs source:
  - `panel/task-queue-system-reviewer-outputs.md`

## Panel verdict
- **Overall: PASS**

## Vote tally
- PASS: 3
- BLOCK: 0

## Must-fix

| # | Issue | Reviewers | Location |
|---|-------|-----------|----------|
| 1 | **CLI `--concurrency` override bypasses schema validation.** `parseInt('abc', 10)` → `NaN`, applied after spec validation → executor's `eligible.slice(i, i + NaN)` returns empty array → silent no-op (zero tasks run, no error). Must validate in `parseArgs`: reject if `isNaN` or `< 1`. | 3/3 | `src/cli/run.mjs` L56-58 |

## Should-fix

| # | Issue | Reviewers | Location |
|---|-------|-----------|----------|
| 1 | **Adapters use `stdout \|\| stderr` — stderr lost when stdout non-empty.** Should concatenate both streams to preserve error details. | 3/3 | All 3 adapter files |
| 2 | **Cursor adapter error message says "cursor" but binary is "agent".** Ternary in `run.mjs` only maps `claude-code` → `claude`. Add cursor → agent mapping. | 3/3 | `src/cli/run.mjs` L109 |
| 3 | **`timeoutPromise` timer never cleared on normal completion.** Dangling `setTimeout` persists until timeout fires. Use `clearTimeout` when the task promise wins the race. | 3/3 | `src/cli/run/executor.mjs` L92-101 |
| 4 | **`parseFlowSequence` doesn't handle quoted commas or nested brackets.** `[a, "b, c"]` splits incorrectly. Acceptable for task spec use (simple file paths) but should be documented as a known limitation. | 2/3 | `src/cli/run/schema.mjs` |
| 5 | **`parseMapping` silently skips over-indented lines.** Lines with `indent > blockIndent` are quietly ignored. Could mask YAML formatting errors. | 1/3 | `src/cli/run/schema.mjs` L226-229 |
| 6 | **`isAvailable()` uses `which` — not available on Windows.** Limits cross-platform use. | 1/3 | All 3 adapter files |
| 7 | **Missing `--file` value not validated.** `--file` without a following arg sets `opts.file = undefined`. | 1/3 | `src/cli/run.mjs` L51-52 |
| 8 | **`skipTask` doesn't guard against undefined task.** `spec.tasks.find()` could return `undefined` → `reporter.onTaskSkipped(undefined, …)` would throw. | 1/3 | `src/cli/run/executor.mjs` |
| 9 | **No `--timeout` CLI override.** No way to globally override task timeouts from CLI. | 1/3 | `src/cli/run.mjs` |
| 10 | **Reporter timestamp filename could collide within same second.** Two runs starting in the same second get the same filename. | 1/3 | `src/cli/run/reporter.mjs` |

## Questions / Ambiguities
- What does the `-s` flag in the copilot adapter do? (2/3 reviewers)
- Are there integration/E2E tests for the task queue system? (1/3)
- Should the YAML parser emit warnings for unrecognized constructs? (1/3)
- Should the executor support task retries? (1/3)

## Disagreements
No material disagreements. All 3 reviewers voted PASS with medium confidence. The MUST-FIX item was identified unanimously. SHOULD-FIX items varied in coverage but none contradicted each other — differences reflect review focus (correctness vs. robustness vs. completeness).

## Determinize next
1. **Unit test for `--concurrency` argument validation** — pass `abc`, `-1`, `0`, `1.5` and assert exit code 1 with error message.
2. **Unit test for adapter output merging** — mock a process producing both stdout and stderr, assert both appear in result.
3. **Unit test for `timeoutPromise` cleanup** — verify `clearTimeout` is called on normal task completion.
4. **Unit test for `parseFlowSequence`** — test with quoted commas, document known limitation.
5. **Integration test with mock adapter** — run a 3-task DAG (2 parallel + 1 dependent), verify JSON report structure and summary counts.
6. **Test `on_failure: stop`** — verify all remaining pending tasks are skipped after a failure.
