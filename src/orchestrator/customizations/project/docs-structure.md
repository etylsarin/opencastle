# Documentation Structure

<!-- Populated by `opencastle init` based on project structure. -->

Project-specific documentation layout referenced by the `documentation-standards` skill.

Documentation files live in the `.opencastle/` directory alongside other project-specific configuration. Key documentation files:

- `.opencastle/KNOWN-ISSUES.md` — Tracked issues, limitations, and accepted risks
- `.opencastle/project/roadmap.md` — Project roadmap and feature status
- `.opencastle/project/decisions.md` — Architecture Decision Records
- `.opencastle/LESSONS-LEARNED.md` — Agent knowledge base of retries and workarounds

## Directory Tree

<!-- Map your project's documentation directory here if one exists -->

```
.opencastle/
├── KNOWN-ISSUES.md            — Tracked issues and limitations
├── LESSONS-LEARNED.md         — Agent knowledge base
└── project/
    ├── roadmap.md             — Feature roadmap
    ├── decisions.md           — Architecture Decision Records
    └── docs-structure.md      — This file
```

## Practices

- **Check Known Issues** before starting any task
- **Review Architecture** decisions for context
- **Update roadmap** after completing features
- **Add new issues** with: Issue ID, Status, Severity, Evidence, Root Cause, Solution Options
- **Archive** outdated docs rather than deleting
