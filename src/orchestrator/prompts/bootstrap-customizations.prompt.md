---
description: 'Bootstrap the .github/customizations/ directory for a new project. Discovers project structure, tech stack, and configuration, then generates all customization files so skills have project-specific context to operate on.'
agent: Team Lead
---

<!-- ⚠️ This file is managed by OpenCastle. Edits will be overwritten on update. Customize in the .github/customizations/ directory instead. -->

# Bootstrap Project Customizations

You are setting up the AI agent framework for a new project. Your job is to **discover** the project's structure, tech stack, and configuration, then **generate** the customization files that skills reference for project-specific context.

## Additional Context (optional)

{{context}}

---

## Background

The `.github/customizations/` directory holds project-specific configuration that skills load at runtime. Skills contain generic methodology (how to write migrations, how to test, how to deploy); customizations hold the concrete values (which database, which endpoints, which project IDs).

Without customizations, agents operate blind — they don't know the project's table schema, API routes, deployment target, or task board. This prompt fixes that.

## Pre-Existing Stack Info

Before starting discovery, check for **`.opencastle.json`** in the project root. If it exists, it contains a combined `repoInfo` field from `opencastle init` that merges two sources:

1. **Auto-detected tooling** — the init command scanned config files, `package.json` dependencies, and directory structures
2. **User-declared choices** — the user selected CMS, database, project management, and notifications via the interactive questionnaire

The result is a single unified view of the project's tech stack:

```json
{
  "repoInfo": {
    "packageManager": "pnpm",
    "monorepo": "nx",
    "language": "typescript",
    "frameworks": ["next", "astro"],
    "databases": ["prisma", "supabase"],
    "cms": ["sanity"],
    "deployment": ["vercel"],
    "testing": ["playwright", "vitest"],
    "cicd": ["github-actions"],
    "styling": ["css-modules", "tailwind"],
    "auth": ["next-auth", "supabase-auth"],
    "pm": ["linear"],
    "notifications": ["slack"],
    "mcpConfig": true,
    "configFiles": ["nx.json", "package.json", "tsconfig.json", "vercel.json"]
  },
  "stack": {
    "cms": "sanity",
    "db": "supabase",
    "pm": "linear",
    "notifications": "slack"
  }
}
```

**Use `repoInfo` to:**
- Skip re-scanning for technologies already listed — go straight to reading their config files
- Pre-fill the tech stack table in `project.instructions.md`
- Know which `stack/` config files to create (e.g., if `repoInfo.databases` includes `"prisma"`, create `stack/prisma-config.md`)
- Know which `project/` config files to create (e.g., if `repoInfo.pm` includes `"linear"`, create `project/linear-config.md`)
- Identify `configFiles` to read for deep inspection (Phase 1.3)

**`stack` vs `repoInfo`:** The `stack` field holds the raw user questionnaire answers (used internally for MCP server filtering and skill selection). The `repoInfo` field is the combined view you should use for discovery — it includes everything from `stack` plus all auto-detected tooling.

**Still verify:** `repoInfo` detects presence, not configuration details. You still need to read the actual config files for schemas, IDs, routes, etc.

The skill matrix (`.github/customizations/agents/skill-matrix.json`) will already have the `cms` and `database` binding entries pre-filled based on this selection. The appropriate task management skill (`linear-task-management` for Linear, `jira-management` for Jira) and notifications skill (`slack-notifications` for Slack, `teams-notifications` for Teams) will already be installed. Verify they are correct and fill in any remaining empty bindings.

## Workflow

### Phase 1: Discovery

Explore the project systematically. Gather facts — don't assume.

#### 1.1 Project Overview

- **First**: Read `.opencastle.json` if it exists — note `stack` choices and `repoInfo` detections
- If `repoInfo` is present, use it as your starting inventory — skip re-scanning for the technologies it already lists
- Read `README.md`, `package.json`, and any workspace config (`nx.json`, `turbo.json`, `pnpm-workspace.yaml`, `lerna.json`)
- Identify: monorepo vs single app, package manager, language, framework(s)
- List all apps and libraries with their purpose
- Note ports, dev server commands, build commands

#### 1.2 Tech Stack Inventory

For each technology detected, note its configuration:

| Area | What to look for |
|------|-----------------|
| **Framework** | Next.js (`next.config.*`), Nuxt, Remix, Astro, SvelteKit, Express, etc. |
| **Database** | Supabase (`supabase/`), Prisma (`prisma/`), Drizzle, raw SQL, MongoDB |
| **CMS** | Sanity (`sanity.config.*`), Contentful, Strapi, Payload |
| **Auth** | Supabase Auth, NextAuth, Clerk, Auth0, custom JWT |
| **Deployment** | Vercel (`vercel.json`), Netlify (`netlify.toml`), Docker, AWS, Railway |
| **Testing** | Jest, Vitest, Playwright, Cypress, Testing Library |
| **CI/CD** | GitHub Actions (`.github/workflows/`), GitLab CI, CircleCI |
| **Task tracking** | Linear, Jira, GitHub Issues, Shortcut |
| **Data pipeline** | Scrapers, ETL scripts, CLI tools, NDJSON processing |
| **Styling** | Tailwind, CSS Modules, Sass, styled-components, Emotion |

#### 1.3 Deep Inspection

For each detected technology, dig into the config:

- **Database**: Read migration files, schema definitions, RLS policies, auth setup
- **CMS**: Read schema files, document types, plugin config, query patterns
- **API**: Find route handlers, Server Actions, middleware, external API integrations
- **Deployment**: Read deploy config, environment variables, cron jobs, security headers
- **Testing**: Find test config, test suites, test utilities, coverage setup
- **Docs**: Map the project's documentation directory tree (if it exists)
- **Task tracking**: Find team IDs, project IDs, workflow states (check Linear/Jira config or docs)

### Phase 2: Generate Customization Files

Create `.github/customizations/` and generate files based on what you discovered. **Only create files for technologies actually present in the project.** Skip files that don't apply.

Files are organized into subdirectories by domain:

```
.github/customizations/
├── README.md                  # Directory index
├── project.instructions.md    # High-level project context
├── LESSONS-LEARNED.md         # Knowledge base (retries, workarounds)
├── AGENT-FAILURES.md          # Dead letter queue for failed delegations
├── AGENT-PERFORMANCE.md       # Agent success tracking & log query recipes
├── agents/                    # Agent framework config
│   ├── agent-registry.md
│   ├── skill-matrix.json
│   └── skill-matrix.md
├── stack/                     # Tech stack config
│   ├── api-config.md
│   ├── deployment-config.md
│   ├── testing-config.md
│   ├── <database>-config.md   # e.g. supabase-config.md, prisma-config.md
│   ├── <cms>-config.md        # e.g. sanity-config.md, contentful-config.md
│   └── data-pipeline-config.md
├── project/                   # Project management config
│   ├── docs-structure.md
│   └── <tracker>-config.md    # e.g. linear-config.md, jira-config.md
└── logs/                      # Append-only NDJSON session logs
    ├── README.md
    ├── sessions.ndjson
    ├── delegations.ndjson
    └── panels.ndjson
```

#### Root Files (always create)

1. **`README.md`** — Describe the customizations directory and list all files with their purpose, organized by subdirectory

2. **`project.instructions.md`** — High-level project context:
   - Project name and description
   - Apps and libraries with purpose
   - Tech stack summary table
   - Dev server ports and URLs
   - Package manager and key commands
   - Environment variable inventory (names only — never values)

3. **`LESSONS-LEARNED.md`** — Empty knowledge base template for agent retries and workarounds. Agents append entries during sessions.

4. **`AGENT-FAILURES.md`** — Empty dead letter queue template for failed delegations.

5. **`AGENT-PERFORMANCE.md`** — Agent tracking template with log query recipes for the NDJSON files.

#### `agents/` — Agent Framework Config (create if `.github/agents/` exists)

6. **`agents/agent-registry.md`** — If `.github/agents/` exists with agent definitions:
   - List of agents with assigned model tiers
   - Scope descriptions
   - File partition examples

7. **`agents/skill-matrix.json`** — If `.github/skills/` exists with skill definitions:
   - Capability slot bindings and `directSkills` per agent role (in JSON format)
   - Which agents load which skills (slots for plugin skills, directSkills for process skills)
   - Note: `skill-matrix.md` is a companion documentation file — the JSON is the source of truth

#### `stack/` — Tech Stack Config (create only for detected technologies)

8. **`stack/api-config.md`** — If the project has API routes or Server Actions:
   - Route handler inventory with HTTP methods
   - Server Actions inventory
   - External API integrations
   - Middleware chain
   - Authentication/authorization patterns

9. **`stack/deployment-config.md`** — If deployment config exists:
   - Platform and architecture
   - Environment variables (names, not values)
   - Cron jobs / scheduled tasks
   - Security headers
   - Caching strategy
   - Key config files

10. **`stack/testing-config.md`** — If test infrastructure exists:
    - Test framework and config
    - Test app/port for E2E
    - Selector conventions (`data-testid`, etc.)
    - Test suites inventory
    - Coverage requirements
    - Responsive breakpoints for UI testing

11. **Database config** in `stack/` (name after the provider, e.g., `stack/supabase-config.md`, `stack/prisma-config.md`):
    - Connection details (project ID, not credentials)
    - Schema / table inventory with column summaries
    - Role / permission system
    - Migration history and naming convention
    - Auth integration flow
    - Key files

12. **CMS config** in `stack/` (e.g., `stack/sanity-config.md`, `stack/contentful-config.md`):
    - Project/space IDs
    - Schema / content model inventory
    - Plugin configuration
    - Query patterns and examples
    - Key files

13. **`stack/data-pipeline-config.md`** — If ETL / scraping / data processing exists:
    - Pipeline architecture
    - Data sources with status
    - CLI commands
    - Output format
    - Key files and directories

#### `project/` — Project Management Config

14. **`project/docs-structure.md`** — If a documentation directory exists:
    - Full directory tree
    - Purpose of each document
    - Documentation conventions

15. **Task tracker config** in `project/` (e.g., `project/linear-config.md`, `project/jira-config.md`) — If task tracking config is documented:
    - Team / project IDs
    - Workflow state IDs
    - Label / category IDs
    - Board conventions

#### `logs/` — Session Logs (always create)

16. **`logs/README.md`** — Schema documentation for the NDJSON log files
17. **`logs/sessions.ndjson`** — Empty file for structured session log entries
18. **`logs/delegations.ndjson`** — Empty file for delegation log entries
19. **`logs/panels.ndjson`** — Empty file for panel review log entries

### Phase 3: Cross-Reference Verification

After generating all files:

1. **Check skill references** — For each skill in `.github/skills/`, verify it references the correct customization file (or note if a reference needs to be added)
2. **Check for gaps** — Is there project-specific knowledge that doesn't fit any file? Create an appropriate new file
3. **Check for staleness** — Does the generated content match the current state of the code? Flag anything uncertain with `<!-- TODO: verify -->`

## Output Format

For each file created, report:
- File path
- Number of lines
- Key sections included

End with a summary of what was discovered, what was generated, and what (if anything) needs manual input (e.g., tracker team IDs that require API access to discover).

After your summary, suggest next steps:

### Suggested Next Steps

Now that your project is configured, here's what you can do:

1. **Review the generated files** — Scan `.github/customizations/` for any `<!-- TODO: verify -->` comments and fill in missing values (e.g., tracker team IDs, Supabase project IDs)
2. **Commit the customizations** — `git add .github/customizations/ && git commit -m "chore: bootstrap OpenCastle customizations"`
3. **Implement a feature** — Use the **"Implement Feature"** prompt to have the Team Lead orchestrate a full feature build with task tracking, delegation, and verification
4. **Fix a bug** — Use the **"Bug Fix"** prompt for structured triage, root cause analysis, and fix with tracker tracking
5. **Brainstorm first** — Not sure how to approach something? Use the **"Brainstorm"** prompt to explore requirements and trade-offs before committing to a plan
6. **Create a task spec** — Use the **"Generate Task Spec"** prompt to create `opencastle.tasks.yml` for autonomous overnight runs with `npx opencastle run` CLI command.

## Guidelines

- **Discover, don't assume.** Read actual config files. Don't guess that the project uses Supabase because it's a Next.js app.
- **Skip what doesn't exist.** If there's no CMS, don't create a CMS config file.
- **Names, not secrets.** Document environment variable names (`SUPABASE_URL`) but never their values.
- **Be specific.** Write actual table names, actual endpoint paths, actual file paths — not placeholders.
- **Flag uncertainty.** If you can't determine something from the code, add a `<!-- TODO: verify -->` comment rather than guessing.
- **Keep files focused.** Each file covers one domain. Don't put database schema in the deployment config.
