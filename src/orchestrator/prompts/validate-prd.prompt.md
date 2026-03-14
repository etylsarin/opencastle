---
description: 'Validate a PRD for completeness, clarity, and implementability before generating a convoy spec. Outputs VALID or INVALID with specific issues.'
agent: 'Reviewer'
output: validation
---

<!-- ⚠️ This file is managed by OpenCastle. Edits will be overwritten on update. Customize in the .opencastle/ directory instead. -->

# Validate PRD

You are a senior technical reviewer. Your job is to validate the PRD below against strict quality criteria before it is used to generate an automated convoy spec. A PRD that passes this gate will produce a clean, executable convoy spec. A PRD that fails will produce bad tasks.

Be strict. Do not pass a PRD with vague language or missing sections just because it "looks mostly right."

## PRD to Validate

{{goal}}

---

## Validation Checklist

Evaluate **every item** below. If ALL items pass, respond `VALID`. If ANY item fails, respond `INVALID` with a specific, actionable issue list.

### Required Sections

- [ ] `Overview` section is present and non-empty (at least 2 sentences)
- [ ] `Goals` section is present with at least one numbered, specific goal
- [ ] `Non-Goals` section is present (may say "None" but must not be missing)
- [ ] `User Stories & Acceptance Criteria` section is present with at least one user story
- [ ] Each user story has associated acceptance criteria (not just the story itself)
- [ ] `Technical Requirements` section is present and non-empty
- [ ] `Implementation Scope` section is present with a table or list of specific files/directories
- [ ] `Task Breakdown` section is present with at least one phase and workstream
- [ ] `Success Criteria` section is present with at least 3 measurable checks
- [ ] `Risks & Open Questions` section is present (may say "None identified")

### Acceptance Criteria Quality

- [ ] All acceptance criteria can be evaluated as pass/fail (no subjective language like "looks good", "feels responsive", "is clean")
- [ ] No criterion uses modal verbs that imply optionality ("should", "might", "could", "may")
- [ ] No criterion references undefined external systems without explaining what they are

### Implementation Scope Quality

- [ ] Scope lists **specific** file names or subdirectory names — not broad paths like `src/` or `the frontend`
- [ ] Scope table does not use glob patterns (`*`, `**`)
- [ ] Every concern area has at least one specific file or directory

### Task Breakdown Quality

- [ ] Each workstream lists the exact files it will modify
- [ ] No two parallel workstreams (same phase) claim the same file
- [ ] Phases have explicit dependency declarations (`depends on: Phase N`)
- [ ] No circular dependencies

### Language Quality

- [ ] No **domain-specific** acronyms or jargon used without explanation (standard software acronyms like API, CSS, HTML, CI/CD, CMS, SDK, CLI, URL, JSON, REST, SQL, SSR, SSG, CDN, DNS, TLS, JWT, OAuth, CRUD, DOM, UI, UX, HTTP, HTTPS, LTS, WCAG, RTL, MCP, PRD, E2E are considered universally understood and do not need expansion)
- [ ] No conflicting requirements (e.g., "must be fast AND run full suite on every change")
- [ ] Section content is not placeholder/template text (e.g., "2–3 sentences about…", "Description here")

---

## Output Format

If the PRD passes every check above, respond with **exactly**:

```
VALID
```

If the PRD fails one or more checks, respond with:

```
INVALID

Issues:
- [Section name]: [Specific problem] — Fix: [What the author must change]
- [Section name]: [Another problem] — Fix: [What the author must change]
```

List only real failures. Do not list items that passed.
