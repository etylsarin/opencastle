/**
 * Shared frontmatter utilities for IDE adapters.
 */

export interface FrontmatterResult {
  frontmatter: string
  body: string
}

/**
 * Split content into frontmatter and body.
 * Frontmatter is the YAML block between `---` delimiters.
 */
export function splitFrontmatter(content: string): FrontmatterResult {
  const m = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/)
  return m
    ? { frontmatter: m[1], body: m[2] }
    : { frontmatter: '', body: content }
}

/**
 * Strip frontmatter and return only the body, trimmed.
 */
export function stripFrontmatter(content: string): string {
  return splitFrontmatter(content).body.trim()
}

/**
 * Parse frontmatter YAML into a key-value record.
 * Handles simple `key: value` and `key: 'value'` / `key: "value"` patterns.
 */
export function parseFrontmatterMeta(content: string): Record<string, string> {
  const { frontmatter } = splitFrontmatter(content)
  return parseFrontmatterString(frontmatter)
}

/**
 * Parse a raw frontmatter string (without delimiters) into key-value pairs.
 */
export function parseFrontmatterString(fm: string): Record<string, string> {
  const result: Record<string, string> = {}
  for (const line of fm.split('\n')) {
    const m = line.match(/^(\w[\w-]*):\s*['"]?(.+?)['"]?\s*$/)
    if (m) result[m[1]] = m[2]
  }
  return result
}
