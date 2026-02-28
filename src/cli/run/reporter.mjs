/* global console */
import { mkdir, writeFile } from 'node:fs/promises'
import { resolve, dirname } from 'node:path'
import { formatDuration } from './executor.mjs'

/**
 * Status icons for terminal output.
 */
const ICONS = {
  start: '▶',
  done: '✓',
  failed: '✗',
  skipped: '⊘',
  'timed-out': '⏱',
}

/**
 * Create a reporter that prints progress to the terminal and writes a JSON report.
 * @param {object} spec - Validated task spec
 * @param {object} options - { reportDir, verbose }
 * @returns {object} Reporter methods
 */
export function createReporter(spec, options = {}) {
  const reportDir = options.reportDir || resolve(process.cwd(), '.opencastle', 'runs')
  const verbose = options.verbose || false

  return {
    /**
     * Called when a task starts execution.
     * @param {object} task
     */
    onTaskStart(task) {
      console.log(`  ${ICONS.start} [${task.id}] ${task.description}`)
    },

    /**
     * Called when a task completes (success or failure).
     * @param {object} task
     * @param {object} result - { status, duration, output }
     */
    onTaskDone(task, result) {
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

    /**
     * Called when a task is skipped.
     * @param {object} task
     * @param {string} reason
     */
    onTaskSkipped(task, reason) {
      console.log(`  ${ICONS.skipped} [${task.id}] skipped — ${reason}`)
    },

    /**
     * Called when a new execution phase starts.
     * @param {number} phase - Phase number (1-indexed)
     * @param {Array} tasks - Tasks in this phase
     */
    onPhaseStart(phase, tasks) {
      const ids = tasks.map((t) => t.id).join(', ')
      console.log(`\n  Phase ${phase}: ${ids}`)
    },

    /**
     * Called when execution is complete. Prints summary and writes JSON report.
     * @param {object} report - Final report object
     */
    async onComplete(report) {
      console.log(`\n  ──────────────────────────────────`)
      console.log(`  Run complete: ${report.name}`)
      console.log(`  Duration: ${report.duration}`)
      console.log()

      const s = report.summary
      const parts = []
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
      } catch (err) {
        console.log(`  ${ICONS.failed} Could not write report: ${err.message}`)
      }

      console.log()
    },
  }
}

/**
 * Print the execution plan (dry-run mode).
 * @param {object} spec - Validated spec
 * @param {Array<Array<object>>} phases - Phase groups from buildPhases
 */
export function printExecutionPlan(spec, phases) {
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
