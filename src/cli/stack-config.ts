import type { CmsChoice, DbChoice, StackConfig } from './types.js';

/** Skills to EXCLUDE based on CMS choice */
const CMS_SKILL_MAP: Record<CmsChoice, string[]> = {
  sanity: ['contentful-cms', 'strapi-cms'],
  contentful: ['sanity-cms', 'strapi-cms'],
  strapi: ['sanity-cms', 'contentful-cms'],
  none: ['sanity-cms', 'contentful-cms', 'strapi-cms'],
};

/** Skills to EXCLUDE based on DB choice */
const DB_SKILL_MAP: Record<DbChoice, string[]> = {
  supabase: ['convex-database'],
  convex: ['supabase-database'],
  none: ['supabase-database', 'convex-database'],
};

/** Agents to EXCLUDE based on CMS choice */
const CMS_AGENT_EXCLUSIONS: Record<CmsChoice, string[]> = {
  sanity: [],
  contentful: [],
  strapi: [],
  none: ['content-engineer.agent.md'],
};

/** Agents to EXCLUDE based on DB choice */
const DB_AGENT_EXCLUSIONS: Record<DbChoice, string[]> = {
  supabase: [],
  convex: [],
  none: ['database-engineer.agent.md'],
};

/** MCP server keys to INCLUDE based on CMS choice */
const CMS_MCP_MAP: Record<CmsChoice, string[]> = {
  sanity: ['Sanity'],
  contentful: ['Contentful'],
  strapi: ['Strapi'],
  none: [],
};

/** MCP server keys to INCLUDE based on DB choice */
const DB_MCP_MAP: Record<DbChoice, string[]> = {
  supabase: ['Supabase'],
  convex: ['Convex'],
  none: [],
};

/** Always-included MCP servers */
const CORE_MCP_SERVERS = ['chrome-devtools', 'Linear', 'Vercel'];

export function getExcludedSkills(stack: StackConfig): Set<string> {
  return new Set([
    ...CMS_SKILL_MAP[stack.cms],
    ...DB_SKILL_MAP[stack.db],
  ]);
}

export function getExcludedAgents(stack: StackConfig): Set<string> {
  return new Set([
    ...CMS_AGENT_EXCLUSIONS[stack.cms],
    ...DB_AGENT_EXCLUSIONS[stack.db],
  ]);
}

export function getIncludedMcpServers(stack: StackConfig): Set<string> {
  return new Set([
    ...CORE_MCP_SERVERS,
    ...CMS_MCP_MAP[stack.cms],
    ...DB_MCP_MAP[stack.db],
  ]);
}
