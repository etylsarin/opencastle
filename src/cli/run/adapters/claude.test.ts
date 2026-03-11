import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync, existsSync, readFileSync, realpathSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { EventEmitter } from 'node:events'
import type { Task } from '../../types.js'

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeTask(): Task {
  return {
    id: 'test-task',
    agent: 'developer',
    prompt: 'Do something',
    files: [],
    timeout: '5m',
    depends_on: [],
    description: 'test task',
    max_retries: 0,
  } as unknown as Task
}

function makeMockProc(exitCode = 0, stdoutData = '{"result":"ok"}') {
  const proc = new EventEmitter() as EventEmitter & {
    stdout: EventEmitter
    stderr: EventEmitter
    killed: boolean
    kill: ReturnType<typeof vi.fn>
  }
  proc.stdout = new EventEmitter()
  proc.stderr = new EventEmitter()
  proc.killed = false
  proc.kill = vi.fn()
  process.nextTick(() => {
    if (stdoutData) proc.stdout.emit('data', Buffer.from(stdoutData))
    proc.emit('close', exitCode)
  })
  return proc
}

// ── SDK mode ──────────────────────────────────────────────────────────────────

describe('claude adapter — SDK mode', () => {
  let mockCreateSession: ReturnType<typeof vi.fn>
  let mockSession: {
    sendAndWait: ReturnType<typeof vi.fn>
    on: ReturnType<typeof vi.fn>
    destroy: ReturnType<typeof vi.fn>
    abort: ReturnType<typeof vi.fn>
  }

  beforeEach(() => {
    vi.resetModules()
    mockSession = {
      sendAndWait: vi.fn().mockResolvedValue({ data: { content: 'I did the task' } }),
      on: vi.fn(),
      destroy: vi.fn().mockResolvedValue(undefined),
      abort: vi.fn().mockResolvedValue(undefined),
    }
    mockCreateSession = vi.fn().mockResolvedValue(mockSession)
    vi.doMock('@anthropic-ai/agent-sdk', () => {
      // Must use a regular function (not arrow) so `new AgentClient()` works
      function MockAgentClient(this: Record<string, unknown>) {
        this.start = vi.fn().mockResolvedValue(undefined)
        this.createSession = mockCreateSession
      }
      return {
        AgentClient: MockAgentClient,
        approveAll: vi.fn(),
      }
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('passes mcpServers to createSession when provided', async () => {
    const { execute } = await import('./claude.js')
    const mcpServers = [{ name: 'my-mcp', type: 'local', command: 'node', args: ['server.js'] }]
    await execute(makeTask(), { mcpServers })
    expect(mockCreateSession).toHaveBeenCalledWith(
      expect.objectContaining({ mcpServers }),
    )
  })

  it('does NOT include mcpServers in createSession when not provided', async () => {
    const { execute } = await import('./claude.js')
    await execute(makeTask(), {})
    const callArg = mockCreateSession.mock.calls[0]?.[0] as Record<string, unknown>
    expect(callArg).not.toHaveProperty('mcpServers')
  })

  it('does NOT include mcpServers when mcpServers is empty array', async () => {
    const { execute } = await import('./claude.js')
    await execute(makeTask(), { mcpServers: [] })
    const callArg = mockCreateSession.mock.calls[0]?.[0] as Record<string, unknown>
    expect(callArg).not.toHaveProperty('mcpServers')
  })
})

// ── CLI mode ──────────────────────────────────────────────────────────────────

describe('claude adapter — CLI mode', () => {
  let tmpDir: string
  let mockSpawn: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.resetModules()
    tmpDir = realpathSync(mkdtempSync(join(tmpdir(), 'claude-test-')))

    mockSpawn = vi.fn().mockImplementation((cmd: string) => {
      if (cmd === 'which') return makeMockProc(0, '')
      return makeMockProc(0, '{"result":"ok"}')
    })
    vi.doMock('node:child_process', () => ({ spawn: mockSpawn }))
  })

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true })
    vi.restoreAllMocks()
  })

  it('writes mcp.json to cwd with correct format when mcpServers provided', async () => {
    let capturedContent: string | null = null
    mockSpawn.mockImplementation((cmd: string) => {
      if (cmd === 'which') return makeMockProc(0, '')
      const mcpPath = join(tmpDir, 'mcp.json')
      if (existsSync(mcpPath)) {
        capturedContent = readFileSync(mcpPath, 'utf8')
      }
      return makeMockProc(0, '{}')
    })

    const { executeViaCli } = await import('./claude.js')
    const mcpServers = [{ name: 'my-mcp', type: 'local', command: 'node', args: ['server.js'] }]
    await executeViaCli(makeTask(), { mcpServers, cwd: tmpDir })

    expect(capturedContent).not.toBeNull()
    expect(JSON.parse(capturedContent!)).toEqual({
      mcpServers: { 'my-mcp': { command: 'node', args: ['server.js'] } },
    })
  })

  it('passes --mcp-config flag pointing to mcp.json path', async () => {
    const capturedArgs: string[] = []
    mockSpawn.mockImplementation((cmd: string, args: string[]) => {
      if (cmd === 'which') return makeMockProc(0, '')
      capturedArgs.push(...args)
      return makeMockProc(0, '{}')
    })
    const { executeViaCli } = await import('./claude.js')
    const mcpServers = [{ name: 'my-mcp', type: 'local', command: 'node', args: ['server.js'] }]
    await executeViaCli(makeTask(), { mcpServers, cwd: tmpDir })

    const idx = capturedArgs.indexOf('--mcp-config')
    expect(idx).toBeGreaterThanOrEqual(0)
    expect(capturedArgs[idx + 1]).toBe(join(tmpDir, 'mcp.json'))
  })

  it('cleans up mcp.json after successful execution', async () => {
    const { executeViaCli } = await import('./claude.js')
    const mcpServers = [{ name: 'my-mcp', type: 'local', command: 'node', args: ['server.js'] }]
    await executeViaCli(makeTask(), { mcpServers, cwd: tmpDir })
    expect(existsSync(join(tmpDir, 'mcp.json'))).toBe(false)
  })

  it('cleans up mcp.json after failed execution (non-zero exit)', async () => {
    mockSpawn.mockImplementation((cmd: string) => {
      if (cmd === 'which') return makeMockProc(0, '')
      return makeMockProc(1, '')
    })
    const { executeViaCli } = await import('./claude.js')
    const mcpServers = [{ name: 'err-mcp', type: 'local', command: 'node', args: [] }]
    await executeViaCli(makeTask(), { mcpServers, cwd: tmpDir })
    expect(existsSync(join(tmpDir, 'mcp.json'))).toBe(false)
  })

  it('includes --approve-mcps flag when mcp_approve_all is true', async () => {
    const capturedArgs: string[] = []
    mockSpawn.mockImplementation((cmd: string, args: string[]) => {
      if (cmd === 'which') return makeMockProc(0, '')
      capturedArgs.push(...args)
      return makeMockProc(0, '{}')
    })
    const { executeViaCli } = await import('./claude.js')
    await executeViaCli(makeTask(), { mcp_approve_all: true, cwd: tmpDir })
    expect(capturedArgs).toContain('--approve-mcps')
  })

  it('does NOT write mcp.json when mcpServers not configured', async () => {
    const { executeViaCli } = await import('./claude.js')
    await executeViaCli(makeTask(), { cwd: tmpDir })
    expect(existsSync(join(tmpDir, 'mcp.json'))).toBe(false)
  })

  it('does NOT add --approve-mcps when mcp_approve_all is not set', async () => {
    const capturedArgs: string[] = []
    mockSpawn.mockImplementation((cmd: string, args: string[]) => {
      if (cmd === 'which') return makeMockProc(0, '')
      capturedArgs.push(...args)
      return makeMockProc(0, '{}')
    })
    const { executeViaCli } = await import('./claude.js')
    await executeViaCli(makeTask(), { cwd: tmpDir })
    expect(capturedArgs).not.toContain('--approve-mcps')
  })

  it('maps mcpServers with url and config into mcp.json', async () => {
    let capturedContent: string | null = null
    mockSpawn.mockImplementation((cmd: string) => {
      if (cmd === 'which') return makeMockProc(0, '')
      const mcpPath = join(tmpDir, 'mcp.json')
      if (existsSync(mcpPath)) capturedContent = readFileSync(mcpPath, 'utf8')
      return makeMockProc(0, '{}')
    })
    const { executeViaCli } = await import('./claude.js')
    const mcpServers = [
      {
        name: 'remote-mcp',
        type: 'remote',
        url: 'http://localhost:9000',
        config: { token: 'abc' },
      },
    ]
    await executeViaCli(makeTask(), { mcpServers, cwd: tmpDir })
    expect(capturedContent).not.toBeNull()
    const parsed = JSON.parse(capturedContent!) as { mcpServers: Record<string, Record<string, unknown>> }
    expect(parsed.mcpServers['remote-mcp']).toMatchObject({
      url: 'http://localhost:9000',
      token: 'abc',
    })
  })
})