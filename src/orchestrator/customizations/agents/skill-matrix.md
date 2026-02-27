````markdown
# Skill Matrix

Maps abstract technology capabilities to concrete skill implementations. Agents reference **capability slots** instead of hardcoded technology skills — when the stack changes, update the bindings here and all agents automatically resolve to the correct skill.

**Process/methodology skills** (session checkpoints, validation gates, self-improvement, etc.) are referenced directly in agent files — they don't go through the matrix.

## How It Works

```
Agent file                  Skill Matrix                 Skill file
┌──────────────┐           ┌──────────────┐           ┌──────────────┐
│ Developer    │           │ framework:   │           │ nextjs-      │
│  needs:      │──lookup──▶│  nextjs      │──load────▶│ patterns     │
│  framework   │           │              │           │              │
│  ui-library  │           │ ui-library:  │           │ react-       │
│  api-layer   │           │  react       │──load────▶│ development  │
│              │           │              │           │              │
│              │           │ api-layer:   │           │ api-         │
│              │           │  nextjs-api  │──load────▶│ patterns     │
│              │           │              │           │              │
└──────────────┘           └──────────────┘           └──────────────┘
```

1. **Agents** declare which capability slots they need (e.g., `framework`, `database`)
2. **This matrix** maps each slot to the current technology and its skill file
3. **When delegating**, resolve slots through this matrix to load the correct skill
4. **To switch tech**, update only the binding row — no agent files change

## Stack Bindings

<!-- Populated by the `bootstrap-customizations` prompt based on detected technologies. -->

### Primary Stack

| Slot | Technology | Skill | Description |
|------|-----------|-------|-------------|
| `language` | | _(general.instructions.md)_ | Primary programming language, type system |
| `ui-library` | | | Component architecture, hooks, state, styling |
| `framework` | | | SSR/SSG, routing, layouts, Server/Client Components |
| `database` | | | Schema, migrations, auth flow, roles |
| `cms` | | | Document types, queries, schema management |
| `deployment` | | | Hosting, cron jobs, env vars, caching, headers |
| `monorepo` | | | Task running, caching, affected commands, generators |

### Tooling

| Slot | Technology | Skill | Description |
|------|-----------|-------|-------------|
| `api-layer` | | | API routes, validation, search architecture |
| `data-pipeline` | | | ETL, scraping, data processing |
| `testing` | | | Unit/integration tests, coverage, test planning |
| `e2e-testing` | | | Browser automation, viewport testing, visual validation |

### Disciplines

| Slot | Approach | Skill | Description |
|------|---------|-------|-------------|
| `performance` | | `performance-optimization` | Bundle size, rendering, caching, profiling |
| `security` | | `security-hardening` | Auth, headers, input validation, vulnerability mgmt |
| `accessibility` | WCAG 2.2 Level AA | `accessibility-standards` | Keyboard nav, screen readers, contrast, semantics |
| `design-system` | | `frontend-design` | Design thinking, typography, color, motion, layout |
| `seo` | | `seo-patterns` | Technical SEO patterns for meta tags, JSON-LD, sitemaps, URL strategy |

## Agent Capability Matrix

Each row shows which capability slots an agent needs (resolved through this matrix) and which process skills it uses directly.

| Agent | Capability Slots | Direct Skills |
|-------|-----------------|---------------|
| **Developer** | `framework`, `ui-library`, `api-layer` | `validation-gates` |
| **Database Engineer** | `database`, `security` | — |
| **UI/UX Expert** | `design-system`, `ui-library`, `accessibility` | `e2e-testing`¹ |
| **Content Engineer** | `cms` | — |
| **Testing Expert** | `e2e-testing`, `testing` | `validation-gates` |
| **Security Expert** | `security`, `database` | — |
| **Data Expert** | `data-pipeline` | — |
| **DevOps Expert** | `deployment` | — |
| **Performance Expert** | `performance` | — |
| **Architect** | `monorepo` | `documentation-standards` |
| **Copywriter** | `cms` | `documentation-standards` |
| **SEO Specialist** | `framework`, `cms`, `seo` | — |
| **API Designer** | `api-layer`, `framework`, `security` | — |
| **Release Manager** | `monorepo`, `deployment` | `validation-gates`, `documentation-standards` |
| **Documentation Writer** | — | `documentation-standards`, `code-commenting` |
| **Researcher** | — | `context-map`, `self-improvement` |
| **Team Lead** | — | `team-lead-reference`, `task-management`, `session-checkpoints`, `validation-gates`, `panel-majority-vote`, `context-map`, `memory-merger`, `agent-hooks` |

¹ UI/UX Expert uses `e2e-testing` as a utility (viewport resize commands) — resolved through the matrix like other slots.

## Process Skills (Always Direct)

These are methodology/workflow skills — not tied to any technology. Referenced directly in agent files, never through capability slots.

| Skill | Purpose |
|-------|---------|
| `self-improvement` | Lessons-learned protocol, retry documentation |
| `session-checkpoints` | Session state saving, resuming, forking |
| `context-map` | File impact mapping before complex changes |
| `panel-majority-vote` | 3-reviewer quality gate (PASS/BLOCK) |
| `memory-merger` | Graduate lessons into permanent skills/instructions |
| `code-commenting` | Self-documenting code patterns, annotation tags |
| `agent-hooks` | Agent lifecycle hooks (session-start, session-end, etc.) |
| `agent-memory` | Agent expertise tracking, cross-session knowledge graph |
| `task-management` | Linear board conventions, issue naming, priorities |
| `team-lead-reference` | Team Lead orchestration reference, model routing |
| `validation-gates` | Shared validation gate definitions (lint, test, build) |
| `documentation-standards` | Documentation templates, formatting rules |

## Switching Technologies

### Example: Supabase → Convex

1. Create a new skill: `skills/convex-database/SKILL.md`
2. Update this matrix: `database` row → Technology: `Convex`, Skill: `convex-database`
3. Update `project.instructions.md` to reflect the new tech stack
4. **No agent files change** — Database Engineer, Security Expert still reference the `database` slot

### Example: React → Svelte + Next.js → SvelteKit

1. Create skills: `skills/svelte-development/SKILL.md`, `skills/sveltekit-patterns/SKILL.md`
2. Update matrix: `ui-library` → `Svelte` / `svelte-development`
3. Update matrix: `framework` → `SvelteKit` / `sveltekit-patterns`
4. Update `project.instructions.md` and `general.instructions.md`
5. **No agent files change** — Developer, UI/UX Expert still reference `framework` and `ui-library` slots

### Example: Jest → Vitest

1. Create skill: `skills/vitest-workflow/SKILL.md`
2. Update matrix: `testing` → `Vitest` / `vitest-workflow`
3. **No agent files change** — Testing Expert still references the `testing` slot

## Design Principles

1. **Single source of truth** — Technology choices live here, not scattered across agent files
2. **Agents are stack-agnostic** — They describe *what* they need, not *which* tool they use
3. **Swap without rewriting** — Changing one matrix row updates every agent that uses that slot
4. **Process skills are stable** — Methodology doesn't change with technology; direct references are fine
5. **Capability slots are composable** — Agents can combine any slots (e.g., Security Expert needs both `security` + `database`)

````
