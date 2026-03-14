import { describe, it, expect } from 'vitest'
import { parseComplexityAssessment, deriveComplexityPath, validateComplexityGroups, topologicalSortGroups } from './pipeline.js'

const SINGLE_JSON = JSON.stringify({
  original_prompt: 'Build a REST API with user auth',
  total_tasks: 4,
  total_phases: 2,
  domains: ['api', 'frontend'],
  estimated_duration_minutes: 60,
  complexity: 'medium',
  recommended_strategy: 'single',
  chain_rationale: '',
  convoy_groups: [
    {
      name: 'full-implementation',
      description: 'All phases in a single convoy',
      phases: [1, 2],
      depends_on: [],
    },
  ],
})

const CHAIN_JSON = JSON.stringify({
  original_prompt: 'Build a full-stack e-commerce platform',
  total_tasks: 12,
  total_phases: 4,
  domains: ['database', 'api', 'frontend', 'testing'],
  estimated_duration_minutes: 240,
  complexity: 'high',
  recommended_strategy: 'chain',
  chain_rationale:
    'Database schema changes have no frontend dependencies and can be validated independently.',
  convoy_groups: [
    {
      name: 'database-setup',
      description: 'Schema changes and migrations',
      phases: [1],
      depends_on: [],
    },
    {
      name: 'api-integration',
      description: 'API routes and server logic',
      phases: [2],
      depends_on: ['database-setup'],
    },
    {
      name: 'frontend-testing',
      description: 'UI components and test suite',
      phases: [3, 4],
      depends_on: ['api-integration'],
    },
  ],
})

const MINIMAL_JSON = JSON.stringify({
  original_prompt: 'Add a health-check endpoint',
  total_tasks: 3,
  total_phases: 1,
  domains: ['api'],
  complexity: 'low',
  recommended_strategy: 'single',
  convoy_groups: [
    { name: 'all', description: 'All', phases: [1], depends_on: [] },
  ],
})

describe('parseComplexityAssessment', () => {
  it('returns null for empty string', () => {
    expect(parseComplexityAssessment('')).toBeNull()
  })

  it('returns null when JSON is malformed', () => {
    expect(
      parseComplexityAssessment('{ "total_tasks": 3, "broken": ')
    ).toBeNull()
  })

  it('returns null for plain text that is not JSON', () => {
    expect(
      parseComplexityAssessment('The complexity is medium.')
    ).toBeNull()
  })

  it('parses a valid single strategy assessment', () => {
    const result = parseComplexityAssessment(SINGLE_JSON)
    expect(result).not.toBeNull()
    expect(result?.original_prompt).toBe('Build a REST API with user auth')
    expect(result?.recommended_strategy).toBe('single')
    expect(result?.complexity).toBe('medium')
    expect(result?.total_tasks).toBe(4)
    expect(result?.total_phases).toBe(2)
    expect(result?.domains).toEqual(['api', 'frontend'])
    expect(result?.convoy_groups).toHaveLength(1)
    expect(result?.convoy_groups[0].name).toBe('full-implementation')
  })

  it('parses a valid chain strategy assessment with multiple groups', () => {
    const result = parseComplexityAssessment(CHAIN_JSON)
    expect(result).not.toBeNull()
    expect(result?.recommended_strategy).toBe('chain')
    expect(result?.complexity).toBe('high')
    expect(result?.convoy_groups).toHaveLength(3)
    expect(result?.convoy_groups[0].name).toBe('database-setup')
    expect(result?.convoy_groups[1].depends_on).toEqual(['database-setup'])
    expect(result?.convoy_groups[2].phases).toEqual([3, 4])
  })

  it('handles missing optional fields gracefully', () => {
    const result = parseComplexityAssessment(MINIMAL_JSON)
    expect(result).not.toBeNull()
    expect(result?.estimated_duration_minutes).toBeUndefined()
    expect(result?.chain_rationale).toBeUndefined()
  })

  it('returns null when required fields are missing from JSON', () => {
    expect(parseComplexityAssessment('{"total_tasks": 3}')).toBeNull()
  })

  it('returns null when original_prompt is missing', () => {
    const json = JSON.stringify({
      total_tasks: 4, total_phases: 2, domains: ['api'],
      complexity: 'medium', recommended_strategy: 'single',
      convoy_groups: [{ name: 'all', description: 'All', phases: [1], depends_on: [] }],
    })
    expect(parseComplexityAssessment(json)).toBeNull()
  })

  it('parses JSON with extra whitespace', () => {
    const result = parseComplexityAssessment(`  \n ${SINGLE_JSON} \n  `)
    expect(result).not.toBeNull()
    expect(result?.total_tasks).toBe(4)
  })
})

describe('deriveComplexityPath', () => {
  it('replaces .prd.md with .complexity.json', () => {
    expect(deriveComplexityPath('/path/to/feature.prd.md')).toBe('/path/to/feature.complexity.json')
  })

  it('appends .complexity.json when path does not end with .prd.md', () => {
    expect(deriveComplexityPath('/path/to/feature.md')).toBe('/path/to/feature.md.complexity.json')
  })

  it('handles paths with no extension', () => {
    expect(deriveComplexityPath('/path/to/feature')).toBe('/path/to/feature.complexity.json')
  })

  it('handles the opencastle PRD convention', () => {
    expect(deriveComplexityPath('.opencastle/prds/personal-portfolio-website.prd.md')).toBe(
      '.opencastle/prds/personal-portfolio-website.complexity.json'
    )
  })
})

describe('validateComplexityGroups', () => {
  it('accepts valid groups', () => {
    const assessment = {
      original_prompt: 'test',
      total_tasks: 6,
      total_phases: 3,
      domains: ['frontend', 'api'],
      complexity: 'medium' as const,
      recommended_strategy: 'chain' as const,
      convoy_groups: [
        { name: 'backend', description: 'API', phases: [1, 2], depends_on: [] },
        { name: 'frontend', description: 'UI', phases: [3], depends_on: ['backend'] },
      ],
    }
    expect(validateComplexityGroups(assessment)).toEqual({ valid: true, reason: '' })
  })

  it('rejects groups exceeding max count for small projects', () => {
    const assessment = {
      original_prompt: 'test',
      total_tasks: 10,
      total_phases: 4,
      domains: ['a'],
      complexity: 'medium' as const,
      recommended_strategy: 'chain' as const,
      convoy_groups: [
        { name: 'a', description: 'A', phases: [1], depends_on: [] },
        { name: 'b', description: 'B', phases: [2], depends_on: [] },
        { name: 'c-group', description: 'C', phases: [3], depends_on: [] },
        { name: 'd-group', description: 'D', phases: [4], depends_on: [] },
      ],
    }
    const result = validateComplexityGroups(assessment)
    expect(result.valid).toBe(false)
    expect(result.reason).toContain('maximum')
  })

  it('rejects overlapping phases', () => {
    const assessment = {
      original_prompt: 'test',
      total_tasks: 8,
      total_phases: 3,
      domains: ['a'],
      complexity: 'medium' as const,
      recommended_strategy: 'chain' as const,
      convoy_groups: [
        { name: 'group-a', description: 'A', phases: [1, 2], depends_on: [] },
        { name: 'group-b', description: 'B', phases: [2, 3], depends_on: [] },
      ],
    }
    const result = validateComplexityGroups(assessment)
    expect(result.valid).toBe(false)
    expect(result.reason).toContain('overlap')
  })

  it('rejects invalid depends_on references', () => {
    const assessment = {
      original_prompt: 'test',
      total_tasks: 8,
      total_phases: 2,
      domains: ['a'],
      complexity: 'medium' as const,
      recommended_strategy: 'chain' as const,
      convoy_groups: [
        { name: 'group-a', description: 'A', phases: [1], depends_on: ['nonexistent'] },
      ],
    }
    const result = validateComplexityGroups(assessment)
    expect(result.valid).toBe(false)
    expect(result.reason).toContain('nonexistent')
  })

  it('rejects dependency cycles', () => {
    const assessment = {
      original_prompt: 'test',
      total_tasks: 8,
      total_phases: 2,
      domains: ['a'],
      complexity: 'medium' as const,
      recommended_strategy: 'chain' as const,
      convoy_groups: [
        { name: 'group-a', description: 'A', phases: [1], depends_on: ['group-b'] },
        { name: 'group-b', description: 'B', phases: [2], depends_on: ['group-a'] },
      ],
    }
    const result = validateComplexityGroups(assessment)
    expect(result.valid).toBe(false)
    expect(result.reason).toContain('cycle')
  })

  it('rejects non-kebab-case group names', () => {
    const assessment = {
      original_prompt: 'test',
      total_tasks: 8,
      total_phases: 2,
      domains: ['a'],
      complexity: 'medium' as const,
      recommended_strategy: 'chain' as const,
      convoy_groups: [
        { name: 'My Group', description: 'Bad name', phases: [1], depends_on: [] },
      ],
    }
    const result = validateComplexityGroups(assessment)
    expect(result.valid).toBe(false)
    expect(result.reason).toContain('kebab')
  })
})

describe('topologicalSortGroups', () => {
  it('sorts groups in dependency order', () => {
    const groups = [
      { name: 'c', description: 'C', phases: [3], depends_on: ['b'] },
      { name: 'a', description: 'A', phases: [1], depends_on: [] },
      { name: 'b', description: 'B', phases: [2], depends_on: ['a'] },
    ]
    const sorted = topologicalSortGroups(groups)
    expect(sorted.map(g => g.name)).toEqual(['a', 'b', 'c'])
  })

  it('preserves order for independent groups', () => {
    const groups = [
      { name: 'x', description: 'X', phases: [1], depends_on: [] },
      { name: 'y', description: 'Y', phases: [2], depends_on: [] },
    ]
    const sorted = topologicalSortGroups(groups)
    expect(sorted.map(g => g.name)).toEqual(['x', 'y'])
  })
})
