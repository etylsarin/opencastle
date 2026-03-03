import { describe, it, expect } from 'vitest'
import { parseYaml, parseTimeout, validateSpec, applyDefaults } from './schema.js'

// ── parseYaml ──────────────────────────────────────────────────

describe('parseYaml', () => {
  it('parses valid YAML mapping', () => {
    const result = parseYaml('name: test\nvalue: 42')
    expect(result).toEqual({ name: 'test', value: 42 })
  })

  it('throws on scalar top-level value', () => {
    expect(() => parseYaml('hello')).toThrow('YAML must be a mapping')
  })

  it('throws on array top-level value', () => {
    expect(() => parseYaml('- a\n- b')).toThrow('YAML must be a mapping')
  })

  it('throws on empty input', () => {
    expect(() => parseYaml('')).toThrow('YAML must be a mapping')
  })

  it('handles nested objects', () => {
    const result = parseYaml('parent:\n  child: value')
    expect(result).toEqual({ parent: { child: 'value' } })
  })

  it('handles multiline strings', () => {
    const result = parseYaml('text: |\n  line one\n  line two')
    expect(result.text).toContain('line one')
    expect(result.text).toContain('line two')
  })

  it('rejects YAML with dangerous __proto__ key gracefully', () => {
    // yaml npm package handles __proto__ safely by default
    const result = parseYaml('__proto__:\n  polluted: true')
    expect(result).toBeDefined()
    // Verify prototype pollution didn't work
    expect(({} as Record<string, unknown>).polluted).toBeUndefined()
  })
})

// ── parseTimeout ───────────────────────────────────────────────

describe('parseTimeout', () => {
  it('parses seconds', () => {
    expect(parseTimeout('30s')).toBe(30_000)
  })

  it('parses minutes', () => {
    expect(parseTimeout('10m')).toBe(600_000)
  })

  it('parses hours', () => {
    expect(parseTimeout('2h')).toBe(7_200_000)
  })

  it('returns NaN for invalid format', () => {
    expect(parseTimeout('abc')).toBeNaN()
  })

  it('returns NaN for missing unit', () => {
    expect(parseTimeout('10')).toBeNaN()
  })

  it('returns NaN for empty string', () => {
    expect(parseTimeout('')).toBeNaN()
  })

  it('handles single digit', () => {
    expect(parseTimeout('1s')).toBe(1_000)
  })

  it('handles large values', () => {
    expect(parseTimeout('999m')).toBe(999 * 60 * 1000)
  })
})

// ── validateSpec ───────────────────────────────────────────────

describe('validateSpec', () => {
  const validSpec = {
    name: 'test-run',
    tasks: [
      { id: 'task-1', prompt: 'Do something' },
      { id: 'task-2', prompt: 'Do another thing', depends_on: ['task-1'] },
    ],
  }

  it('accepts a valid minimal spec', () => {
    const result = validateSpec(validSpec)
    expect(result.valid).toBe(true)
    expect(result.errors).toHaveLength(0)
  })

  it('rejects null input', () => {
    const result = validateSpec(null)
    expect(result.valid).toBe(false)
    expect(result.errors[0]).toMatch(/must be a YAML object/)
  })

  it('rejects non-object input', () => {
    const result = validateSpec('string')
    expect(result.valid).toBe(false)
  })

  it('requires name field', () => {
    const result = validateSpec({ tasks: [{ id: 'a', prompt: 'b' }] })
    expect(result.valid).toBe(false)
    expect(result.errors).toContainEqual(expect.stringContaining('name'))
  })

  it('requires tasks array', () => {
    const result = validateSpec({ name: 'test' })
    expect(result.valid).toBe(false)
    expect(result.errors).toContainEqual(expect.stringContaining('tasks'))
  })

  it('rejects empty tasks array', () => {
    const result = validateSpec({ name: 'test', tasks: [] })
    expect(result.valid).toBe(false)
    expect(result.errors).toContainEqual(expect.stringContaining('non-empty'))
  })

  it('rejects tasks without id', () => {
    const result = validateSpec({ name: 'test', tasks: [{ prompt: 'x' }] })
    expect(result.valid).toBe(false)
    expect(result.errors).toContainEqual(expect.stringContaining('id'))
  })

  it('rejects tasks without prompt', () => {
    const result = validateSpec({ name: 'test', tasks: [{ id: 'a' }] })
    expect(result.valid).toBe(false)
    expect(result.errors).toContainEqual(expect.stringContaining('prompt'))
  })

  it('rejects duplicate task ids', () => {
    const result = validateSpec({
      name: 'test',
      tasks: [
        { id: 'same', prompt: 'a' },
        { id: 'same', prompt: 'b' },
      ],
    })
    expect(result.valid).toBe(false)
    expect(result.errors).toContainEqual(expect.stringContaining('duplicate'))
  })

  it('validates concurrency is a positive integer', () => {
    const result = validateSpec({ ...validSpec, concurrency: -1 })
    expect(result.valid).toBe(false)
    expect(result.errors).toContainEqual(expect.stringContaining('concurrency'))
  })

  it('validates concurrency rejects zero', () => {
    const result = validateSpec({ ...validSpec, concurrency: 0 })
    expect(result.valid).toBe(false)
  })

  it('accepts valid concurrency', () => {
    const result = validateSpec({ ...validSpec, concurrency: 3 })
    expect(result.valid).toBe(true)
  })

  it('validates on_failure values', () => {
    const result = validateSpec({ ...validSpec, on_failure: 'invalid' })
    expect(result.valid).toBe(false)
    expect(result.errors).toContainEqual(expect.stringContaining('on_failure'))
  })

  it('accepts valid on_failure values', () => {
    expect(validateSpec({ ...validSpec, on_failure: 'continue' }).valid).toBe(true)
    expect(validateSpec({ ...validSpec, on_failure: 'stop' }).valid).toBe(true)
  })

  it('validates adapter is a string', () => {
    const result = validateSpec({ ...validSpec, adapter: 123 })
    expect(result.valid).toBe(false)
    expect(result.errors).toContainEqual(expect.stringContaining('adapter'))
  })

  it('validates invalid timeout format', () => {
    const result = validateSpec({
      name: 'test',
      tasks: [{ id: 'a', prompt: 'x', timeout: 'bad' }],
    })
    expect(result.valid).toBe(false)
    expect(result.errors).toContainEqual(expect.stringContaining('timeout'))
  })

  it('validates depends_on must be an array', () => {
    const result = validateSpec({
      name: 'test',
      tasks: [{ id: 'a', prompt: 'x', depends_on: 'task-1' }],
    })
    expect(result.valid).toBe(false)
    expect(result.errors).toContainEqual(expect.stringContaining('depends_on'))
  })

  it('validates depends_on references exist', () => {
    const result = validateSpec({
      name: 'test',
      tasks: [{ id: 'a', prompt: 'x', depends_on: ['nonexistent'] }],
    })
    expect(result.valid).toBe(false)
    expect(result.errors).toContainEqual(expect.stringContaining('unknown task'))
  })

  it('validates files must be an array', () => {
    const result = validateSpec({
      name: 'test',
      tasks: [{ id: 'a', prompt: 'x', files: 'not-array' }],
    })
    expect(result.valid).toBe(false)
    expect(result.errors).toContainEqual(expect.stringContaining('files'))
  })

  it('detects simple circular dependency (A→B→A)', () => {
    const result = validateSpec({
      name: 'test',
      tasks: [
        { id: 'a', prompt: 'x', depends_on: ['b'] },
        { id: 'b', prompt: 'y', depends_on: ['a'] },
      ],
    })
    expect(result.valid).toBe(false)
    expect(result.errors).toContainEqual(expect.stringContaining('Circular'))
  })

  it('detects 3-node cycle (A→B→C→A)', () => {
    const result = validateSpec({
      name: 'test',
      tasks: [
        { id: 'a', prompt: 'x', depends_on: ['c'] },
        { id: 'b', prompt: 'y', depends_on: ['a'] },
        { id: 'c', prompt: 'z', depends_on: ['b'] },
      ],
    })
    expect(result.valid).toBe(false)
    expect(result.errors).toContainEqual(expect.stringContaining('Circular'))
  })

  it('accepts a valid DAG without cycles', () => {
    const result = validateSpec({
      name: 'test',
      tasks: [
        { id: 'a', prompt: 'x' },
        { id: 'b', prompt: 'y', depends_on: ['a'] },
        { id: 'c', prompt: 'z', depends_on: ['a', 'b'] },
      ],
    })
    expect(result.valid).toBe(true)
  })

  it('accepts a self-contained task (no depends_on)', () => {
    const result = validateSpec({
      name: 'test',
      tasks: [{ id: 'solo', prompt: 'do it' }],
    })
    expect(result.valid).toBe(true)
  })

  it('collects multiple errors at once', () => {
    const result = validateSpec({
      tasks: [{ id: 123, timeout: 'bad' }],
    })
    expect(result.valid).toBe(false)
    expect(result.errors.length).toBeGreaterThan(1)
  })
})

// ── applyDefaults ──────────────────────────────────────────────

describe('applyDefaults', () => {
  it('applies default concurrency', () => {
    const spec = applyDefaults({
      name: 'test',
      tasks: [{ id: 'a', prompt: 'x' }],
    })
    expect(spec.concurrency).toBe(1)
  })

  it('applies default on_failure', () => {
    const spec = applyDefaults({
      name: 'test',
      tasks: [{ id: 'a', prompt: 'x' }],
    })
    expect(spec.on_failure).toBe('continue')
  })

  it('applies default adapter', () => {
    const spec = applyDefaults({
      name: 'test',
      tasks: [{ id: 'a', prompt: 'x' }],
    })
    expect(spec.adapter).toBe('claude-code')
  })

  it('preserves user-specified values', () => {
    const spec = applyDefaults({
      name: 'test',
      concurrency: 3,
      on_failure: 'stop',
      adapter: 'copilot',
      tasks: [{ id: 'a', prompt: 'x' }],
    })
    expect(spec.concurrency).toBe(3)
    expect(spec.on_failure).toBe('stop')
    expect(spec.adapter).toBe('copilot')
  })

  it('applies task-level defaults', () => {
    const spec = applyDefaults({
      name: 'test',
      tasks: [{ id: 'a', prompt: 'x' }],
    })
    const task = spec.tasks[0]
    expect(task.agent).toBe('developer')
    expect(task.timeout).toBe('30m')
    expect(task.depends_on).toEqual([])
    expect(task.files).toEqual([])
  })

  it('preserves user-specified task values', () => {
    const spec = applyDefaults({
      name: 'test',
      tasks: [{
        id: 'a',
        prompt: 'x',
        agent: 'ui-ux-expert',
        timeout: '15m',
        depends_on: ['b'],
        files: ['src/'],
      }],
    })
    const task = spec.tasks[0]
    expect(task.agent).toBe('ui-ux-expert')
    expect(task.timeout).toBe('15m')
    expect(task.depends_on).toEqual(['b'])
    expect(task.files).toEqual(['src/'])
  })
})
