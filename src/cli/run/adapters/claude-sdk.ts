import { parseTimeout } from '../schema.js'
import type { Task, ExecuteOptions, ExecuteResult } from '../../types.js'

// ── Local type stubs for @anthropic-ai/agent-sdk (optional peer dependency) ──
// These mirror the SDK's public surface. When the package is installed, the
// dynamic import values will conform to these shapes at runtime.

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

/** Adapter name */
export const name = 'claude-sdk'

/**
 * Lazy-initialized shared client instance.
 * The client manages communication with the Claude Agent SDK; all task
 * sessions are created from it.
 */
let clientPromise: Promise<ClaudeAgentClient> | null = null

/** Cached permission handler from the SDK module. */
let cachedApproveAll: unknown = null

/** Active sessions keyed by task id — used by `kill()` for timeout enforcement. */
const activeSessions = new Map<string, AgentSession>()

/**
 * Check if the `@anthropic-ai/agent-sdk` package is installed.
 * Uses dynamic import so no hard dependency is required — the adapter
 * gracefully returns false if the package is absent.
 */
export async function isAvailable(): Promise<boolean> {
  try {
    await (import('@anthropic-ai/agent-sdk') as Promise<unknown>)
    return true
  } catch {
    return false
  }
}

/**
 * Get or create the shared AgentClient.
 * The client is started once and reused across all task executions.
 */
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

/**
 * Execute a task using the Claude Agent SDK.
 *
 * Each task gets its own session with:
 *   - All tool permissions auto-approved
 *   - Per-session cwd for worktree isolation (key advantage over Copilot SDK)
 *   - System message injected with the agent role
 *   - Streaming enabled in verbose mode for live output
 */
export async function execute(task: Task, options: ExecuteOptions = {}): Promise<ExecuteResult> {
  let prompt = `You are a ${task.agent}. ${task.prompt}`

  if (task.files && task.files.length > 0) {
    prompt += `\n\nOnly modify files under: ${task.files.join(', ')}`
  }

  const client = await getClient()

  const session = await client.createSession({
    onPermissionRequest: cachedApproveAll!,
    // cwd is supported per-session in the Claude Agent SDK — this is the key
    // differentiator from the Copilot SDK which lacks per-session workingDirectory.
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

  // Stream deltas to stdout in verbose mode
  if (options.verbose) {
    session.on('assistant.message_delta', (...args: unknown[]) => {
      const event = args[0] as { data: { deltaContent: string } }
      process.stdout.write(event.data.deltaContent)
    })
  }

  try {
    const timeoutMs = parseTimeout(task.timeout)
    const response = await session.sendAndWait({ prompt }, timeoutMs) as Record<string, unknown>
    const data = response?.data as Record<string, unknown> | undefined
    const output = (data?.content as string | undefined) ?? ''
    const rawUsage = data?.usage ?? response?.usage
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
