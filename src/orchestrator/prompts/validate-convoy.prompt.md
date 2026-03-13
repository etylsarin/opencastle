---
description: 'Validate a convoy YAML spec for schema correctness and logical soundness. Outputs VALID or INVALID with specific errors.'
agent: 'Reviewer'
output: validation
---

<!-- ⚠️ This file is managed by OpenCastle. Edits will be overwritten on update. Customize in the .opencastle/ directory instead. -->

# Validate Convoy Spec

You are a senior technical reviewer. Validate the convoy spec below against the schema rules and logical constraints. Be strict — a spec that passes this gate will be executed autonomously by AI agents.

## Convoy Spec to Validate

{{goal}}

---

## Validation Rules

Evaluate **every rule** below. If ALL pass, respond `VALID`. If ANY fail, respond `INVALID` with specific, actionable errors.

### Schema Requirements

- [ ] `name` field is present (non-empty string)
- [ ] `version` field is present (integer: `1` or `2`)
- [ ] `tasks` list is present and contains at least one task
- [ ] Every task has a unique `id` (lowercase, kebab-case, no spaces or special chars)
- [ ] Every task has a non-empty `prompt` field
- [ ] `on_failure` is `continue` or `stop` (if present; default `stop` is fine if absent)
- [ ] `concurrency` is a positive integer or the string `"auto"` (if present)
- [ ] `review` values are one of: `auto`, `fast`, `panel`, `none` (if present on task)
- [ ] `agent` values are from the approved roster (if present on task):
  `api-designer`, `architect`, `content-engineer`, `copywriter`, `data-expert`,
  `database-engineer`, `developer`, `devops-expert`, `documentation-writer`,
  `performance-expert`, `release-manager`, `researcher`, `security-expert`,
  `seo-specialist`, `team-lead`, `testing-expert`, `ui-ux-expert`
- [ ] `timeout` values match `<integer><s|m|h>` format (e.g., `30m`, `1h`, `90s`) (if present)

### Files Constraint

- [ ] No `files` entry contains glob patterns (`*`, `?`, `**`)
- [ ] All `files` entries are plain file paths or directory paths (trailing `/` is allowed for directories)
- [ ] No `files` entry is an absolute path (all paths must be relative to the repo root)

### Dependency Graph

- [ ] Every `depends_on` id references a real task `id` in the spec
- [ ] No dependency cycles exist (A → B → A is a cycle; A → B → C → A is also a cycle)

### Partition Conflicts

Two tasks that can run in parallel (no `depends_on` edge between them) must not share any `files` entry.

- [ ] Check every pair of tasks that lack a `depends_on` relationship — they must not share any file or directory path in their `files` lists

### Prompt Quality

- [ ] Each task `prompt` is self-contained: an agent with no surrounding context must be able to execute it
- [ ] Each task `prompt` names the specific files to act on (not vague phrases like "the frontend" or "the codebase")
- [ ] No task `prompt` is shorter than 2 sentences (one-liners are usually too vague)

### Inputs / Outputs Consistency (if used)

- [ ] Every `inputs[].from` references an existing task `id`
- [ ] Every task referenced in an `inputs[].from` declares a matching `outputs[].name`
- [ ] No consuming task runs before its producing task (must have `depends_on` edge or be in a later phase)

---

## Output Format

If all checks pass:

```
VALID
```

If any check fails:

```
INVALID

Errors:
- [Rule category] / [task id if applicable]: [Specific problem] — Fix: [How to correct it]
- [Rule category] / [task id if applicable]: [Another problem] — Fix: [How to correct it]
```

List only real failures. Do not list passing checks. Be specific — name the task id, the field, and the exact value that violates the rule.
