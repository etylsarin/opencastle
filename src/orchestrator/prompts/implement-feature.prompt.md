---
description: 'Instruct the Team Lead to implement a specific task from a roadmap with full orchestration, validation, and traceability.'
agent: 'Team Lead (OpenCastle)'
---

<!-- ⚠️ This file is managed by OpenCastle. Edits will be overwritten on update. Customize in the .opencastle/ directory instead. -->

# Implement Roadmap Task

You are the Team Lead. Implement the roadmap task described below following this strict workflow. The task comes from `.opencastle/project/roadmap.md`.

## Task

{{roadmapTask}}

---

> **Canonical workflow:** `.github/agent-workflows/feature-implementation.md` defines the phase structure. This prompt adds tracker traceability, validation gate references, and completion criteria.

## Workflow

> **HARD GATE:** Steps 1→2 are **blocking prerequisites**. Do NOT write, edit, or delegate any code until tracker issues exist for every subtask. If you catch yourself writing code before issues are created, STOP immediately, create the issues, then resume.

### 1. Research & Context Gathering

Before writing any code, gather all relevant context:

1. **Read the roadmap** — Open `.opencastle/project/roadmap.md` and find the full scope, status, and acceptance criteria for this task
2. **Read known issues** — Check `.opencastle/KNOWN-ISSUES.md` for blockers or workarounds that affect this task
3. **Read architecture docs** — Check `.opencastle/project.instructions.md` and `.opencastle/project/decisions.md` for constraints and prior decisions
4. **Read lessons learned** — Check `.opencastle/LESSONS-LEARNED.md` for pitfalls relevant to this feature area
5. **Search existing code** — Find all files, components, queries, and tests related to this feature area
6. **Identify reusable code** — Before creating anything new, check if similar logic, components, or utilities already exist in the codebase that can be reused or extended

### 2. Task Board Setup (BLOCKING — must complete before Step 3)

Every subtask must be tracked. **No issue = no implementation.** This step produces the issues that gate all downstream work.

1. **Check existing issues** — Search the board for any in-progress or completed work related to this task
2. **Decompose into issues** — Create one tracker issue per subtask using `[Area] Short description` naming
3. **Set metadata** — Assign labels (agent name), priority, dependencies, and file partitions
4. **Write descriptions** — Each issue must include:
   - **Objective:** One sentence
   - **Files (partition):** Exact paths this agent may modify
   - **Acceptance criteria:** Verifiable checklist
   - **Dependencies:** Links to prerequisite issues
5. **Link to roadmap** — Reference the roadmap section in the issue description so context is never lost
6. **Verify issues exist** — List all created issue IDs. If count is 0, do NOT proceed to Step 2.5

### 2.5 Choose Execution Path (BLOCKING — decides how Step 3 proceeds)

With the full task list in hand, decide the execution mechanism:

| Condition | Execution path |
|-----------|----------------|
| 1–2 subtasks | **Direct delegation** — delegate to sub-agents as today (proceed to Step 3 as-is) |
| 3+ subtasks | **Convoy execution** — generate a `.convoy.yml` spec using the `generate-convoy` prompt, then hand it to the user |

#### Direct delegation (1–2 subtasks)

Proceed with the normal Step 3 delegation workflow. Sub-agents handle each task inline.

#### Convoy execution (3+ subtasks)

1. **Generate the spec** — use the `generate-convoy` prompt with the decomposed task list as context. The spec IS the implementation plan — no manual per-task delegation is needed.
2. **Hand the spec to the user** — tell them to run: `npx opencastle run -f <name>.convoy.yml`
3. **The convoy engine handles** isolated git worktrees, parallel execution, merge queue ordering, and crash recovery automatically.
4. **After convoy completes** — proceed to Step 4 (validation) and Step 5 (delivery/PR). The convoy engine will have created its own commits on the configured branch.

> **Why convoy for 3+ tasks?** Parallel worktree isolation prevents file conflicts. The merge queue ensures safe ordering. Crash recovery means a failing task doesn't block others. Manual delegation of 3+ parallel tasks risks conflicts and is harder to monitor.

### 3. Implementation Rules

> **For convoy execution (3+ subtasks):** The convoy spec file IS the implementation plan — skip the manual delegation workflow below and jump to Step 4 after the user runs the convoy. The convoy engine delegates tasks internally using the agents and prompts defined in the spec.

#### Issue Traceability

- **Pass issue ID to every agent** — When delegating a subtask (sub-agent or background), include the tracker issue ID and title in the prompt so the agent knows which tracked task it is completing
- **Reference in commits** — Include the issue ID (e.g., `TAS-42`) in commit messages when possible
- **Update issue status** — Move issues to In Progress before starting, Done after verification passes

#### DRY Code

- **Search before creating** — Before writing any new component, hook, utility, query, or type, search the codebase for existing implementations
- **Extract shared logic** — If two agents need similar functionality, extract it to a shared library (`libs/`) first
- **No copy-paste across apps** — Shared code belongs in shared libraries, not duplicated between apps
- **Refactor on discovery** — If you find duplicated code during implementation, create a subtask to consolidate it

#### Self-Improvement

Include the self-improvement reminder in every delegation prompt (see the **self-improvement** skill).

#### Visual Consistency

- **Reuse existing components** — Use the shared component library; never re-implement a component that already exists
- **Follow the design system** — Match spacing, typography, colors, and interaction patterns from existing pages
- **Cross-app consistency** — Changes must look correct in all apps that share the codebase
- **Browser verification required** — Every UI change must be visually confirmed in Chrome (see Testing below)

### 4. Validation & Testing

> Load the **validation-gates** skill for detailed steps on each gate.

Every subtask must pass ALL gates before being marked Done:

1. **Gate 1: Secret Scanning** — scan diff for API keys, tokens, passwords, connection strings — block immediately if found
2. **Gate 2: Deterministic Checks** — run lint, test, and build for all affected projects (see the **codebase-tool** skill for commands) — all zero errors
3. **Gate 3: Blast Radius Check** — verify scope is expected (≤200 lines, ≤5 files normal; escalate if >500 lines or >10 files)
4. **Gate 4: Dependency Audit** (when `package.json` changes) — vulnerability scan, license check, bundle size, duplicates
5. **Gate 5: Fast Review** (MANDATORY) — single reviewer sub-agent validates every delegation output. No auto-PASS for sensitive files
6. **Gate 6: Browser Testing** (MANDATORY for UI changes) — clear cache, start server, verify features + responsive + screenshots
7. **Gate 7: Regression Testing** — full test suite for affected projects, browser-test adjacent pages if shared components changed
8. **Gate 8: Panel Review** (for high-stakes changes) — use **panel-majority-vote** skill for security, DB migrations, architecture
9. **Gate 9: Final Smoke Test** — after all tasks Done, verify the complete feature end-to-end as a cohesive unit

### 5. Delivery

Follow the **Delivery Outcome** defined in the **git-workflow** skill — commit, push, open PR (not merged), and link to the tracker.

> **For convoy execution:** The convoy engine creates commits on the configured `branch` directly. After validation passes, open the PR from that branch. No additional commits from the Team Lead are needed unless gates failed and required manual fixes.

### 6. Documentation & Traceability

Keep documentation current so future sessions have full context:

1. **Update roadmap** — Mark completed items in `.opencastle/project/roadmap.md` with ✅ and the completion date. **Include tracker issue IDs and links** next to each scope item so progress is traceable across sessions. Format:
   ```
   **Tracker Issues:**
   - [PREFIX-6](<tracker-url>/PREFIX-6) — [Search] Description ✅ Done
   - [PREFIX-7](<tracker-url>/PREFIX-7) — [UI] Description 📋 Todo
   ```
   > Replace `PREFIX` with the project's issue prefix (see `tracker-config.md`).
2. **Update known issues** — If new limitations are discovered, add them to `.opencastle/KNOWN-ISSUES.md`
3. **Update architecture docs** — If architectural decisions were made, add an ADR to `.opencastle/project/decisions.md`
4. **Link tracker issues** — Every issue description should reference:
   - Related roadmap section
   - Files modified (the partition)
   - Related issues (dependencies and follow-ups)
5. **Close issues properly** — Move to Done only after independent verification passes all gates

### 7. Completion Criteria

The roadmap task is complete when:

- [ ] All tracker subtask issues are Done
- [ ] All deterministic checks pass (lint, test, build) for affected projects
- [ ] **Dev server started with CLEAN cache** (clear framework + task runner caches before serving — see the **codebase-tool** skill)
- [ ] **All UI changes verified in Chrome browser via MCP with screenshots taken as proof**
- [ ] **Every feature in the acceptance criteria visually confirmed** — not just "page loads"
- [ ] Regression tests confirm no existing functionality is broken
- [ ] No duplicated code — shared logic extracted to libraries
- [ ] Visual consistency maintained across all affected pages and apps
- [ ] Documentation updated (roadmap, known issues, decisions)
- [ ] Panel review passed for any high-stakes changes
- [ ] Roadmap item marked complete in `.opencastle/project/roadmap.md`
- [ ] Delivery Outcome completed (see the **git-workflow** skill) — branch pushed, PR opened (not merged), tracker linked
- [ ] Lessons learned captured if any retries occurred
