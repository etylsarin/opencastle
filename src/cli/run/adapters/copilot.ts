import { spawn } from 'node:child_process'
import type { CopilotClient as CopilotClientType, CopilotSession, PermissionHandler } from '@github/copilot-sdk'
import { parseTimeout } from '../schema.js'
import type { Task, ExecuteOptions, ExecuteResult } from '../../types.js'

/** Adapter name */
export const name = 'copilot'

/**
 * Lazy-initialized shared client instance.
 * The client manages a single Copilot CLI server process; all task sessions
 * multiplex over it via JSON-RPC.
 */
let clientPromise: Promise<CopilotClientType> | null = null

/** Cached permission handler from the SDK module. */
let cachedApproveAll: PermissionHandler | null = null

/** Active sessions keyed by task id — used by `kill()` for timeout enforcement. */
const activeSessions = new Map<string, CopilotSession>()

/**
 * Check if the `copilot` CLI is available on the system PATH.
 * The SDK communicates with the CLI in server mode, so it must be installed.
 */
export async function isAvailable(): Promise<boolean> {
  return new Promise((resolve) => {
    const proc = spawn('which', ['copilot'], { stdio: 'pipe' })
    proc.on('close', (code) => resolve(code === 0))
    proc.on('error', () => resolve(false))
  })
}

/**
 * Get or create the shared CopilotClient.
 * The client is started once and reused across all task executions.
 */
async function getClient(): Promise<CopilotClientType> {
  if (!clientPromise) {
    clientPromise = (async () => {
      const { CopilotClient, approveAll } = await import('@github/copilot-sdk')
      cachedApproveAll = approveAll
      const client = new CopilotClient({
        autoStart: false,
        logLevel: 'error',
      })
      await client.start()
      return client
    })()
  }
  return clientPromise
}

/**
 * Execute a task using the Copilot SDK.
 *
 * Each task gets its own session with:
 *   - All tool permissions auto-approved (equivalent to `--allow-all-tools`)
 *   - No `ask_user` tool (autonomous — equivalent to `--no-ask-user`)
 *   - System message injected with the agent role
 *   - Streaming enabled in verbose mode for live output
 */
export async function execute(task: Task, options: ExecuteOptions = {}): Promise<ExecuteResult> {
  // NOTE: The Copilot SDK CopilotClient is a shared singleton. Per-task cwd
  // isolation requires SDK support for per-session workingDirectory, which is
  // not yet available. When running in convoy mode with worktrees, prefer
  // subprocess-based adapters (claude-code, cursor) that support options.cwd
  // natively. Copilot SDK per-session cwd support is tracked for Phase 3.
  let prompt = `You are a ${task.agent}. ${task.prompt}`

  if (task.files && task.files.length > 0) {
    prompt += `\n\nOnly modify files under: ${task.files.join(', ')}`
  }

  const client = await getClient()

  const session = await client.createSession({
    onPermissionRequest: cachedApproveAll!,
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

  // Stream deltas to stdout in verbose mode
  if (options.verbose) {
    session.on('assistant.message_delta', (event: { data: { deltaContent: string } }) => {
      process.stdout.write(event.data.deltaContent)
    })
  }

  try {
    const timeoutMs = parseTimeout(task.timeout)
    const response = await session.sendAndWait({ prompt }, timeoutMs)
    const output = response?.data?.content ?? ''
    const rawUsage = (response?.data as Record<string, unknown> | undefined)?.usage ?? (response as Record<string, unknown> | undefined)?.usage
    const u = rawUsage as Record<string, number> | undefined
    const usageResult = u ? {
      prompt_tokens: u.prompt_tokens ?? u.promptTokens,
      completion_tokens: u.completion_tokens ?? u.completionTokens,
      total_tokens: u.total_tokens ?? u.totalTokens,
    } : undefined

    return {
      success: true,
      output: output.slice(0, 10_000),
      exitCode: 0,
      usage: usageResult,
    }
  } catch (err: unknown) {
    return {
      success: false,
      output: `Copilot SDK error: ${(err as Error).message}`,
      exitCode: 1,
    }
  } finally {
    activeSessions.delete(task.id)
    await session.destroy().catch(() => {})
  }
}

/**
 * Abort and destroy the session associated with a task.
 * Called by the executor when a task exceeds its timeout.
 */
export function kill(task: Task): void {
  const session = activeSessions.get(task.id)
  if (session) {
    session.abort().catch(() => {})
    session.destroy().catch(() => {})
    activeSessions.delete(task.id)
  }
}
