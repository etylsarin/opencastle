import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { formatDuration } from './executor.js'
import type {
  TaskSpec,
  Task,
  TaskResult,
  RunReport,
  Reporter,
  ReporterOptions,
} from '../types.js'

/**
 * Status icons for terminal output.
 */
const ICONS: Record<string, string> = {
  start: '▶',
  done: '✓',
  failed: '✗',
  skipped: '⊘',
  'timed-out': '⏱',
}

/**
 * Create a reporter that prints progress to the terminal and writes a JSON report.
 */
export function createReporter(spec: TaskSpec, options: ReporterOptions = {}): Reporter {
  const reportDir = options.reportDir || resolve(process.cwd(), '.opencastle', 'runs')
  const verbose = options.verbose || false

  return {
    onTaskStart(task: Task): void {
      console.log(`  ${ICONS.start} [${task.id}] ${task.description}`)
    },

    onTaskDone(task: Task, result: TaskResult): void {
      const dur = formatDuration(result.duration)
      if (result.status === 'done') {
        console.log(`  ${ICONS.done} [${task.id}] completed (${dur})`)
      } else if (result.status === 'timed-out') {
        console.log(`  ${ICONS['timed-out']} [${task.id}] timed out after ${task.timeout}`)
      } else {
        console.log(`  ${ICONS.failed} [${task.id}] failed (${dur})`)
        if (result.output) {
          const lines = result.output.split('\n').slice(0, 5)
          for (const line of lines) {
            console.log(`    ${line}`)
          }
          if (result.output.split('\n').length > 5) {
            console.log(`    ... (truncated)`)
          }
        }
      }

      if (verbose && result.output && result.status === 'done') {
        console.log(`    Output: ${result.output.slice(0, 500)}`)
      }
    },

    onTaskSkipped(task: Task, reason: string): void {
      console.log(`  ${ICONS.skipped} [${task.id}] skipped — ${reason}`)
    },

    onPhaseStart(phase: number, tasks: Task[]): void {
      const ids = tasks.map((t) => t.id).join(', ')
      console.log(`\n  Phase ${phase}: ${ids}`)
    },

    async onComplete(report: RunReport): Promise<void> {
      console.log(`\n  ──────────────────────────────────`)
      console.log(`  Run complete: ${report.name}`)
      console.log(`  Duration: ${report.duration}`)
      console.log()

      const s = report.summary
      const parts: string[] = []
      if (s.done > 0) parts.push(`${s.done} done`)
      if (s.failed > 0) parts.push(`${s.failed} failed`)
      if (s.skipped > 0) parts.push(`${s.skipped} skipped`)
      if (s['timed-out'] > 0) parts.push(`${s['timed-out']} timed out`)
      console.log(`  Tasks: ${s.total} total — ${parts.join(', ')}`)

      // Write JSON report
      try {
        await mkdir(reportDir, { recursive: true })
        const timestamp = new Date()
          .toISOString()
          .replace(/[:.]/g, '-')
          .slice(0, 19)
        const reportPath = resolve(reportDir, `${timestamp}.json`)
        await writeFile(reportPath, JSON.stringify(report, null, 2), 'utf8')
        console.log(`  Report: ${reportPath}`)
      } catch (err: unknown) {
        console.log(`  ${ICONS.failed} Could not write report: ${(err as Error).message}`)
      }

      console.log()
    },
  }
}

/**
 * Print the execution plan (dry-run mode).
 */
export function printExecutionPlan(spec: TaskSpec, phases: Task[][]): void {
  console.log(`\n  🏰 Execution Plan: ${spec.name}`)
  console.log(`  Adapter: ${spec.adapter}`)
  console.log(`  Concurrency: ${spec.concurrency}`)
  console.log(`  On failure: ${spec.on_failure}`)
  console.log(`  Tasks: ${spec.tasks.length}`)
  console.log()

  for (let i = 0; i < phases.length; i++) {
    const phase = phases[i]
    console.log(`  Phase ${i + 1}:`)
    for (const task of phase) {
      const deps =
        task.depends_on.length > 0
          ? ` (after: ${task.depends_on.join(', ')})`
          : ''
      const files =
        task.files.length > 0 ? ` [${task.files.join(', ')}]` : ''
      console.log(
        `    ${task.id} — ${task.description} [${task.agent}, ${task.timeout}]${deps}${files}`
      )
    }
  }
  console.log()
}
