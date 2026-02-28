/* global process, setTimeout */
import { spawn } from 'node:child_process'

/** Adapter name */
export const name = 'copilot'

/**
 * Check if the `copilot` CLI is available on the system PATH.
 * @returns {Promise<boolean>}
 */
export async function isAvailable() {
  return new Promise((resolve) => {
    const proc = spawn('which', ['copilot'], { stdio: 'pipe' })
    proc.on('close', (code) => resolve(code === 0))
    proc.on('error', () => resolve(false))
  })
}

/**
 * Execute a task by invoking the Copilot CLI in autopilot mode.
 * @param {object} task - Task object with id, agent, prompt, files, timeout
 * @param {object} options - { verbose }
 * @returns {Promise<{ success: boolean, output: string, exitCode: number }>}
 */
export async function execute(task, options = {}) {
  let prompt = `You are a ${task.agent}. ${task.prompt}`

  if (task.files && task.files.length > 0) {
    prompt += `\n\nOnly modify files under: ${task.files.join(', ')}`
  }

  const args = [
    '-p',
    prompt,
    '--autopilot',
    '--allow-all-tools',
    '--no-ask-user',
    '-s',
    '--max-autopilot-continues',
    '50',
  ]

  return new Promise((resolve) => {
    const proc = spawn('copilot', args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env },
      cwd: process.cwd(),
    })

    let stdout = ''
    let stderr = ''

    proc.stdout.on('data', (chunk) => {
      stdout += chunk.toString()
      if (options.verbose) {
        process.stdout.write(chunk)
      }
    })

    proc.stderr.on('data', (chunk) => {
      stderr += chunk.toString()
      if (options.verbose) {
        process.stderr.write(chunk)
      }
    })

    proc.on('close', (code) => {
      const output = [stdout, stderr].filter(Boolean).join('\n')
      resolve({
        success: code === 0,
        output: output.slice(0, 10000), // Cap output size
        exitCode: code,
      })
    })

    proc.on('error', (err) => {
      resolve({
        success: false,
        output: `Failed to spawn copilot: ${err.message}`,
        exitCode: -1,
      })
    })

    // Store process ref for potential timeout kill
    task._process = proc
  })
}

/**
 * Kill the process associated with a task (used by timeout enforcement).
 * @param {object} task
 */
export function kill(task) {
  if (task._process && !task._process.killed) {
    task._process.kill('SIGTERM')
    setTimeout(() => {
      if (task._process && !task._process.killed) {
        task._process.kill('SIGKILL')
      }
    }, 5000)
  }
}
