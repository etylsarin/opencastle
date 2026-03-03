import type { PluginConfig } from '../types.js';

export const config: PluginConfig = {
  id: 'linear',
  name: 'Linear',
  category: 'team',
  subCategory: 'tracker',
  label: 'Linear',
  hint: 'Issue tracking with MCP integration',
  skillName: 'linear-task-management',
  mcpServerKey: 'Linear',
  mcpConfig: {
    type: 'stdio',
    command: 'npx',
    args: ['-y', '@mseep/linear-mcp'],
    envFile: '${workspaceFolder}/.env',
  },
  authType: 'env-token',
  envVars: [
    {
      name: 'LINEAR_API_KEY',
      hint: 'Create at linear.app → Settings → API → Personal API keys',
    },
  ],
  agentToolMap: {
    'team-lead': [
      'linear/create_issue', 'linear/list_issues', 'linear/update_issue',
      'linear/list_teams', 'linear/list_projects', 'linear/get_issue', 'linear/search_issues',
    ],
  },
  docsUrl: '/guides/linear-setup',
  officialDocs: 'https://linear.app/docs',
  mcpPackage: '@mseep/linear-mcp',
};
