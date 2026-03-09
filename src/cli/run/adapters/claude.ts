import { spawn } from 'node:child_process'
import { parseTimeout } from '../schema.js'
import type { Task, ExecuteOptions, ExecuteResult, TokenUsage } from '../../types.js'

// Adapter name
export const name = 'claude'

// Module-level state for mode selection
let mode: 'sdk' | 'cli' | null = null

// SDK dynamic import check
async function sdkAvailable(): Promise<boolean> {
  try {
    await import('@anthropic-ai/agent-sdk')
    return true
  } catch {
    return false
  }
}

// CLI check
async function cliAvailable(): Promise<boolean> {
  return new Promise((resolve) => {
    const proc = spawn('which', ['claude'], { stdio: 'pipe' })
    proc.on('close', (code) => resolve(code === 0))
    proc.on('error', () => resolve(false))
  })
}

export async function isAvailable(): Promise<boolean> {
  if (await sdkAvailable()) {
    mode = 'sdk'
    return true
  }
  if (await cliAvailable()) {
    mode = 'cli'
    return true
  }
  return false
}

// --- SDK implementation (from claude-sdk.ts) ---
// Local type stubs for @anthropic-ai/agent-sdk
interface AgentSession {
  on(event: string, handler: (...args: unknown[]) => void): void
  sendAndWait(msg: { prompt: string }, timeoutMs: number): Promise<unknown>
  abort(): Promise<void>
  destroy(): Promise<void>
}
interface SessionCreateOptions {
  onPermissionRequest?: unknown
  cwd?: string
  systemMessage?: { content: string }
  infiniteSessions?: { enabled: boolean }
  streaming?: boolean
}
interface ClaudeAgentClient {
  start(): Promise<void>
  createSession(options: SessionCreateOptions): Promise<AgentSession>
}
let clientPromise: Promise<ClaudeAgentClient> | null = null
let cachedApproveAll: unknown = null
const activeSessions = new Map<string, AgentSession>()

async function getClient(): Promise<ClaudeAgentClient> {
  if (!clientPromise) {
    clientPromise = (async () => {
      const sdk = await import('@anthropic-ai/agent-sdk') as Record<string, unknown>
      const { AgentClient, approveAll } = sdk as {
        AgentClient: new (opts: { autoStart: boolean; logLevel: string }) => ClaudeAgentClient
        approveAll: unknown
      }
      cachedApproveAll = approveAll
      const client = new AgentClient({
        autoStart: false,
        logLevel: 'error',
      })
      await client.start()
      return client
    })()
  }
  return clientPromise
}

async function executeViaSdk(task: Task, options: ExecuteOptions = {}): Promise<ExecuteResult> {
  let prompt = `You are a ${task.agent}. ${task.prompt}`
  if (task.files && task.files.length > 0) {
    prompt += `\n\nOnly modify files under: ${task.files.join(', ')}`
  }
  const client = await getClient()
  const session = await client.createSession({
    onPermissionRequest: cachedApproveAll!,
    cwd: options.cwd ?? process.cwd(),
    systemMessage: {
      content: [
        `You are a ${task.agent}.`,
        'Work autonomously without asking questions.',
        'Follow all instructions precisely.',
      ].join(' '),
    },
    infiniteSessions: { enabled: false },
    ...(options.verbose ? { streaming: true } : {}),
  })
  activeSessions.set(task.id, session)
  if (options.verbose) {
    session.on('assistant.message_delta', (...args: unknown[]) => {
      const event = args[0] as { data: { deltaContent: string } }
      process.stdout.write(event.data.deltaContent)
    })
  }
  try {
    const timeoutMs = parseTimeout(task.timeout)
    const response = await session.sendAndWait({ prompt }, timeoutMs)
    const data = (response as any)?.data as Record<string, unknown> | undefined
    const output = (data?.content as string | undefined) ?? ''
    const rawUsage = data?.usage ?? (response as any)?.usage
    const u = rawUsage as Record<string, number> | undefined
    const usageResult = u
      ? {
          prompt_tokens: u.prompt_tokens ?? u.promptTokens,
          completion_tokens: u.completion_tokens ?? u.completionTokens,
          total_tokens: u.total_tokens ?? u.totalTokens,
        }
      : undefined
    return {
      success: true,
      output: output.slice(0, 10_000),
      exitCode: 0,
      usage: usageResult,
    }
  } catch (err: unknown) {
    return {
      success: false,
      output: `Claude Agent SDK error: ${(err as Error).message}`,
      exitCode: 1,
    }
  } finally {
    activeSessions.delete(task.id)
    await session.destroy().catch(() => {})
  }
}

function killSdk(task: Task): void {
  const session = activeSessions.get(task.id)
  if (session) {
    session.abort().catch(() => {})
    session.destroy().catch(() => {})
    activeSessions.delete(task.id)
  }
}

// --- CLI implementation (from claude-code.ts) ---
async function executeViaCli(task: Task, options: ExecuteOptions = {}): Promise<ExecuteResult> {
  let prompt = `You are a ${task.agent}. ${task.prompt}`
  if (task.files && task.files.length > 0) {
    prompt += `\n\nOnly modify files under: ${task.files.join(', ')}`
  }
  const args = [
    '-p',
    prompt,
    '--output-format',
    'json',
    '--max-turns',
    '50',
  ]
  return new Promise((resolve) => {
    const proc = spawn('claude', args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env },
      cwd: options?.cwd ?? process.cwd(),
    })
    let stdout = ''
    let stderr = ''
    proc.stdout.on('data', (chunk: Buffer) => {
      stdout += chunk.toString()
      if (options.verbose) {
        process.stdout.write(chunk)
      }
    })
    proc.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString()
      if (options.verbose) {
        process.stderr.write(chunk)
      }
    })
    proc.on('close', (code) => {
      const output = [stdout, stderr].filter(Boolean).join('\n')
      let usage: TokenUsage | undefined
      try {
        const parsedJson = JSON.parse(stdout) as Record<string, unknown>
        const u = parsedJson?.usage as Record<string, number> | undefined
        if (u) {
          const promptTokens = (u.input_tokens ?? u.prompt_tokens) as number | undefined
          const completionTokens = (u.output_tokens ?? u.completion_tokens) as number | undefined
          const total = ((promptTokens ?? 0) + (completionTokens ?? 0)) || undefined
          usage = { prompt_tokens: promptTokens, completion_tokens: completionTokens, total_tokens: total }
        }
      } catch { /* not JSON or no usage — graceful degradation */ }
      resolve({
        success: code === 0,
        output: output.slice(0, 10000),
        exitCode: code ?? -1,
        usage,
      })
    })
    proc.on('error', (err) => {
      resolve({
        success: false,
        output: `Failed to spawn claude: ${err.message}`,
        exitCode: -1,
      })
    })
    task._process = proc
  })
}

function killCli(task: Task): void {
  if (task._process && !task._process.killed) {
    task._process.kill('SIGTERM')
    setTimeout(() => {
      if (task._process && !task._process.killed) {
        task._process.kill('SIGKILL')
      }
    }, 5000)
  }
}

// --- Unified interface ---
export async function execute(task: Task, options: ExecuteOptions = {}): Promise<ExecuteResult> {
  if (!mode) await isAvailable()
  if (mode === 'sdk') return executeViaSdk(task, options)
  return executeViaCli(task, options)
}

export function kill(task: Task): void {
  if (mode === 'sdk') killSdk(task)
  else killCli(task)
}