/* global console */
import { readFile } from 'node:fs/promises'

/**
 * Minimal YAML parser for task spec files.
 * Handles: key-value, lists, nested objects, block scalars (|), comments, quoted strings.
 * Does NOT handle: anchors, aliases, flow mappings, merge keys, tags.
 */

/**
 * Parse a YAML string into a JS object.
 * @param {string} text - YAML text
 * @returns {object}
 */
export function parseYaml(text) {
  const lines = text.split('\n')
  return parseBlock(lines, 0, -1).value
}

/**
 * Remove inline comments and trim trailing whitespace.
 * Respects quoted strings — won't strip # inside quotes.
 * @param {string} line
 * @returns {string}
 */
function stripInlineComment(line) {
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
 * @param {string} line
 * @returns {number}
 */
function indentOf(line) {
  const m = line.match(/^( *)/)
  return m ? m[1].length : 0
}

/**
 * Unquote a string value (strip surrounding quotes).
 * @param {string} val
 * @returns {string}
 */
function unquote(val) {
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
 * @param {string} raw
 * @returns {string|number|boolean|null}
 */
function castScalar(raw) {
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
function parseBlock(lines, startIdx, parentIndent) {
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
function parseList(lines, startIdx, blockIndent) {
  const result = []
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
      const obj = {}
      if (after.endsWith(':')) {
        const key = after.slice(0, -1).trim()
        // Value on next lines or empty
        const nested = parseValueAfterColon('', lines, i, blockIndent + 2)
        obj[key] = nested.value
        i = nested.nextIndex
      }
      // Collect remaining keys at the deeper indent
      const sub = parseItemBody(lines, i, blockIndent + 2)
      Object.assign(obj, sub.value || {})
      i = sub.nextIndex
      result.push(Object.keys(obj).length > 0 ? obj : null)
    } else if (after.includes(': ') || after.endsWith(':')) {
      // Inline mapping start: "- key: value"
      const colonIdx = after.indexOf(':')
      const key = after.slice(0, colonIdx).trim()
      const rest = after.slice(colonIdx + 1).trim()
      const obj = {}

      if (rest === '' || rest === '|') {
        const nested = parseValueAfterColon(rest, lines, i, blockIndent + 2)
        obj[key] = nested.value
        i = nested.nextIndex
      } else {
        obj[key] = castScalar(rest)
      }

      // Collect remaining keys at deeper indent
      const sub = parseItemBody(lines, i, blockIndent + 2)
      Object.assign(obj, sub.value || {})
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
function parseItemBody(lines, startIdx, minIndent) {
  let i = startIdx
  const obj = {}

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
function parseMapping(lines, startIdx, blockIndent) {
  const result = {}
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
function parseValueAfterColon(rest, lines, nextIdx, parentIndent) {
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
function parseBlockScalar(lines, startIdx, parentIndent) {
  let i = startIdx
  const collected = []
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
 * @param {string} text
 * @returns {Array}
 */
function parseFlowSequence(text) {
  const inner = text.slice(1, -1).trim()
  if (inner === '') return []
  return inner.split(',').map((s) => castScalar(s.trim()))
}

// ── Schema validation ──────────────────────────────────────────────

const VALID_ON_FAILURE = ['continue', 'stop']
const TIMEOUT_RE = /^(\d+)(s|m|h)$/

/**
 * Parse a timeout string into milliseconds.
 * @param {string} timeout - e.g. "10m", "1h", "30s"
 * @returns {number} milliseconds
 */
export function parseTimeout(timeout) {
  const m = String(timeout).match(TIMEOUT_RE)
  if (!m) return NaN
  const num = parseInt(m[1], 10)
  const unit = m[2]
  if (unit === 's') return num * 1000
  if (unit === 'm') return num * 60 * 1000
  if (unit === 'h') return num * 60 * 60 * 1000
  return NaN
}

/**
 * Validate a parsed spec object.
 * @param {object} spec
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateSpec(spec) {
  const errors = []

  if (!spec || typeof spec !== 'object') {
    return { valid: false, errors: ['Spec must be a YAML object'] }
  }

  // Name
  if (!spec.name || typeof spec.name !== 'string') {
    errors.push('`name` is required and must be a string')
  }

  // Concurrency
  if (spec.concurrency !== undefined) {
    const c = Number(spec.concurrency)
    if (!Number.isInteger(c) || c < 1) {
      errors.push('`concurrency` must be an integer >= 1')
    }
  }

  // on_failure
  if (spec.on_failure !== undefined) {
    if (!VALID_ON_FAILURE.includes(spec.on_failure)) {
      errors.push(
        `\`on_failure\` must be one of: ${VALID_ON_FAILURE.join(', ')}`
      )
    }
  }

  // adapter
  if (spec.adapter !== undefined && typeof spec.adapter !== 'string') {
    errors.push('`adapter` must be a string')
  }

  // Tasks
  if (!spec.tasks || !Array.isArray(spec.tasks) || spec.tasks.length === 0) {
    errors.push('`tasks` is required and must be a non-empty array')
    return { valid: false, errors }
  }

  const taskIds = new Set()
  const taskIdList = []

  for (let i = 0; i < spec.tasks.length; i++) {
    const task = spec.tasks[i]
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
      taskIdList.push(task.id)
    }

    // prompt
    if (!task.prompt || typeof task.prompt !== 'string') {
      errors.push(`${prefix}: \`prompt\` is required and must be a string`)
    }

    // timeout
    if (task.timeout !== undefined) {
      if (isNaN(parseTimeout(task.timeout))) {
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
        for (const dep of task.depends_on) {
          if (!taskIds.has(dep) && !spec.tasks.some((t) => t && t.id === dep)) {
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
    const cycleErr = detectCycles(spec.tasks)
    if (cycleErr) errors.push(cycleErr)
  }

  return { valid: errors.length === 0, errors }
}

/**
 * Detect cycles in the task dependency graph using DFS.
 * @param {Array} tasks
 * @returns {string|null} Error message or null
 */
function detectCycles(tasks) {
  const adj = new Map()
  for (const t of tasks) {
    adj.set(t.id, t.depends_on || [])
  }

  const WHITE = 0, GRAY = 1, BLACK = 2
  const color = new Map()
  for (const id of adj.keys()) color.set(id, WHITE)

  function dfs(node, path) {
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
 * @param {object} spec
 * @returns {object} spec with defaults applied
 */
export function applyDefaults(spec) {
  spec.concurrency = spec.concurrency !== undefined ? Number(spec.concurrency) : 1
  spec.on_failure = spec.on_failure || 'continue'
  spec.adapter = spec.adapter || 'claude-code'

  for (const task of spec.tasks) {
    task.agent = task.agent || 'developer'
    task.timeout = task.timeout || '30m'
    task.depends_on = task.depends_on || []
    task.files = task.files || []
    task.description = task.description || task.id
  }

  return spec
}

/**
 * Read, parse, validate, and return a typed task spec from a YAML file.
 * @param {string} filePath - Absolute path to the YAML file
 * @returns {Promise<object>} The validated and defaults-applied spec
 * @throws {Error} If file cannot be read, parsed, or spec is invalid
 */
export async function parseTaskSpec(filePath) {
  let text
  try {
    text = await readFile(filePath, 'utf8')
  } catch (err) {
    if (err.code === 'ENOENT') {
      throw new Error(`Task spec file not found: ${filePath}`)
    }
    throw new Error(`Cannot read task spec file: ${err.message}`)
  }

  if (!text.trim()) {
    throw new Error('Task spec file is empty')
  }

  let spec
  try {
    spec = parseYaml(text)
  } catch (err) {
    throw new Error(`YAML parse error: ${err.message}`)
  }

  const { valid, errors } = validateSpec(spec)
  if (!valid) {
    throw new Error(`Invalid task spec:\n  • ${errors.join('\n  • ')}`)
  }

  return applyDefaults(spec)
}
