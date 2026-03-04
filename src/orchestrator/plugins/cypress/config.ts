import type { PluginConfig } from '../types.js';

export const config: PluginConfig = {
  id: 'cypress',
  name: 'Cypress',
  category: 'tech',
  subCategory: 'e2e-testing',
  label: 'Cypress',
  hint: 'E2E and component testing in the browser',
  skillName: 'cypress-testing',
  authType: 'none',
  envVars: [],
  agentToolMap: {},
  docsUrl: 'https://www.opencastle.dev/docs/plugins#cypress',
  officialDocs: 'https://docs.cypress.io',
};
