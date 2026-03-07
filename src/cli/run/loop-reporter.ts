import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { formatDuration } from './executor.js'
import { c } from '../prompt.js'
import type {
  LoopRunReport,
  LoopIterationResult,
  BackpressureResult,
  LoopReporter,
} from '../types.js'

const STOPPED_LABELS: Record<LoopRunReport['stoppedReason'], string> = {
  'max-iterations': 'reached max iterations',
  'plan-empty': 'plan exhausted',
  'backpressure-fail': 'backpressure check failed',
  'user-abort': 'aborted by user',
  error: 'agent error',
}

export function createLoopReporter(
  specName: string,
  options: { reportDir?: string; verbose?: boolean } = {},
): LoopReporter {
  const reportDir = options.reportDir ?? resolve(process.cwd(), '.opencastle', 'runs')
  const verbose = options.verbose ?? false

  return {
    onIterationStart(i: number, max: number): void {
      console.log(`\n  \u21bb Iteration ${i}/${max}`)
    },

    onIterationDone(_i: number, result: LoopIterationResult): void {
      const dur = formatDuration(result.duration)
      if (result.status === 'done') {
        console.log(`  ${c.green('\u2713')} Completed (${dur})`)
      } else if (result.status === 'backpressure-fail') {
        console.log(`  ${c.yellow('\u26a0')} Backpressure failed (${dur})`)
      } else {
        console.log(`  ${c.red('\u2717')} Failed (${dur})`)
        if (result.output) {
          const lines = result.output.split('\n').slice(0, 5)
          for (const line of lines) console.log(`    ${line}`)
          if (result.output.split('\n').length > 5) console.log(`    ... (truncated)`)
        }
      }
      if (verbose && result.output && result.status === 'done') {
        console.log(`    Output: ${result.output.slice(0, 500)}`)
      }
    },

    onBackpressureStart(cmd: string): void {
      console.log(`  \u23ce Running: ${cmd}`)
    },

    onBackpressureResult(result: BackpressureResult): void {
      if (result.passed) {
        console.log(`  ${c.green('\u2713')} Exit ${result.exitCode}`)
      } else {
        console.log(`  ${c.red('\u2717')} Exit ${result.exitCode}`)
        if (result.output) {
          const lines = result.output.split('\n').slice(0, 5)
          for (const line of lines) console.log(`    ${line}`)
        }
      }
    },

    async onComplete(report: LoopRunReport): Promise<void> {
      console.log(`\n  ${c.dim('\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500')}`)
      console.log(`  ${c.bold('Loop complete:')} ${report.name}`)
      console.log(`  Duration: ${report.duration}`)
      console.log()
      console.log(
        `  Iterations: ${report.totalIterations} total \u2014 ` +
          `${c.green(String(report.completedIterations))} completed`,
      )
      console.log(`  Stopped: ${STOPPED_LABELS[report.stoppedReason]}`)

      try {
        await mkdir(reportDir, { recursive: true })
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
        const reportPath = resolve(reportDir, `loop-${specName}-${timestamp}.json`)
        await writeFile(reportPath, JSON.stringify(report, null, 2), 'utf8')
        console.log(`  Report: ${reportPath}`)
      } catch (err: unknown) {
        console.log(`  \u2717 Could not write report: ${(err as Error).message}`)
      }

      console.log()
    },
  }
}
