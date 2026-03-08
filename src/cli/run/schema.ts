import { readFile } from 'node:fs/promises'
import { parse as yamlParse } from 'yaml'
import type { TaskSpec, ValidationResult } from '../types.js'

/**
 * Parse a YAML string into a JS object.
 * Uses the `yaml` npm package for full YAML 1.2 compliance.
 */
export function parseYaml(text: string): Record<string, unknown> {
  const result = yamlParse(text)
  if (!result || typeof result !== 'object' || Array.isArray(result)) {
    throw new Error('YAML must be a mapping at the top level')
  }
  return result as Record<string, unknown>
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
  version?: unknown
  defaults?: unknown
  gates?: unknown
  branch?: unknown
}

interface RawTask {
  id?: unknown
  prompt?: unknown
  agent?: unknown
  timeout?: unknown
  depends_on?: unknown
  files?: unknown
  description?: unknown
  model?: unknown
  max_retries?: unknown
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

  // version
  if (s.version !== undefined) {
    if (typeof s.version !== 'number' || !Number.isInteger(s.version) || s.version !== 1) {
      errors.push('`version` must be 1')
    }
  }

  // defaults
  if (s.defaults !== undefined) {
    if (!s.defaults || typeof s.defaults !== 'object' || Array.isArray(s.defaults)) {
      errors.push('`defaults` must be an object')
    } else {
      const d = s.defaults as Record<string, unknown>
      if (d.timeout !== undefined && isNaN(parseTimeout(d.timeout as string))) {
        errors.push(
          '`defaults.timeout` must be in format: <number><s|m|h> (e.g. "10m")'
        )
      }
      if (d.model !== undefined && typeof d.model !== 'string') {
        errors.push('`defaults.model` must be a string')
      }
      if (d.max_retries !== undefined) {
        const mr = Number(d.max_retries)
        if (!Number.isInteger(mr) || mr < 0) {
          errors.push('`defaults.max_retries` must be a non-negative integer')
        }
      }
      if (d.agent !== undefined && typeof d.agent !== 'string') {
        errors.push('`defaults.agent` must be a string')
      }
    }
  }

  // gates
  if (s.gates !== undefined) {
    if (
      !Array.isArray(s.gates) ||
      !(s.gates as unknown[]).every((g) => typeof g === 'string')
    ) {
      errors.push('`gates` must be an array of strings')
    }
  }

  // branch
  if (s.branch !== undefined && typeof s.branch !== 'string') {
    errors.push('`branch` must be a string')
  }

  // Tasks are always required
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

    // model
    if (task.model !== undefined && typeof task.model !== 'string') {
      errors.push(`${prefix}: \`model\` must be a string`)
    }

    // max_retries
    if (task.max_retries !== undefined) {
      const mr = Number(task.max_retries)
      if (!Number.isInteger(mr) || mr < 0) {
        errors.push(
          `${prefix}: \`max_retries\` must be a non-negative integer`
        )
      }
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
  // Leave adapter empty so run.ts can auto-detect the best available CLI
  s.adapter = (s.adapter as string) || ''

  const tasks = s.tasks as Array<Record<string, unknown>>
  const d =
    s.version === 1 && s.defaults
      ? (s.defaults as Record<string, unknown>)
      : {}
  for (const task of tasks) {
    task.agent =
      (task.agent as string) || (d.agent as string | undefined) || 'developer'
    task.timeout =
      (task.timeout as string) ||
      (d.timeout as string | undefined) ||
      '30m'
    task.depends_on = (task.depends_on as string[]) || []
    task.files = (task.files as string[]) || []
    task.description = (task.description as string) || (task.id as string)
    // model: task-level overrides defaults (no hardcoded fallback)
    if (task.model === undefined && d.model !== undefined) {
      task.model = d.model
    }
    // max_retries: task-level overrides defaults, fallback to 1
    if (task.max_retries === undefined) {
      task.max_retries =
        d.max_retries !== undefined ? Number(d.max_retries) : 1
    }
  }

  return s as unknown as TaskSpec
}

/**
 * Returns true if the spec uses the Convoy Engine enhanced format (version: 1).
 */
export function isConvoySpec(spec: unknown): boolean {
  if (!spec || typeof spec !== 'object') return false
  return (spec as Record<string, unknown>).version === 1
}

/**
 * Parse, validate, and return a typed task spec from a YAML string.
 * @throws If the text is empty, cannot be parsed, or spec is invalid
 */
export function parseTaskSpecText(text: string): TaskSpec {
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

  return parseTaskSpecText(text)
}
