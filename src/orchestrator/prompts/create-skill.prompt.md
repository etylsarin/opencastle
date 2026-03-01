---
description: 'Scaffold a new skill directory with proper frontmatter, structure, and content sections. Use when adding a new domain skill to the AI configuration.'
agent: Team Lead
---

<!-- ⚠️ This file is managed by OpenCastle. Edits will be overwritten on update. Customize in the customizations/ directory instead. -->

# Create Skill

Scaffold a new skill for the AI agent configuration. Skills encode domain-specific knowledge that agents load on demand.

## Skill Request

{{skillDescription}}

---

## Workflow

### Step 1: Determine Scope

Classify the skill:

| Scope | Prefix | When to Use |
|-------|--------|-------------|
| **Global** | `global-` | Domain knowledge applicable to any project (React, testing, security) |
| **Local** | `local-` | Project-specific conventions (Linear config, Sanity schema patterns, this project's API structure) |

### Step 2: Name the Skill

- Format: `<scope>-<domain>` (e.g., `global-react-development`, `local-sanity-cms`)
- Use kebab-case
- Be specific enough to distinguish from other skills, broad enough to be reusable
- Check existing skills in `.github/skills/` to avoid overlap

### Step 3: Create the Skill File

Create `.github/skills/<skill-name>/SKILL.md` with this structure:

```markdown
````skill
---
name: <skill-name>
description: "<One-line description of what the skill covers. Include key topics and when to use it.>"
---

# Skill: <Display Name>

<1-2 sentence overview of the skill's purpose and scope.>

## When to Use

- <Trigger condition 1>
- <Trigger condition 2>
- <Trigger condition 3>

## Core Principles

1. **<Principle>** — <Explanation>
2. **<Principle>** — <Explanation>
3. **<Principle>** — <Explanation>

## <Domain Section 1>

<Content organized by topic. Use tables, code blocks, and checklists.>

## <Domain Section 2>

<More domain content.>

## Checklist

- [ ] <Verification item 1>
- [ ] <Verification item 2>

## Anti-Patterns

- **<Bad pattern>** — <Why it's bad and what to do instead>
- **<Bad pattern>** — <Why it's bad and what to do instead>
````
```

### Step 4: Register the Skill

1. **Add to the skill matrix** — Update `.github/customizations/agents/skill-matrix.md` with the new skill mapping
2. **Add to relevant agents** — Update the `skills` section in each agent that should use this skill
3. **Reference in instructions** — If the skill is loaded by default, add it to the appropriate `.github/instructions/` file

### Step 5: Validate

- [ ] File created at `.github/skills/<name>/SKILL.md`
- [ ] Frontmatter has `name` and `description` fields
- [ ] Description is a single line (no line breaks)
- [ ] Content follows the template structure
- [ ] No overlap with existing skills
- [ ] Skill matrix updated
- [ ] At least one agent references the skill

## Quality Guidelines

- **Be prescriptive** — Skills should give clear instructions, not vague advice. "Use `fetchPlaces()` from `libs/queries`" beats "use the query library"
- **Include examples** — Code snippets, file path examples, and table references from the actual codebase
- **Keep it scannable** — Use headings, tables, bullets, and code blocks. Agents need to find information fast
- **Avoid duplication** — If a rule already exists in `.github/instructions/`, reference it instead of repeating it
- **Size target** — 100-300 lines. Under 100 is probably too thin; over 300 should be split into multiple skills
