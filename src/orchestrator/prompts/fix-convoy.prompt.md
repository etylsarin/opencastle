---
description: 'Fix schema validation errors in a convoy YAML spec. Goal is the broken spec YAML; context is the error list from the validation step.'
agent: 'Team Lead (OpenCastle)'
output: convoy-spec
---

<!-- ⚠️ This file is managed by OpenCastle. Edits will be overwritten on update. Customize in the .opencastle/ directory instead. -->

# Fix Convoy Spec

You are the Team Lead. The convoy spec below failed validation. Fix **every reported error** and output a complete, corrected spec.

## Failing Spec

```yaml
{{goal}}
```

## Validation Errors

{{context}}

---

## Fix Instructions

1. Read every error before touching the YAML.
2. Fix **all** reported errors — do not partially fix.
3. Do not change the intent, agent assignments, or task scope of any task. Only fix what is broken.
4. Preserve all `id`, `prompt`, `agent`, `review`, and `files` values that are not part of the reported errors.

### Common Fix Patterns

**Glob patterns in `files`**
- `src/**/*.ts` → `src/` (use the directory, not a glob)
- `app/api/**` → `app/api/`
- `components/*.tsx` → `components/`

**Missing required fields**
- Add `name:` at the top level if missing
- Add `version: 2` at the top level if missing
- Add `id:` to any task that lacks one (use kebab-case derived from the task purpose)
- Add `prompt:` to any task that lacks one — write a 2-sentence self-contained description

**Dependency cycles**
- If A depends on B and B depends on A: remove the weaker edge (the one that can be inferred from ordering)
- If the cycle is A → B → C → A: introduce a new intermediate task or reorder so earlier tasks do not depend on later ones

**Partition conflicts (two parallel tasks sharing files)**
- Option 1: Add a `depends_on` edge to serialize the conflicting tasks
- Option 2: Split one task's `files` list to use a more specific path that does not overlap

**Invalid `agent` value**
Replace with the closest valid agent from:
`api-designer`, `architect`, `content-engineer`, `copywriter`, `data-expert`,
`database-engineer`, `developer`, `devops-expert`, `documentation-writer`,
`performance-expert`, `release-manager`, `researcher`, `security-expert`,
`seo-specialist`, `team-lead`, `testing-expert`, `ui-ux-expert`

**Invalid `timeout` format**
- `"30 minutes"` → `30m`
- `"1 hour"` → `1h`
- `"120"` → `120s`

---

## Output

Return the **complete corrected YAML** inside a fenced code block (not just the changed lines):

```yaml
# .opencastle/convoys/<same-filename-as-original>
name: ...
version: 2
tasks:
  ...
```

Do not add explanatory prose before or after the YAML block.
