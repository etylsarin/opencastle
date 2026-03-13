import { describe, it, expect } from 'vitest'
import { parseComplexityAssessment } from './pipeline.js'

const SINGLE_PRD = `# My Feature — PRD

## Overview
Some overview.

## Risks & Open Questions
None identified.

## Complexity Assessment

\`\`\`json
{
  "total_tasks": 4,
  "total_phases": 2,
  "domains": ["api", "frontend"],
  "estimated_duration_minutes": 60,
  "complexity": "medium",
  "recommended_strategy": "single",
  "chain_rationale": "",
  "convoy_groups": [
    {
      "name": "full-implementation",
      "description": "All phases in a single convoy",
      "phases": [1, 2],
      "depends_on": []
    }
  ]
}
\`\`\`
`

const CHAIN_PRD = `# Big Feature — PRD

## Overview
Big feature.

## Risks & Open Questions
None identified.

## Complexity Assessment

\`\`\`json
{
  "total_tasks": 12,
  "total_phases": 4,
  "domains": ["database", "api", "frontend", "testing"],
  "estimated_duration_minutes": 240,
  "complexity": "high",
  "recommended_strategy": "chain",
  "chain_rationale": "Database schema changes have no frontend dependencies and can be validated independently.",
  "convoy_groups": [
    {
      "name": "database-setup",
      "description": "Schema changes and migrations",
      "phases": [1],
      "depends_on": []
    },
    {
      "name": "api-integration",
      "description": "API routes and server logic",
      "phases": [2],
      "depends_on": ["database-setup"]
    },
    {
      "name": "frontend-testing",
      "description": "UI components and test suite",
      "phases": [3, 4],
      "depends_on": ["api-integration"]
    }
  ]
}
\`\`\`
`

const NO_SECTION_PRD = `# Feature — PRD

## Overview
Plain prd with no complexity section.

## Risks & Open Questions
None.
`

const MALFORMED_JSON_PRD = `# Feature — PRD

## Complexity Assessment

\`\`\`json
{ "total_tasks": 3, "broken": 
\`\`\`
`

const UNFENCED_JSON_PRD = `# Feature — PRD

## Complexity Assessment

The complexity is medium.

total_tasks: 3, total_phases: 2
`

const OTHER_JSON_PRD = `# Feature — PRD

## Overview
Some feature with json-like content: \`{"key": "value"}\`

Another block:
\`\`\`json
{"not": "complexity"}
\`\`\`

## Complexity Assessment

\`\`\`json
{
  "total_tasks": 6,
  "total_phases": 3,
  "domains": ["api", "frontend"],
  "complexity": "medium",
  "recommended_strategy": "single",
  "convoy_groups": [
    {
      "name": "impl",
      "description": "All phases",
      "phases": [1, 2, 3],
      "depends_on": []
    }
  ]
}
\`\`\`
`

describe('parseComplexityAssessment', () => {
  it('returns null when PRD has no Complexity Assessment section', () => {
    expect(parseComplexityAssessment(NO_SECTION_PRD)).toBeNull()
  })

  it('returns null when JSON is malformed', () => {
    expect(parseComplexityAssessment(MALFORMED_JSON_PRD)).toBeNull()
  })

  it('parses a valid single strategy assessment', () => {
    const result = parseComplexityAssessment(SINGLE_PRD)
    expect(result).not.toBeNull()
    expect(result?.recommended_strategy).toBe('single')
    expect(result?.complexity).toBe('medium')
    expect(result?.total_tasks).toBe(4)
    expect(result?.total_phases).toBe(2)
    expect(result?.domains).toEqual(['api', 'frontend'])
    expect(result?.convoy_groups).toHaveLength(1)
    expect(result?.convoy_groups[0].name).toBe('full-implementation')
  })

  it('parses a valid chain strategy assessment with multiple groups', () => {
    const result = parseComplexityAssessment(CHAIN_PRD)
    expect(result).not.toBeNull()
    expect(result?.recommended_strategy).toBe('chain')
    expect(result?.complexity).toBe('high')
    expect(result?.convoy_groups).toHaveLength(3)
    expect(result?.convoy_groups[0].name).toBe('database-setup')
    expect(result?.convoy_groups[1].depends_on).toEqual(['database-setup'])
    expect(result?.convoy_groups[2].phases).toEqual([3, 4])
  })

  it('handles missing optional fields gracefully', () => {
    const prd = `# Feature — PRD\n\n## Complexity Assessment\n\n\`\`\`json\n{\n  "total_tasks": 3,\n  "total_phases": 1,\n  "domains": ["api"],\n  "complexity": "low",\n  "recommended_strategy": "single",\n  "convoy_groups": [{"name": "all", "description": "All", "phases": [1], "depends_on": []}]\n}\n\`\`\`\n`
    const result = parseComplexityAssessment(prd)
    expect(result).not.toBeNull()
    expect(result?.estimated_duration_minutes).toBeUndefined()
    expect(result?.chain_rationale).toBeUndefined()
  })

  it('returns null when JSON block is not fenced properly', () => {
    expect(parseComplexityAssessment(UNFENCED_JSON_PRD)).toBeNull()
  })

  it('correctly extracts JSON even when PRD has other JSON-like content elsewhere', () => {
    const result = parseComplexityAssessment(OTHER_JSON_PRD)
    expect(result).not.toBeNull()
    expect(result?.total_tasks).toBe(6)
    expect(result?.recommended_strategy).toBe('single')
  })

  it('returns null when required fields are missing from JSON', () => {
    const prd = `# Feature — PRD\n\n## Complexity Assessment\n\n\`\`\`json\n{"total_tasks": 3}\n\`\`\`\n`
    expect(parseComplexityAssessment(prd)).toBeNull()
  })
})
