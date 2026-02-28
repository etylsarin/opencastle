# Panel Review: website-readme-consistency — Raw Reviewer Outputs

**Panel key:** `website-readme-consistency`
**Date:** 2026-02-28
**Question:** Are the website (index.astro) and README.md consistent with each other and with the actual codebase? Specifically: (1) Do all numeric claims match? (2) Are agent counts, skill counts, workflow counts, prompt counts correct? (3) Is the Getting Started flow accurate for all 3 IDEs? (4) Is the website copy misleading in any way? (5) Do the tier assignments on the website match the agent-registry.md? (6) Are the 'Quality Gates' descriptions accurate? (7) Is the 'Battle-Tested' section in the README accurate?

---

## Reviewer A

### Ground Truth (from codebase)

| Metric | Actual Count |
|--------|-------------|
| Agent files (*.agent.md) | 18 |
| Skill directories (*/SKILL.md) | 28 |
| Workflow templates (excl. README.md & shared-delivery-phase.md) | 8 |
| Prompt files (*.prompt.md) | 9 |
| Orchestration .md files | 89 |
| Word count (all orchestration .md) | ~58,321 |
| MCP integrations in mcp.json | 5 (Sanity, Vercel, Supabase, Chrome DevTools, Linear) |

### Agent Tier Mapping (agent-registry.md)

| Agent | Registry Tier |
|-------|--------------|
| Team Lead | Premium (implied) |
| Architect | Premium |
| Security Expert | Premium |
| Developer | Standard |
| UI/UX Expert | Standard |
| Content Engineer | Standard |
| Database Engineer | Standard |
| Performance Expert | Standard |
| API Designer | Standard |
| Testing Expert | Fast |
| Data Expert | Fast |
| DevOps Expert | Fast |
| Release Manager | Fast |
| Documentation Writer | Economy |
| Researcher | Economy |
| Reviewer | Economy |
| Copywriter | Economy |
| SEO Specialist | Economy |

### Findings

#### (1) Numeric claims

| Claim Location | Claim | Actual | Match? |
|---------------|-------|--------|--------|
| README project structure | "18 specialist agent definitions" | 18 | ✅ |
| README project structure | "28 on-demand knowledge modules" | 28 | ✅ |
| README project structure | "8 reproducible execution templates" | 8 | ✅ |
| README project structure | "9 reusable prompt templates" | 9 | ✅ |
| README features table | "18 specialist agents" | 18 | ✅ |
| README features table | "28 on-demand skills" | 28 | ✅ |
| README features table | "8 workflow templates" | 8 | ✅ |
| README battle-tested | "88 orchestration files" | 89 | ❌ off by 1 |
| README battle-tested | "~45K tokens" | ~77K tokens (58K words × 1.33) | ❌ significantly understated |
| Website features cards | "18 Specialist Agents" | 18 | ✅ |
| Website features cards | "28 On-Demand Skills" | 28 | ✅ |
| Website features cards | "8 Workflow Templates" | 8 | ✅ |
| Website hero | "Eighteen specialists" | 18 | ✅ |
| **Website stats section** | **"17 Specialist Agents"** | **18** | **❌** |
| **Website stats section** | **"27 On-Demand Skills"** | **28** | **❌** |
| Website stats section | "8 Workflow Templates" | 8 | ✅ |
| Website stats section | "3 IDE Adapters" | 3 | ✅ |
| **Website CTA** | **"Seventeen specialists ready to build"** | **18** | **❌** |
| **Website workflow section** | **"8 prompt templates"** | **9** | **❌** |
| **Website stats subtitle** | **"52K+ words"** | **~58K words** | **⚠️ understated but directionally OK** |

#### (2) Agent/skill/workflow/prompt counts

- README: All correct.
- Website: Features cards correct (18/28/8). Stats section stale (17/27). CTA stale ("Seventeen"). Prompt count wrong (8 vs 9).

#### (3) Getting Started flow

- README: "Choose your IDE" ✅ (previously fixed from "detects your IDE").
- CLI output table shows 3 options: VS Code, Cursor, Claude Code. ✅
- Website installation section: Shows `npx opencastle init` with 3 IDE choices. Accurately describes output formats (`.github/` for VS Code, `.cursorrules` for Cursor, `CLAUDE.md` for Claude Code). ✅
- MCP server config mentioned in README and website. ✅

No issues with the Getting Started flow.

#### (4) Misleading website copy

- **Slack integration listed** in the website integrations section, but Slack is NOT present in the `mcp.json` config. The website displays "Slack — Notifications & team updates" as a pre-configured MCP integration. This is misleading — there is no Slack MCP server configured.
- The stats section's stale numbers (17 agents, 27 skills) contradict the features section (18 agents, 28 skills) on the same page.

#### (5) Tier assignments

- **Website uses "Utility" tier name** for Testing Expert, Data Expert, DevOps Expert, Release Manager.
- **README and agent-registry use "Fast" tier name** for the same agents.
- The underlying model (GPT-5.3-Codex) matches. But the tier name is inconsistent.
- Agent-to-tier assignments are otherwise correct.

#### (6) Quality Gates descriptions

- README lists 6 gates: Deterministic, Fast review, Panel review, Structured disputes, Browser testing, Self-review. ✅
- Website Quality Gates section has 5 cards (01–05): Deterministic Checks, Panel Majority Vote, Structured Disputes, Browser Testing, Self-Review. **Missing: Fast Review** as a standalone card.
- The website features card for Quality Gates does mention "Mandatory fast review after every step" — so it's covered in features, just not in the dedicated section.
- All descriptions in both README and website are accurate.

#### (7) Battle-Tested section

- "88 orchestration files" → Actually 89. Off by 1. Minor.
- "~45K tokens of curated knowledge" → Actual word count is 58K, which translates to ~77K tokens. Significantly understated.
- "8 workflow templates" → ✅
- "Mandatory fast review" → ✅ Accurate.
- "Structured dispute escalation" → ✅ Accurate.
- "Self-improving" → ✅ Accurate.

### VERDICT: **BLOCK**

### MUST-FIX

1. **Website stats: "17 Specialist Agents" → "18"** (`index.astro` line ~580, `<div class="stat__value">17</div>`)
2. **Website stats: "27 On-Demand Skills" → "28"** (`index.astro` line ~584, `<div class="stat__value">27</div>`)
3. **Website CTA: "Seventeen specialists" → "Eighteen specialists"** (`index.astro` line ~658)
4. **Website integrations: Remove Slack** or add actual Slack MCP config — Slack is listed as pre-configured but not in mcp.json
5. **Tier naming: Align "Utility" (website) with "Fast" (README/registry)** — pick one name, use it everywhere

### SHOULD-FIX

1. **Website workflow section: "8 prompt templates" → "9 prompt templates"** (`index.astro` line ~422)
2. **README battle-tested: "88 orchestration files" → "89"** (or recount and update)
3. **README battle-tested: "~45K tokens" → update** — actual content is ~58K words (~77K tokens)
4. **Website Quality Gates section: Add "Fast Review" as gate 02** (shift others down), or explicitly mention it in an existing card — currently it's only in the features card, not the dedicated section

### QUESTIONS

- Should "Utility" or "Fast" be the canonical tier name? "Fast" aligns with model-tier semantics (fast inference). "Utility" aligns with role semantics (utility tasks). Both are defensible.
- Is the Slack integration planned? If so, when will the MCP config be added?
- Is the "52K+ words" / "~45K tokens" claim intentionally conservative, or just stale?

### TEST IDEAS

- Automated script that extracts all numeric claims from README.md and index.astro, compares against `find`/`ls` counts, and fails CI if they diverge.
- Pre-commit hook or PR check that validates agent count in website matches `ls src/orchestrator/agents/*.agent.md | wc -l`.
- Integration test for MCP config: every service listed on the website must be a key in mcp.json.

### CONFIDENCE: 95%

---

## Reviewer B

### Ground Truth

Verified via filesystem:
- **18** agent files in `src/orchestrator/agents/`
- **28** skill directories with SKILL.md in `src/orchestrator/skills/`
- **8** workflow templates in `src/orchestrator/agent-workflows/` (excluding README.md and shared-delivery-phase.md)
- **9** prompt files in `src/orchestrator/prompts/`
- **89** total .md/.yml/.json files in `src/orchestrator/`
- **58,321** words across all orchestration .md files
- **5** MCP servers configured: Sanity, Vercel, Supabase, Chrome DevTools, Linear
- Agent-registry tier: "Fast" for Testing/Data/DevOps/Release Manager

### Cross-Reference Matrix

| Artifact | README | Website Features | Website Stats | Website CTA | Codebase | Consistent? |
|----------|--------|-----------------|---------------|-------------|----------|-------------|
| Agent count | 18 | 18 | **17** | **Seventeen** | 18 | ❌ |
| Skill count | 28 | 28 | **27** | — | 28 | ❌ |
| Workflow count | 8 | 8 | 8 | — | 8 | ✅ |
| Prompt count | 9 | — | — | — | 9 | ✅ |
| Prompt mention | — | **"8 prompt templates"** | — | — | 9 | ❌ |
| Tier name (mid-low) | Fast | — | — | — | Fast (registry) | — |
| Tier name (mid-low) | — | **Utility** | — | — | — | ❌ vs README |
| File count | 88 | — | — | — | 89 | ❌ |
| Token/word count | ~45K tokens | 52K+ words | — | — | 58K words | ❌ |
| Slack MCP | Not listed | Listed | — | — | Not configured | ❌ |

### Detailed Findings

**(1) Numeric claims** — Multiple stale values on the website. Stats section and CTA have old numbers. README file count and token estimates are stale.

**(2) Agent/skill/workflow/prompt counts** — Website features section is correct. Stats section is wrong. README is correct except for file count in battle-tested section.

**(3) Getting Started** — Accurate for all 3 IDEs. "Choose your IDE" correctly describes user-initiated selection. Output formats correctly described.

**(4) Misleading copy** — Two issues:
1. **Slack integration card** implies Slack MCP is pre-configured and ready to use. It is not in the MCP config. This is objectively misleading.
2. **Internal numeric contradictions** on the same page (hero says 18, stats says 17) are confusing and undermine credibility.

**(5) Tier assignments** — All agent-to-tier mappings are correct. The only issue is the naming: website says "Utility" where README/registry says "Fast." The underlying model assignment (GPT-5.3-Codex) is consistent.

**(6) Quality Gates** — Descriptions are accurate. The README's 6-gate list includes "Fast review" which the website's dedicated Quality Gates section omits (it has 5 numbered cards). However, fast review IS mentioned in the features section's Quality Gates card. Not inaccurate, but incomplete in the dedicated section.

**(7) Battle-Tested** — Claims are directionally accurate but numerically stale:
- "88 orchestration files" → 89 (off by 1)
- "~45K tokens" → significantly understated; 58K words ≈ 77K tokens
- Other claims (8 workflows, mandatory fast review, structured disputes, self-improving) are accurate.

### VERDICT: **BLOCK**

### MUST-FIX

1. **Website stats "17" → "18" agents** (stale, contradicts hero/features on same page)
2. **Website stats "27" → "28" skills** (stale, contradicts features on same page)
3. **Website CTA "Seventeen" → "Eighteen"** (stale)
4. **Remove Slack from website integrations** (or add `slack` to mcp.json) — listing an unconfigured integration as "pre-configured" is misleading
5. **Align tier name**: "Utility" on website vs "Fast" in README/registry — choose one

### SHOULD-FIX

1. **Website: "8 prompt templates" → "9 prompt templates"** in workflow section subtitle
2. **README: "88 orchestration files" → "89"**
3. **README: "~45K tokens" → "~77K tokens" or "58K+ words"** to match reality; also update website "52K+ words" → "58K+ words"
4. **Website Quality Gates section: Consider adding Fast Review** as a numbered card for completeness

### QUESTIONS

- Is Slack MCP planned as a future integration? If so, mark it as "Coming Soon" on the website rather than listing it alongside configured integrations.
- What's the canonical tier name — Fast or Utility?
- Should there be a CI check to keep these numbers in sync?

### TEST IDEAS

1. Add a `verify-claims.sh` script to CI that counts agents/skills/workflows/prompts and asserts they match README and website values.
2. Parse mcp.json keys and assert every website integration card has a matching key.
3. Snapshot the README/website numeric claims in a test fixture and compare against filesystem.

### CONFIDENCE: 93%

---

## Reviewer C

### Verification Data

**Filesystem:**
- 18 × `*.agent.md` in `src/orchestrator/agents/`
- 28 × `*/SKILL.md` in `src/orchestrator/skills/`
- 8 workflow templates (bug-fix, data-pipeline, database-migration, feature-implementation, performance-optimization, refactoring, schema-changes, security-audit) + README.md + shared-delivery-phase.md = 10 files total
- 9 × `*.prompt.md` in `src/orchestrator/prompts/`
- 89 total orchestration files
- ~58K words across all .md files
- MCP config: Sanity, Vercel, Supabase, chrome-devtools, Linear (5 total, no Slack)

**Agent-Registry Tier Assignments (source of truth):**
- Premium: Architect, Security Expert (+ Team Lead implicitly)
- Standard (Gemini 3.1 Pro): Developer, UI/UX Expert, Content Engineer, Database Engineer, Performance Expert, API Designer
- Fast (GPT-5.3-Codex): Testing Expert, Data Expert, DevOps Expert, Release Manager
- Economy (GPT-5 mini): Documentation Writer, Researcher, Reviewer, Copywriter, SEO Specialist

### (1) Numeric Claims Audit

**README.md — all claims verified:**

| Claim | Value | Actual | Status |
|-------|-------|--------|--------|
| Agent definitions | 18 | 18 | ✅ |
| On-demand skills | 28 | 28 | ✅ |
| Workflow templates | 8 | 8 | ✅ |
| Prompt templates | 9 | 9 | ✅ |
| Orchestration files (battle-tested) | 88 | 89 | ⚠️ off by 1 |
| Token estimate (battle-tested) | ~45K tokens | ~77K tokens | ⚠️ stale |

**Website (index.astro) — claims verified:**

| Location | Claim | Actual | Status |
|----------|-------|--------|--------|
| Features card | 18 Specialist Agents | 18 | ✅ |
| Features card | 28 On-Demand Skills | 28 | ✅ |
| Features card | 8 Workflow Templates | 8 | ✅ |
| Hero text | "Eighteen specialists" | 18 | ✅ |
| Agents subtitle | "18 specialist agents" | 18 | ✅ |
| **Stats counter** | **17 Specialist Agents** | **18** | **❌ WRONG** |
| **Stats counter** | **27 On-Demand Skills** | **28** | **❌ WRONG** |
| Stats counter | 8 Workflow Templates | 8 | ✅ |
| Stats counter | 3 IDE Adapters | 3 | ✅ |
| **CTA text** | **"Seventeen specialists"** | **18** | **❌ WRONG** |
| Workflow subtitle | "8 prompt templates" | 9 | ⚠️ Wrong count |
| Stats subtitle | "52K+ words" | ~58K words | ⚠️ understated |

### (2) Agent/skill/workflow/prompt counts

README is fully accurate. Website has 3 stale numeric values (stats: 17 agents, 27 skills; CTA: "Seventeen") and one wrong count (workflow subtitle: 8 prompts instead of 9).

### (3) Getting Started flow — All 3 IDEs

README:
- `npx opencastle init` → choose IDE → generates correct format. Accurately describes VS Code (.github/), Cursor (.cursorrules + .cursor/rules/), Claude Code (CLAUDE.md + .claude/). ✅
- MCP server config mentioned. ✅

Website:
- Same flow described in installation section with code block. ✅
- 3 IDE options shown. ✅

No inaccuracies in the Getting Started flow.

### (4) Misleading website copy

**Two misleading items:**

1. **Slack integration** — The website's integrations section lists 6 pre-configured MCP integrations: Linear, Supabase, Sanity, Vercel, Chrome DevTools, **Slack**. But `mcp.json` only contains 5 servers (no Slack). Listing Slack as "pre-configured" when it has no config is misleading.

2. **Internal contradictions** — The page says "18" in three places (hero, features card, agents subtitle) and "17" in two places (stats counter, CTA). A visitor scrolling the page will see conflicting numbers.

### (5) Tier assignments vs agent-registry.md

**Website agent array:**

| Agent | Website Tier | Registry Tier | Match? |
|-------|-------------|---------------|--------|
| Team Lead | premium | Premium (implied) | ✅ |
| Architect | premium | Premium | ✅ |
| Security Expert | premium | Premium | ✅ |
| Developer | standard | Standard | ✅ |
| UI/UX Expert | standard | Standard | ✅ |
| Content Engineer | standard | Standard | ✅ |
| Database Engineer | standard | Standard | ✅ |
| Performance Expert | standard | Standard | ✅ |
| API Designer | standard | Standard | ✅ |
| Testing Expert | **utility** | **Fast** | ❌ naming |
| Data Expert | **utility** | **Fast** | ❌ naming |
| DevOps Expert | **utility** | **Fast** | ❌ naming |
| Release Manager | **utility** | **Fast** | ❌ naming |
| Documentation Writer | economy | Economy | ✅ |
| Researcher | economy | Economy | ✅ |
| Reviewer | economy | Economy | ✅ |
| Copywriter | economy | Economy | ✅ |
| SEO Specialist | economy | Economy | ✅ |

The agent-to-tier *mapping* is correct (same agents in same model group). The *name* of the tier differs: "utility" on the website vs "Fast" in README and agent-registry. The README also has a "Model tiers" table that calls it "Fast". This naming inconsistency should be resolved.

### (6) Quality Gates descriptions

README lists 6 gates:
1. Deterministic — lint, type-check, unit tests, build ✅
2. Fast review — mandatory single-reviewer after every delegation ✅
3. Panel review — 3 isolated reviewers, 2/3 majority ✅
4. Structured disputes — formal dispute records ✅
5. Browser testing — Chrome DevTools MCP at 3 breakpoints ✅
6. Self-review — "What edge cases am I missing?" ✅

Website Quality Gates section has 5 cards:
1. Deterministic Checks ✅
2. Panel Majority Vote ✅
3. Structured Disputes ✅
4. Browser Testing ✅
5. Self-Review ✅

**Missing from website QG section: "Fast Review"** — though it IS mentioned in the features card. Not inaccurate, but the dedicated QG section is incomplete vs the README.

All descriptions that are present are accurate.

### (7) Battle-Tested section (README)

- "88 orchestration files" → 89 actual. Off by 1. ⚠️
- "~45K tokens of curated knowledge" → ~58K words ≈ ~77K tokens. Significantly understated. ⚠️
- "8 workflow templates covering the full SDLC" → ✅
- "Mandatory fast review on every step" → ✅ Verified in fast-review skill
- "Structured dispute escalation" → ✅
- "Self-improving — agents capture lessons and graduate them" → ✅ Verified self-improvement and memory-merger skills exist

### VERDICT: **BLOCK**

### MUST-FIX

1. **`index.astro` stats: "17" → "18" Specialist Agents**
2. **`index.astro` stats: "27" → "28" On-Demand Skills**
3. **`index.astro` CTA: "Seventeen" → "Eighteen"**
4. **`index.astro` integrations: Remove Slack card** (not in mcp.json, misleading)
5. **Tier naming: Harmonize "Utility" (website) ↔ "Fast" (README/registry)**

### SHOULD-FIX

1. **`index.astro` workflow subtitle: "8 prompt templates" → "9 prompt templates"**
2. **README battle-tested: "88 orchestration files" → "89"**
3. **README battle-tested: "~45K tokens" → more accurate figure** (e.g., "~77K tokens" or "58K+ words")
4. **Website stats subtitle: "52K+ words" → "58K+ words"** or similar
5. **Website QG section: Add Fast Review card** for parity with README

### QUESTIONS

- Is "Fast" or "Utility" the desired canonical tier name?
- Is Slack MCP integration planned? If so, add it to mcp.json; if not, remove from website.
- Should a CI script enforce that README/website numbers match filesystem counts?

### TEST IDEAS

1. CI script: `count-and-assert.sh` — counts agents, skills, workflows, prompts and asserts matches against README/index.astro values.
2. MCP config lint: every integration card on website must have a corresponding mcp.json key.
3. Word/token count tracker that updates README automatically on release.

### CONFIDENCE: 94%
