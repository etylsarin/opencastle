# OpenCastle

<p align="center">
  <img src="opencastle-logo.png" alt="OpenCastle" width="480" />
</p>

<p align="center">
  <strong>Open-source multi-agent orchestration framework for AI coding assistants</strong>
</p>

<p align="center">
  <a href="https://www.opencastle.dev/">Website</a> &middot;
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
npx opencastle run      # Process a task queue autonomously (daemon mode)
```

### Daemon / Autonomous Mode

Run a batch of tasks unattended by defining them in a YAML spec file:

```bash
npx opencastle run                         # Uses opencastle.tasks.yml
npx opencastle run -f my-tasks.yml         # Custom spec file
npx opencastle run --dry-run               # Preview execution plan
npx opencastle run --adapter claude-code   # Override adapter
npx opencastle run --concurrency 3         # Run up to 3 tasks in parallel
```

See [Task Queue](#task-queue) below for the full spec format.

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

## Task Queue

The `opencastle run` command processes a YAML task spec file, delegating tasks to AI coding agents without human supervision. Tasks form a DAG (directed acyclic graph) — dependencies are resolved automatically, and independent tasks can run in parallel.

### Spec format

Create an `opencastle.tasks.yml` file in your project root:

```yaml
name: "Overnight feature batch"
concurrency: 1          # Max parallel tasks (default: 1)
on_failure: continue     # "continue" | "stop" (default: "continue")
adapter: claude-code     # Which agent runtime to use

tasks:
  - id: migrate-db
    description: "Add reviews table with RLS policies"
    agent: database-engineer
    prompt: |
      Create a new Supabase migration for a reviews table.
    files:
      - supabase/migrations/
    timeout: 10m

  - id: build-component
    description: "Create ReviewCard component"
    agent: ui-ux-expert
    prompt: |
      Build a ReviewCard component following existing patterns.
    files:
      - libs/shared-ui/src/components/ReviewCard/
    timeout: 15m

  - id: wire-page
    description: "Wire reviews into the place detail page"
    agent: developer
    prompt: |
      Add a reviews section to the place detail page.
    depends_on: [migrate-db, build-component]
    timeout: 20m
```

### Task fields

| Field | Required | Default | Description |
|-------|----------|---------|-------------|
| `id` | Yes | — | Unique identifier |
| `prompt` | Yes | — | Instructions for the AI agent |
| `description` | No | Same as `id` | Human-readable description |
| `agent` | No | `developer` | Specialist agent role |
| `depends_on` | No | `[]` | Task IDs that must complete first |
| `files` | No | `[]` | File/directory scope hints |
| `timeout` | No | `30m` | Max duration (`30s`, `10m`, `1h`) |

### Top-level options

| Field | Default | Description |
|-------|---------|-------------|
| `name` | (required) | Human-readable run name |
| `concurrency` | `1` | Max tasks running in parallel |
| `on_failure` | `continue` | `continue` skips dependents; `stop` halts everything |
| `adapter` | `claude-code` | Agent runtime adapter |

### CLI options

```
opencastle run [options]

  --file, -f <path>        Task spec file (default: opencastle.tasks.yml)
  --dry-run                Show execution plan without running
  --concurrency, -c <n>    Override max parallel tasks
  --adapter, -a <name>     Override agent runtime adapter
  --report-dir <path>      Where to write run reports (default: .opencastle/runs)
  --verbose                Show full agent output
  --help, -h               Show this help
```

### Adapters

| Adapter | Status | CLI |
|---------|--------|-----|
| `claude-code` | ✅ Supported | `claude` |
| `copilot` | 🚧 Planned | — |

### Run reports

After each run, a JSON report is written to `.opencastle/runs/` with task statuses, durations, and output summaries.

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
