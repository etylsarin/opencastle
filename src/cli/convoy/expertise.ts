import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { scanForSecrets } from './gates.js'

const EXPERTISE_PATH = '.opencastle/AGENT-EXPERTISE.md'

export function readExpertise(
  agentName: string,
  basePath?: string,
): { strong: string[]; weak: string[]; files: string[] } {
  const base = basePath ?? process.cwd()
  const filePath = join(base, EXPERTISE_PATH)
  const empty = { strong: [] as string[], weak: [] as string[], files: [] as string[] }
  if (!existsSync(filePath)) return empty

  const content = readFileSync(filePath, 'utf8')
  const lines = content.split('\n')
  const agentHeaderRegex = new RegExp(
    '^## ' + agentName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*$',
    'i',
  )

  let inAgentSection = false
  let currentSubsection = ''
  const result = { strong: [] as string[], weak: [] as string[], files: [] as string[] }

  for (const line of lines) {
    if (agentHeaderRegex.test(line)) {
      inAgentSection = true
      continue
    }
    if (inAgentSection) {
      if (line.startsWith('## ')) break
      if (line.startsWith('### ')) {
        currentSubsection = line.replace(/^###\s*/, '').trim()
        continue
      }
      if (line.startsWith('- ')) {
        const item = line.replace(/^-\s*/, '').trim()
        if (currentSubsection === 'Strong Areas') result.strong.push(item)
        else if (currentSubsection === 'Weak Areas') result.weak.push(item)
        else if (currentSubsection === 'File Familiarity') result.files.push(item)
      }
    }
  }

  return result
}

function appendBulletToSubsection(
  lines: string[],
  agentName: string,
  subsection: string,
  item: string,
): void {
  const agentHeaderRegex = new RegExp(
    '^## ' + agentName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*$',
    'i',
  )
  const subsectionHeader = '### ' + subsection

  let inAgentSection = false
  let inSubsection = false
  let insertAfterLine = -1

  for (let i = 0; i < lines.length; i++) {
    if (agentHeaderRegex.test(lines[i])) {
      inAgentSection = true
      continue
    }
    if (inAgentSection) {
      if (lines[i].startsWith('## ')) break
      if (lines[i] === subsectionHeader) {
        inSubsection = true
        insertAfterLine = i
        continue
      }
      if (inSubsection) {
        if (lines[i].startsWith('### ') || lines[i].startsWith('## ')) break
        if (lines[i].startsWith('- ')) {
          insertAfterLine = i
        }
      }
    }
  }

  if (insertAfterLine !== -1) {
    lines.splice(insertAfterLine + 1, 0, '- ' + item)
  }
}

function ensureAgentSection(lines: string[], agentName: string): void {
  const agentHeaderRegex = new RegExp(
    '^## ' + agentName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*$',
    'i',
  )
  const exists = lines.some(l => agentHeaderRegex.test(l))
  if (!exists) {
    lines.push(
      '',
      '## ' + agentName,
      '',
      '### Strong Areas',
      '',
      '### Weak Areas',
      '',
      '### File Familiarity',
      '',
    )
  }
}

export function updateExpertise(
  agentName: string,
  taskResult: { taskId: string; success: boolean; retries: number; files: string[] },
  basePath?: string,
): { updated: boolean; reason?: string } {
  const base = basePath ?? process.cwd()
  const filePath = join(base, EXPERTISE_PATH)

  const date = new Date().toISOString().slice(0, 10)
  const outcome = taskResult.success ? 'success' : 'failed'
  const entryText =
    '[' + date + '] ' + taskResult.taskId + ': ' + outcome +
    '/retries=' + taskResult.retries + ', files: [' + taskResult.files.join(', ') + ']'

  const scanResult = scanForSecrets(entryText, 'expertise')
  if (!scanResult.clean) {
    return { updated: false, reason: 'secrets_detected' }
  }

  const initialContent = existsSync(filePath)
    ? readFileSync(filePath, 'utf8')
    : '# Agent Expertise\n\nTracking agent performance across tasks.\n'

  const lines = initialContent.split('\n')
  ensureAgentSection(lines, agentName)

  if (taskResult.success && taskResult.retries === 0) {
    appendBulletToSubsection(lines, agentName, 'Strong Areas', entryText)
  } else if (taskResult.success && taskResult.retries > 0) {
    appendBulletToSubsection(lines, agentName, 'Strong Areas', entryText)
    appendBulletToSubsection(lines, agentName, 'Weak Areas', entryText)
  } else {
    appendBulletToSubsection(lines, agentName, 'Weak Areas', entryText)
  }

  const existing = readExpertise(agentName, base)
  const currentFiles = new Set(existing.files)
  for (const f of taskResult.files) {
    if (!currentFiles.has(f)) {
      appendBulletToSubsection(lines, agentName, 'File Familiarity', f)
      currentFiles.add(f)
    }
  }

  writeFileSync(filePath, lines.join('\n'), 'utf8')
  return { updated: true }
}

export function feedCircuitBreaker(agentName: string, basePath?: string): string[] {
  return readExpertise(agentName, basePath).weak
}
