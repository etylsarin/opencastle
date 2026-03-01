# Panel Report

## Context
- Run root:
  - `/Users/filip/repos/hospitality-sites/opencastle/`
- Panel key: `docs-website-accuracy`
- Question asked: "Are the OpenCastle README.md, ARCHITECTURE.md, and website (website/src/pages/index.astro) accurate, complete, and consistent with the actual codebase? Check: feature claims match implementation, counts are correct (agents, skills, workflows, integrations), CLI commands documented match actual commands, code examples work, no broken links or misleading information, and installation instructions are correct."
- Artifacts in scope:
  - `README.md`
  - `ARCHITECTURE.md`
  - `website/src/pages/index.astro`
  - `package.json`
  - `bin/cli.mjs`
  - `src/cli/init.ts`, `update.ts`, `diff.ts`, `eject.ts`, `run.ts`, `dashboard.ts`
  - `src/orchestrator/agents/` (18 .md files)
  - `src/orchestrator/skills/` (34 subdirectories)
  - `src/orchestrator/agent-workflows/` (9 .md files excl. README)
  - `src/orchestrator/prompts/` (9 .md files)
  - `src/orchestrator/mcp.json` (11 server entries)
- Reviewer runs:
  - N = 3
- Reviewer outputs source:
  - `panel/docs-website-accuracy-reviewer-outputs.md`

## Panel verdict
- Overall: **PASS**

## Vote tally
- PASS: 3
- BLOCK: 0

## Must-fix
(none — all 3 reviewers reported no must-fix items)

## Should-fix

| # | Issue | Flagged by |
|---|-------|------------|
| 1 | **`--report-dir` CLI flag undocumented** — `run.ts` accepts `--report-dir <path>` to override run report output directory, but this flag is not in the README's CLI flags reference table. | 3/3 |
| 2 | **Website quality gates section shows 5 cards, ARCHITECTURE.md lists 6** — "Fast review" gate is missing as a dedicated card in the website. It's mentioned in the Features section's "Quality Gates" card, but the quality gates breakdown is incomplete vs ARCHITECTURE.md. | 3/3 |
| 3 | **`shared-delivery-phase.md` naming/location could cause counting confusion** — `agent-workflows/` has 9 .md files (excl. README) but docs claim "8 workflows". The 9th is a shared fragment. Consider underscore prefix (`_shared-delivery-phase.md`) or subdirectory to disambiguate. | 3/3 |
| 4 | **`dashboard` command missing from website installation code block** — Website installation section shows init, update, diff, eject, run but not dashboard. README CLI table includes it. | 1/3 |
| 5 | **README run flags table missing `--help/-h`** — Conventional but not listed in the reference. | 1/3 |

## Questions / Ambiguities
- Are model names (Claude Opus 4.6, Gemini 3.1 Pro, GPT-5.3-Codex, GPT-5 mini) actual or aspirational? (1/3)
- Is the "52K+ words" stat on the website auto-validated or a one-time count? (1/3)
- Is `--report-dir` considered public API or internal? (1/3)
- Is "Fast review" intentionally omitted from website quality gates section for conciseness? (1/3)
- Is `dashboard` intentionally omitted from website installation section? (1/3)

## Disagreements
- Minor disagreement on `dashboard` omission from website (flagged by 1 of 3 reviewers as should-fix; others didn't mention it).
- Minor disagreement on `--help/-h` omission from README run flags table (flagged by 1 of 3).
- No material conflicts in verdicts or critical assessments.

## Determinize next
1. **Add a CI count-validation check** — Script that counts agents, skills, workflows (excluding shared fragments), prompts, and MCP servers, then asserts against documented numbers. Prevents drift.
2. **Snapshot tests for website arrays** — Assert that `agents`, `workflows`, and integration arrays in `index.astro` match actual filesystem contents.
3. **Link checker** — Automated check that all internal README links resolve to existing files.
4. **Word count automation** — If the "52K+ words" claim is featured, automate the count in CI.
