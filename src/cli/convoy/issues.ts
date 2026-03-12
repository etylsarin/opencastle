import { existsSync, readFileSync, appendFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { scanForSecrets } from './gates.js'
import type { ConvoyEventEmitter } from './events.js'

const DISCOVERED_PATH = 'DISCOVERED-ISSUES.md'
const KNOWN_PATH = 'KNOWN-ISSUES.md'

const INJECT_INSTRUCTION =
  'IMPORTANT: After completing your task, if you notice any pre-existing bugs or issues ' +
  'unrelated to your task, append them to DISCOVERED-ISSUES.md in the format:\n\n' +
  '### ISSUE: [title]\n' +
  '- **File:** [filepath]\n' +
  '- **Description:** [description]\n' +
  '- **Severity:** low|medium|high\n\n' +
  '---\n\n' +
  'Now proceed with your original task:\n\n'

export function injectDiscoveredIssuesInstruction(prompt: string): string {
  return INJECT_INSTRUCTION + prompt
}

interface DiscoveredIssue {
  title: string
  file: string
  description: string
  severity: string
}

function parseIssueEntries(content: string): DiscoveredIssue[] {
  const issues: DiscoveredIssue[] = []
  const parts = content.split(/(?=### ISSUE:)/)
  for (const part of parts) {
    if (!part.trim().startsWith('### ISSUE:')) continue
    const titleMatch = part.match(/### ISSUE:\s*(.+)/)
    const fileMatch = part.match(/\*\*File:\*\*\s*(.+)/)
    const descMatch = part.match(/\*\*Description:\*\*\s*(.+)/)
    const sevMatch = part.match(/\*\*Severity:\*\*\s*(.+)/)
    if (titleMatch) {
      issues.push({
        title: titleMatch[1].trim(),
        file: fileMatch ? fileMatch[1].trim() : '',
        description: descMatch ? descMatch[1].trim() : '',
        severity: sevMatch ? sevMatch[1].trim() : 'low',
      })
    }
  }
  return issues
}

export function checkDiscoveredIssues(
  taskId: string,
  events: ConvoyEventEmitter,
  convoyId: string,
  basePath?: string,
): number {
  const base = basePath ?? process.cwd()
  const filePath = join(base, DISCOVERED_PATH)
  if (!existsSync(filePath)) return 0

  const content = readFileSync(filePath, 'utf8')
  const issues = parseIssueEntries(content)

  for (const issue of issues) {
    events.emit(
      'discovered_issue',
      {
        task_id: taskId,
        title: issue.title,
        file: issue.file,
        description: issue.description,
        severity: issue.severity,
      },
      { convoy_id: convoyId, task_id: taskId },
    )
  }

  return issues.length
}

export function consolidateIssues(basePath?: string): { moved: number; skipped: number } {
  const base = basePath ?? process.cwd()
  const discoveredPath = join(base, DISCOVERED_PATH)
  const knownPath = join(base, KNOWN_PATH)

  if (!existsSync(discoveredPath)) return { moved: 0, skipped: 0 }

  const discoveredContent = readFileSync(discoveredPath, 'utf8')
  const discovered = parseIssueEntries(discoveredContent)
  if (discovered.length === 0) return { moved: 0, skipped: 0 }

  const knownContent = existsSync(knownPath) ? readFileSync(knownPath, 'utf8') : ''
  let moved = 0
  let skipped = 0
  const newEntries: string[] = []

  for (const issue of discovered) {
    const knownLower = knownContent.toLowerCase()
    const alreadyKnown =
      knownLower.includes(issue.title.toLowerCase()) &&
      issue.file !== '' &&
      knownLower.includes(issue.file.toLowerCase())

    if (alreadyKnown) {
      skipped++
      continue
    }

    const entry =
      '\n### ' + issue.title + '\n' +
      '- **File:** ' + issue.file + '\n' +
      '- **Description:** ' + issue.description + '\n' +
      '- **Severity:** ' + issue.severity + '\n\n---\n'

    const scan = scanForSecrets(entry, 'known-issues')
    if (!scan.clean) continue

    newEntries.push(entry)
    moved++
  }

  if (newEntries.length > 0) {
    if (!existsSync(knownPath)) {
      writeFileSync(knownPath, '# Known Issues\n\nTracked pre-existing bugs and issues.\n', 'utf8')
    }
    appendFileSync(knownPath, newEntries.join(''), 'utf8')
  }

  writeFileSync(
    discoveredPath,
    '# Discovered Issues\n\nIssues discovered by agents during task execution.\n',
    'utf8',
  )

  return { moved, skipped }
}
