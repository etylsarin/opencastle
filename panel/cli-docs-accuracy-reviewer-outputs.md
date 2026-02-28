# Panel Review: cli-docs-accuracy — Raw Reviewer Outputs

**Question:** "Is the OpenCastle CLI production-ready? Specifically: (1) Do all 6 CLI commands (init, update, diff, eject, run, dashboard) work correctly with proper error handling? (2) Is the README.md accurate — do all claims match the actual code? (3) Are the 'Getting Started' instructions complete and correct for all 3 IDEs (VS Code, Cursor, Claude Code)? (4) Are there misleading claims, broken flows, or documentation gaps?"

---

## Reviewer 1 — CLI Command Correctness & Error Handling Focus

### 1) VERDICT: BLOCK

### 2) MUST-FIX:

- **Timeout does not kill child processes** — In `executor.mjs`, `Promise.race([adapter.execute(task), timeoutPromise(ms)])` resolves the timeout sentinel, but the child process spawned by the adapter continues running. Each adapter exports a `kill(task)` function, but the executor never calls it. After a timeout, the process is leaked, consuming CPU and potentially writing to the filesystem uncontrolled. This is a correctness bug in the `run` command.
- **Claude Code `update()` doesn't actually update framework files** — `claude-code.mjs:update()` deletes `CLAUDE.md` then calls `install()`. But `install()` checks `existsSync()` and skips all existing files for agents, skills, and commands. So only `CLAUDE.md` gets regenerated; `.claude/agents/`, `.claude/skills/`, `.claude/commands/` are never updated. The VS Code and Cursor adapters correctly overwrite framework dirs on update. This means Claude Code users are stuck on old versions of agents/skills after `opencastle update`.
- **README says init "detects your IDE"** but it actually prompts the user to choose — The Quick Start section says "The CLI detects your IDE and generates the right format." In reality, `init.mjs` calls `select('Which IDE are you using?', ...)`. This is misleading. It should say "prompts you to choose your IDE."

### 3) SHOULD-FIX:

- **No `--ide` flag for non-interactive/CI usage** — `init` requires interactive terminal input. There's no way to run `npx opencastle init --ide vscode` in CI pipelines or scripts. Consider adding `--ide <name>` and `--yes` flags.
- **`which` command in adapter `isAvailable()` is not cross-platform** — All three run adapters use `spawn('which', ['claude'])`. The `which` command doesn't exist natively on Windows. Use `where` on Windows or a cross-platform check.
- **`diff` doesn't show actual content diffs** — README says "Preview what an update would change" but the command only lists path categories (framework vs customizable). A user expecting `git diff`-style output will be disappointed. At minimum, the README description should be adjusted to "Preview which files an update would affect."
- **Cursor adapter update pushes relative path string `.cursorrules` while install pushes resolved absolute path** — In `cursor.mjs:update()`, `results.copied.push('.cursorrules')` uses a relative string, whereas `install()` pushes `resolve(projectRoot, '.cursorrules')`. This inconsistency means the manifest's path tracking could be unreliable.
- **`eject` accepts `args` parameter but ignores it** — No `--yes`/`--force` flag for non-interactive eject. The function signature accepts `{ pkgRoot, args }` but `args` is never used (and `pkgRoot` is also unused).
- **Custom YAML parser limitations not documented in README** — The spec format section shows YAML examples but doesn't mention the parser doesn't support anchors, aliases, flow mappings, merge keys, or tags. Users may use standard YAML features and get silent parse failures.

### 4) QUESTIONS:

- Does the `copilot` CLI actually support the flags used (`--autopilot`, `--allow-all-tools`, `--no-ask-user`, `-s`, `--max-autopilot-continues`)? These seem speculative.
- Does the Cursor CLI actually support `--force` and `--output-format json`? The `agent` binary name is also unusual.
- Is `package.json` `engines.node >= 18` sufficient? The code uses top-level `await` which requires Node 14.8+, but other APIs used should be checked.
- Are there integration tests for any of the CLI commands?

### 5) TEST IDEAS:

- Test `run` with a task that genuinely times out — verify the child process is actually killed (currently it won't be).
- Test `opencastle update` on a Claude Code project — verify agents/skills/commands are updated (currently they won't be).
- Test `init` with piped input (`printf '1\n' | npx opencastle init`) — verify the readline buffer-based prompt handling works.
- Test `diff` when version differs — verify output is useful.
- Test all adapters' `isAvailable()` on Windows.
- Test YAML parser with anchors/aliases to verify graceful error vs silent corruption.

### 6) CONFIDENCE: high

---

## Reviewer 2 — README Accuracy & Documentation Quality Focus

### 1) VERDICT: BLOCK

### 2) MUST-FIX:

- **"The CLI detects your IDE" is false** — Quick Start section states: "The CLI detects your IDE and generates the right format." The actual behavior is an interactive prompt asking "Which IDE are you using?" with 3 options. This is a factual inaccuracy that will confuse users expecting auto-detection.
- **Claude Code `update` is broken for framework files** — The README says `opencastle update` "Update framework files (preserves customizations)" but for Claude Code installations, only `CLAUDE.md` is regenerated. Agent definitions, skills, and commands under `.claude/` are silently skipped because `install()` checks `existsSync()`. This is a documentation accuracy issue because the CLI doesn't deliver what the README promises for Claude Code users.
- **Getting Started step 3 is VS Code-specific** — "Set the Team Lead as your Copilot Chat mode and start delegating" only applies to GitHub Copilot in VS Code. Cursor and Claude Code users have no concept of "Copilot Chat mode." The Getting Started section needs per-IDE instructions or should use generic language.

### 3) SHOULD-FIX:

- **CLI output says 3 next steps, README says 4** — After `init`, the CLI prints 3 next steps (Bootstrap, Customize, Commit). The README Getting Started section lists 4 steps (adding "Set the Team Lead as your Copilot Chat mode"). These should be consistent.
- **README claims "88 orchestration files"** — Cannot verify this from CLI code alone. Should be auto-calculated or verified to prevent staleness.
- **"~45K tokens of curated knowledge"** — This claim will become stale. Consider removing or making it dynamic.
- **Adapter CLI column in the table is potentially confusing** — The adapters table says `cursor` adapter uses CLI `agent`. Users unfamiliar with Cursor's CLI might not know what `agent` is. A footnote or link would help.
- **No troubleshooting section** — Common issues (port conflict for dashboard, missing CLI tools for `run`, YAML parse failures) are not documented.
- **`diff` description is misleading** — "Preview what an update would change" implies content-level diffing. The actual command only shows path categories. Should say "Preview which files an update would affect."
- **No mention of custom YAML parser limitations** — The Task Queue section shows YAML examples but fails to mention the parser is custom and limited. Standard YAML features like anchors (`&`/`*`) and flow mappings (`{key: value}`) are unsupported.
- **Dashboard "real agent data" claim** — README says dashboard "visualizes your project's real agent data." For new users who haven't run agents, they get "No agent logs found." The `--seed` demo data is mentioned but could be more prominent for first-time users.

### 4) QUESTIONS:

- Are the model tier names (Claude Opus 4.6, Gemini 3.1 Pro, GPT-5.3-Codex, GPT-5 mini) accurate and current? These seem like future/speculative model names.
- How is the "18 specialist agents" count derived? Is it verified against the actual orchestrator source?
- Is the `copilot` CLI (`copilot -p ... --autopilot`) actually a real, documented interface? As of early 2026 this feels aspirational.

### 5) TEST IDEAS:

- Verify all numbered claims (18 agents, 28 skills, 8 workflows, 88 orchestration files) against actual orchestrator source file counts.
- Test the Getting Started flow end-to-end for each IDE, verifying every README step works.
- Test `opencastle update` for Claude Code and verify which files are actually updated vs skipped.
- Run `npx opencastle init` in a fresh directory and compare output with README claims.

### 6) CONFIDENCE: high

---

## Reviewer 3 — Edge Cases, Security & Production-Readiness Focus

### 1) VERDICT: BLOCK

### 2) MUST-FIX:

- **Process leak on task timeout** — The `executor.mjs` uses `Promise.race` for timeout, but when the timeout wins, the spawned child process (claude/copilot/agent) continues running. The `kill()` function exported by each adapter is never called. In production "run overnight" usage, multiple timed-out tasks could leave orphaned processes consuming resources indefinitely. This directly contradicts the "autonomous overnight" use case.
- **Claude Code update path silently fails to update most files** — `claude-code.mjs:update()` deletes CLAUDE.md and calls `install()`, which skips existing files. Framework files under `.claude/agents/`, `.claude/skills/`, `.claude/commands/` are never refreshed. Users running `opencastle update` after a version bump will have stale files and no warning. The VS Code adapter handles this correctly by using `overwrite: true`.

### 3) SHOULD-FIX:

- **`openUrl()` in dashboard.mjs doesn't quote/escape the URL** — `exec(\`${cmd} ${url}\`)` with `cmd = 'open'` could be a command injection vector if the URL contained shell metacharacters. Since the URL is constructed from `parseInt`-ed port, current risk is negligible, but defense-in-depth would use `spawn` or properly quote the argument.
- **`tryListen` in dashboard has a subtle bug** — When port `N` fails with EADDRINUSE, it increments attempt and tries `N+1`, but `server.once('error', ...)` only handles the _next_ error event. If the next `listen()` also emits an error synchronously (which Node's net module can do in edge cases), the handler from the previous attempt may not have been cleaned up. Using `server.removeAllListeners('error')` before retry would be safer.
- **Path traversal check in dashboard could be more robust** — `if (!filePath.startsWith(distDir))` works for basic traversal, but `resolve` already normalizes the path. If `distDir` is a symlink target and `filePath` is resolved differently, the check could be bypassed. Using `path.relative()` and checking for `..` prefix would be more robust.
- **No `--yes`/`--force` flag for scripted usage** — `init`, `update`, and `eject` all require interactive confirmation. There's no way to run these non-interactively (e.g., in Docker builds, CI). The readline `prompt.mjs` handles piped input via the buffer, but there's no explicit `--yes` flag.
- **Windows compatibility** — `which` command used in adapter `isAvailable()` checks won't work on Windows. The `openUrl()` function does handle `win32` platform, but the adapter checks don't.
- **`run` command doesn't validate adapter names against available adapters before parsing YAML** — If a user specifies `--adapter foo` (unknown), the error only surfaces after spec parsing. Minor, but early validation would improve UX.
- **README says "One command. Any repo. Any IDE."** — The "any IDE" claim is limited to 3 IDEs. This is marketing language but could mislead.

### 4) QUESTIONS:

- Is there any test coverage for the CLI commands? No test files were in scope.
- Has the readline buffer approach in `prompt.mjs` been tested with slow TTYs, Windows cmd, or Git Bash?
- What happens if the orchestrator source directory (`src/orchestrator/`) doesn't exist when running `init`? The `getOrchestratorRoot()` returns a path but there's no existence check before `readdir`.
- The README mentions "Sanity, Vercel, Supabase, Linear, and Chrome DevTools" MCP servers — are these in the template `mcp.json`? Couldn't verify from CLI code alone.

### 5) TEST IDEAS:

- Test `run` with 3 tasks, one of which times out — verify that the timed-out process is killed and others continue. (Currently the process will leak.)
- Test `opencastle update` for all 3 IDEs — verify framework files are actually updated in each.
- Stress-test `tryListen` with all ports occupied — verify graceful error after `maxAttempts`.
- Test `init` when orchestrator source dir doesn't exist — verify error message.
- Test dashboard path traversal with `/../../../etc/passwd` URL.
- Test `run` on Windows to verify adapter availability checks.
- Fuzz the custom YAML parser with malformed inputs.
- Test `prompt.mjs` readline with rapid piped input (`printf '1\ny\n' | npx opencastle init`).

### 6) CONFIDENCE: high

---

_Generated: 2026-02-28_
