---
description: 'Validate a convoy task plan for semantic correctness. Outputs VALID or INVALID with specific errors.'
agent: 'Reviewer'
output: validation
---

<!-- ⚠️ This file is managed by OpenCastle. Edits will be overwritten on update. Customize in the .opencastle/ directory instead. -->

# Validate Task Plan

> **Note:** Schema validation (field types, YAML syntax, dependency cycles, glob patterns) has already passed. Focus ONLY on the semantic checks below.

You are a senior technical reviewer. Validate the task plan below for semantic correctness. Be strict — a plan that passes this gate will be executed autonomously by AI agents.

> **⚠ EXHAUSTIVENESS MANDATE**: You MUST report ALL errors in a single pass. Do NOT stop at the first few issues. Systematically evaluate every task against every check below. A second validation pass should find zero new issues — if it would, your first pass was incomplete. Cross-reference every task's prompt against every other task's files list and dependency edges before concluding.

## Task Plan to Validate

{{goal}}

---

## Semantic Checks

> If the spec below contains the marker `<!-- validation-pass: N -->`, this is validation pass N. On pass 1, be maximally thorough — report every issue you can find. On pass 2+, verify that previous fixes were applied correctly and check for regressions, but do NOT invent new categories of issues not covered by the checks below.

Evaluate **every check** below. If ALL pass, respond `VALID`. If ANY fail, respond `INVALID` with specific, actionable errors.

### 1. Partition Conflicts

Two tasks that can run in parallel (no direct or transitive `depends_on` edge between them) must not share any `files` entry.

- [ ] For every pair of potentially-parallel tasks, confirm they share no file or directory path in their `files` lists
- [ ] Transitive dependencies count: if A → B → C, then A and C are NOT parallel

### 2. Prompt Quality

Each task `prompt` must be:

- [ ] **Self-contained** — an agent with zero context can execute it without external clarification
- [ ] **File-specific** — names the exact files to create or modify (not vague references like "the frontend" or "the codebase")
- [ ] **Substantive** — at least 2 meaningful sentences; no stubs (`...`), no placeholders
- [ ] **Verifiable** — contains acceptance criteria or explicit verification steps
- [ ] **Research-instructed** — if the prompt concerns real people, places, or organisations, it includes a research instruction

### 3. Dependency Completeness

If a task's prompt imports, references, or builds on files, types, components, or packages produced by another task, a `depends_on` edge to that producing task must exist.

- [ ] Scan every prompt for cross-task file imports, type usage, or component references
- [ ] Each such reference must be covered by a `depends_on` edge to the task that creates it

### 4. Logical Soundness

The overall plan must make engineering sense.

- [ ] No redundant tasks doing the same work
- [ ] No obvious missing tasks (gaps that would leave the goal unachievable)
- [ ] File ownership matches task descriptions (a task that owns a file should actually modify it)
- [ ] Agent assignment matches domain — `developer` for code, `documentation-writer` for docs, `copywriter` for marketing copy, etc.
- [ ] File list completeness — every file the prompt instructs the agent to create/modify appears in the task's `files` list
- [ ] Prompt-dependency coherence — prompts do not include workarounds (stub files, `@ts-expect-error`, conditional imports) for outputs of tasks listed in `depends_on`, since those outputs are guaranteed to exist

---

## Output Format

Your entire response must be a single fenced JSON block — no text before or after:

```json
{
  "valid": true
}
```

Or if any check fails:

```json
{
  "valid": false,
  "issues": [
    "[Section name]: [Specific problem] — Fix: [What to change]"
  ]
}
```

List only real failures in `issues`. Do not list items that passed.
