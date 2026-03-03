---
description: 'Scaffold a new skill file with proper frontmatter, structure, and registration. Use when adding a new domain skill to the AI configuration.'
agent: Team Lead
---

<!-- ⚠️ This file is managed by OpenCastle. Edits will be overwritten on update. Customize in the .github/customizations/ directory instead. -->

# Create Skill

Scaffold a new skill for the AI agent configuration. Skills encode domain-specific knowledge that agents load on demand.

## Skill Request

{{skillDescription}}

---

## Skill Types

OpenCastle has two kinds of skills with different locations and registration paths:

| Type | Location | Bound Via | Purpose |
|------|----------|-----------|---------|
| **Process skill** | `skills/<name>/SKILL.md` | Direct reference in agent files | Stack-agnostic methodology (testing workflow, self-improvement, validation gates) |
| **Plugin skill** | `plugins/<plugin>/SKILL.md` | Capability slot in the skill matrix | Technology-specific knowledge (CMS queries, database patterns, deployment config) |

> **Rule of thumb:** If the skill would need to be rewritten when switching technologies (e.g., Supabase → Convex), it belongs in a **plugin**. If it's useful regardless of stack, it's a **process skill**.

---

## Workflow

### Step 1: Classify the Skill

Determine the type:

| Question | If Yes → | If No → |
|----------|----------|---------|
| Is this tied to a specific technology/tool? | Plugin skill | Process skill |
| Would switching tech stacks invalidate this content? | Plugin skill | Process skill |
| Does a plugin already exist for this tool in `plugins/`? | Add `SKILL.md` to existing plugin | Create new plugin or process skill |

### Step 2: Name the Skill

- Use `kebab-case`
- **Process skills:** descriptive domain name (e.g., `testing-workflow`, `context-map`, `security-hardening`)
- **Plugin skills:** `skillName` field in the plugin's `config.ts` (e.g., `sanity-cms`, `supabase-database`, `nx-workspace`)
- Check existing skills in `skills/` and `plugins/` to avoid overlap

### Step 3: Create the Skill File

**Process skill:** Create `skills/<skill-name>/SKILL.md`
**Plugin skill:** Create `plugins/<plugin-name>/SKILL.md`

Use this template:

```markdown
````skill
---
name: <skill-name>
description: "<One-line description of what the skill covers. Include key topics and when to use it.>"
---

# <Display Name>

<1-2 sentence overview of the skill's purpose and scope.>

## Core Principles

1. **<Principle>** — <Explanation>
2. **<Principle>** — <Explanation>
3. **<Principle>** — <Explanation>

## <Domain Section 1>

<Content organized by topic. Use tables, code blocks, and checklists.>

## <Domain Section 2>

<More domain content.>

## Anti-Patterns

- **<Bad pattern>** — <Why it's bad and what to do instead>
- **<Bad pattern>** — <Why it's bad and what to do instead>
````
```

### Step 4: Register the Skill

Registration differs by type:

#### Process Skill

1. **Add to the skill matrix** — Add a row to the **Process Skills (Always Direct)** table in `.github/customizations/agents/skill-matrix.md`
2. **Reference in agent files** — Add to the `Direct Skills` section of each agent that should use it
3. **Optional: reference in instructions** — If the skill should be loaded by default, add it to the appropriate `.github/instructions/` file

#### Plugin Skill

1. **Set `skillName` in the plugin's `config.ts`** — This connects the skill to the plugin
2. **Update the skill matrix** — Set the Skill column for the matching capability slot row in `.github/customizations/agents/skill-matrix.md`
3. **No agent changes needed** — Agents resolve plugin skills through capability slots automatically

### Step 5: Validate

- [ ] File created at the correct path (`skills/` or `plugins/`)
- [ ] Frontmatter has `name` and `description` fields
- [ ] Description is a single line (no line breaks)
- [ ] Content follows the template structure
- [ ] No overlap with existing skills
- [ ] Skill matrix updated (process skill table or capability slot binding)
- [ ] For process skills: at least one agent references the skill directly
- [ ] For plugin skills: `config.ts` `skillName` matches the `name` in frontmatter

## Quality Guidelines

- **Be prescriptive** — Skills should give clear instructions, not vague advice. "Use `fetchPlaces()` from `libs/queries`" beats "use the query library"
- **Include examples** — Code snippets, file path examples, and table references
- **Keep it scannable** — Use headings, tables, bullets, and code blocks. Agents need to find information fast
- **Avoid duplication** — If a rule already exists in `.github/instructions/`, reference it instead of repeating it
- **Stay stack-agnostic in process skills** — Never hardcode technology names; use capability slot references (e.g., "the **database** skill" not "Supabase")
- **Size target** — 100-300 lines. Under 100 is probably too thin; over 300 should be split into multiple skills
