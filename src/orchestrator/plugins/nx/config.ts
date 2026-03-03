import type { PluginConfig } from '../types.js';

export const config: PluginConfig = {
  id: 'nx',
  name: 'NX',
  category: 'tech',
  subCategory: 'monorepo',
  label: 'NX',
  hint: 'Monorepo build system',
  skillName: 'nx-workspace',
  mcpServerKey: 'Nx',
  mcpConfig: {
    type: 'stdio',
    command: 'npx',
    args: ['nx', 'mcp'],
  },
  authType: 'none',
  envVars: [],
  agentToolMap: {
    'architect': ['nx-mcp-server/nx_workspace', 'nx-mcp-server/nx_project_details', 'nx-mcp-server/nx_visualize_graph'],
    'developer': ['nx-mcp-server/nx_project_details', 'nx-mcp-server/nx_workspace', 'nx-mcp-server/nx_generators'],
    'devops-expert': ['nx-mcp-server/nx_project_details', 'nx-mcp-server/nx_workspace', 'nx-mcp-server/nx_workspace_path'],
    'performance-expert': ['nx-mcp-server/nx_project_details', 'nx-mcp-server/nx_workspace'],
    'release-manager': ['nx-mcp-server/nx_project_details', 'nx-mcp-server/nx_workspace', 'nx-mcp-server/nx_workspace_path'],
  },
  docsUrl: null,
  officialDocs: 'https://nx.dev/getting-started/intro',
  mcpPackage: null,
};
