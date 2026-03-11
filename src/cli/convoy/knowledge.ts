import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { scanForSecrets } from './gates.js'

const KNOWLEDGE_PATH = '.opencastle/KNOWLEDGE-GRAPH.md'
const TABLE_HEADER =
  '| source | target | relationship | date | convoy_id |\n' +
  '|--------|--------|--------------|------|-----------|\n'

function extractChangedFiles(diffOutput: string): string[] {
  const files: string[] = []
  const re = /^diff --git a\/.+ b\/(.+)$/gm
  let m: RegExpExecArray | null
  while ((m = re.exec(diffOutput)) !== null) {
    const fileName = m[1]
    if (isTargetFile(fileName)) files.push(fileName)
  }
  return files
}

function isTargetFile(fileName: string): boolean {
  if (!/\.(ts|js)$/.test(fileName)) return false
  if (/\.(test|spec)\.(ts|js)$/.test(fileName)) return false
  return true
}

function extractFileDiff(diffOutput: string, fileName: string): string {
  const escaped = fileName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const re = new RegExp(
    'diff --git a/' + escaped + ' b/' + escaped + '([\\s\\S]*?)(?=diff --git |$)',
  )
  const m = diffOutput.match(re)
  return m ? m[0] : ''
}

function extractImports(diffContent: string): Array<{ source: string; target: string }> {
  const imports: Array<{ source: string; target: string }> = []
  const headerMatch = diffContent.match(/^diff --git a\/(.+) b\//)
  if (!headerMatch) return []
  const sourceFile = headerMatch[1]

  for (const line of diffContent.split('\n')) {
    if (!line.startsWith('+') || line.startsWith('+++')) continue
    const content = line.slice(1)

    const esmMatch = content.match(/import\s+.*\s+from\s+['"](\.[^'"]+)['"]/)
    if (esmMatch) {
      imports.push({ source: sourceFile, target: esmMatch[1] })
      continue
    }
    const reqMatch = content.match(/require\s*\(\s*['"](\.[^'"]+)['"]\s*\)/)
    if (reqMatch) {
      imports.push({ source: sourceFile, target: reqMatch[1] })
    }
  }

  return imports
}

function parseExistingRowKeys(content: string): Set<string> {
  const keys = new Set<string>()
  for (const line of content.split('\n')) {
    const parts = line.split('|').map(p => p.trim()).filter(Boolean)
    if (parts.length >= 2 && parts[0] !== 'source') {
      keys.add(parts[0] + '|' + parts[1])
    }
  }
  return keys
}

export function buildKnowledgeGraph(
  diffOutput: string,
  convoyId: string,
  basePath?: string,
): { added: number; skipped: number } {
  const base = basePath ?? process.cwd()
  const filePath = join(base, KNOWLEDGE_PATH)
  const date = new Date().toISOString().slice(0, 10)

  const changedFiles = extractChangedFiles(diffOutput)
  const allImports: Array<{ source: string; target: string }> = []
  for (const file of changedFiles) {
    allImports.push(...extractImports(extractFileDiff(diffOutput, file)))
  }

  if (allImports.length === 0) return { added: 0, skipped: 0 }

  const existingContent = existsSync(filePath) ? readFileSync(filePath, 'utf8') : ''
  const existingKeys = parseExistingRowKeys(existingContent)

  const newRows: string[] = []
  let skipped = 0

  for (const { source, target } of allImports) {
    const key = source + '|' + target
    if (existingKeys.has(key)) {
      skipped++
      continue
    }
    const row = '| ' + source + ' | ' + target + ' | imports | ' + date + ' | ' + convoyId + ' |'
    const scan = scanForSecrets(row, 'knowledge-graph')
    if (!scan.clean) {
      skipped++
      continue
    }
    newRows.push(row)
    existingKeys.add(key)
  }

  if (newRows.length === 0) return { added: 0, skipped }

  let fileContent: string
  if (!existsSync(filePath)) {
    fileContent =
      '# Knowledge Graph\n\nFile dependency relationships discovered during convoy runs.\n\n' +
      TABLE_HEADER +
      newRows.join('\n') +
      '\n'
  } else {
    const hasHeader = existingContent.includes('| source | target |')
    fileContent =
      (hasHeader
        ? existingContent.trimEnd()
        : existingContent.trimEnd() + '\n\n' + TABLE_HEADER.trimEnd()) +
      '\n' +
      newRows.join('\n') +
      '\n'
  }

  writeFileSync(filePath, fileContent, 'utf8')
  return { added: newRows.length, skipped }
}
