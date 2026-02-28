---
name: panel-majority-vote
description: "Run 3 isolated reviewer sub-agents against the same question and decide PASS/BLOCK by majority vote (2/3 wins). Use when deterministic verification is insufficient."
---

# Skill: Panel majority vote (3 reviewers)

Use this skill when deterministic verification is unavailable and you need a panel to decide PASS/BLOCK for a single question against a declared artifact scope.

## Contract
- Scope is exactly one run root and one panel key.
- Reviewers must only use the declared in-scope artifacts.
- Exactly 3 isolated reviewer runs.
- Majority vote decides overall verdict (2/3 wins).
- Consolidated panel report must include a short retry summary when BLOCK.

## Inputs
- Run root: `<runRoot>`
- Panel key: `<panelKey>` (a filesystem-safe identifier used to name output files)
- Exact question text (single question)
- Explicit in-scope artifact list (all under the same run root)

Optional (defaults shown):
- Panel output directory: `<panelDir>` (default: `<runRoot>/panel/`)

## Outputs (files)
- (Optional) Prompt payload: `<panelDir>/<panelKey>-panel-prompt.md`
- Raw reviewer outputs: `<panelDir>/<panelKey>-reviewer-outputs.md`
- Consolidated report: `<panelDir>/<panelKey>.md`

## Procedure (required: run in isolation)
Run this skill in an isolated subagent (using `runSubagent`) so the panel cannot accidentally consult unrelated workspace context.

The isolated runner subagent must:
1. Validate scope
  - Ensure every in-scope artifact path is under `<runRoot>`.
  - Ensure the in-scope list is sufficient to answer the question.

2. Spawn exactly 3 reviewers (in parallel)
  - Launch 3 isolated reviewer subagents (using `runSubagent`) with the exact same prompt payload.
  - The prompt payload may be passed directly to the reviewer subagents (no file required).
  - If you want an explicit artifact of the prompt payload, optionally write it to `<panelDir>/<panelKey>-panel-prompt.md`.
  - Reviewer prompt must require this strict output format:
    1) VERDICT: PASS | BLOCK
    2) MUST-FIX:
    - ...
    3) SHOULD-FIX:
    - ...
    4) QUESTIONS:
    - ...
    5) TEST IDEAS:
    - ...
    6) CONFIDENCE: low | med | high
  - Reviewers must not include any other sections.

3. Persist reviewer outputs (required audit trail)
  - Create/overwrite `<panelDir>/<panelKey>-reviewer-outputs.md`.
  - Include at the top:
    - Run root
    - Panel key
    - Question text
    - In-scope artifact list
    - (Optional) The exact prompt payload text provided to reviewers
  - Then include each reviewer output verbatim, clearly separated.

4. Consolidate by majority vote (2/3 wins)
  - Compute:
    - PASS count
    - BLOCK count
    - Overall = PASS if PASS >= 2 else BLOCK
  - Deduplicate MUST-FIX and SHOULD-FIX items; annotate how many reviewers flagged each.
  - Record disagreements (items flagged by only 1 reviewer; or materially conflicting assessments).
  - Include determinize-next recommendations.
  - If Overall = BLOCK, include a short Retry summary:
    - top changes required before retrying

5. Write the consolidated panel report
 - Create `<panelDir>/<panelKey>.md` using the template in `panel-report.template.md` (in this directory).

6. Print a concise summary to chat
  - Overall verdict + vote tally + path to `<panelDir>/<panelKey>.md`.

7. Log the panel result
  - Append a JSON line to `.github/customizations/logs/panels.ndjson` with the panel record schema (see `.github/customizations/logs/README.md`).
  - Include: `timestamp`, `panel_key`, `verdict`, `pass_count`, `block_count`, `must_fix`, `should_fix`, `reviewer_model`, `weighted`, `attempt`, `linear_issue`, `artifacts_count`, `report_path`.
  - Example:
    ```bash
    echo '{"timestamp":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'","panel_key":"instruction-refactoring","verdict":"pass","pass_count":3,"block_count":0,"must_fix":0,"should_fix":5,"reviewer_model":"claude-opus-4-6","weighted":false,"attempt":1,"artifacts_count":14,"report_path":".github/customizations/logs/panel/instruction-refactoring.md"}' >> .github/customizations/logs/panels.ndjson
    ```

Finally: ensure whatever produced the claim being verified links the consolidated panel report as verification evidence.

## Notes
- If the panel output is BLOCK, prefer to change the underlying work and re-run the same panel question over re-wording the question.
- After 3 consecutive BLOCKs on the same panel key, create a **dispute record** in `.github/customizations/DISPUTES.md` instead of retrying further. The dispute packages the agent's position, all reviewer feedback, attempt history, and resolution options for human decision-making. See the **team-lead-reference** skill § Dispute Protocol for the full procedure.

## Model Selection for Reviewers

Choose reviewer models based on the domain being reviewed:
- **Security, architecture, complex logic** → Premium (Claude Opus 4.6) for all 3 reviewers
- **Feature implementation, UI, queries** → Standard (Gemini 3.1 Pro) for all 3 reviewers
- **Mixed-domain review** → Use Premium for at least 1 reviewer, Standard for the other 2

All 3 reviewers should use the same model to ensure comparable verdicts. Mixing models can lead to inconsistent review depth and confusing disagreements.

## Weighted Consensus Variant

Extends the panel system for subjective decisions where domain expertise should weight more heavily than a simple head-count.

### When to Use Weighted Consensus

| Decision Type | Use Simple Majority | Use Weighted Consensus |
|--------------|--------------------|-----------------------|
| Security vulnerability present? | ✅ | — |
| Code correctness | ✅ | — |
| Best UI approach for user experience | — | ✅ |
| Architecture tradeoff (performance vs maintainability) | — | ✅ |
| Data model design choices | — | ✅ |
| Naming conventions / code style disputes | — | ✅ |

### Weight Assignment Rules

Each reviewer gets a weight based on 3 factors:

| Factor | Weight Bonus | Example |
|--------|-------------|---------|
| **Domain expertise** | +2 | Security Expert reviewing auth code |
| **Confidence level** | +1 (high) / 0 (med) / -1 (low) | Self-reported by reviewer |
| **Prior success** | +1 | Agent has >80% success rate for similar reviews (from AGENT-PERFORMANCE.md) |

**Base weight:** 1 for all reviewers. Add bonuses to get final weight.

**Example:**

```text
Reviewer 1 (Security Expert, reviewing auth): base 1 + domain 2 + confidence 1 = weight 4
Reviewer 2 (Next.js Dev, reviewing auth):     base 1 + domain 0 + confidence 1 = weight 2
Reviewer 3 (Architect, reviewing auth):        base 1 + domain 1 + confidence 0 = weight 2
```

### Weighted Voting Protocol

1. **Assign weights** to each reviewer before spawning them (based on their role relative to the review domain)
2. **Spawn reviewers** with the same prompt as simple majority (use the existing procedure)
3. **Collect verdicts** — each reviewer submits PASS/BLOCK with confidence level
4. **Calculate weighted score:**
   - Sum weights of PASS reviewers → PASS score
   - Sum weights of BLOCK reviewers → BLOCK score
   - Overall = PASS if PASS score > BLOCK score, else BLOCK
5. **Tie-breaking:** If scores are equal, the reviewer with the highest individual weight breaks the tie. If weights are also equal, default to BLOCK (conservative).

### Conflict Resolution

- If a low-weight reviewer BLOCKs but high-weight reviewers PASS: note the BLOCK concerns in the report but overall PASS. Include the low-weight MUST-FIX items as SHOULD-FIX instead.
- If the domain expert BLOCKs but generalists PASS: overall BLOCK. Domain expertise overrides general opinion.
- If all reviewers have equal weight: falls back to simple majority vote (2/3 wins).

### Weighted Panel Report Extension

Add these fields to the consolidated panel report template when using weighted consensus:

```markdown
### Weighting
| Reviewer | Role | Domain | Confidence | Prior Success | Final Weight |
|----------|------|--------|------------|---------------|-------------|
| 1 | [Agent] | +X | +X | +X | X |
| 2 | [Agent] | +X | +X | +X | X |
| 3 | [Agent] | +X | +X | +X | X |

### Weighted Score
- PASS: X (reviewers: 1, 3)
- BLOCK: X (reviewer: 2)
- **Overall: PASS/BLOCK** (weighted)
```

### Integration with Existing Panel Workflow

The weighted consensus variant follows the SAME procedure steps (1-6) from the main panel protocol. The only differences are:
1. Weight assignment happens in step 2 (before spawning reviewers)
2. Step 4 uses weighted calculation instead of simple count
3. The consolidated report includes the weighting table

The Team Lead decides whether to use simple majority or weighted consensus when scheduling the panel review. Include the decision rationale in the delegation prompt.

