import { readFile } from 'node:fs/promises'
import { spawn } from 'node:child_process'
import type { ChildProcess } from 'node:child_process'
import { resolve } from 'node:path'
import { formatDuration } from './executor.js'
import { parseTimeout } from './schema.js'
import type {
  TaskSpec,
  LoopRunReport,
  LoopIterationResult,
  BackpressureResult,
  AgentAdapter,
  LoopReporter,
  LoopExecutor,
  Task,
} from '../types.js'

interface ActiveState {
  task: Task | null
  bpChild: ChildProcess | null
}

async function runBackpressureCommand(
  command: string,
  active: ActiveState,
  timeoutMs: number,
): Promise<BackpressureResult> {
  return new Promise((res) => {
    const child = spawn('sh', ['-c', command])
    active.bpChild = child
    let output = ''
    let killed = false

    const timer = setTimeout(() => {
      killed = true
      child.kill('SIGTERM')
    }, timeoutMs)

    child.stdout.on('data', (data: Buffer) => { output += data.toString() })
    child.stderr.on('data', (data: Buffer) => { output += data.toString() })

    child.on('close', (code: number | null) => {
      clearTimeout(timer)
      active.bpChild = null
      const exitCode = code ?? 1
      if (output.length > 5000) output = output.slice(0, 5000)
      const timedOut = killed
      res({
        command,
        exitCode: timedOut ? -1 : exitCode,
        output: timedOut ? `Command timed out after ${timeoutMs}ms` : output,
        passed: !timedOut && exitCode === 0,
      })
    })
  })
}

async function runBackpressure(
  commands: string[],
  reporter: LoopReporter,
  active: ActiveState,
  timeoutMs: number,
): Promise<{ passed: boolean; results: BackpressureResult[] }> {
  const results: BackpressureResult[] = []
  for (const command of commands) {
    reporter.onBackpressureStart(command)
    const result = await runBackpressureCommand(command, active, timeoutMs)
    reporter.onBackpressureResult(result)
    results.push(result)
    if (!result.passed) return { passed: false, results }
  }
  return { passed: true, results }
}

export function createLoopExecutor(
  spec: TaskSpec,
  adapter: AgentAdapter,
  reporter: LoopReporter,
): LoopExecutor {
  return {
    async run(): Promise<LoopRunReport> {
      const loop = spec.loop!
      const startedAt = new Date()
      const iterations: LoopIterationResult[] = []
      let aborted = false
      const active: ActiveState = { task: null, bpChild: null }
      const timeoutMs = parseTimeout(loop.timeout)

      const sigintHandler = () => {
        aborted = true
        if (active.task && typeof adapter.kill === 'function') {
          adapter.kill(active.task)
        }
        if (active.bpChild && !active.bpChild.killed) {
          active.bpChild.kill('SIGTERM')
        }
      }
      process.on('SIGINT', sigintHandler)

      let stoppedReason: LoopRunReport['stoppedReason'] = 'max-iterations'

      try {
        for (let i = 1; i <= loop.max_iterations; i++) {
          if (aborted) {
            stoppedReason = 'user-abort'
            break
          }

          reporter.onIterationStart(i, loop.max_iterations)

          // Re-read prompt from disk each iteration for latest content
          const promptContent = await readFile(resolve(process.cwd(), loop.prompt), 'utf8')

          const syntheticTask: Task = {
            id: `loop-${i}`,
            prompt: promptContent,
            agent: 'autonomous',
            timeout: loop.timeout,
            depends_on: [],
            files: [],
            description: `Loop iteration ${i}`,
            max_retries: 1,
          }

          const iterStart = Date.now()
          active.task = syntheticTask
          const adapterResult = await adapter.execute(syntheticTask, { verbose: spec._verbose })
          active.task = null

          if (!adapterResult.success) {
            const duration = Date.now() - iterStart
            const iterResult: LoopIterationResult = {
              iteration: i,
              status: 'failed',
              duration,
              output: adapterResult.output,
              backpressureResults: [],
            }
            iterations.push(iterResult)
            reporter.onIterationDone(i, iterResult)
            stoppedReason = 'error'
            break
          }

          let backpressureResults: BackpressureResult[] = []
          if (loop.backpressure && loop.backpressure.length > 0) {
            const bp = await runBackpressure(loop.backpressure, reporter, active, timeoutMs)
            backpressureResults = bp.results
            if (!bp.passed) {
              const duration = Date.now() - iterStart
              const iterResult: LoopIterationResult = {
                iteration: i,
                status: 'backpressure-fail',
                duration,
                output: adapterResult.output,
                backpressureResults,
              }
              iterations.push(iterResult)
              reporter.onIterationDone(i, iterResult)
              stoppedReason = 'backpressure-fail'
              break
            }
          }

          const duration = Date.now() - iterStart
          const iterResult: LoopIterationResult = {
            iteration: i,
            status: 'done',
            duration,
            output: adapterResult.output,
            backpressureResults,
          }
          iterations.push(iterResult)
          reporter.onIterationDone(i, iterResult)
        }
      } finally {
        process.off('SIGINT', sigintHandler)
      }

      const completedAt = new Date()
      const completedIterations = iterations.filter((it) => it.status === 'done').length

      const report: LoopRunReport = {
        name: spec.name,
        mode: 'loop',
        startedAt: startedAt.toISOString(),
        completedAt: completedAt.toISOString(),
        duration: formatDuration(completedAt.getTime() - startedAt.getTime()),
        totalIterations: iterations.length,
        completedIterations,
        stoppedReason,
        iterations,
      }

      await reporter.onComplete(report)
      return report
    },
  }
}
