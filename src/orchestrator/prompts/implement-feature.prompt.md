---
description: 'Instruct the Team Lead to implement a specific task from the post-MVP roadmap with full orchestration, validation, and traceability.'
agent: Team Lead
---

<!-- ⚠️ This file is managed by OpenCastle. Edits will be overwritten on update. Customize in the customizations/ directory instead. -->

# Implement Roadmap Task

You are the Team Lead. Implement the roadmap task described below following this strict workflow. The task comes from `docs/ROADMAP-POST-MVP.md`.

## Task

{{roadmapTask}}

---

> **Canonical workflow:** `.github/agent-workflows/feature-implementation.md` defines the phase structure. This prompt adds Linear traceability, validation gate references, and completion criteria.

## Workflow

> **HARD GATE:** Steps 1→2 are **blocking prerequisites**. Do NOT write, edit, or delegate any code until Linear issues exist for every subtask. If you catch yourself writing code before issues are created, STOP immediately, create the issues, then resume.

### 1. Research & Context Gathering

Before writing any code, gather all relevant context:

1. **Read the roadmap** — Open `docs/ROADMAP-POST-MVP.md` and find the full scope, status, and acceptance criteria for this task
2. **Read known issues** — Check `docs/KNOWN-ISSUES.md` for blockers or workarounds that affect this task
3. **Read architecture docs** — Check `docs/PROJECT.md` and `docs/DECISIONS.md` for constraints and prior decisions
4. **Read lessons learned** — Check `.github/customizations/LESSONS-LEARNED.md` for pitfalls relevant to this feature area
5. **Search existing code** — Find all files, components, queries, and tests related to this feature area
6. **Identify reusable code** — Before creating anything new, check if similar logic, components, or utilities already exist in the codebase that can be reused or extended

### 2. Linear Board Setup (BLOCKING — must complete before Step 3)

Every subtask must be tracked on Linear. **No issue = no implementation.** This step produces the issues that gate all downstream work.

1. **Check existing issues** — Search the board for any in-progress or completed work related to this task
2. **Decompose into issues** — Create one Linear issue per subtask using `[Area] Short description` naming
3. **Set metadata** — Assign labels (agent name), priority, dependencies, and file partitions
4. **Write descriptions** — Each issue must include:
   - **Objective:** One sentence
   - **Files (partition):** Exact paths this agent may modify
   - **Acceptance criteria:** Verifiable checklist
   - **Dependencies:** Links to prerequisite issues
5. **Link to roadmap** — Reference the roadmap section in the issue description so context is never lost
6. **Verify issues exist** — List all created issue IDs. If count is 0, do NOT proceed to Step 3

### 3. Implementation Rules

#### Linear Issue Traceability

- **Pass issue ID to every agent** — When delegating a subtask (sub-agent or background), include the Linear issue ID and title in the prompt so the agent knows which tracked task it is completing
- **Reference in commits** — Include the issue ID (e.g., `TAS-42`) in commit messages when possible
- **Update issue status** — Move issues to In Progress before starting, Done after verification passes

#### DRY Code

- **Search before creating** — Before writing any new component, hook, utility, query, or type, search the codebase for existing implementations
- **Extract shared logic** — If two agents need similar functionality, extract it to a shared library (`libs/`) first
- **No copy-paste across apps** — Shared code belongs in shared libraries, not duplicated between apps
- **Refactor on discovery** — If you find duplicated code during implementation, create a subtask to consolidate it

#### Self-Improvement

Include the self-improvement reminder in every delegation prompt (see `general.instructions.md` § Self-Improvement Protocol).

#### Visual Consistency

- **Reuse existing components** — Use the shared component library; never re-implement a component that already exists
- **Follow the design system** — Match spacing, typography, colors, and interaction patterns from existing pages
- **Cross-app consistency** — Changes must look correct in all apps that share the codebase
- **Browser verification required** — Every UI change must be visually confirmed in Chrome (see Testing below)

### 4. Validation & Testing

> Load the **validation-gates** skill for detailed steps on each gate.

Every subtask must pass ALL gates before being marked Done:

1. **Gate 1: Deterministic Checks** — `yarn nx run <project>:lint --fix`, `:test`, `:build` — all zero errors
2. **Gate 2: Browser Testing** (MANDATORY for UI changes) — clear cache, start server, verify features + responsive + screenshots
3. **Gate 3: Regression Testing** — full test suite for affected projects, browser-test adjacent pages if shared components changed
4. **Gate 4: Panel Review** (for high-stakes changes) — use **panel-majority-vote** skill for security, DB migrations, architecture

### 5. Delivery

Follow the **Delivery Outcome** defined in `general.instructions.md` — commit, push, open PR (not merged), and link to Linear.

### 6. Documentation & Traceability

Keep documentation current so future sessions have full context:

1. **Update roadmap** — Mark completed items in `docs/ROADMAP-POST-MVP.md` with ✅ and the completion date. **Include Linear issue IDs and links** next to each scope item so progress is traceable across sessions. Format:
   ```
   **Linear Issues:**
   - [PREFIX-6](https://linear.app/<workspace>/issue/PREFIX-6) — [Search] Description ✅ Done
   - [PREFIX-7](https://linear.app/<workspace>/issue/PREFIX-7) — [UI] Description 📋 Todo
   ```
   > Replace `PREFIX` and `<workspace>` with the project's Linear prefix and workspace slug (see `linear-config.md`).
2. **Update known issues** — If new limitations are discovered, add them to `docs/KNOWN-ISSUES.md`
3. **Update architecture docs** — If architectural decisions were made, add an ADR to `docs/DECISIONS.md`
4. **Link Linear issues** — Every issue description should reference:
   - Related roadmap section
   - Files modified (the partition)
   - Related issues (dependencies and follow-ups)
5. **Close issues properly** — Move to Done only after independent verification passes all gates

### 7. Completion Criteria

The roadmap task is complete when:

- [ ] All Linear subtask issues are Done
- [ ] All deterministic checks pass (lint, test, build) for affected projects
- [ ] **Dev server started with CLEAN cache** (`rm -rf .next && yarn nx reset` before serving)
- [ ] **All UI changes verified in Chrome browser via MCP with screenshots taken as proof**
- [ ] **Every feature in the acceptance criteria visually confirmed** — not just "page loads"
- [ ] Regression tests confirm no existing functionality is broken
- [ ] No duplicated code — shared logic extracted to libraries
- [ ] Visual consistency maintained across all affected pages and apps
- [ ] Documentation updated (roadmap, known issues, decisions)
- [ ] Panel review passed for any high-stakes changes
- [ ] Roadmap item marked complete in `docs/ROADMAP-POST-MVP.md`
- [ ] Delivery Outcome completed (see `general.instructions.md`) — branch pushed, PR opened (not merged), Linear linked
- [ ] Lessons learned captured if any retries occurred
