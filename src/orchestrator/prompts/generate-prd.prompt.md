---
description: 'Generate a Product Requirements Document from a high-level feature prompt. Output feeds directly into the generate-convoy step.'
agent: 'Team Lead (OpenCastle)'
output: prd
---

<!-- ⚠️ This file is managed by OpenCastle. Edits will be overwritten on update. Customize in the .opencastle/ directory instead. -->

# Generate PRD

You are the Team Lead. Convert the feature request below into a structured Product Requirements Document (PRD). The PRD will be consumed by the `generate-convoy` step to produce an automated agent task spec, so every section must be **concrete**, **specific**, and **implementation-ready**.

## Feature Request

{{goal}}

## Additional Context

{{context}}

---

## Research Before Writing

If the feature request involves a specific person, place, organization, topic, or any real-world subject you are not confident you have accurate knowledge about — **you MUST search the internet first** using any available web search or fetch tools (e.g. `fetch_webpage`, web search MCP, or similar). Use the search results to gather accurate facts, names, dates, descriptions, and other details.

**Never fabricate or hallucinate content** about real-world subjects. If you cannot verify a claim through web search, state what is unknown rather than inventing plausible-sounding text. This applies to all content: bios, descriptions, histories, statistics, quotes, and any factual claims.

## Required PRD Structure

Produce the PRD in Markdown using **exactly** the sections below. Do not skip or merge sections. Do not wrap the output in a code fence — output raw Markdown starting directly with the `#` heading.

---

# [Feature Name] — PRD

## Overview

2–3 sentences: what this feature does, who benefits, and why it matters now.

## Goals

Numbered list of specific, measurable outcomes this feature must achieve. Each goal should be a single sentence with a clear success condition.

1. …
2. …

## Non-Goals

Explicit exclusions — what this work does **not** cover. If nothing is excluded, write "None."

## User Stories & Acceptance Criteria

For each primary scenario, write a user story + binary acceptance criteria. Criteria must be testable (pass/fail — no subjective language).

**US-1: [Short title]**
As a [user type], I want [action] so that [benefit].

Acceptance criteria:
- [ ] [Specific, testable condition]
- [ ] [Another condition]

*(Repeat for each user story)*

## Technical Requirements

Specific technical constraints the implementation must respect:
- Libraries, framework versions to use or avoid
- API contracts or interfaces that must not break
- Performance thresholds (e.g., "<200 ms p95 latency")
- Security requirements
- Browser/platform compatibility

## Implementation Scope

List **every file and directory** that will be created, modified, or deleted. Use specific paths — not broad paths like `src/`. Group by concern.

| Concern | Files / Directories |
|---------|---------------------|
| [Frontend components] | `components/feature/`, `app/feature/page.tsx` |
| [API routes] | `app/api/feature/route.ts` |
| [Database] | `db/migrations/add_feature.sql`, `db/schema.ts` |
| [Shared types] | `types/feature.ts` |
| [Tests] | `__tests__/feature.test.ts`, `e2e/feature.spec.ts` |
| [Config / env] | `.env.example` |

**File partition rules (important for parallel execution):**
- No two concurrent workstreams may modify the same file
- If two workstreams need the same file, they must be sequenced (Phase N+1 after Phase N)

## Task Breakdown

Decompose into the minimum number of phases. Tasks in the same phase run in parallel and **must not share any files**.

```
Phase 1 — Foundation (parallel, no dependencies):
  - [Workstream A title]: [2-sentence description]
    Files: [list exact files]
  - [Workstream B title]: [2-sentence description]
    Files: [list exact files]

Phase 2 — Integration (depends on Phase 1):
  - [Workstream C title]: [2-sentence description]
    Files: [list exact files]
    Depends on: Phase 1

Phase 3 — Verification (depends on Phase 2):
  - [Tests]: Run full test suite, achieve ≥ 95% coverage on new files
  - [Documentation]: Update READMEs and changelogs
```

## Success Criteria

Measurable, binary checks that confirm the feature is shippable:
- [ ] All acceptance criteria in User Stories & Acceptance Criteria pass
- [ ] TypeScript compiles with zero errors
- [ ] Lint passes with zero warnings
- [ ] Unit test coverage ≥ 95% on all new/changed files
- [ ] [Feature-specific checks]

## Risks & Open Questions

- **[Risk title]**: [Description of the risk] — *Mitigation: [How to handle it]*
- **[Open question]**: [What needs to be decided before implementation can start]

If there are no risks or open questions, write "None identified."
