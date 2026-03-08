import { describe, it, expect } from 'vitest'
import { parseYaml, parseTimeout, validateSpec, applyDefaults, isConvoySpec, parseTaskSpecText } from './schema.js'

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
    // Empty string signals run.ts to auto-detect; no hardcoded default here
    expect(spec.adapter).toBe('')
  })

  it('leaves adapter empty when not specified so run.ts can auto-detect', () => {
    const spec = applyDefaults({
      name: 'test',
      tasks: [{ id: 'a', prompt: 'x' }],
    })
    expect(spec.adapter).toBe('')
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
    const task = spec.tasks![0]
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
    const task = spec.tasks![0]
    expect(task.agent).toBe('ui-ux-expert')
    expect(task.timeout).toBe('15m')
    expect(task.depends_on).toEqual(['b'])
    expect(task.files).toEqual(['src/'])
  })
})

// ── validateSpec — version field ───────────────────────────────

describe('validateSpec — version field', () => {
  const validSpec = {
    name: 'test-run',
    tasks: [{ id: 'task-1', prompt: 'Do something' }],
  }

  it('accepts version 1', () => {
    const result = validateSpec({ ...validSpec, version: 1 })
    expect(result.valid).toBe(true)
    expect(result.errors).toHaveLength(0)
  })

  it('rejects version 2', () => {
    const result = validateSpec({ ...validSpec, version: 2 })
    expect(result.valid).toBe(false)
    expect(result.errors).toContainEqual(expect.stringContaining('version'))
  })

  it('rejects non-integer version', () => {
    const result = validateSpec({ ...validSpec, version: 1.5 })
    expect(result.valid).toBe(false)
    expect(result.errors).toContainEqual(expect.stringContaining('version'))
  })

  it('rejects string version', () => {
    const result = validateSpec({ ...validSpec, version: '1' })
    expect(result.valid).toBe(false)
    expect(result.errors).toContainEqual(expect.stringContaining('version'))
  })

  it('omitting version is valid (legacy spec)', () => {
    const result = validateSpec(validSpec)
    expect(result.valid).toBe(true)
  })
})

// ── validateSpec — defaults block ──────────────────────────────

describe('validateSpec — defaults block', () => {
  const validSpec = {
    name: 'test-run',
    version: 1,
    tasks: [{ id: 'task-1', prompt: 'Do something' }],
  }

  it('accepts a fully specified defaults block', () => {
    const result = validateSpec({
      ...validSpec,
      defaults: { timeout: '10m', model: 'gpt-4', max_retries: 2, agent: 'developer' },
    })
    expect(result.valid).toBe(true)
  })

  it('accepts partial defaults block', () => {
    const result = validateSpec({ ...validSpec, defaults: { timeout: '5m' } })
    expect(result.valid).toBe(true)
  })

  it('rejects defaults as a non-object', () => {
    const result = validateSpec({ ...validSpec, defaults: 'invalid' })
    expect(result.valid).toBe(false)
    expect(result.errors).toContainEqual(expect.stringContaining('defaults'))
  })

  it('rejects defaults as an array', () => {
    const result = validateSpec({ ...validSpec, defaults: ['timeout', '10m'] })
    expect(result.valid).toBe(false)
    expect(result.errors).toContainEqual(expect.stringContaining('defaults'))
  })

  it('rejects defaults with invalid timeout format', () => {
    const result = validateSpec({ ...validSpec, defaults: { timeout: 'bad' } })
    expect(result.valid).toBe(false)
    expect(result.errors).toContainEqual(
      expect.stringContaining('defaults.timeout')
    )
  })

  it('rejects defaults with non-string model', () => {
    const result = validateSpec({ ...validSpec, defaults: { model: 42 } })
    expect(result.valid).toBe(false)
    expect(result.errors).toContainEqual(
      expect.stringContaining('defaults.model')
    )
  })

  it('rejects defaults with negative max_retries', () => {
    const result = validateSpec({ ...validSpec, defaults: { max_retries: -1 } })
    expect(result.valid).toBe(false)
    expect(result.errors).toContainEqual(
      expect.stringContaining('defaults.max_retries')
    )
  })

  it('rejects defaults with non-integer max_retries', () => {
    const result = validateSpec({ ...validSpec, defaults: { max_retries: 1.5 } })
    expect(result.valid).toBe(false)
    expect(result.errors).toContainEqual(
      expect.stringContaining('defaults.max_retries')
    )
  })

  it('accepts defaults.max_retries of 0', () => {
    const result = validateSpec({ ...validSpec, defaults: { max_retries: 0 } })
    expect(result.valid).toBe(true)
  })

  it('rejects defaults with non-string agent', () => {
    const result = validateSpec({ ...validSpec, defaults: { agent: 99 } })
    expect(result.valid).toBe(false)
    expect(result.errors).toContainEqual(
      expect.stringContaining('defaults.agent')
    )
  })
})

// ── validateSpec — gates field ─────────────────────────────────

describe('validateSpec — gates field', () => {
  const validSpec = {
    name: 'test-run',
    tasks: [{ id: 'task-1', prompt: 'Do something' }],
  }

  it('accepts a valid gates array', () => {
    const result = validateSpec({
      ...validSpec,
      gates: ['npm test', 'npx tsc --noEmit'],
    })
    expect(result.valid).toBe(true)
  })

  it('accepts an empty gates array', () => {
    const result = validateSpec({ ...validSpec, gates: [] })
    expect(result.valid).toBe(true)
  })

  it('rejects gates as a string', () => {
    const result = validateSpec({ ...validSpec, gates: 'npm test' })
    expect(result.valid).toBe(false)
    expect(result.errors).toContainEqual(expect.stringContaining('gates'))
  })

  it('rejects gates with non-string items', () => {
    const result = validateSpec({ ...validSpec, gates: ['npm test', 42] })
    expect(result.valid).toBe(false)
    expect(result.errors).toContainEqual(expect.stringContaining('gates'))
  })
})

// ── validateSpec — branch field ────────────────────────────────

describe('validateSpec — branch field', () => {
  const validSpec = {
    name: 'test-run',
    tasks: [{ id: 'task-1', prompt: 'Do something' }],
  }

  it('accepts a valid branch string', () => {
    const result = validateSpec({ ...validSpec, branch: 'feat/my-feature' })
    expect(result.valid).toBe(true)
  })

  it('rejects non-string branch', () => {
    const result = validateSpec({ ...validSpec, branch: 123 })
    expect(result.valid).toBe(false)
    expect(result.errors).toContainEqual(expect.stringContaining('branch'))
  })

  it('rejects boolean branch', () => {
    const result = validateSpec({ ...validSpec, branch: true })
    expect(result.valid).toBe(false)
    expect(result.errors).toContainEqual(expect.stringContaining('branch'))
  })
})

// ── validateSpec — per-task model and max_retries ──────────────

describe('validateSpec — per-task model and max_retries', () => {
  it('accepts valid task model string', () => {
    const result = validateSpec({
      name: 'test',
      tasks: [{ id: 'a', prompt: 'x', model: 'claude-3.5-sonnet' }],
    })
    expect(result.valid).toBe(true)
  })

  it('rejects non-string task model', () => {
    const result = validateSpec({
      name: 'test',
      tasks: [{ id: 'a', prompt: 'x', model: 123 }],
    })
    expect(result.valid).toBe(false)
    expect(result.errors).toContainEqual(expect.stringContaining('model'))
  })

  it('accepts valid task max_retries', () => {
    const result = validateSpec({
      name: 'test',
      tasks: [{ id: 'a', prompt: 'x', max_retries: 3 }],
    })
    expect(result.valid).toBe(true)
  })

  it('accepts zero max_retries', () => {
    const result = validateSpec({
      name: 'test',
      tasks: [{ id: 'a', prompt: 'x', max_retries: 0 }],
    })
    expect(result.valid).toBe(true)
  })

  it('rejects negative max_retries', () => {
    const result = validateSpec({
      name: 'test',
      tasks: [{ id: 'a', prompt: 'x', max_retries: -1 }],
    })
    expect(result.valid).toBe(false)
    expect(result.errors).toContainEqual(expect.stringContaining('max_retries'))
  })

  it('rejects non-integer max_retries', () => {
    const result = validateSpec({
      name: 'test',
      tasks: [{ id: 'a', prompt: 'x', max_retries: 1.5 }],
    })
    expect(result.valid).toBe(false)
    expect(result.errors).toContainEqual(expect.stringContaining('max_retries'))
  })
})

// ── isConvoySpec ───────────────────────────────────────────────

describe('isConvoySpec', () => {
  it('returns true for version 1 spec', () => {
    expect(
      isConvoySpec({ name: 'test', version: 1, tasks: [{ id: 'a', prompt: 'x' }] })
    ).toBe(true)
  })

  it('returns false for legacy spec without version', () => {
    expect(
      isConvoySpec({ name: 'test', tasks: [{ id: 'a', prompt: 'x' }] })
    ).toBe(false)
  })

  it('returns false for version 2', () => {
    expect(isConvoySpec({ name: 'test', version: 2 })).toBe(false)
  })

  it('returns false for null input', () => {
    expect(isConvoySpec(null)).toBe(false)
  })

  it('returns false for non-object input', () => {
    expect(isConvoySpec('string')).toBe(false)
  })

  it('returns false for undefined', () => {
    expect(isConvoySpec(undefined)).toBe(false)
  })
})

// ── applyDefaults — convoy spec (version: 1) ───────────────────

describe('applyDefaults — convoy spec (version: 1)', () => {
  it('merges defaults.agent into tasks when not specified', () => {
    const spec = applyDefaults({
      name: 'test',
      version: 1,
      defaults: { agent: 'ui-ux-expert' },
      tasks: [{ id: 'a', prompt: 'x' }],
    })
    expect(spec.tasks![0].agent).toBe('ui-ux-expert')
  })

  it('task-level agent overrides default', () => {
    const spec = applyDefaults({
      name: 'test',
      version: 1,
      defaults: { agent: 'ui-ux-expert' },
      tasks: [{ id: 'a', prompt: 'x', agent: 'api-designer' }],
    })
    expect(spec.tasks![0].agent).toBe('api-designer')
  })

  it('merges defaults.timeout into tasks', () => {
    const spec = applyDefaults({
      name: 'test',
      version: 1,
      defaults: { timeout: '15m' },
      tasks: [{ id: 'a', prompt: 'x' }],
    })
    expect(spec.tasks![0].timeout).toBe('15m')
  })

  it('task-level timeout overrides defaults.timeout', () => {
    const spec = applyDefaults({
      name: 'test',
      version: 1,
      defaults: { timeout: '15m' },
      tasks: [{ id: 'a', prompt: 'x', timeout: '5m' }],
    })
    expect(spec.tasks![0].timeout).toBe('5m')
  })

  it('merges defaults.model into tasks', () => {
    const spec = applyDefaults({
      name: 'test',
      version: 1,
      defaults: { model: 'gpt-4' },
      tasks: [{ id: 'a', prompt: 'x' }],
    })
    expect(spec.tasks![0].model).toBe('gpt-4')
  })

  it('task-level model overrides defaults.model', () => {
    const spec = applyDefaults({
      name: 'test',
      version: 1,
      defaults: { model: 'gpt-4' },
      tasks: [{ id: 'a', prompt: 'x', model: 'claude-3.5-sonnet' }],
    })
    expect(spec.tasks![0].model).toBe('claude-3.5-sonnet')
  })

  it('no model set when no defaults.model and no task model', () => {
    const spec = applyDefaults({
      name: 'test',
      version: 1,
      tasks: [{ id: 'a', prompt: 'x' }],
    })
    expect(spec.tasks![0].model).toBeUndefined()
  })

  it('merges defaults.max_retries into tasks', () => {
    const spec = applyDefaults({
      name: 'test',
      version: 1,
      defaults: { max_retries: 3 },
      tasks: [{ id: 'a', prompt: 'x' }],
    })
    expect(spec.tasks![0].max_retries).toBe(3)
  })

  it('task-level max_retries overrides defaults.max_retries', () => {
    const spec = applyDefaults({
      name: 'test',
      version: 1,
      defaults: { max_retries: 3 },
      tasks: [{ id: 'a', prompt: 'x', max_retries: 0 }],
    })
    expect(spec.tasks![0].max_retries).toBe(0)
  })

  it('propagates version and defaults fields through to spec', () => {
    const spec = applyDefaults({
      name: 'test',
      version: 1,
      defaults: { model: 'gpt-4' },
      gates: ['npm test'],
      branch: 'feat/convoy',
      tasks: [{ id: 'a', prompt: 'x' }],
    })
    expect(spec.version).toBe(1)
    expect(spec.gates).toEqual(['npm test'])
    expect(spec.branch).toBe('feat/convoy')
  })
})

// ── applyDefaults — max_retries default always applied ─────────

describe('applyDefaults — max_retries always applied', () => {
  it('applies max_retries default of 1 for legacy spec', () => {
    const spec = applyDefaults({
      name: 'test',
      tasks: [{ id: 'a', prompt: 'x' }],
    })
    expect(spec.tasks![0].max_retries).toBe(1)
  })

  it('applies max_retries default of 1 when version:1 has no defaults block', () => {
    const spec = applyDefaults({
      name: 'test',
      version: 1,
      tasks: [{ id: 'a', prompt: 'x' }],
    })
    expect(spec.tasks![0].max_retries).toBe(1)
  })

  it('preserves explicit task max_retries in legacy spec', () => {
    const spec = applyDefaults({
      name: 'test',
      tasks: [{ id: 'a', prompt: 'x', max_retries: 5 }],
    })
    expect(spec.tasks![0].max_retries).toBe(5)
  })
})

// ── backward compatibility ─────────────────────────────────────

describe('backward compatibility — legacy specs', () => {
  it('legacy spec validates identically without version field', () => {
    const result = validateSpec({
      name: 'test-run',
      tasks: [
        { id: 'task-1', prompt: 'Do something' },
        { id: 'task-2', prompt: 'Do another thing', depends_on: ['task-1'] },
      ],
    })
    expect(result.valid).toBe(true)
    expect(result.errors).toHaveLength(0)
  })

  it('legacy spec applyDefaults produces same agent/timeout/depends_on/files as before', () => {
    const spec = applyDefaults({
      name: 'test',
      tasks: [{ id: 'a', prompt: 'x' }],
    })
    const task = spec.tasks![0]
    expect(task.agent).toBe('developer')
    expect(task.timeout).toBe('30m')
    expect(task.depends_on).toEqual([])
    expect(task.files).toEqual([])
  })

  it('user-specified legacy task values are preserved', () => {
    const spec = applyDefaults({
      name: 'test',
      tasks: [{
        id: 'a',
        prompt: 'x',
        agent: 'ui-ux-expert',
        timeout: '5m',
        depends_on: ['b'],
        files: ['src/'],
      }],
    })
    const task = spec.tasks![0]
    expect(task.agent).toBe('ui-ux-expert')
    expect(task.timeout).toBe('5m')
    expect(task.depends_on).toEqual(['b'])
    expect(task.files).toEqual(['src/'])
  })

  it('defaults block is ignored without version:1', () => {
    // Without version:1, the defaults block should not be merged
    const spec = applyDefaults({
      name: 'test',
      defaults: { agent: 'ui-ux-expert', model: 'gpt-4' },
      tasks: [{ id: 'a', prompt: 'x' }],
    })
    // agent falls back to hardcoded 'developer', not defaults.agent
    expect(spec.tasks![0].agent).toBe('developer')
    // model is not set
    expect(spec.tasks![0].model).toBeUndefined()
  })
})

// ── parseTaskSpecText ──────────────────────────────────────────

describe('parseTaskSpecText', () => {
  it('parses a valid YAML string and returns a TaskSpec', () => {
    const yaml = `
name: test-run
tasks:
  - id: task-1
    prompt: Do something
`
    const spec = parseTaskSpecText(yaml)
    expect(spec.name).toBe('test-run')
    expect(spec.tasks).toHaveLength(1)
    expect(spec.tasks![0].id).toBe('task-1')
  })

  it('throws on empty string', () => {
    expect(() => parseTaskSpecText('')).toThrow('empty')
  })

  it('throws on whitespace-only string', () => {
    expect(() => parseTaskSpecText('   \n  ')).toThrow('empty')
  })

  it('throws on invalid YAML', () => {
    expect(() => parseTaskSpecText(': invalid: yaml: {')).toThrow(/YAML parse error/)
  })

  it('throws on invalid spec (missing tasks)', () => {
    expect(() => parseTaskSpecText('name: test')).toThrow(/Invalid task spec/)
  })

  it('applies defaults when parsing', () => {
    const yaml = `
name: test-run
tasks:
  - id: task-1
    prompt: Do something
`
    const spec = parseTaskSpecText(yaml)
    expect(spec.concurrency).toBe(1)
    expect(spec.on_failure).toBe('continue')
    expect(spec.tasks![0].agent).toBe('developer')
    expect(spec.tasks![0].timeout).toBe('30m')
  })

  it('parses a convoy spec (version: 1)', () => {
    const yaml = `
name: convoy-run
version: 1
tasks:
  - id: task-1
    prompt: Do something
`
    const spec = parseTaskSpecText(yaml)
    expect(spec.version).toBe(1)
    expect(isConvoySpec(spec)).toBe(true)
  })
})
