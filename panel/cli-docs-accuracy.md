# Panel Report: cli-docs-accuracy

**Panel key:** `cli-docs-accuracy`  
**Date:** 2026-02-28  
**Question:** "Is the OpenCastle CLI production-ready? Specifically: (1) Do all 6 CLI commands work correctly? (2) Is README.md accurate? (3) Are Getting Started instructions correct for all 3 IDEs? (4) Are there misleading claims or documentation gaps?"

---

## Overall Verdict: **BLOCK** (3/3)

| Reviewer | Verdict | Confidence |
|----------|---------|------------|
| Reviewer 1 (CLI correctness) | BLOCK | high |
| Reviewer 2 (README accuracy) | BLOCK | high |
| Reviewer 3 (Edge cases & security) | BLOCK | high |

**Unanimous BLOCK.** Two critical bugs and one documentation inaccuracy must be fixed before production release.

---

## MUST-FIX (3 items — all 3 reviewers agree)

### MF-1: Timeout does not kill child processes (3/3 reviewers)

**Files:** `src/cli/run/executor.mjs`, `src/cli/run/adapters/*.mjs`

`executor.mjs` uses `Promise.race([adapter.execute(task), timeoutPromise(ms)])` but when the timeout sentinel wins, the spawned child process (claude/copilot/agent) keeps running. Each adapter exports a `kill(task)` function that is **never called** by the executor. In the "run overnight" autonomous use case, timed-out tasks leak orphaned processes indefinitely.

**Fix:** After timeout resolves, call `adapter.kill(task)` (or the adapter's kill function) to terminate the child process.

### MF-2: Claude Code `update()` silently skips framework files (3/3 reviewers)

**Files:** `src/cli/adapters/claude-code.mjs`

`update()` deletes `CLAUDE.md` then calls `install()`. But `install()` checks `existsSync()` and skips all existing files for `.claude/agents/`, `.claude/skills/`, `.claude/commands/`. Only `CLAUDE.md` is regenerated. The VS Code and Cursor adapters correctly overwrite framework dirs. Claude Code users get stale agent definitions and skills after running `opencastle update`.

**Fix:** Implement proper update logic for Claude Code (similar to VS Code/Cursor adapters: delete-and-recreate or overwrite framework files, preserve customizations).

### MF-3: README falsely claims init "detects your IDE" (3/3 reviewers)

**Files:** `README.md`

Quick Start section says: "The CLI detects your IDE and generates the right format." The actual code prompts the user to choose their IDE via `select('Which IDE are you using?', ...)`. This is factually incorrect.

**Fix:** Change to "prompts you to choose your IDE" or similar.

---

## SHOULD-FIX (11 items)

| # | Item | Reviewers | Severity |
|---|------|-----------|----------|
| SF-1 | No `--ide`/`--yes` flags for non-interactive CI usage of `init`/`update`/`eject` | 1, 3 | Medium |
| SF-2 | `which` command in adapter `isAvailable()` doesn't work on Windows | 1, 3 | Medium |
| SF-3 | `diff` command only shows path categories, not content diffs — README description is misleading | 1, 2 | Medium |
| SF-4 | Getting Started step 3 ("Set the Team Lead as your Copilot Chat mode") is VS Code-specific | 2 | Medium |
| SF-5 | CLI output shows 3 next steps, README shows 4 — inconsistency | 2 | Low |
| SF-6 | Custom YAML parser limitations (no anchors, aliases, flow mappings) not documented | 1, 2 | Medium |
| SF-7 | Cursor adapter update pushes relative path string vs absolute path inconsistency | 1 | Low |
| SF-8 | `openUrl()` in dashboard uses `exec()` without escaping — minor injection risk | 3 | Low |
| SF-9 | `tryListen` error handler could miss events on rapid port retries | 3 | Low |
| SF-10 | Stale numeric claims ("88 orchestration files", "~45K tokens") will rot | 2 | Low |
| SF-11 | No troubleshooting section in README | 2 | Low |

---

## Open Questions

1. Do the `copilot` CLI flags (`--autopilot`, `--allow-all-tools`, `--no-ask-user`, `-s`, `--max-autopilot-continues`) match the actual GitHub Copilot CLI interface?
2. Does the Cursor `agent` CLI support `--force` and `--output-format json`?
3. Are the model tier names (Claude Opus 4.6, Gemini 3.1 Pro, GPT-5.3-Codex, GPT-5 mini) current?
4. Is there any test coverage for CLI commands?
5. What happens if `src/orchestrator/` source directory doesn't exist when running `init`?
6. Are the claimed numbers (18 agents, 28 skills, 8 workflows) verified against source?

---

## Additional Test Ideas

| # | Test | Priority |
|---|------|----------|
| T-1 | Run `opencastle run` with a task that times out — verify child process is killed | Critical |
| T-2 | Run `opencastle update` for Claude Code — verify agents/skills/commands are refreshed | Critical |
| T-3 | Verify all numeric README claims against actual orchestrator file counts | High |
| T-4 | Test `init` with piped stdin for non-interactive use | High |
| T-5 | Test adapter `isAvailable()` on Windows | Medium |
| T-6 | Fuzz the custom YAML parser with anchors, aliases, flow mappings | Medium |
| T-7 | Test dashboard path traversal with `/../../../etc/passwd` | Medium |
| T-8 | Stress-test `tryListen` with all ports busy up to maxAttempts | Low |
| T-9 | Test Getting Started flow end-to-end for each IDE in a fresh directory | High |

---

## Summary

The CLI has solid architecture, good separation of concerns, and well-structured code. However, **two bugs** (process leak on timeout, Claude Code update silently skipping framework files) and **one README inaccuracy** (IDE auto-detection claim) must be fixed before a v0.1.0 production release. The should-fix items improve robustness and documentation quality but are not release-blockers.

_Raw reviewer outputs: [cli-docs-accuracy-reviewer-outputs.md](cli-docs-accuracy-reviewer-outputs.md)_
