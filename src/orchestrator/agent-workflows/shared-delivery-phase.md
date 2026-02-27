# Shared Delivery Phase

This phase is referenced by all workflow templates. It covers the final delivery steps after all implementation and verification is complete.

## Steps

1. **Commit all changes** to the feature branch with Linear issue IDs in commit messages
2. **Push the branch** to origin: `git push -u origin <branch-name>`
3. **Open a PR** using `gh` CLI (always use `GH_PAGER=cat` to prevent pager issues):
   ```bash
   GH_PAGER=cat gh pr create --base main --title "TAS-XX: Short description" --body "Resolves TAS-XX"
   ```
4. **Do NOT merge** — PRs are opened for human review only
5. **Update Linear issues** with the PR URL for traceability
6. **Clean up session checkpoint** if one exists

## Branch & Delivery Strategy

The **Team Lead owns delivery**, not individual specialist agents:

- **Team Lead creates the branch** in Phase 1 before any delegation
- **Sub-agents** work directly on the Team Lead's branch (shared working tree)
- **Background agents** work in isolated worktrees branched from the feature branch
- **Team Lead merges worktrees back** during verification
- **Only the Team Lead pushes** to the branch and opens the PR

## Exit Criteria

- [ ] All changes committed with Linear issue IDs in messages
- [ ] Branch pushed to origin
- [ ] PR opened on GitHub (NOT merged)
- [ ] Linear issues updated with PR URL
- [ ] All project issues marked Done or Cancelled
