---
name: git-workflow
description: "Git branching, PR workflow, delivery requirements, discovered issues policy, and task tracking conventions. Load when committing, pushing, or opening PRs."
---

# Git Workflow & Delivery

## Git Workflow

**NEVER commit or push directly to the `main` branch.** All changes must go through a feature/fix branch and a pull request.

1. **Create a branch** from `main` before making any changes: `git checkout -b <type>/<ticket-id>-<short-description>` (e.g., `fix/tas-21-places-redirect-loop`, `feat/tas-15-new-filter`)
2. **Commit to the branch** — never to `main`. Reference the task tracker issue ID in every commit message (e.g., `TAS-42: Fix token refresh logic`)
3. **Push the branch** and open a pull request on GitHub. **Do NOT merge** — PRs are opened for review only
4. **Link the PR to the task tracker** — Update the issue description with the PR URL so progress is traceable
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
2. **Atomic commits** — Each commit references the issue ID (e.g., `TAS-42: Add filter component`)
3. **Pushed branch** — Branch pushed to origin
4. **Open PR** — Use `gh` CLI to create the PR. **Do NOT merge** — PRs are opened for review only:
   ```bash
   GH_PAGER=cat gh pr create --base main --title "TAS-XX: Short description" --body "Resolves TAS-XX"
   ```
5. **Task tracker linkage** — The issue is updated with the PR URL, and the PR description references the issue ID

## Discovered Issues Policy

> **⛔ No issue gets ignored.** Untracked bugs discovered during work are a quality gate failure.

When you encounter a bug, error, or unexpected behavior that is unrelated to the current task:

1. **Check if already tracked:**
   - Search `.opencastle/KNOWN-ISSUES.md` for a matching entry
   - If you have task tracker tools available, also search for open bugs (use `search_issues` or `list_issues` with bug label)
2. **If found tracked** — skip it, continue with your current work
3. **If NOT tracked** — you must act:
   - **Unfixable limitation** (third-party constraint, platform restriction, upstream dependency) → add it to `.opencastle/KNOWN-ISSUES.md` with: Issue ID, Status, Severity, Evidence, Root Cause, Solution Options
   - **Fixable bug** → if you have task tracker tools, create a ticket with label `bug`, appropriate priority, and a clear description of the symptoms, reproduction steps, and affected files. If you do NOT have task tracker tools, add a `**Discovered Issues**` section to your output listing the bug details so the Team Lead can track it.

Never assume a pre-existing issue is somebody else's problem. If it's not tracked, track it.

## Task Tracking

Feature work is tracked in the **task tracker** (see `tracker-config.md` for project details). The Team Lead agent creates and updates issues via MCP. For conventions, load the **task-management** skill.

### When Task Tracker MCP Tools Are Unavailable

If task tracker MCP tools are not available in the current session, do NOT block on issue creation. Instead:

1. **Document planned issues** in your output with the title, description, and acceptance criteria you would have used
2. **Proceed with implementation** — the work is still valuable without a ticket number
3. **Placeholder value for `tracker_issue`:**
   - **No tracker configured** (no `task-management` slot bound in `skill-matrix.json`) → use `"N/A"`
   - **Tracker configured but tools unavailable** → use the project prefix + `PENDING` (e.g., `"TAS-PENDING"`)
4. **Ask the user** to create the issues manually if tracking is critical for the task
5. After implementation, update commit messages and PR descriptions when issue IDs become available
