````skill
---
name: fast-review
description: "Mandatory single-reviewer gate that runs after every agent delegation. Provides automatic retry with feedback and escalation to panel review after repeated failures. Essential for overnight/long-running autonomous sessions."
---

# Skill: Fast Review

Mandatory lightweight review that runs after **every** agent delegation. Inspired by the [Steroids CLI](https://github.com/UnlikeOtherAI/steroids-cli) coder/reviewer separation pattern.

## Why Fast Review Exists

Panel reviews (3 reviewers, majority vote) are thorough but expensive and slow. Running them after every step is impractical. Without any review, agent output ships unchecked — risky for overnight runs where no human is watching.

Fast review fills the gap: **a single reviewer sub-agent that validates every delegation output before acceptance**, with automatic retry and escalation.

```
                    ┌─────────────────────────────────┐
                    │         Agent completes          │
                    └────────────┬────────────────────┘
                                 │
                    ┌────────────▼────────────────────┐
                    │     Fast Review (mandatory)      │
                    │     Single reviewer sub-agent    │
                    └────────────┬────────────────────┘
                                 │
                    ┌────────────▼────────────────────┐
                    │          PASS?                   │
                    ├── YES ──▶ Accept & continue      │
                    ├── FAIL ──▶ Retry (up to 2x)     │
                    └── 3x FAIL ──▶ Escalate to panel │
                                                      │
                    ┌─────────────────────────────────┐
                    │   Panel Review (escalation)      │
                    │   3 reviewers, majority vote     │
                    ├── PASS ──▶ Accept                │
                    ├── BLOCK ──▶ Re-delegate + retry  │
                    └── 3x BLOCK ──▶ Dispute record   │
                                       │
                    ┌──────────────────▼──────────────┐
                    │   Dispute (human decision)       │
                    │   Both perspectives + options    │
                    │   → Human picks resolution       │
                    └─────────────────────────────────┘
```

## When to Use

| Scenario | Use Fast Review | Use Panel Review |
|----------|----------------|-----------------|
| Any agent delegation output | **Always** (mandatory) | — |
| Security changes (auth, RLS, headers) | ✅ then also → | **Always** |
| DB migrations | ✅ then also → | **Always** |
| Architecture decisions | ✅ then also → | **Always** |
| Complex business logic without tests | ✅ then also → | **Recommended** |
| Feature implementation with tests | ✅ | Only if fast review flags concerns |
| Config changes, docs, simple fixes | ✅ | No |

Fast review is **never skipped**. Panel review remains opt-in for high-stakes work, or triggers as escalation when fast review fails repeatedly.

## Contract

- Runs **after every delegation** — no exceptions.
- Single reviewer sub-agent (not 3).
- Uses Economy/Standard tier models (cost-efficient).
- Produces PASS or FAIL with structured feedback.
- On FAIL: automatic retry with reviewer feedback (up to 2 retries).
- On 3rd FAIL: auto-escalates to panel review.
- Total review time budget: ~2-5 minutes per review.

## Reviewer Model Selection

| Implementation Agent Tier | Reviewer Model | Rationale |
|--------------------------|---------------|-----------|
| Economy (GPT-5 mini) | GPT-5 mini | Peer-level review is sufficient |
| Utility (GPT-5.3-Codex) | GPT-5 mini | One tier lower for cost savings |
| Standard (Gemini 3.1 Pro) | GPT-5 mini | Economy is enough for structured checks |
| Premium (Claude Opus 4.6) | Gemini 3.1 Pro | Premium work deserves Standard review |

**Override:** If the task touches security, auth, or data integrity, upgrade the reviewer to Standard regardless of the implementation tier.

## Procedure

### Step 1: Collect Review Context

Before spawning the reviewer, gather:

1. **Issue** — acceptance criteria from the tracked issue
2. **File diff** — list of changed files and their contents (or key sections)
3. **File partition** — the agent's assigned files (to check for boundary violations)
4. **Deterministic results** — lint, test, build output (already run as part of validation gates)
5. **Agent's self-report** — what the agent claims to have done

### Step 2: Spawn Reviewer Sub-Agent

Launch a single `runSubagent` with the review prompt (see § Reviewer Prompt Template below).

**Critical:** The reviewer runs in an isolated sub-agent context. It must NOT have access to the original delegation prompt — it reviews the *output*, not the *intent*. The acceptance criteria from the issue serve as the objective reference.

### Step 3: Parse Verdict

The reviewer must output this exact structure:

```
VERDICT: PASS | FAIL

ISSUES:
- [severity:critical|major|minor] Description of issue
- [severity:critical|major|minor] Description of issue

FEEDBACK:
Specific, actionable feedback for the implementer if FAIL.

CONFIDENCE: low | medium | high
```

**Verdict rules:**
- **PASS** — No critical or major issues. Minor issues are noted but don't block.
- **FAIL** — At least one critical or major issue found.

**Auto-PASS conditions (skip reviewer):**
- The delegation was pure research/exploration with no code changes
- The delegation only modified documentation files (`.md`)
- All deterministic gates already passed AND the change is ≤10 lines across ≤2 files

### Step 4: Handle Verdict

#### On PASS

1. Accept the agent's output
2. Log the review result (see § Logging)
3. Continue orchestration

#### On FAIL (attempt 1 or 2)

1. Log the review result
2. Extract the reviewer's ISSUES and FEEDBACK
3. Re-delegate to the **same agent** with:
   - Original task context
   - Reviewer's feedback appended
   - Instruction: "Address the following review feedback before resubmitting"
   - Note: "This is retry attempt N/2 after fast review"
4. After the agent re-submits, run fast review again (go back to Step 1)

#### On FAIL (attempt 3 — escalation)

1. Log the review result with `escalated: true`
2. **Auto-escalate to panel review** — load the `panel-majority-vote` skill
3. Include all 3 fast review reports as context for the panel
4. The panel decides PASS/BLOCK with the standard majority vote protocol
5. If panel PASS → accept with a note that it required escalation
6. If panel BLOCK → follow the standard panel retry flow (max 3 panel attempts)
7. If panel BLOCKs 3 times → create a **dispute record** in `.github/customizations/DISPUTES.md` (see **team-lead-reference** skill § Dispute Protocol)

```
Fast Review Attempt 1: FAIL → retry
Fast Review Attempt 2: FAIL → retry
Fast Review Attempt 3: FAIL → escalate to panel
Panel Attempt 1: BLOCK → re-delegate with MUST-FIX
Panel Attempt 2: BLOCK → re-delegate with MUST-FIX
Panel Attempt 3: BLOCK → create dispute record for human resolution
```

## Reviewer Prompt Template

```markdown
You are a code reviewer. Your job is to verify that a delegated task was
completed correctly. Be concise and specific. Focus on correctness, not style.

## Task Under Review

**Issue:** [ID] — [Title]
**Acceptance Criteria:**
- [ ] [Criterion 1]
- [ ] [Criterion 2]
- [ ] [Criterion 3]

## Agent's File Partition (allowed files)
[List of directories/files the agent was allowed to modify]

## Changed Files
[For each file: path, key sections of the diff or full new content]

## Deterministic Check Results
- Lint: [PASS/FAIL + details]
- Tests: [PASS/FAIL + details]
- Build: [PASS/FAIL + details]

## Review Checklist

Evaluate EACH item. Only flag issues you are confident about.

1. **Acceptance criteria met** — Does the implementation satisfy every criterion?
2. **File partition respected** — Were only allowed files modified?
3. **No regressions** — Could any change break existing functionality?
4. **Error handling** — Are errors surfaced clearly? No swallowed exceptions?
5. **Type safety** — Proper TypeScript types? No `as any` or unsafe casts?
6. **Security basics** — No exposed secrets, no injection vectors, no unsafe user input handling?
7. **Edge cases** — Are obvious edge cases handled (null, empty, overflow)?

## Previous Review Feedback (if retry)
[Include prior FAIL feedback so the reviewer can verify fixes]

## Output Format (MANDATORY — follow exactly)

VERDICT: PASS | FAIL

ISSUES:
- [severity:critical|major|minor] Description

FEEDBACK:
Actionable feedback for the implementer.

CONFIDENCE: low | medium | high
```

## Logging

Append a JSON line to `customizations/logs/reviews.ndjson` after each fast review:

```json
{
  "timestamp": "2026-02-28T14:30:00Z",
  "linear_issue": "PRJ-42",
  "agent": "Developer",
  "reviewer_model": "gpt-5-mini",
  "verdict": "pass",
  "attempt": 1,
  "issues_critical": 0,
  "issues_major": 0,
  "issues_minor": 2,
  "confidence": "high",
  "escalated": false,
  "duration_sec": 45
}
```

## Integration with Existing Workflow

### Position in the Verification Loop

Fast review sits between the agent's output and the Team Lead's acceptance:

```
Agent completes work
       │
       ▼
Deterministic checks (lint, test, build)  ← validation-gates Gate 1
       │
       ▼
Fast Review (this skill)                  ← validation-gates Gate 1.5
       │
       ├── PASS → Accept, move to next task
       ├── FAIL → Retry loop (up to 2x)
       └── 3x FAIL → Escalate to Panel (Gate 5)
```

### Relationship to on-post-delegate Hook

Fast review is executed as part of the `on-post-delegate` hook in the agent-hooks skill. The hook sequence is:

1. Verify output (file changes within partition)
2. Run deterministic checks (lint, test, build)
3. **Run fast review** ← inserted here
4. Check acceptance criteria (reviewer does this too, as cross-check)
5. Update issue

### Skipping Panel Review

When fast review passes, you can safely skip panel review for **non-high-stakes** tasks. The thresholds for mandatory panel review remain:

- Security-sensitive changes
- Database migrations
- Architecture decisions
- Complex business logic without test coverage

These tasks get **both** fast review AND panel review.

## Cost Impact

Estimated cost per fast review:

| Review Tier | Est. Tokens | Est. Duration |
|-------------|-------------|---------------|
| Economy reviewer | ~3K-8K tokens | 30-90 sec |
| Standard reviewer | ~5K-12K tokens | 60-180 sec |

For a typical 7-delegation session:
- **Without fast review:** 0 review tokens
- **With fast review:** ~20K-60K additional tokens (~5-15% overhead)
- **With panel on every step:** ~150K-450K additional tokens (prohibitive)

Fast review provides ~85% of the safety benefit of full panel review at ~15% of the cost.

## Overnight/Long-Run Mode

For autonomous overnight sessions, fast review is the primary quality gate. Additional considerations:

1. **Lower PASS threshold** — In overnight mode, consider upgrading the reviewer model one tier for extra safety (no human in the loop to catch issues).
2. **Stricter escalation** — Escalate to panel after 2 FAILs instead of 3 when running unattended.
3. **Checkpoint on escalation** — If fast review escalates to panel during an overnight run, save a session checkpoint before proceeding. This allows human review of the escalation decision.
4. **Aggregated review log** — At the end of an overnight session, generate a summary of all fast reviews (pass rate, common issues, escalations) as part of the session-end hook.

## Anti-Patterns

- **Skipping fast review** — Never. Not even for "trivial" changes. The cost is minimal, the risk of uncaught issues in overnight runs is high.
- **Using Panel as fast review** — Panel is 3 reviewers with majority vote. Using it for every step wastes ~3x the tokens and time.
- **Reviewer sees the delegation prompt** — The reviewer should evaluate output against acceptance criteria, not the prompt. This prevents rubber-stamping intent as completion.
- **Ignoring minor issues** — Minor issues get a PASS verdict but should be tracked. If the same minor issue appears 3+ times across reviews, create a ticket.
- **Manual override of FAIL** — The Team Lead should never force-accept a FAIL verdict. Either fix the issues through retry or escalate.
- **Skipping deterministic checks** — Fast review does NOT replace lint/test/build. Those run first. The reviewer focuses on semantic correctness beyond what tools can check.

## Metrics & Continuous Improvement

Track these metrics from `reviews.ndjson` to optimize the review process:

| Metric | Target | Action if Off-Target |
|--------|--------|---------------------|
| First-pass rate | > 80% | Improve delegation prompts with more specific acceptance criteria |
| Escalation rate | < 5% | Review why agents fail 3x — prompts may be ambiguous |
| False positive rate | < 10% | If reviewer FAILs work that's actually correct, adjust reviewer prompt |
| Avg review duration | < 120 sec | If too slow, reduce review context or use a faster model |
| Retry success rate | > 90% | If retries don't fix issues, the feedback isn't specific enough |

Review these metrics monthly (or after every 50 reviews) and adjust the reviewer prompt template accordingly.

````
