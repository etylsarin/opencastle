import type { CmsChoice, DbChoice, PmChoice, StackConfig, CopyDirOptions } from './types.js';

// ── Skill / Technology labels ─────────────────────────────────

/** Display name for each CMS choice */
const CMS_LABELS: Record<Exclude<CmsChoice, 'none'>, { tech: string; skill: string }> = {
  sanity: { tech: 'Sanity', skill: 'sanity-cms' },
  contentful: { tech: 'Contentful', skill: 'contentful-cms' },
  strapi: { tech: 'Strapi', skill: 'strapi-cms' },
};

/** Display name for each DB choice */
const DB_LABELS: Record<Exclude<DbChoice, 'none'>, { tech: string; skill: string }> = {
  supabase: { tech: 'Supabase', skill: 'supabase-database' },
  convex: { tech: 'Convex', skill: 'convex-database' },
};

/** Display name for each PM choice */
const PM_LABELS: Record<Exclude<PmChoice, 'none'>, { tech: string; skill: string }> = {
  linear: { tech: 'Linear', skill: 'task-management' },
  jira: { tech: 'Jira', skill: 'jira-management' },
};

// ── Exclusion / inclusion maps ────────────────────────────────

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

/** Skills to EXCLUDE based on PM choice */
const PM_SKILL_MAP: Record<PmChoice, string[]> = {
  linear: ['jira-management'],
  jira: ['task-management'],
  none: ['task-management', 'jira-management'],
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

/** MCP server keys to INCLUDE based on PM choice */
const PM_MCP_MAP: Record<PmChoice, string[]> = {
  linear: ['Linear'],
  jira: ['Jira'],
  none: [],
};

/** Always-included MCP servers */
const CORE_MCP_SERVERS = ['chrome-devtools', 'Vercel'];

export function getExcludedSkills(stack: StackConfig): Set<string> {
  return new Set([
    ...CMS_SKILL_MAP[stack.cms],
    ...DB_SKILL_MAP[stack.db],
    ...PM_SKILL_MAP[stack.pm],
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
    ...PM_MCP_MAP[stack.pm],
  ]);
}

// ── Customization file transforms ─────────────────────────────

/**
 * Return a transform callback that pre-populates customization files
 * based on the user's stack selection.
 *
 * Used by all adapters when copying the `customizations/` directory.
 */
export function getCustomizationsTransform(
  stack: StackConfig
): NonNullable<CopyDirOptions['transform']> {
  return (content: string, srcPath: string) => {
    // Pre-fill skill matrix with CMS and DB bindings
    if (srcPath.endsWith('skill-matrix.md')) {
      return transformSkillMatrix(content, stack);
    }
    return content;
  };
}

/**
 * Fill in the `database` and `cms` rows in the skill matrix
 * based on the user's stack selection.
 */
function transformSkillMatrix(content: string, stack: StackConfig): string {
  let result = content;

  // Fill the database row
  if (stack.db !== 'none') {
    const { tech, skill } = DB_LABELS[stack.db];
    result = result.replace(
      /(\| `database`\s*\|)\s*\|(\s*\|)/,
      `$1 ${tech} | \`${skill}\` $2`
    );
  }

  // Fill the CMS row
  if (stack.cms !== 'none') {
    const { tech, skill } = CMS_LABELS[stack.cms];
    result = result.replace(
      /(\| `cms`\s*\|)\s*\|(\s*\|)/,
      `$1 ${tech} | \`${skill}\` $2`
    );
  }

  return result;
}
