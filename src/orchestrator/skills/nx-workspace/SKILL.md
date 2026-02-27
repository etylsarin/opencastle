---
name: nx-workspace
description: "NX monorepo commands, conventions, code generation, and task running patterns. Use when running builds, tests, linting, code generation, or any development commands."
---

# NX Workspace

## Commands

### Testing

```bash
yarn nx run <project-name>:test
yarn nx run <project-name>:test --coverage
yarn nx run <project-name>:test -u              # Update snapshots
yarn nx affected -t test                         # Affected tests only
```

### Linting

```bash
yarn nx run <project-name>:lint --fix
yarn nx run <project-name>:lint-styles --fix     # CSS/SCSS
yarn nx affected -t lint
```

### Building

```bash
yarn nx run <project-name>:build
yarn nx affected -t build
```

### Serving

```bash
yarn nx run <project-name>:serve
yarn nx run <project-name>:dev
```

### Code Generation

```bash
yarn nx generate <generator-name> --no-interactive
yarn nx g <generator-name> --no-interactive
```

### Formatting

```bash
yarn nx format --fix
```

### Forbidden Commands

```bash
# NEVER use these:
npm test | npm run test | npm run lint | npm run build
npm run dev | npm start | npx jest | npx eslint
jest --coverage | eslint --fix
```

## Requirements

- **Minimum Coverage**: 95% for new components/functions.
- **Coverage Reports**: `reports/coverage/jest/`.
- **Code Linting**: Always use `--fix` flag.
- **Style Linting**: `yarn nx run <project>:lint-styles --fix` for CSS/SCSS.

## Best Practices

1. Always use `yarn nx run <project-name>:<target>` format.
2. Use `yarn nx affected -t <target>` for multi-project changes.
3. Use exact project names from `project.json` files.
4. NX automatically handles task caching and parallel execution.

## NX MCP Server

The NX MCP server provides tools for understanding and working with the workspace. Use these tools instead of guessing about workspace structure:

| Tool | When to Use |
|------|-------------|
| `nx_workspace` | First — understand workspace architecture, get errors |
| `nx_docs` | Configuration questions, best practices (always check before assuming) |
| `nx_project_details` | Inspect a specific project's targets, config, and dependencies |
| `nx_visualize_graph` | Visualize project/task dependency graphs |
| `nx_generators` | List available generators (plugin + local) |
| `nx_generator_schema` | Get schema details for a specific generator |
| `nx_available_plugins` | Discover installable plugins when no existing generator fits |
| `nx_current_running_tasks_details` | Monitor running/completed/failed tasks |
| `nx_current_running_task_output` | Get terminal output for a specific task |

---

## Code Generation Workflow

Use this workflow whenever scaffolding new code (libraries, applications, features) or running automated code transformations. **Always prefer generators over manual file creation** when a generator exists for the task.

### Phase 1: Discover

1. **List available generators** using `nx_generators` MCP tool
   - This includes plugin generators (e.g., `@nx/react:library`) and local workspace generators
2. **Match generator to request** — identify which generator(s) could fulfill the need
3. **Prefer local generators** — when both local and plugin generators could work, **always prefer local** (they're customized for this repo's patterns)
4. **If no generator fits** — check `nx_available_plugins` for installable plugins. Only fall back to manual creation after exhausting all generator options

### Phase 2: Understand

Before running any generator, complete these steps:

1. **Fetch generator schema** using `nx_generator_schema` MCP tool
   - Identify required vs optional options
   - Note default values that may need overriding
   - Pay attention to options that affect file structure or naming

2. **Read generator source code** (for unfamiliar generators)
   - Find source: `node -e "console.log(require.resolve('@nx/<plugin>/generators.json'));"`
   - If that fails: read from `node_modules/<plugin>/generators.json`
   - Local generators: check `tools/generators/` or local plugin directories
   - Understanding the source reveals side effects (config updates, dep installs) and files created/modified

3. **Reevaluate generator choice** — after understanding what the generator does, confirm it's the right one. If not, go back to Phase 1 and select a different generator.

4. **Examine repo context** — study existing similar artifacts in the codebase:
   - Look at how similar projects are structured (naming, test runner, build tool, linter)
   - Match conventions when configuring the generator
   - Note directory structures, file patterns, and config styles

5. **Validate required options** — map the user's request to generator options:
   - Infer values from context where possible
   - Ask for critical missing information if it cannot be inferred

### Phase 3: Execute

1. **Consider dry-run first** (recommended for complex/unfamiliar generators):
   ```bash
   yarn nx generate <generator-name> <options> --dry-run --no-interactive
   ```
   - Shows files that would be created/deleted/modified (but not content)
   - Some generators don't support dry-run (e.g., if they install packages) — skip and run for real
   - For simple, well-understood generators, you may skip dry-run

2. **Run the generator**:
   ```bash
   yarn nx generate <generator-name> <options> --no-interactive
   ```
   **CRITICAL**: Always include `--no-interactive` to prevent prompts that hang execution.

   **CRITICAL**: Generators may behave differently based on the current working directory (e.g., library generators use cwd to determine placement). Verify cwd before running.

3. **Handle failures** — if the generator fails:
   - Read the error message carefully
   - Common causes: missing required options, invalid values, conflicting files, missing dependencies
   - Adjust options and retry
   - Add a lesson to `.github/customizations/LESSONS-LEARNED.md` if the fix was non-obvious

### Phase 4: Post-Generation

1. **Modify generated code** if needed — generators provide a starting point:
   - Adjust functionality to match specific requirements
   - Update imports, exports, configurations
   - Integrate with existing code patterns

2. **Format code**:
   ```bash
   yarn nx format --fix
   ```

3. **Run verification** on generated/affected projects:
   ```bash
   yarn nx run <new-project>:lint --fix
   yarn nx run <new-project>:test
   yarn nx run <new-project>:build
   ```

4. **Handle verification failures**:
   - **Small scope** (few lint errors, minor type issues) — fix directly, re-verify
   - **Large scope** (many errors, complex problems) — fix obvious issues first, escalate remaining with description of what was generated, what's failing, and what was attempted

## Running Tasks Workflow

When helping with build, test, lint, or serve tasks:

1. Use `nx_current_running_tasks_details` to check for active/completed/failed tasks
2. For a specific task, use `nx_current_running_task_output` to get its terminal output
3. Diagnose issues from the output and apply fixes
4. To rerun a task, always use `yarn nx run <taskId>` to preserve the NX context
5. **Continuous tasks** (like `serve`) are already running — don't offer to rerun, just check output

## Project Names

See `project.instructions.md` for the full project name → location mapping.
