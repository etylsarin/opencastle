# Panel Reviewer Outputs: orchestrator-content

## Context
- **Run root:** `/Users/filip/repos/hospitality-sites/opencastle`
- **Panel key:** `orchestrator-content`
- **Question:** "Is the orchestrator content (agent definitions, skills, workflows, prompts, instructions) internally consistent and complete? Specifically: (1) Do all 18 agent definitions in src/orchestrator/agents/ have proper frontmatter with name, description, and model assignment? (2) Are the model tier assignments consistent with what README.md and website claim (Premium: Team Lead, Architect, Security; Standard: Developer, UI/UX, Content Engineer, Database, Perf, API; Fast: Testing, Data, DevOps, Release Manager; Economy: Docs, Researcher, Reviewer, Copywriter, SEO)? (3) Do all 28 skills in src/orchestrator/skills/ have SKILL.md files with name and description frontmatter? (4) Do the 8 workflow templates reference agents and skills that actually exist? (5) Do the 9 prompts reference valid agent names and workflow names? (6) Does copilot-instructions.md accurately describe the framework structure? (7) Are there any orphaned or missing cross-references between agents, skills, workflows, and prompts?"
- **In-scope artifacts:**
  - `src/orchestrator/agents/` — 18 .agent.md files
  - `src/orchestrator/skills/` — 28 subdirectories with SKILL.md files
  - `src/orchestrator/agent-workflows/` — 8 workflow templates + README.md + shared-delivery-phase.md
  - `src/orchestrator/prompts/` — 9 prompt files
  - `src/orchestrator/instructions/` — 2 instruction files
  - `src/orchestrator/copilot-instructions.md`
  - `src/orchestrator/customizations/` — template files including agents/skill-matrix.md
  - `README.md`

---

## Reviewer 1

VERDICT: PASS

MUST-FIX:
- (none)

SHOULD-FIX:
- **Model name discrepancy (README vs agent files):** README.md model tier table says "Gemini 3.1 Pro" but all 6 Standard-tier agent files specify `model: Gemini 3.1 Pro (Preview)`. The "(Preview)" suffix should either be added to the README or removed from the agent files for consistency. Affects: README.md lines ~160-165, and agent files for developer, ui-ux-expert, content-engineer, database-engineer, performance-expert, api-designer.
- **generate-task-spec.prompt.md Agent Roster omits `reviewer`:** The Agent Roster section in the generate-task-spec prompt lists 17 agents but omits the Reviewer agent. While this is likely intentional (Reviewer is an internal QA gate, not a task executor), a brief comment in the prompt explaining the omission would prevent confusion. The README claims 18 agents, and users might expect all 18 to be valid. Affected file: `src/orchestrator/prompts/generate-task-spec.prompt.md`.
- **copilot-instructions.md is minimal:** The entry point file says only "All conventions, architecture, and project context live in `.github/instructions/`. Read those files before making changes." It doesn't mention agents, skills, workflows, or prompts — the four primary content categories. While this may be by design (keeping it simple), it could be slightly expanded to list the directory structure so first-time users know what exists.

QUESTIONS:
- Is the "(Preview)" suffix on Gemini 3.1 Pro intentional, reflecting a pre-release model? If so, should README reflect this?
- Is the Reviewer omission from the task spec roster documented anywhere?

TEST IDEAS:
- Add a validation script that parses all agent frontmatter and checks model values against a canonical tier map
- Add a CI check that verifies the Agent Roster in generate-task-spec matches the list of .agent.md files (minus Reviewer, with a comment explaining why)

CONFIDENCE: high

---

## Reviewer 2

VERDICT: PASS

MUST-FIX:
- (none)

SHOULD-FIX:
- **Standard-tier model name inconsistency:** Agent files use `Gemini 3.1 Pro (Preview)` while README.md uses `Gemini 3.1 Pro`. This creates a subtle discrepancy where programmatic parsing of model values would not match the documented tier table. All six Standard-tier agents are affected.
- **README Economy tier description is reductive:** The README model tier table describes Economy as "Documentation" but the Economy tier also includes Researcher, Reviewer, Copywriter, and SEO Specialist — roles that go well beyond documentation. The "Use case" column should reflect the broader scope (e.g., "Documentation, research, review, copy, SEO").
- **Workflow references use `.github/` paths:** Workflow templates and agents reference paths like `.github/agent-workflows/`, `.github/customizations/agents/skill-matrix.md`, etc. These are the *deployed* paths, not the source paths under `src/orchestrator/`. This is correct by design (agents consume deployed files, not source), but worth noting that any CI validation on the source tree would need path translation.
- **copilot-instructions.md doesn't mention the four content types:** The framework has agents, skills, workflows, and prompts as first-class concepts, but the entry point file only mentions instructions. A one-line addition listing the content types would improve discoverability.

QUESTIONS:
- Should the Economy tier "Use case" column in the README be more descriptive?
- Are there any agents that reference skills which don't exist? (Verified: No — all skill references resolve.)

TEST IDEAS:
- Script to extract all skill references from agent files and verify each matches a skill directory
- Lint rule ensuring model values in agent frontmatter match a canonical list

CONFIDENCE: high

---

## Reviewer 3

VERDICT: PASS

MUST-FIX:
- (none)

SHOULD-FIX:
- **Model string inconsistency across README and agents:** `Gemini 3.1 Pro` (README) vs `Gemini 3.1 Pro (Preview)` (6 agent files). This is the only data inconsistency found across the entire orchestrator content. Should be harmonized.
- **Task spec prompt omits Reviewer from agent roster:** `generate-task-spec.prompt.md` lists 17 of 18 agents. The Reviewer agent is omitted, which is defensible (it's a QA agent, not a task executor) but undocumented. Adding a comment like `<!-- reviewer omitted: internal QA agent, not a task executor -->` would prevent future confusion.
- **No cross-reference index:** There is no single document mapping which agents reference which skills, which workflows reference which agents, etc. A cross-reference matrix would make maintenance easier and allow automated validation. This is a nice-to-have, not a bug.

QUESTIONS:
- Would a generated cross-reference matrix (agent → skills, workflow → agents, prompt → agents) be valuable for maintenance?

TEST IDEAS:
- Create a `validate-orchestrator.mjs` script that:
  1. Lists all .agent.md files, extracts frontmatter, verifies name/description/model
  2. Lists all skill directories, verifies SKILL.md exists with name/description
  3. Extracts agent references from workflows and verifies they exist
  4. Extracts agent references from prompts and verifies they exist
  5. Compares model values against a canonical tier map

CONFIDENCE: high
