import type { PluginConfig } from '../types.js';

export const config: PluginConfig = {
  id: 'jira',
  name: 'Jira',
  category: 'team',
  subCategory: 'tracker',
  label: 'Jira',
  hint: 'Atlassian issue tracking via Rovo MCP',
  skillName: 'jira-management',
  mcpServerKey: 'Jira',
  mcpConfig: {
    type: 'http',
    url: 'https://mcp.atlassian.com/v1/mcp',
  },
  authType: 'oauth',
  envVars: [],
  agentToolMap: {
    'team-lead': [
      'Jira/searchJiraIssuesUsingJql', 'Jira/getJiraIssue', 'Jira/createJiraIssue',
      'Jira/addCommentToJiraIssue', 'Jira/getJiraProjectIssueTypesMetadata',
      'Jira/getJiraIssueTypeMetaWithFields', 'Jira/search',
      'Jira/getConfluencePage', 'Jira/searchConfluenceUsingCql',
      'Jira/getAccessibleAtlassianResources',
    ],
  },
  docsUrl: null,
  officialDocs: 'https://developer.atlassian.com/cloud/jira/platform/',
  mcpPackage: null,
};
