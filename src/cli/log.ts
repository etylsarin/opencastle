import { mkdir, appendFile, stat } from 'node:fs/promises'
import { readdirSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import type { CliContext } from './types.js'

const HELP = `
  opencastle log [options]
  opencastle log merge [--since <ISO-date>] [--until <ISO-date>] [--output <path>]

  Append a structured event to the observability log (events.ndjson),
  or merge per-convoy NDJSON files into a single file.

  Subcommands:
    merge         Merge all .opencastle/logs/convoys/*.ndjson into convoy-events.ndjson

  Options (log append):
    --type <type>          Event type (required): session|delegation|review|panel|dispute
    --<field> <value>      Any field from the event schema (see documentation)
    --logs-dir <path>      Override the logs directory path
    --help, -h             Show this help

  Options (merge):
    --since <ISO-date>     Only include records at or after this date
    --until <ISO-date>     Only include records at or before this date
    --output <path>        Output path (default: .opencastle/logs/convoy-events.ndjson)

  Array fields (comma-separated): file_partition, lessons_added, discoveries, reviewing_agents
  Boolean fields: escalated, weighted
  Numeric fields: auto-detected from value

  Examples:
    opencastle log --type session --agent Developer --model claude-sonnet-4-6 --task "Fix bug" --outcome success
    opencastle log --type delegation --session_id feat/prj-1 --agent Developer --tier fast --mechanism sub-agent --outcome success
    opencastle log --type panel --panel_key auth-review --verdict pass --pass_count 3 --block_count 0
    opencastle log merge --since 2026-01-01 --output /tmp/merged.ndjson
    opencastle log merge
`

const VALID_TYPES = ['session', 'delegation', 'review', 'panel', 'dispute']

const ARRAY_FIELDS = new Set([
  'file_partition',
  'lessons_added',
  'discoveries',
  'reviewing_agents',
])

const BOOLEAN_FIELDS = new Set(['escalated', 'weighted'])

function coerceValue(key: string, raw: string): unknown {
  if (ARRAY_FIELDS.has(key)) return raw.split(',').map((s) => s.trim()).filter(Boolean)
  if (BOOLEAN_FIELDS.has(key)) return raw === 'true'
  if (/^-?\d+(\.\d+)?$/.test(raw)) return Number(raw)
  return raw
}

/** Resolve the path to the logs directory (walks up to find .opencastle/). */
export async function resolveLogsDir(override?: string | null): Promise<string> {
  if (override) return override
  let dir = process.cwd()
  for (;;) {
    try {
      const s = await stat(join(dir, '.opencastle'))
      if (s.isDirectory()) return join(dir, '.opencastle', 'logs')
    } catch {
      // .opencastle not in this directory, walk up
    }
    const parent = dirname(dir)
    if (parent === dir) break
    dir = parent
  }
  return join(process.cwd(), '.opencastle', 'logs')
}

/** Merge per-convoy NDJSON files into a single deduplicated, sorted file. */
export async function mergeConvoyLogs(options: {
  since?: string
  until?: string
  output?: string
  basePath?: string
}): Promise<{ merged: number; deduplicated: number; written: number }> {
  const base = options.basePath ?? process.cwd()
  const convoysDir = join(base, '.opencastle', 'logs', 'convoys')

  let files: string[] = []
  try {
    files = readdirSync(convoysDir)
      .filter(f => f.endsWith('.ndjson'))
      .map(f => join(convoysDir, f))
  } catch {
    return { merged: 0, deduplicated: 0, written: 0 }
  }

  if (files.length === 0) {
    return { merged: 0, deduplicated: 0, written: 0 }
  }

  const allRecords: Array<Record<string, unknown>> = []
  let totalRead = 0

  for (const file of files) {
    const content = readFileSync(file, 'utf8')
    const lines = content.split('\n').filter(l => l.trim())
    for (const line of lines) {
      try {
        allRecords.push(JSON.parse(line) as Record<string, unknown>)
        totalRead++
      } catch {
        // skip malformed lines
      }
    }
  }

  // Deduplicate by _event_id — keep first occurrence
  const seen = new Set<unknown>()
  const unique: Array<Record<string, unknown>> = []
  for (const record of allRecords) {
    const id = record['_event_id']
    if (id !== undefined) {
      if (seen.has(id)) continue
      seen.add(id)
    }
    unique.push(record)
  }

  const deduplicatedCount = totalRead - unique.length

  // Filter by since/until
  let filtered = unique
  if (options.since) {
    const since = options.since
    filtered = filtered.filter(r => {
      const ts = r['timestamp'] as string | undefined
      return ts !== undefined && ts >= since
    })
  }
  if (options.until) {
    const until = options.until
    filtered = filtered.filter(r => {
      const ts = r['timestamp'] as string | undefined
      return ts !== undefined && ts <= until
    })
  }

  // Sort by timestamp ascending
  filtered.sort((a, b) => {
    const ta = (a['timestamp'] as string) ?? ''
    const tb = (b['timestamp'] as string) ?? ''
    return ta < tb ? -1 : ta > tb ? 1 : 0
  })

  if (filtered.length === 0) {
    return { merged: totalRead, deduplicated: deduplicatedCount, written: 0 }
  }

  const outputPath = options.output ?? join(base, '.opencastle', 'logs', 'convoy-events.ndjson')
  mkdirSync(dirname(outputPath), { recursive: true })
  writeFileSync(outputPath, filtered.map(r => JSON.stringify(r)).join('\n') + '\n', 'utf8')

  return { merged: totalRead, deduplicated: deduplicatedCount, written: filtered.length }
}

/** Append a structured event record to events.ndjson. */
export async function appendEvent(
  record: Record<string, unknown>,
  logsDir?: string | null,
): Promise<void> {
  const resolvedDir = await resolveLogsDir(logsDir ?? null)
  const eventsFile = join(resolvedDir, 'events.ndjson')
  await mkdir(resolvedDir, { recursive: true })
  const line = JSON.stringify(record)
  await appendFile(eventsFile, line + '\n', 'utf8')
}

export default async function log({ args }: CliContext): Promise<void> {
  if (args.includes('--help') || args.includes('-h')) {
    console.log(HELP)
    return
  }

  // merge subcommand
  if (args[0] === 'merge') {
    const mergeArgs = args.slice(1)
    let since: string | undefined
    let until: string | undefined
    let output: string | undefined
    for (let i = 0; i < mergeArgs.length; i++) {
      const a = mergeArgs[i]
      if (a === '--since' && i + 1 < mergeArgs.length) { since = mergeArgs[++i]; continue }
      if (a === '--until' && i + 1 < mergeArgs.length) { until = mergeArgs[++i]; continue }
      if (a === '--output' && i + 1 < mergeArgs.length) { output = mergeArgs[++i]; continue }
    }
    const result = await mergeConvoyLogs({ since, until, output })
    console.log(`  Merged: ${result.merged} records, Deduplicated: ${result.deduplicated}, Written: ${result.written}`)
    return
  }

  let type: string | null = null
  let logsDir: string | null = null
  const fields: Record<string, unknown> = {}

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    switch (arg) {
      case '--type':
        if (i + 1 >= args.length) { console.error('  \u2717 --type requires a value'); process.exit(1) }
        type = args[++i]
        break
      case '--logs-dir':
        if (i + 1 >= args.length) { console.error('  \u2717 --logs-dir requires a path'); process.exit(1) }
        logsDir = args[++i]
        break
      default:
        if (arg.startsWith('--')) {
          const key = arg.slice(2)
          const DANGEROUS_KEYS = new Set(['__proto__', 'constructor', 'prototype'])
          if (DANGEROUS_KEYS.has(key)) break
          const next = args[i + 1]
          if (next === undefined || next.startsWith('--')) {
            fields[key] = true
          } else {
            fields[key] = coerceValue(key, args[++i])
          }
        }
    }
  }

  if (!type) {
    console.error('  \u2717 --type is required. Use one of: session, delegation, review, panel, dispute')
    console.error('  Run "opencastle log --help" for usage.')
    process.exit(1)
  }

  if (!VALID_TYPES.includes(type)) {
    console.error(`  \u2717 Invalid --type "${type}". Must be one of: ${VALID_TYPES.join(', ')}`)
    process.exit(1)
  }

  const timestamp = (fields['timestamp'] as string | undefined) ?? new Date().toISOString()
  delete fields['timestamp']
  const record = { type, timestamp, ...fields }

  try {
    await appendEvent(record, logsDir)
    console.log(JSON.stringify(record))
  } catch (err: unknown) {
    console.error(`  ✗ Failed to write log: ${(err as Error).message}`)
    process.exit(1)
  }
}

