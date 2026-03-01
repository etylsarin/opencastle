import { readFile } from 'node:fs/promises'
import type { TaskSpec, ParseResult, ValidationResult } from '../types.js'

/**
 * Minimal YAML parser for task spec files.
 * Handles: key-value, lists, nested objects, block scalars (|), comments, quoted strings.
 * Does NOT handle: anchors, aliases, flow mappings, merge keys, tags.
 */

/**
 * Parse a YAML string into a JS object.
 */
export function parseYaml(text: string): Record<string, unknown> {
  const lines = text.split('\n')
  return parseBlock(lines, 0, -1).value as Record<string, unknown>
}

/**
 * Remove inline comments and trim trailing whitespace.
 * Respects quoted strings — won't strip # inside quotes.
 */
function stripInlineComment(line: string): string {
  let inSingle = false
  let inDouble = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === "'" && !inDouble) inSingle = !inSingle
    else if (ch === '"' && !inSingle) inDouble = !inDouble
    else if (ch === '#' && !inSingle && !inDouble) {
      // Must be preceded by whitespace (or be at start)
      if (i === 0 || /\s/.test(line[i - 1])) {
        return line.slice(0, i).trimEnd()
      }
    }
  }
  return line.trimEnd()
}

/**
 * Measure indent level (number of leading spaces).
 */
function indentOf(line: string): number {
  const m = line.match(/^( *)/)
  return m ? m[1].length : 0
}

/**
 * Unquote a string value (strip surrounding quotes).
 */
function unquote(val: string): string {
  if (
    (val.startsWith('"') && val.endsWith('"')) ||
    (val.startsWith("'") && val.endsWith("'"))
  ) {
    return val.slice(1, -1)
  }
  return val
}

/**
 * Cast a scalar value to its JS type.
 */
function castScalar(raw: string): string | number | boolean | null {
  const val = raw.trim()
  if (val === '' || val === '~' || val === 'null') return null
  if (val === 'true') return true
  if (val === 'false') return false
  if (/^-?\d+$/.test(val)) return parseInt(val, 10)
  if (/^-?\d+\.\d+$/.test(val)) return parseFloat(val)
  return unquote(val)
}

/**
 * Parse a block of YAML lines starting at `startIdx` with minimum indent `parentIndent`.
 * Returns { value, nextIndex }.
 */
function parseBlock(lines: string[], startIdx: number, parentIndent: number): ParseResult {
  let i = startIdx

  // Skip blank / comment-only lines
  while (i < lines.length) {
    const stripped = lines[i].trimStart()
    if (stripped === '' || stripped.startsWith('#')) {
      i++
      continue
    }
    break
  }
  if (i >= lines.length) return { value: null, nextIndex: i }

  const firstLine = stripInlineComment(lines[i])
  const firstIndent = indentOf(firstLine)
  if (firstIndent <= parentIndent) return { value: null, nextIndex: i }

  const trimmedFirst = firstLine.trimStart()

  // Detect whether this block is a list or a mapping
  if (trimmedFirst.startsWith('- ') || trimmedFirst === '-') {
    return parseList(lines, i, firstIndent)
  }
  return parseMapping(lines, i, firstIndent)
}

/**
 * Parse a YAML list block.
 */
function parseList(lines: string[], startIdx: number, blockIndent: number): ParseResult {
  const result: unknown[] = []
  let i = startIdx

  while (i < lines.length) {
    // Skip blanks / comments
    const raw = lines[i]
    const stripped = raw.trimStart()
    if (stripped === '' || stripped.startsWith('#')) {
      i++
      continue
    }

    const indent = indentOf(raw)
    if (indent < blockIndent) break
    if (indent > blockIndent) break // Shouldn't happen at list level

    const line = stripInlineComment(raw)
    const trimmed = line.trimStart()

    if (!trimmed.startsWith('- ') && trimmed !== '-') break

    // Content after "- "
    const after = trimmed === '-' ? '' : trimmed.slice(2).trim()
    i++

    if (after === '' || after.endsWith(':')) {
      // List item is a nested mapping or empty
      // Check if the next non-empty lines at deeper indent form an object
      // If after ends with ':', it's the first key in a mapping
      const obj: Record<string, unknown> = {}
      if (after.endsWith(':')) {
        const key = after.slice(0, -1).trim()
        // Value on next lines or empty
        const nested = parseValueAfterColon('', lines, i, blockIndent + 2)
        obj[key] = nested.value
        i = nested.nextIndex
      }
      // Collect remaining keys at the deeper indent
      const sub = parseItemBody(lines, i, blockIndent + 2)
      Object.assign(obj, (sub.value as Record<string, unknown>) || {})
      i = sub.nextIndex
      result.push(Object.keys(obj).length > 0 ? obj : null)
    } else if (after.includes(': ') || after.endsWith(':')) {
      // Inline mapping start: "- key: value"
      const colonIdx = after.indexOf(':')
      const key = after.slice(0, colonIdx).trim()
      const rest = after.slice(colonIdx + 1).trim()
      const obj: Record<string, unknown> = {}

      if (rest === '' || rest === '|') {
        const nested = parseValueAfterColon(rest, lines, i, blockIndent + 2)
        obj[key] = nested.value
        i = nested.nextIndex
      } else {
        obj[key] = castScalar(rest)
      }

      // Collect remaining keys at deeper indent
      const sub = parseItemBody(lines, i, blockIndent + 2)
      Object.assign(obj, (sub.value as Record<string, unknown>) || {})
      i = sub.nextIndex
      result.push(obj)
    } else if (after.startsWith('[') && after.endsWith(']')) {
      // Inline flow sequence
      result.push(parseFlowSequence(after))
    } else {
      // Simple scalar list item
      result.push(castScalar(after))
    }
  }

  return { value: result, nextIndex: i }
}

/**
 * Parse the body (remaining keys) of a list item at a given indent.
 */
function parseItemBody(lines: string[], startIdx: number, minIndent: number): ParseResult {
  let i = startIdx
  const obj: Record<string, unknown> = {}

  while (i < lines.length) {
    const raw = lines[i]
    const stripped = raw.trimStart()
    if (stripped === '' || stripped.startsWith('#')) {
      i++
      continue
    }

    const indent = indentOf(raw)
    if (indent < minIndent) break

    const line = stripInlineComment(raw)
    const trimmed = line.trimStart()

    // If this is a list item at this indent, it belongs to a parent list
    if (trimmed.startsWith('- ')) break

    const colonIdx = trimmed.indexOf(':')
    if (colonIdx === -1) {
      i++
      continue
    }

    const key = trimmed.slice(0, colonIdx).trim()
    const rest = trimmed.slice(colonIdx + 1).trim()
    i++

    const nested = parseValueAfterColon(rest, lines, i, indent)
    obj[key] = nested.value
    i = nested.nextIndex
  }

  return { value: Object.keys(obj).length > 0 ? obj : null, nextIndex: i }
}

/**
 * Parse a YAML mapping block.
 */
function parseMapping(lines: string[], startIdx: number, blockIndent: number): ParseResult {
  const result: Record<string, unknown> = {}
  let i = startIdx

  while (i < lines.length) {
    const raw = lines[i]
    const stripped = raw.trimStart()
    if (stripped === '' || stripped.startsWith('#')) {
      i++
      continue
    }

    const indent = indentOf(raw)
    if (indent < blockIndent) break
    if (indent > blockIndent) {
      i++
      continue
    }

    const line = stripInlineComment(raw)
    const trimmed = line.trimStart()

    const colonIdx = trimmed.indexOf(':')
    if (colonIdx === -1) {
      i++
      continue
    }

    const key = trimmed.slice(0, colonIdx).trim()
    const rest = trimmed.slice(colonIdx + 1).trim()
    i++

    const nested = parseValueAfterColon(rest, lines, i, blockIndent)
    result[key] = nested.value
    i = nested.nextIndex
  }

  return { value: result, nextIndex: i }
}

/**
 * Parse the value after a colon — could be inline scalar, block scalar (|),
 * nested mapping, or nested list.
 */
function parseValueAfterColon(
  rest: string,
  lines: string[],
  nextIdx: number,
  parentIndent: number
): ParseResult {
  // Block scalar
  if (rest === '|') {
    return parseBlockScalar(lines, nextIdx, parentIndent)
  }

  // Flow sequence [a, b, c]
  if (rest.startsWith('[') && rest.endsWith(']')) {
    return { value: parseFlowSequence(rest), nextIndex: nextIdx }
  }

  // Inline scalar value present
  if (rest !== '') {
    return { value: castScalar(rest), nextIndex: nextIdx }
  }

  // Empty after colon — check for nested block
  const nested = parseBlock(lines, nextIdx, parentIndent)
  if (nested.value !== null) {
    return nested
  }

  return { value: null, nextIndex: nextIdx }
}

/**
 * Parse a block scalar (| indicator).
 * Collects all lines with indent greater than the parent.
 */
function parseBlockScalar(lines: string[], startIdx: number, parentIndent: number): ParseResult {
  let i = startIdx
  const collected: string[] = []
  let blockIndent = -1

  while (i < lines.length) {
    const raw = lines[i]

    // Blank line inside block scalar — preserve it
    if (raw.trim() === '') {
      collected.push('')
      i++
      continue
    }

    const indent = indentOf(raw)
    if (blockIndent === -1) {
      // First content line determines the block indent
      if (indent <= parentIndent) break
      blockIndent = indent
    }

    if (indent < blockIndent) break

    collected.push(raw.slice(blockIndent))
    i++
  }

  // Remove trailing blank lines
  while (collected.length > 0 && collected[collected.length - 1] === '') {
    collected.pop()
  }

  return { value: collected.join('\n') + '\n', nextIndex: i }
}

/**
 * Parse a flow sequence: [item1, item2, item3]
 * Handles quoted strings that may contain commas.
 */
function parseFlowSequence(text: string): Array<string | number | boolean | null> {
  const inner = text.slice(1, -1).trim()
  if (inner === '') return []

  const items: string[] = []
  let current = ''
  let inQuote: string | null = null

  for (let i = 0; i < inner.length; i++) {
    const ch = inner[i]
    if (inQuote) {
      if (ch === inQuote) {
        inQuote = null
      } else {
        current += ch
      }
    } else if (ch === '"' || ch === "'") {
      inQuote = ch
    } else if (ch === ',') {
      items.push(current.trim())
      current = ''
    } else {
      current += ch
    }
  }
  if (current.trim()) items.push(current.trim())

  return items.map(castScalar)
}

// ── Schema validation ──────────────────────────────────────────────

const VALID_ON_FAILURE = ['continue', 'stop']
const TIMEOUT_RE = /^(\d+)(s|m|h)$/

/**
 * Parse a timeout string into milliseconds.
 */
export function parseTimeout(timeout: string): number {
  const m = String(timeout).match(TIMEOUT_RE)
  if (!m) return NaN
  const num = parseInt(m[1], 10)
  const unit = m[2]
  if (unit === 's') return num * 1000
  if (unit === 'm') return num * 60 * 1000
  if (unit === 'h') return num * 60 * 60 * 1000
  return NaN
}

interface RawSpec {
  name?: unknown
  concurrency?: unknown
  on_failure?: unknown
  adapter?: unknown
  tasks?: unknown
}

interface RawTask {
  id?: unknown
  prompt?: unknown
  agent?: unknown
  timeout?: unknown
  depends_on?: unknown
  files?: unknown
  description?: unknown
}

/**
 * Validate a parsed spec object.
 */
export function validateSpec(spec: unknown): ValidationResult {
  const errors: string[] = []

  if (!spec || typeof spec !== 'object') {
    return { valid: false, errors: ['Spec must be a YAML object'] }
  }

  const s = spec as RawSpec

  // Name
  if (!s.name || typeof s.name !== 'string') {
    errors.push('`name` is required and must be a string')
  }

  // Concurrency
  if (s.concurrency !== undefined) {
    const c = Number(s.concurrency)
    if (!Number.isInteger(c) || c < 1) {
      errors.push('`concurrency` must be an integer >= 1')
    }
  }

  // on_failure
  if (s.on_failure !== undefined) {
    if (!VALID_ON_FAILURE.includes(s.on_failure as string)) {
      errors.push(
        `\`on_failure\` must be one of: ${VALID_ON_FAILURE.join(', ')}`
      )
    }
  }

  // adapter
  if (s.adapter !== undefined && typeof s.adapter !== 'string') {
    errors.push('`adapter` must be a string')
  }

  // Tasks
  if (!s.tasks || !Array.isArray(s.tasks) || s.tasks.length === 0) {
    errors.push('`tasks` is required and must be a non-empty array')
    return { valid: false, errors }
  }

  const taskIds = new Set<string>()
  const tasks = s.tasks as RawTask[]

  for (let i = 0; i < tasks.length; i++) {
    const task = tasks[i]
    const prefix = `tasks[${i}]`

    if (!task || typeof task !== 'object') {
      errors.push(`${prefix}: must be an object`)
      continue
    }

    // id
    if (!task.id || typeof task.id !== 'string') {
      errors.push(`${prefix}: \`id\` is required and must be a string`)
    } else if (taskIds.has(task.id)) {
      errors.push(`${prefix}: duplicate task id "${task.id}"`)
    } else {
      taskIds.add(task.id)
    }

    // prompt
    if (!task.prompt || typeof task.prompt !== 'string') {
      errors.push(`${prefix}: \`prompt\` is required and must be a string`)
    }

    // timeout
    if (task.timeout !== undefined) {
      if (isNaN(parseTimeout(task.timeout as string))) {
        errors.push(
          `${prefix}: \`timeout\` must be in format: <number><s|m|h> (e.g. "10m")`
        )
      }
    }

    // depends_on
    if (task.depends_on !== undefined) {
      if (!Array.isArray(task.depends_on)) {
        errors.push(`${prefix}: \`depends_on\` must be an array`)
      } else {
        for (const dep of task.depends_on as string[]) {
          if (!taskIds.has(dep) && !tasks.some((t) => t && t.id === dep)) {
            errors.push(
              `${prefix}: \`depends_on\` references unknown task "${dep}"`
            )
          }
        }
      }
    }

    // files
    if (task.files !== undefined && !Array.isArray(task.files)) {
      errors.push(`${prefix}: \`files\` must be an array`)
    }
  }

  // DAG cycle detection
  if (errors.length === 0) {
    const cycleErr = detectCycles(tasks as Array<{ id: string; depends_on?: string[] }>)
    if (cycleErr) errors.push(cycleErr)
  }

  return { valid: errors.length === 0, errors }
}

/**
 * Detect cycles in the task dependency graph using DFS.
 */
function detectCycles(tasks: Array<{ id: string; depends_on?: string[] }>): string | null {
  const adj = new Map<string, string[]>()
  for (const t of tasks) {
    adj.set(t.id, t.depends_on || [])
  }

  const WHITE = 0, GRAY = 1, BLACK = 2
  const color = new Map<string, number>()
  for (const id of adj.keys()) color.set(id, WHITE)

  function dfs(node: string, path: string[]): string[] | null {
    color.set(node, GRAY)
    path.push(node)

    for (const dep of adj.get(node) || []) {
      if (color.get(dep) === GRAY) {
        const cycleStart = path.indexOf(dep)
        return [...path.slice(cycleStart), dep]
      }
      if (color.get(dep) === WHITE) {
        const result = dfs(dep, path)
        if (result) return result
      }
    }

    color.set(node, BLACK)
    path.pop()
    return null
  }

  for (const id of adj.keys()) {
    if (color.get(id) === WHITE) {
      const cycle = dfs(id, [])
      if (cycle) {
        return `Circular dependency detected: ${cycle.join(' → ')}`
      }
    }
  }
  return null
}

/**
 * Apply default values to a parsed spec.
 */
export function applyDefaults(spec: Record<string, unknown>): TaskSpec {
  const s = spec as Record<string, unknown>
  s.concurrency = s.concurrency !== undefined ? Number(s.concurrency) : 1
  s.on_failure = (s.on_failure as string) || 'continue'
  s.adapter = (s.adapter as string) || 'claude-code'

  const tasks = s.tasks as Array<Record<string, unknown>>
  for (const task of tasks) {
    task.agent = (task.agent as string) || 'developer'
    task.timeout = (task.timeout as string) || '30m'
    task.depends_on = (task.depends_on as string[]) || []
    task.files = (task.files as string[]) || []
    task.description = (task.description as string) || (task.id as string)
  }

  return s as unknown as TaskSpec
}

/**
 * Read, parse, validate, and return a typed task spec from a YAML file.
 * @throws If file cannot be read, parsed, or spec is invalid
 */
export async function parseTaskSpec(filePath: string): Promise<TaskSpec> {
  let text: string
  try {
    text = await readFile(filePath, 'utf8')
  } catch (err: unknown) {
    const e = err as Error & { code?: string }
    if (e.code === 'ENOENT') {
      throw new Error(`Task spec file not found: ${filePath}`)
    }
    throw new Error(`Cannot read task spec file: ${e.message}`)
  }

  if (!text.trim()) {
    throw new Error('Task spec file is empty')
  }

  let spec: Record<string, unknown>
  try {
    spec = parseYaml(text)
  } catch (err: unknown) {
    throw new Error(`YAML parse error: ${(err as Error).message}`)
  }

  const { valid, errors } = validateSpec(spec)
  if (!valid) {
    throw new Error(`Invalid task spec:\n  • ${errors.join('\n  • ')}`)
  }

  return applyDefaults(spec)
}
