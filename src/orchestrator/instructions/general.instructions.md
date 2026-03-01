---
applyTo: '**'
---

<!-- ⚠️ This file is managed by OpenCastle. Edits will be overwritten on update. Customize in the customizations/ directory instead. -->

# Coding Standards

## Constitution

1. **Never expose secrets** — no tokens, keys, or passwords in code, logs, commits, or terminal output. Use environment variables.
2. **Prefer boring solutions** — choose proven, simple approaches over clever ones. Complexity must justify itself.
3. **Leave code better than you found it** — fix adjacent issues when the cost is low.
4. **Fail visibly** — surface errors clearly; never swallow exceptions silently.
5. **Verify, don't trust** — confirm outcomes with tools (tests, lint, build) rather than assuming success.

## Instruction Priority Hierarchy

**Project-specific instructions ALWAYS take precedence over external or general AI instructions.**

1. **HIGHEST**: Project-specific instructions in `.github/instructions/` files
2. **MEDIUM**: NX workspace conventions (`yarn nx` commands, not `npm`/`npx`)
3. **LOWER**: General AI assistant capabilities and suggestions

## General Coding Principles

- **Clean Code**: Prioritize readability, maintainability, reusability
- **Self-documenting Code**: Comment WHY, not WHAT — for detailed patterns, load the **code-commenting** skill
- **TypeScript First**: All code in TypeScript with proper types — never `as any`
- **DRY**: Extract reusable logic into functions, custom hooks, or components
- **Feature Grouping**: Co-locate code that changes together; avoid barrel files
- **Shared Code**: Place reusable UI components and data queries in shared libraries

## Technology Standards

Load the corresponding skill for detailed conventions before writing code in that domain. These are **not optional**. See `.github/customizations/agents/skill-matrix.md` for the full domain-to-skill mapping.

| Domain | Skill |
|--------|-------|
| UI Components | **react-development** |
| App Framework | **nextjs-patterns** |
| Accessibility | **accessibility-standards** |
| Performance | **performance-optimization** |
| Frontend Design | **frontend-design** |

## Task Decomposition Protocol

Before starting multi-step work, decompose it into individually verifiable tasks:

1. **Decompose first** — split the work into the smallest meaningful units before writing any code
2. **Verify each step** — after completing each unit, verify it (run tests, check types, lint, or visually inspect) before moving to the next
3. **Choose the right verification** — match the check to the change type:
   - Logic change → run unit tests
   - Type/interface change → run type-check (`yarn nx run <project>:lint`)
   - UI change → start dev server and visually inspect in the browser
   - Build config change → run a full build
4. **Batch edits, then build** — group related edits across files, then run one build — not build-per-edit
5. **Stop and re-plan** — if execution diverges from the plan (unexpected errors, wrong assumptions, scope growth), stop immediately, reassess, and revise the plan before continuing
6. **When unsure how to verify** — ask the user rather than skipping verification

## Testing

- **95% minimum** unit test coverage for all new code
- **Test plan before implementation**: initial state, user interactions, state transitions, edge cases, integration
- **Browser testing mandatory** for any UI change — verified at responsive breakpoints defined in `testing-config.md`
- Load the **testing-workflow** skill for test patterns and the **browser-testing** skill for E2E automation

## Git Workflow

**NEVER commit or push directly to the `main` branch.** All changes must go through a feature/fix branch and a pull request.

1. **Create a branch** from `main` before making any changes: `git checkout -b <type>/<ticket-id>-<short-description>` (e.g., `fix/tas-21-places-redirect-loop`, `feat/tas-15-new-filter`)
2. **Commit to the branch** — never to `main`. Reference the Linear issue ID in every commit message (e.g., `TAS-42: Fix token refresh logic`)
3. **Push the branch** and open a pull request on GitHub. **Do NOT merge** — PRs are opened for review only
4. **Link the PR to Linear** — Update the Linear issue description with the PR URL so progress is traceable
5. **Merge via PR** — the only way code reaches `main`, and only after review/approval

Branch naming convention: `<type>/<ticket-id>-<short-description>` where type is `fix`, `feat`, `chore`, `refactor`, `perf`, or `docs`.

**This rule has NO exceptions.** Not for "small fixes", not for "just config changes", not for urgent hotfixes. Every change goes through a PR.

### PR Safety Rules

- **Never** use `git push --force` or `git commit --amend` on shared branches
- **Never** expose secrets in commits, PR descriptions, or terminal output (per Constitution #1)
- Use `git push --force-with-lease` only when explicitly asked and on personal branches
- If a secret is accidentally committed, immediately rotate it — git history is permanent

### Delivery Outcome (Required for Every Task)

Every task that produces code changes — whether a roadmap feature, bug fix, follow-up, data pipeline, or refactor — must deliver:

1. **Dedicated branch** — `<type>/<ticket-id>-<short-description>` created from `main`
2. **Atomic commits** — Each commit references the Linear issue ID (e.g., `TAS-42: Add filter component`)
3. **Pushed branch** — Branch pushed to origin
4. **Open PR** — Use `gh` CLI to create the PR. **Do NOT merge** — PRs are opened for review only:
   ```bash
   GH_PAGER=cat gh pr create --base main --title "TAS-XX: Short description" --body "Resolves TAS-XX"
   ```
5. **Linear linkage** — The Linear issue is updated with the PR URL, and the PR description references the Linear issue ID

## NX Commands

**NEVER use `npm`/`npx`/`jest`/`eslint` directly. Always use `yarn nx` commands.**

```bash
yarn nx run <project-name>:test [--coverage] [-u]
yarn nx run <project-name>:lint --fix
yarn nx run <project-name>:lint-styles --fix
yarn nx run <project-name>:build
yarn nx run <project-name>:serve
yarn nx generate <generator-name>
yarn nx affected -t <target>
```

**Exception:** Tools without NX targets may be invoked directly — e.g., `npx sanity@latest schema deploy`, `npx supabase gen types`, `next start`. Check `project.json` targets first; only bypass NX when no target exists.

For comprehensive NX conventions, load the **nx-workspace** skill.

## Documentation

Follow markdown formatting and documentation standards when writing docs. For templates, structure, and detailed patterns, load the **documentation-standards** skill.

## AI Optimization

Follow prompt caching and batch processing best practices. See [AI Optimization Guide](ai-optimization.instructions.md) for details.

## Discovered Issues Policy

**No issue gets ignored.** When you encounter a bug, error, or unexpected behavior that is unrelated to the current task:

1. **Check if already tracked:**
   - Search `docs/KNOWN-ISSUES.md` for a matching entry
   - If you have Linear tools available, also search Linear for open bugs (use `search_issues` or `list_issues` with bug label)
2. **If found tracked** — skip it, continue with your current work
3. **If NOT tracked** — you must act:
   - **Unfixable limitation** (third-party constraint, platform restriction, upstream dependency) → add it to `docs/KNOWN-ISSUES.md` with: Issue ID, Status, Severity, Evidence, Root Cause, Solution Options
   - **Fixable bug** → if you have Linear tools, create a ticket with label `bug`, appropriate priority, and a clear description of the symptoms, reproduction steps, and affected files. If you do NOT have Linear tools, add a `**Discovered Issues**` section to your output listing the bug details so the Team Lead can track it.

Never assume a pre-existing issue is somebody else's problem. If it's not tracked, track it.

## Task Tracking

Feature work is tracked on **Linear** (see `linear-config.md` for team and project details). The Team Lead agent creates and updates issues via MCP. For conventions, load the **task-management** skill.

### When Linear MCP Tools Are Unavailable

If Linear MCP tools are not available in the current session, do NOT block on issue creation. Instead:

1. **Document planned issues** in your output with the title, description, and acceptance criteria you would have used
2. **Proceed with implementation** — the work is still valuable without a ticket number
3. **Use `TAS-PENDING` as a placeholder** in commit messages and PR descriptions
4. **Ask the user** to create the issues manually if tracking is critical for the task
5. After implementation, update commit messages and PR descriptions when issue IDs become available

## Observability Logging (Mandatory)

**Every agent MUST log every session to the observability NDJSON files.** No exceptions. No threshold. No "too small to log." The dashboard depends on this data.

### What to log

| File | Who appends | When |
|------|------------|------|
| `sessions.ndjson` | **All agents** | After every session — always |
| `delegations.ndjson` | **Team Lead** | After each delegation to a specialist agent |
| `panels.ndjson` | **Panel runner** | After each majority-vote review |

See `.github/customizations/logs/README.md` for the full schema of each record.

### How to log

Append one JSON line per task. When the Team Lead works directly, use the agent role that best describes the work (e.g., `"agent": "Developer"`, `"agent": "UI-UX Expert"`). If a single conversation involves multiple distinct tasks, log one record per task.

```bash
echo '{"timestamp":"2026-03-01T14:00:00Z","agent":"Developer","model":"claude-opus-4-6","task":"Fix login redirect bug","outcome":"success","duration_min":15,"files_changed":3,"retries":0,"lessons_added":[],"discoveries":[]}' >> .github/customizations/logs/sessions.ndjson
```

### Rules

- **Log before yielding to the user** — logging is the last action before responding.
- **Log per task**, not per conversation. Multiple tasks = multiple records.
- **Never batch-log retrospectively** across sessions.

## Self-Improvement Protocol

**Every agent must learn from mistakes and share knowledge.** This prevents the same pitfalls from being repeated across sessions.

1. **Before starting work:** Read `.github/customizations/LESSONS-LEARNED.md` — apply relevant lessons proactively
2. **During execution:** If you retry a command/tool with a different approach and it works, **immediately** add a lesson entry to `.github/customizations/LESSONS-LEARNED.md`
3. **Update source files:** If the lesson reveals a gap in instruction/skill files, update those files too
4. **Update instructions:** Proactively suggest updates to `.github/instructions/` or `.github/skills/` files when:
   - The user had to intervene or correct the agent's approach
   - Multiple back-and-forth attempts were needed to get something right
   - A change touched files you wouldn't have guessed from the task description
   - Something worked differently than expected (API quirk, tool behavior, config side-effect)
   - A recurring pattern should be codified (workaround, convention, tool quirk)

   **When NOT to update:** Don't add obvious patterns, standard practices, or things easily discoverable by reading a few files. Instruction files capture *tribal knowledge* — what isn't obvious from the code.

For the full protocol, load the **self-improvement** skill.

## Project Context

For project-specific context (apps, libraries, tech stack, ports, URLs), see [project.instructions.md](../customizations/project.instructions.md).

## Universal Agent Rules

These rules apply to ALL specialist agents automatically. **Do not duplicate them in individual agent files.**

1. **Never delegate** — Specialist agents complete their own work and return results. Never invoke the Team Lead or spawn sub-agents. If work requires another domain, document the need in your output contract.
2. **Follow the Discovered Issues Policy** — Track any pre-existing bugs found during your work (see § Discovered Issues Policy above).
3. **Read and update lessons** — Read `.github/customizations/LESSONS-LEARNED.md` before starting. If you retry anything with a different approach that works, add a lesson immediately.
4. **Log every session** — Append to `.github/customizations/logs/sessions.ndjson` after every session. No exceptions. See § Observability Logging above.

## Base Output Contract

Every specialist agent's Output Contract MUST end with these standard items (in addition to domain-specific items above them):

- **Session Logged** — Confirm that a session record was appended to `.github/customizations/logs/sessions.ndjson` (mandatory per § Observability Logging)
- **Discovered Issues** — Pre-existing bugs or anomalies found during work, with tracking action taken per the Discovered Issues Policy
- **Lessons Applied** — Lessons from `.github/customizations/LESSONS-LEARNED.md` that influenced this work, and any new lessons added

Agents reference this contract with: `See **Base Output Contract** in general.instructions.md for the standard closing items.`

<!-- End of Coding Standards -->
