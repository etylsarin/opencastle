# Panel Review: website-readme-consistency

**Panel key:** `website-readme-consistency`
**Date:** 2026-02-28
**Reviewers:** 3
**Overall verdict:** **BLOCK** (3/3 unanimous)

---

## Vote Tally

| Reviewer | Verdict | Confidence |
|----------|---------|------------|
| A | BLOCK | 95% |
| B | BLOCK | 93% |
| C | BLOCK | 94% |

**Result: BLOCK (3/3)** — All reviewers independently identified the same critical issues.

---

## MUST-FIX Items (Unanimous — 3/3 agreement on all)

### MF-1: Website stats section shows "17 Specialist Agents" — should be "18"

- **File:** `website/src/pages/index.astro` (line ~580)
- **Current:** `<div class="stat__value">17</div>`
- **Expected:** `<div class="stat__value">18</div>`
- **Evidence:** 18 agent files exist in `src/orchestrator/agents/`. The hero section, features card, and agent subtitle on the **same page** already say 18.
- **Votes:** 3/3

### MF-2: Website stats section shows "27 On-Demand Skills" — should be "28"

- **File:** `website/src/pages/index.astro` (line ~584)
- **Current:** `<div class="stat__value">27</div>`
- **Expected:** `<div class="stat__value">28</div>`
- **Evidence:** 28 skill directories with SKILL.md exist. The features card on the same page already says 28.
- **Votes:** 3/3

### MF-3: Website CTA says "Seventeen specialists" — should be "Eighteen"

- **File:** `website/src/pages/index.astro` (line ~658)
- **Current:** `One Team Lead to coordinate. Seventeen specialists ready to build.`
- **Expected:** `One Team Lead to coordinate. Eighteen specialists ready to build.`
- **Evidence:** Same as MF-1. Internal page inconsistency — hero says "Eighteen", CTA says "Seventeen".
- **Votes:** 3/3

### MF-4: Slack listed as pre-configured MCP integration but NOT in mcp.json

- **File:** `website/src/pages/index.astro` (integrations section)
- **Issue:** Website shows Slack with "Notifications & team updates" as a pre-configured MCP integration alongside Linear, Supabase, Sanity, Vercel, Chrome DevTools. But `mcp.json` only contains 5 servers — Slack is not configured.
- **Fix:** Remove the Slack integration card from the website, OR add a Slack MCP server to `mcp.json`.
- **Votes:** 3/3

### MF-5: Tier naming inconsistency — "Utility" (website) vs "Fast" (README/registry)

- **Files:** `website/src/pages/index.astro` (agent array, tier card) vs `README.md` (Mermaid diagram, model tiers table) vs `agent-registry.md`
- **Issue:** Website calls the GPT-5.3-Codex tier "Utility". README and agent-registry call it "Fast". Both refer to the same tier with the same agents (Testing Expert, Data Expert, DevOps Expert, Release Manager).
- **Fix:** Pick one canonical name and use it everywhere. README/registry already use "Fast" — update website to match, or vice versa.
- **Votes:** 3/3

---

## SHOULD-FIX Items

### SF-1: Website workflow section says "8 prompt templates" — should be "9" (3/3)

- **File:** `website/src/pages/index.astro` (line ~422)
- **Current:** `8 prompt templates cover common tasks from brainstorming to PR reviews.`
- **Expected:** `9 prompt templates cover common tasks from brainstorming to PR reviews.`
- **Evidence:** 9 files in `src/orchestrator/prompts/`. README correctly says 9.

### SF-2: README battle-tested section says "88 orchestration files" — actual is 89 (3/3)

- **File:** `README.md`
- **Current:** `88 orchestration files`
- **Expected:** `89 orchestration files` (or recount periodically)
- **Evidence:** `find src/orchestrator -type f | wc -l` → 89

### SF-3: README "~45K tokens" is significantly understated (3/3)

- **File:** `README.md`
- **Current:** `~45K tokens of curated knowledge`
- **Evidence:** 58,321 words across all orchestration .md files ≈ ~77K tokens. Also, website says "52K+ words" which is closer but still understated.
- **Fix:** Update both to accurate figures, or use a consistent unit (words or tokens, not both).

### SF-4: Website Quality Gates section omits "Fast Review" card (2/3)

- **File:** `website/src/pages/index.astro` (Quality Gates section)
- **Issue:** README lists 6 quality gates. Website dedicated section has 5 cards (01–05), missing "Fast Review" as a standalone gate. It IS mentioned in the features section Quality Gates card.
- **Fix:** Add a "02 Fast Review" card between Deterministic Checks and Panel Majority Vote for parity with README.

### SF-5: Website stats subtitle "52K+ words" understated (2/3)

- **File:** `website/src/pages/index.astro` (line ~576)
- **Current:** `52K+ words of curated knowledge`
- **Expected:** `58K+ words` or similar
- **Evidence:** `wc -w` across all orchestration .md files → 58,321 words

---

## Items NOT flagged (verified correct)

- ✅ Getting Started flow accurately describes all 3 IDE outputs
- ✅ `npx opencastle init` → choose IDE → correct file format per IDE
- ✅ CLI commands table in README matches implementation
- ✅ All 8 workflow names and descriptions match actual files
- ✅ Agent-to-tier *assignments* are correct (same agents in same model groups)
- ✅ Model names (Claude Opus 4.6, Gemini 3.1 Pro, GPT-5.3-Codex, GPT-5 mini) are consistent
- ✅ Quality Gate descriptions (where present) are accurate
- ✅ Battle-Tested claims about fast review, structured disputes, self-improvement are accurate
- ✅ Dashboard section accurately describes functionality and flags

---

## Consensus Questions

1. **Canonical tier name: "Fast" or "Utility"?** — 3/3 reviewers flagged this. README/registry use "Fast" (2 sources), website uses "Utility" (1 source). Recommend adopting "Fast" as canonical since it has more existing usage and aligns with model-tier semantics.
2. **Slack integration: planned or premature?** — If planned, add to mcp.json; if aspirational, mark as "Coming Soon" or remove.
3. **Should a CI check enforce numeric consistency?** — All 3 reviewers suggested this. A simple script comparing counts against README/website values would prevent future drift.

---

## Summary

5 MUST-FIX items (all unanimous) that need resolution before the website and README can be considered consistent. The core issues are stale numbers in the website's stats/CTA sections, a phantom Slack integration, and a tier naming split. All 3 reviewers agreed on every MUST-FIX item. The SHOULD-FIX items are lower priority but would improve accuracy.
