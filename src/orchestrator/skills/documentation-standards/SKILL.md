---
name: documentation-standards
description: "Documentation templates, structure, and standards for project docs, roadmaps, ADRs, and known issues. Use when writing or updating documentation files."
---

<!-- ⚠️ This file is managed by OpenCastle. Edits will be overwritten on update. Customize in the customizations/ directory instead. -->

# Documentation Standards

Generic documentation templates and writing standards. For project-specific directory structure and practices, see [docs-structure.md](../../customizations/project/docs-structure.md).

## Issue Documentation Template

```markdown
### ISSUE-ID: Brief Description

**Issue ID:** ISSUE-ID
**Status:** Known Limitation | Fixed | Workaround Available
**Severity:** Critical | High | Medium | Low
**Impact:** [What user/developer experience is affected]

#### Problem
[Clear description of the issue]

#### Root Cause
[Technical explanation]

#### Solution Options
1. **Option A** — [Description]
   - Pros: ...
   - Cons: ...
2. **Option B** — [Description]

#### Related Files
- `path/to/file.ts` — [What it does]
```

## Roadmap Update Template

When a feature is completed:
1. Change status to `COMPLETE`
2. Add completion date
3. List modified files
4. Update the summary table at the top
5. Move to completed section if applicable

## Architecture Decision Record Template

```markdown
## ADR-NNN: Decision Title

**Date:** YYYY-MM-DD
**Status:** Accepted | Superseded | Deprecated
**Context:** [Why this decision was needed]
**Decision:** [What was decided]
**Consequences:** [Impact of the decision]
**Alternatives Considered:** [What else was evaluated]
```

## Writing Guidelines

- Write clear, concise prose — avoid jargon unless necessary
- Include diagrams (Mermaid or ASCII) for architecture
- Link to related files and docs using relative paths
- Keep line length under 400 characters; break at 80 for readability
- Use tables for structured data
- Include "Last Updated" dates on all documents
- Archive outdated docs rather than deleting
- Cross-reference between documents when relevant

### Formatting Rules

- **Headings**: Use H2 for sections, H3 for subsections. Do not use H1 — generated from title. Avoid H4+
- **Lists**: Use `-` for bullet points and `1.` for numbered lists; indent nested lists with two spaces
- **Code Blocks**: Use fenced code blocks with language specified for syntax highlighting
- **Links**: Use `[link text](URL)` with descriptive text and valid URLs
- **Images**: Use `![alt text](image URL)` with brief descriptive alt text
- **Tables**: Use `|` tables with properly aligned columns and headers
- **Whitespace**: Use blank lines to separate sections; avoid excessive whitespace

### Front Matter

Include YAML front matter at the beginning of instruction/skill files:

- `title` / `name`: The title of the document
- `description`: A brief description of the document content
- `applyTo`: (for instruction files) Glob pattern for which files the instructions apply to
