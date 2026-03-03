import { createSingleFileAdapter } from './single-file-base.js'

/**
 * OpenCode adapter.
 *
 * Generates AGENTS.md (root instructions) and .opencode/ structure.
 *
 *   copilot-instructions.md    → AGENTS.md  (combined with instructions/)
 *   skills/*\/SKILL.md          → .opencode/skills/<name>.md
 *   agents/*.agent.md          → .opencode/agents/<name>.md
 *   agent-workflows/*.md       → .opencode/workflows/<name>.md
 *   prompts/*.prompt.md        → .opencode/prompts/<name>.md
 *   customizations/            → .opencode/customizations/  (scaffolded once)
 *   mcp.json                   → opencode.json  (OpenCode format: type local/remote)
 */

export const IDE_ID = 'opencode'

const { install, update, getManagedPaths } = createSingleFileAdapter({
  rootFile: 'AGENTS.md',
  dotDir: '.opencode',
  mcpConfigPath: 'opencode.json',
  mcpFormat: 'opencode',
  promptsDir: 'prompts',
  workflowsDir: 'workflows',
  workflowPrefix: '',
  frameworkDirs: ['agents', 'skills', 'prompts', 'workflows'],
})

export { install, update, getManagedPaths }

