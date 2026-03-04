import type { PluginConfig } from '../types.js';

export const config: PluginConfig = {
  id: 'turborepo',
  name: 'Turborepo',
  category: 'tech',
  subCategory: 'codebase-tool',
  label: 'Turborepo',
  hint: 'Monorepo build system with remote caching',
  skillName: 'turborepo-monorepo',
  authType: 'none',
  envVars: [],
  agentToolMap: {},
  docsUrl: 'https://www.opencastle.dev/docs/plugins#turborepo',
  officialDocs: 'https://turbo.build/repo/docs',
};
