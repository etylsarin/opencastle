---
description: 'Resolve GitHub PR review comments by reading them, grouping by file, and applying fixes systematically.'
agent: Team Lead
---

# Resolve PR Comments

You are the Team Lead. A pull request has review comments that need to be resolved. Read the comments, group them by file, and delegate fixes efficiently.

## PR Reference

{{prReference}}

---

## Workflow

### Phase 1: Gather Comments

1. **Read the PR** — Use `gh pr view <number> --comments` and `gh pr diff <number>` to understand the full context
2. **List review comments** — Use `gh api repos/{owner}/{repo}/pulls/{number}/comments` to get all inline review comments
3. **Group by file** — Organize comments by file path. Comments on the same file should be resolved together
4. **Classify each comment:**
   - **Must-fix** — Correctness issues, security concerns, logic errors, test gaps
   - **Should-fix** — Style issues, naming improvements, missing edge cases
   - **Discussion** — Questions, alternative suggestions, design debates (flag for human)

### Phase 2: Plan Fixes

1. **Map file ownership** — Ensure no two parallel agents touch the same file
2. **Check dependencies** — Some comments may depend on others (e.g., "rename this type" affects all files using it)
3. **Order by dependency** — Resolve foundational changes first (types, shared utilities) before downstream files
4. **Estimate scope** — If >10 must-fix comments, consider splitting into multiple delegation rounds

### Phase 3: Apply Fixes

For each file group, delegate to the appropriate specialist agent:

```
Fix the following PR review comments in [file path]:

1. [Comment 1]: [reviewer's feedback] (Line X)
2. [Comment 2]: [reviewer's feedback] (Line Y)

Context: This file is part of [feature/area]. The PR is [brief PR description].

Acceptance criteria:
- [ ] Each comment is addressed (fixed or documented why not)
- [ ] No new lint/type errors introduced
- [ ] Existing tests still pass
- [ ] New tests added if the comment identified a gap
```

**Discussion comments** — Do not fix these. Instead, compile them into a summary for the human reviewer with your recommendation.

### Phase 4: Verify & Report

1. **Run verification** — `yarn nx affected -t lint,test,build` on all affected projects
2. **Commit fixes** — Use descriptive commit messages referencing the PR: `TAS-XX: Address PR review — [summary]`
3. **Push to the same branch** — The PR updates automatically
4. **Report back** — Provide a structured summary of what was resolved

## Output Format

After resolving comments, report:

```markdown
## PR Comment Resolution: #<number>

### Resolved (Must-Fix)
| File | Comment | Resolution |
|------|---------|------------|
| path/to/file.ts | [feedback summary] | [what was changed] |

### Resolved (Should-Fix)
| File | Comment | Resolution |
|------|---------|------------|
| path/to/file.ts | [feedback summary] | [what was changed] |

### Flagged for Discussion
| File | Comment | Recommendation |
|------|---------|---------------|
| path/to/file.ts | [question/debate] | [your take + options] |

### Verification
- Lint: PASS/FAIL
- Tests: PASS/FAIL
- Build: PASS/FAIL

### Commits
- `abc1234` TAS-XX: Address PR review — [summary]
```

## Rules

- **Never dismiss a must-fix comment** — if you disagree, flag it for discussion instead
- **Preserve the reviewer's intent** — don't just technically satisfy the comment, address the underlying concern
- **Don't over-fix** — resolve only what was commented on. Save unrelated improvements for a separate PR
- **Respond to every comment** — nothing should be silently ignored
- **Self-improvement** — Follow `general.instructions.md` § Self-Improvement Protocol
