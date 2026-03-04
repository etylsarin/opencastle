import type { PluginConfig } from '../types.js';

export const config: PluginConfig = {
  id: 'figma',
  name: 'Figma',
  category: 'tech',
  subCategory: 'design',
  label: 'Figma',
  hint: 'Design tokens, component specs, asset export',
  skillName: 'figma-design',
  mcpServerKey: 'Figma',
  mcpConfig: {
    type: 'stdio',
    command: 'npx',
    args: ['-y', '@anthropic/figma-mcp@latest'],
    envFile: '${workspaceFolder}/.env'
  },
  authType: 'env-token',
  envVars: [
    {
      name: 'FIGMA_ACCESS_TOKEN',
      hint: 'Generate at figma.com → Settings → Personal access tokens',
    },
  ],
  agentToolMap: {
    'ui-ux-expert': ['figma/*'],
    'developer': ['figma/*'],
  },
  docsUrl: 'https://www.opencastle.dev/docs/plugins#figma',
  officialDocs: 'https://www.figma.com/developers/api',
  mcpPackage: '@anthropic/figma-mcp',
};
