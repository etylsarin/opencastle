# Panel Reviewer Outputs

- **Run root:** `/Users/filip/repos/hospitality-sites/opencastle`
- **Panel key:** `docs-website-accuracy`
- **Question:** "Are the OpenCastle README.md, ARCHITECTURE.md, and website (website/src/pages/index.astro) accurate, complete, and consistent with the actual codebase? Check: feature claims match implementation, counts are correct (agents, skills, workflows, integrations), CLI commands documented match actual commands, code examples work, no broken links or misleading information, and installation instructions are correct."
- **In-scope artifacts:**
  - `README.md`
  - `ARCHITECTURE.md`
  - `website/src/pages/index.astro`
  - `package.json`
  - `bin/cli.mjs`
  - `src/cli/init.ts`
  - `src/cli/update.ts`
  - `src/cli/diff.ts`
  - `src/cli/eject.ts`
  - `src/cli/run.ts`
  - `src/cli/dashboard.ts`
  - `src/orchestrator/agents/` (18 .md files)
  - `src/orchestrator/skills/` (34 subdirectories)
  - `src/orchestrator/agent-workflows/` (9 .md files excl. README, 8 standalone + 1 shared fragment)
  - `src/orchestrator/prompts/` (9 .md files)
  - `src/orchestrator/mcp.json` (11 server entries)

---

## Reviewer 1

1) VERDICT: PASS

2) MUST-FIX:
- (none)

3) SHOULD-FIX:
- **`--report-dir` flag undocumented in README** — `run.ts` (line ~46) defines a `--report-dir <path>` option that is not listed in the README's "CLI flags" reference table under the Task Queue details section. Add it for completeness.
- **Website quality gates section shows 5 cards, ARCHITECTURE.md lists 6** — The "Fast review" gate (mandatory single-reviewer after every delegation) is listed in ARCHITECTURE.md but missing as a dedicated card in the website's quality gates section. It IS mentioned in the features section's "Quality Gates" card ("Mandatory fast review after every step"), so it's not absent from the website entirely — but the quality gates breakdown section is inconsistent with ARCHITECTURE.md (5 vs 6 items).
- **`shared-delivery-phase.md` could cause counting confusion** — The `agent-workflows/` directory contains 9 .md files (excluding README.md), but the docs claim "8 workflows". The 9th file (`shared-delivery-phase.md`) is a shared fragment referenced by other workflows, not a standalone template. This is technically accurate, but a developer listing the directory would count 9. Consider adding a README or naming convention (e.g., `_shared-delivery-phase.md`) to clarify.

4) QUESTIONS:
- Should the `--report-dir` flag be considered a public API that needs documentation, or is it internal?
- Is the "Fast review" quality gate intentionally omitted from the website breakdown to keep the section concise, or was it an oversight?

5) TEST IDEAS:
- Run `npx opencastle --help` and compare output to README CLI table
- Run `npx opencastle run --help` and compare output to README run flags table
- Count `*.md` files in `src/orchestrator/agents/` programmatically and assert equals 18
- Count subdirectories in `src/orchestrator/skills/` and assert equals 34
- Count server entries in `src/orchestrator/mcp.json` and assert equals 11
- Verify all internal README links resolve (ARCHITECTURE.md, LICENSE, #task-queue, #contributing)
- Verify agent names in website's `agents` array match filenames in `src/orchestrator/agents/`

6) CONFIDENCE: high

---

## Reviewer 2

1) VERDICT: PASS

2) MUST-FIX:
- (none)

3) SHOULD-FIX:
- **Undocumented `--report-dir` CLI flag** — The `run` command accepts `--report-dir <path>` (run.ts line 46-48) to control where run reports are written. This is absent from the README's detailed run reference. Since this is a user-facing CLI flag, it should be documented in both the README table and potentially the website's autonomous mode section.
- **Website quality gates incomplete vs ARCHITECTURE.md** — ARCHITECTURE.md defines 6 quality gates (Deterministic, Fast review, Panel review, Structured disputes, Browser testing, Self-review). The website's dedicated quality gates section only has 5 cards, missing "Fast review" as a standalone card. While mentioned in the features section, the quality gates section should be a complete enumeration.
- **Workflow count verbally says 8 but directory has 9 files** — As stated, `shared-delivery-phase.md` is a shared fragment. But this means `ls src/orchestrator/agent-workflows/*.md | grep -v README | wc -l` returns 9, not 8. The claim "8 workflows" is semantically correct (8 standalone templates) but a reader exploring the directory would find a mismatch.
- **README task fields table missing `--help/-h` for run command** — The `--help` flag is implemented but not in the README reference table. Minor since `--help` is conventional, but the table should be exhaustive.

4) QUESTIONS:
- Are the model names (Claude Opus 4.6, Gemini 3.1 Pro, GPT-5.3-Codex, GPT-5 mini) actual model names, or aspirational/placeholder names?
- The "52K+ words of curated knowledge" stat on the website — is this validated automatically or was it a one-time count?

5) TEST IDEAS:
- Script to count words across all orchestrator files and verify "52K+ words" claim
- Snapshot test: agent list in website must equal sorted filenames from `src/orchestrator/agents/`
- Snapshot test: workflow list in website must equal sorted filenames from `src/orchestrator/agent-workflows/` (excluding shared-delivery-phase and README)
- Snapshot test: integration list in website must equal server keys from `src/orchestrator/mcp.json`
- Verify `package.json` `files` array includes all directories referenced by `bin/cli.mjs` (bin/, dist/)

6) CONFIDENCE: high

---

## Reviewer 3

1) VERDICT: PASS

2) MUST-FIX:
- (none)

3) SHOULD-FIX:
- **`--report-dir` flag missing from README documentation** — The run command in `run.ts` accepts `--report-dir <path>` to override the run report output directory (default: `.opencastle/runs`). This public flag is not listed in the README's CLI flags table.
- **Quality gates count mismatch: website (5) vs ARCHITECTURE.md (6)** — The website's quality gates section has 5 cards, while ARCHITECTURE.md lists 6 gates. The "Fast review" gate is referenced in the features section but doesn't get its own card in the quality gates section. Either add a 6th card for Fast review, or add a note explaining the omission.
- **`shared-delivery-phase.md` naming convention** — Consider prefixing with underscore (`_shared-delivery-phase.md`) or moving to a `shared/` subdirectory to make it clear this isn't a standalone workflow when browsing the filesystem.
- **No `opencastle dashboard` in website's installation code block** — The website's installation section shows `opencastle init`, `update`, `diff`, `eject`, `run` but doesn't show `dashboard`. The README CLI table does list it. Minor inconsistency.

4) QUESTIONS:
- Is the dashboard command intentionally omitted from the website installation section to keep it focused on onboarding?
- Should the website link to the GitHub wiki or additional docs beyond README/ARCHITECTURE?

5) TEST IDEAS:
- Integration test: `npx opencastle --version` outputs version matching `package.json`
- Integration test: `npx opencastle init --help` (or signal to verify help text exists)
- Count-validation CI check: count agents, skills, workflows, prompts, MCP servers and assert against documented numbers
- Link checker: validate all internal README links resolve
- Verify website `workflows` array length equals ARCHITECTURE.md workflow table rows
- Verify website `agents` array length equals 18 and names match

6) CONFIDENCE: high
