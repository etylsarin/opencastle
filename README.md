# OpenCastle

<p align="center">
  <img src="opencastle-logo.png" alt="OpenCastle" width="480" />
</p>

<p align="center">
  <strong>Open-source multi-agent orchestration framework for AI coding assistants</strong>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/opencastle"><img src="https://img.shields.io/npm/v/opencastle.svg" alt="npm version" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/npm/l/opencastle.svg" alt="license" /></a>
  <a href="https://www.npmjs.com/package/opencastle"><img src="https://img.shields.io/npm/dm/opencastle.svg" alt="downloads" /></a>
  <a href="https://github.com/etylsarin/opencastle"><img src="https://img.shields.io/github/stars/etylsarin/opencastle.svg?style=social" alt="GitHub stars" /></a>
  <img src="https://img.shields.io/node/v/opencastle.svg" alt="node version" />
</p>

<p align="center">
  <a href="https://www.opencastle.dev/">Website</a> &middot;
  <a href="#quick-start">Quick Start</a> &middot;
  <a href="ARCHITECTURE.md">Architecture</a> &middot;
  <a href="#contributing">Contributing</a> &middot;
  <a href="LICENSE">MIT License</a>
</p>

---

OpenCastle turns **GitHub Copilot**, **Cursor**, and **Claude Code** into coordinated multi-agent teams. Instead of one AI doing everything, it decomposes complex tasks across specialized agents that work in parallel — each with its own domain expertise, tools, and file partition.

One command. Any repo. Any IDE.

<p align="center">
  <a href="https://ko-fi.com/A0A61V4992" target="_blank"><img height="36" style="border:0px;height:36px;" src="https://storage.ko-fi.com/cdn/kofi4.png?v=6" border="0" alt="Buy Me a Coffee at ko-fi.com" /></a>
</p>

## Quick Start

```bash
npx opencastle init
```

The guided onboarding asks about your IDE and tech stack, then installs only the relevant agents, skills, and MCP servers:

```
$ npx opencastle init

🏰 OpenCastle v0.1.0

Which IDE are you using?
  1) VS Code       — .github/ agents, instructions, skills
  2) Cursor        — .cursorrules & .cursor/rules/*.mdc
  3) Claude Code   — CLAUDE.md & .claude/ commands

Which CMS are you using?
  1) Sanity        2) Contentful    3) Strapi        4) None

Which database are you using?
  1) Supabase      2) Convex        3) None

Which project management tool are you using?
  1) Linear        2) Jira          3) None

Which notifications tool are you using?
  1) Slack         2) Microsoft Teams   3) None
```

Your selections are stored in `.opencastle.json` and control which skills get installed, which MCP servers are configured, and how the skill matrix is pre-populated.

| IDE | Output |
|-----|--------|
| **VS Code** (Copilot) | `.github/` — agents, instructions, skills, workflows, prompts |
| **Cursor** | `.cursorrules` + `.cursor/rules/**/*.mdc` |
| **Claude Code** | `CLAUDE.md` + `.claude/` — agents, skills, commands |

All targets include a pre-configured **MCP server config** — only the servers matching your stack are included (from Sanity, Contentful, Strapi, Supabase, Convex, Vercel, Chrome DevTools, Linear, Jira, Slack, and Teams).

### Getting started

1. Run the **"Bootstrap Customizations"** prompt to configure for your project
2. Customize agent definitions and skills for your tech stack
3. Set the Team Lead as your Copilot Chat mode and start delegating
4. Commit the generated files to your repository

### CLI commands

| Command | Description |
|---------|-------------|
| `npx opencastle init` | Set up OpenCastle in your project |
| `npx opencastle update` | Update framework files (preserves customizations) |
| `npx opencastle diff` | Preview what an update would change |
| `npx opencastle eject` | Remove dependency, keep all files standalone |
| `npx opencastle run` | Process a task queue autonomously ([details](#task-queue)) |
| `npx opencastle dashboard` | View agent observability dashboard |

### Project structure (VS Code)

```
.github/
├── agents/              # 18 specialist agent definitions
├── instructions/        # Always-loaded project context
├── skills/              # 34 on-demand knowledge modules
├── agent-workflows/     # 8 reproducible execution templates
├── prompts/             # 9 reusable prompt templates
└── customizations/      # Your project config (never overwritten)
.vscode/
└── mcp.json             # MCP server config
```

---

## Key Features

| Feature | What it does |
|---------|-------------|
| **Team Lead orchestrator** | Analyzes, decomposes, delegates, and verifies work across agents |
| **18 specialist agents** | Developer, UI/UX, Database, Security, Testing, Reviewer, and more |
| **34 on-demand skills** | Loaded per task to keep context windows lean — stack-specific skills auto-selected during init |
| **8 workflow templates** | Features, bug fixes, data pipelines, security audits, etc. |
| **Multi-IDE support** | VS Code, Cursor, Claude Code — native formats for each |
| **Autonomous mode** | Queue tasks in YAML, run overnight without supervision |
| **Quality gates** | Fast review after every step, panel majority vote for high-stakes, structured dispute escalation, lint/test/build checks, browser testing |
| **Cost-aware routing** | Auto-selects model tier (Premium → Economy) by complexity |
| **Self-improvement** | Agents capture lessons and graduate them into instructions |

---

## Dashboard

Track your agent team's performance with a built-in observability dashboard:

```bash
npx opencastle dashboard
```

<p align="center">
  <img src="dashboard-screenshot.png" alt="OpenCastle Dashboard" width="800" />
</p>

Opens a local dashboard at `http://localhost:4300` that visualizes your project's real agent data:

- **KPIs** — Total sessions, success rate, delegations, avg duration
- **Pipeline** — Task flow across execution phases
- **Charts** — Sessions by agent, tier distribution, timeline, model usage
- **Execution log** — Recent agent activity step by step
- **Panel reviews** — Quality gate verdicts and fix items
- **Sessions table** — Sortable session history

The dashboard reads NDJSON logs from `.github/customizations/logs/` — the same files your agents write to during normal operation. No configuration needed.

| Flag | Description |
|------|-------------|
| `--port <n>` | Custom port (default: 4300) |
| `--no-open` | Don't auto-open browser |
| `--seed` | Show demo data instead of project logs |

---

## Architecture

OpenCastle orchestrates 18 specialist agents across 4 model tiers, coordinated by a Team Lead. See the full architecture diagram, model tiers, workflow templates, and quality gates in **[ARCHITECTURE.md](ARCHITECTURE.md)**.

---

## Task Queue

Queue tasks in a YAML spec file and let agents run overnight — no supervision required. Tasks form a DAG; dependencies resolve automatically.

### Generating the spec

Use the **"Generate Task Spec"** prompt to create a valid `opencastle.tasks.yml` from a high-level description of what you want to accomplish. The prompt guides the Team Lead through goal analysis, task decomposition, dependency graphing, and writing self-contained agent instructions — so you don't have to author the YAML by hand.

```bash
npx opencastle run                         # Uses opencastle.tasks.yml
npx opencastle run -f my-tasks.yml         # Custom spec file
npx opencastle run --dry-run               # Preview execution plan
npx opencastle run --concurrency 3         # Parallel tasks
```

### Spec format

```yaml
name: "Overnight feature batch"
concurrency: 2
on_failure: continue     # "continue" | "stop"
adapter: claude-code

tasks:
  - id: migrate-db
    agent: database-engineer
    prompt: |
      Create a new Supabase migration for a reviews table.
    files: [supabase/migrations/]
    timeout: 10m

  - id: build-component
    agent: ui-ux-expert
    prompt: |
      Build a ReviewCard component following existing patterns.
    files: [libs/shared-ui/src/components/ReviewCard/]
    timeout: 15m

  - id: wire-page
    agent: developer
    prompt: |
      Add a reviews section to the place detail page.
    depends_on: [migrate-db, build-component]
    timeout: 20m
```

### Reference

<details>
<summary>Task fields</summary>

| Field | Required | Default | Description |
|-------|----------|---------|-------------|
| `id` | Yes | — | Unique identifier |
| `prompt` | Yes | — | Instructions for the agent |
| `description` | No | Same as `id` | Human-readable label |
| `agent` | No | `developer` | Specialist agent role |
| `depends_on` | No | `[]` | Task IDs that must complete first |
| `files` | No | `[]` | File/directory scope |
| `timeout` | No | `30m` | Max duration (`30s`, `10m`, `1h`) |

</details>

<details>
<summary>Top-level options</summary>

| Field | Default | Description |
|-------|---------|-------------|
| `name` | *(required)* | Human-readable run name |
| `concurrency` | `1` | Max parallel tasks |
| `on_failure` | `continue` | `continue` skips dependents; `stop` halts all |
| `adapter` | `claude-code` | Agent runtime adapter |

</details>

<details>
<summary>CLI options</summary>

| Flag | Description |
|------|-------------|
| `--file, -f <path>` | Task spec file (default: `opencastle.tasks.yml`) |
| `--dry-run` | Show execution plan without running |
| `--concurrency, -c <n>` | Override max parallel tasks |
| `--adapter, -a <name>` | Override agent runtime |
| `--report-dir <path>` | Report output dir (default: `.opencastle/runs`) |
| `--verbose` | Show full agent output |

</details>

### Adapters

| Adapter | Status | CLI |
|---------|--------|-----|
| `claude-code` | ✅ Supported | `claude` |
| `copilot` | ✅ Supported | `copilot` |
| `cursor` | ✅ Supported | `agent` |

After each run, a JSON report is written to `.opencastle/runs/` with statuses, durations, and output summaries.

---

## Contributing

Contributions are welcome! Whether it's bug reports, feature requests, new skills, agent definitions, or workflow templates — we'd love your help.

1. **Fork** the repository
2. **Create a branch** — `feat/your-feature` or `fix/your-fix`
3. **Make your changes** — follow existing code style and conventions
4. **Test** — ensure `npm run build:cli` passes
5. **Open a PR** — describe what you changed and why

Please open an [issue](https://github.com/etylsarin/opencastle/issues) first for large changes so we can discuss the approach.

See [ARCHITECTURE.md](ARCHITECTURE.md) for technical details on how the framework is structured.

---

## Sponsors

OpenCastle is free and open-source, maintained in spare time. If you or your company find it useful, consider supporting development:

<p align="center">
  <a href="https://ko-fi.com/A0A61V4992" target="_blank"><img height="36" style="border:0px;height:36px;" src="https://storage.ko-fi.com/cdn/kofi4.png?v=6" border="0" alt="Buy Me a Coffee at ko-fi.com" /></a>
</p>

**Why sponsor?**

- Sustain active development and new features
- Priority issue responses
- Influence the roadmap
- Support the open-source AI tooling ecosystem

For corporate sponsorship inquiries, open a [GitHub Discussion](https://github.com/etylsarin/opencastle/discussions).

---

## License

[MIT](LICENSE) — Filip Mares, 2026
