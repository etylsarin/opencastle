# OpenCastle

<p align="center">
  <img src="opencastle-logo.png" alt="OpenCastle" width="480" />
</p>

<p align="center">
  <strong>Open-source multi-agent orchestration framework for AI coding assistants</strong>
</p>

<p align="center">
  <a href="https://etylsarin.github.io/opencastle/">Website</a> &middot;
  <a href="#quick-start">Quick Start</a> &middot;
  <a href="#architecture">Architecture</a> &middot;
  <a href="LICENSE">MIT License</a>
</p>

---

## What is OpenCastle?

OpenCastle is a battle-tested, open-source orchestration framework that turns AI coding assistants — **GitHub Copilot**, **Cursor**, and **Claude Code** — into coordinated multi-agent teams. Instead of one AI assistant doing everything, OpenCastle decomposes complex tasks across specialized agents that work in parallel, each with its own domain expertise, tool access, and file partition.

Run `npx opencastle init` in any repository to get a production-ready AI development team — complete with instructions, skills, agent definitions, workflow templates, MCP server configs, and quality gates. The CLI detects your IDE and generates the right file format automatically. Customize the agents and skills for your tech stack; the orchestration patterns work with any language or framework.

## Key Features

- **Team Lead orchestrator** — A single coordinator that analyzes, decomposes, delegates, and verifies work across specialist agents
- **17 specialist agents** — From frontend developer to security expert, each with curated tools, model tiers, and domain skills
- **27 on-demand skills** — Modular knowledge files loaded per task to keep context windows lean
- **8 workflow templates** — Reproducible execution plans for features, bug fixes, data pipelines, schema changes, and more
- **8 prompt templates** — Reusable prompts for common tasks like feature implementation, brainstorming, and skill creation
- **Multi-IDE support** — Native adapters for VS Code (Copilot), Cursor (.mdc rules), and Claude Code (CLAUDE.md)
- **MCP server configs** — Pre-configured Model Context Protocol servers (Sanity, Vercel, Supabase, Linear, Chrome DevTools)
- **Quality gates** — Panel majority vote (3 reviewers), deterministic lint/test/build checks, browser testing
- **Self-improvement protocol** — Agents capture lessons learned and graduate them into permanent instructions
- **Linear integration** — Every task tracked, every PR linked, every decision traceable
- **Cost-aware model routing** — Automatic tier selection (Premium → Economy) based on task complexity

## Architecture

```
┌──────────────────────────────────────────────────┐
│                   Team Lead                       │
│              (Claude Opus 4.6)                    │
│   Analyze → Decompose → Delegate → Verify        │
├──────────────────────────────────────────────────┤
│                                                  │
│  ┌───────────┐ ┌───────────┐ ┌───────────┐      │
│  │ Developer │ │  UI/UX    │ │  Content  │      │
│  │           │ │  Expert   │ │  Engineer │ Std  │
│  └───────────┘ └───────────┘ └───────────┘      │
│  ┌───────────┐ ┌───────────┐ ┌───────────┐      │
│  │ Database  │ │   Perf    │ │   API     │      │
│  │ Engineer  │ │  Expert   │ │ Designer  │ Std  │
│  └───────────┘ └───────────┘ └───────────┘      │
│  ┌───────────┐ ┌───────────┐ ┌───────────┐      │
│  │ Security  │ │ Architect │ │ Release   │      │
│  │  Expert   │ │           │ │  Manager  │ Prem │
│  └───────────┘ └───────────┘ └───────────┘      │
│  ┌───────────┐ ┌───────────┐ ┌───────────┐      │
│  │ Testing   │ │   Data    │ │  DevOps   │      │
│  │  Expert   │ │  Expert   │ │  Expert   │ Fast │
│  └───────────┘ └───────────┘ └───────────┘      │
│  ┌───────────┐ ┌───────────┐ ┌───────────┐      │
│  │   Docs    │ │Researcher │ │Copywriter │      │
│  │  Writer   │ │           │ │           │ Econ │
│  └───────────┘ └───────────┘ └───────────┘      │
│  ┌───────────┐                                   │
│  │   SEO     │  Economy Tier                     │
│  │Specialist │                                   │
│  └───────────┘                                   │
│                                                  │
├──────────────────────────────────────────────────┤
│  Instructions │ Skills │ Workflows │ Prompts     │
│  (always on)  │(on-demand)│(per task)│(templates)│
└──────────────────────────────────────────────────┘
```

## Quick Start

Install OpenCastle in your project with one command:

```bash
npx opencastle init
```

The CLI will ask which IDE you use and generate the right file format:

| IDE | Format |
|-----|--------|
| **VS Code** (GitHub Copilot) | `.github/` — agents, instructions, skills, workflows, prompts |
| **Cursor** | `.cursorrules` + `.cursor/rules/**/*.mdc` |
| **Claude Code** | `CLAUDE.md` + `.claude/` — agents, skills, commands |

All three targets also get a pre-configured **MCP server config** with Sanity, Vercel, Supabase, Linear, and Chrome DevTools.

### After installation

1. Run the **"Bootstrap Customizations"** prompt to configure for your project
2. Customize agent definitions for your tech stack
3. Add domain skills for your specific frameworks and tools
4. Set the Team Lead as your Copilot Chat mode and start delegating
5. Commit the generated files to your repository

### Other commands

```bash
npx opencastle update   # Update framework files (preserves customizations)
npx opencastle diff     # Preview what an update would change
npx opencastle eject    # Remove dependency, keep all files standalone
```

### Project structure (VS Code example)

```
.github/
├── agents/              # 17 specialist agent definitions
├── instructions/        # Always-loaded project context files
├── skills/              # 27 on-demand domain knowledge files
├── agent-workflows/     # 8 reproducible execution templates
├── prompts/             # 8 reusable prompt templates
└── customizations/      # Your project-specific config (never overwritten)
.vscode/
└── mcp.json             # MCP server config (Sanity, Vercel, Supabase, Linear, Chrome DevTools)
```

## Model Tier Routing

| Tier | Model | Use Case | Cost |
|------|-------|----------|------|
| Premium | Claude Opus 4.6 | Architecture, security, orchestration | Highest |
| Standard | Gemini 3.1 Pro | Feature implementation, schemas, UI | Mid |
| Fast | GPT-5.3-Codex | Testing, data pipelines, deployment | Low |
| Economy | GPT-5 mini | Documentation | Lowest |

## Workflow Templates

| Template | Use Case |
|----------|----------|
| `feature-implementation` | Multi-layer features (DB → Query → UI → Tests) |
| `bug-fix` | Triage → RCA → Fix → Verify |
| `data-pipeline` | Scrape → Convert → Enrich → Validate → Import |
| `security-audit` | Scope → Automate → Review → Panel → Remediate |
| `performance-optimization` | Measure → Analyze → Optimize → Verify |
| `schema-changes` | CMS/content model modifications and queries |
| `database-migration` | DB migrations, access policies, rollback |
| `refactoring` | Safe code refactoring with behavior preservation |

## Quality Gates

- **Deterministic checks** — Lint, type-check, unit tests, build verification
- **Panel majority vote** — 3 isolated reviewer sub-agents, 2/3 majority wins
- **Browser testing** — Chrome DevTools MCP for visual validation at 3 breakpoints
- **Self-review** — Every agent asked "What edge cases am I missing?"

## Battle-Tested

OpenCastle was forged in a production monorepo shipping real consumer apps. The patterns, guard rails, and lessons baked into the framework come from thousands of agent delegations — not theory.

- **88 orchestration files** totaling ~45K tokens of curated knowledge
- **8 workflow templates** covering the full SDLC
- **Self-improving** — agents capture lessons and graduate them into permanent instructions

## License

[MIT](LICENSE) — Filip Mares, 2026
