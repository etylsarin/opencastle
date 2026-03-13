---
description: 'Fix validation errors in a PRD. Goal is the broken PRD markdown; context is the error list from the validation step.'
agent: 'Team Lead (OpenCastle)'
output: prd
---

<!-- ⚠️ This file is managed by OpenCastle. Edits will be overwritten on update. Customize in the .opencastle/ directory instead. -->

# Fix PRD

You are the Team Lead. The PRD below failed validation. Fix **every reported issue** and output a complete, corrected PRD.

## Failing PRD

{{goal}}

## Validation Errors

{{context}}

---

## Fix Instructions

1. Read every reported issue before making changes.
2. Fix **all** reported issues — do not partially fix.
3. Do not change the intent, goals, or scope of the feature. Only fix what the validator flagged.
4. Preserve all content that is not part of the reported issues.

### Common Fix Patterns

**Missing sections**
- Add the missing section with concrete, specific content — not placeholder text
- If the section needs real data you cannot infer, write a reasonable default and mark with `<!-- TODO: verify -->`

**Vague acceptance criteria**
- Replace subjective language ("looks good", "feels responsive") with measurable conditions ("renders within 200ms", "meets WCAG 2.2 AA contrast ratio")
- Replace modal verbs ("should", "might", "could") with definitive language ("must", "will")

**Broad implementation scope**
- Replace broad paths (`src/`, `the frontend`) with specific file names or subdirectory names
- Remove glob patterns (`*`, `**`) from scope tables — use actual directory or file names

**File partition conflicts**
- If two parallel workstreams claim the same file, move one to a later phase with explicit dependency
- Or split the file's responsibilities across the two workstreams so each touches distinct files

**Missing dependency declarations**
- Add `depends on: Phase N` to phases that require output from earlier phases

**Placeholder text**
- Replace template filler ("2–3 sentences about…", "Description here") with real content derived from the feature description

---

## Output

Return the **complete corrected PRD** as raw Markdown starting with the `#` heading. Do not wrap the output in a code fence. Do not add explanatory prose before or after the PRD.
