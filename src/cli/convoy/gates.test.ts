import { mkdtempSync, rmSync, writeFileSync, existsSync, readFileSync, mkdirSync, realpathSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { deflateSync } from 'node:zlib'
import { EventEmitter } from 'node:events'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  scanForSecrets,
  withSecretScan,
  runBlastRadiusGate,
  runGateCommand,
  browserTestGate,
  runA11yAudit,
  _setAllowlistConfigPath,
  _resetAllowlistCache,
  pixelDiffPercentage,
  computeVisualDiff,
  captureAndPersistBaseline,
  mapA11ySeverity,
  type A11yFinding,
} from './gates.js'

// ── Mock child_process for timeout tests ──────────────────────────────────────

vi.mock('node:child_process', () => ({
  spawn: vi.fn(),
}))

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeFakeChild() {
  const proc = new EventEmitter() as NodeJS.EventEmitter & {
    stdout: EventEmitter
    stderr: EventEmitter
    kill: ReturnType<typeof vi.fn>
  }
  Object.assign(proc, {
    stdout: new EventEmitter(),
    stderr: new EventEmitter(),
    kill: vi.fn(),
  })
  return proc
}

// ── scanForSecrets ────────────────────────────────────────────────────────────

describe('scanForSecrets', () => {
  beforeEach(() => {
    _resetAllowlistCache()
    _setAllowlistConfigPath('/nonexistent/path/does/not/exist.yml')
  })

  it('returns clean result for safe content', () => {
    const result = scanForSecrets('const x = 1\nconsole.log(x)\n// no secrets here')
    expect(result.clean).toBe(true)
    expect(result.findings).toHaveLength(0)
  })

  it('detects AWS Access Key', () => {
    const result = scanForSecrets('key: AKIAIOSFODNN7EXAMPLE')
    expect(result.clean).toBe(false)
    expect(result.findings[0].pattern).toBe('AWS Access Key')
    expect(result.findings[0].line).toBe(1)
  })

  it('detects AWS Secret Key', () => {
    const result = scanForSecrets(
      'aws_secret_access_key: wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
    )
    expect(result.clean).toBe(false)
    expect(result.findings[0].pattern).toBe('AWS Secret Key')
  })

  it('detects Generic API Key', () => {
    const result = scanForSecrets('apikey: Xb3kR7mNpQvZwY4hJcFe9ABCDE')
    expect(result.clean).toBe(false)
    expect(result.findings[0].pattern).toBe('Generic API Key')
  })

  it('detects Bearer Token', () => {
    const result = scanForSecrets('Authorization: Bearer eyJhbGciOiJIUzI1NiJ9.payload.sig')
    expect(result.clean).toBe(false)
    expect(result.findings[0].pattern).toBe('Bearer Token')
  })

  it('detects Private Key header', () => {
    const result = scanForSecrets('-----BEGIN RSA PRIVATE KEY-----')
    expect(result.clean).toBe(false)
    expect(result.findings[0].pattern).toBe('Private Key')
  })

  it('detects Connection String', () => {
    const result = scanForSecrets('postgres://dbuser:s3cr3tpass@localhost:5432/mydb')
    expect(result.clean).toBe(false)
    expect(result.findings[0].pattern).toBe('Connection String')
  })

  it('detects GitHub Token', () => {
    const result = scanForSecrets(
      'token: ghp_abcdefghijklmnopqrstuvwxyz12345678ABCD',
    )
    expect(result.clean).toBe(false)
    expect(result.findings[0].pattern).toBe('GitHub Token')
  })

  it('detects Generic Password', () => {
    const result = scanForSecrets('password: Sup3rS3cur3Pass')
    expect(result.clean).toBe(false)
    expect(result.findings[0].pattern).toBe('Generic Password')
  })

  it('detects Slack Token', () => {
    const result = scanForSecrets('xoxb-12345678901-ABCDEFGHIJKLM')
    expect(result.clean).toBe(false)
    expect(result.findings[0].pattern).toBe('Slack Token')
  })

  it('detects Generic Secret', () => {
    const result = scanForSecrets('secret: my_unique_sec_token_value_1234')
    expect(result.clean).toBe(false)
    expect(result.findings[0].pattern).toBe('Generic Secret')
  })

  it('includes file and line info in findings', () => {
    const result = scanForSecrets('ok line\npassword: s3cur3P4ssw0rd\n', 'src/config.ts')
    expect(result.findings[0].file).toBe('src/config.ts')
    expect(result.findings[0].line).toBe(2)
  })

  it('truncates long line snippet to ~100 chars', () => {
    const longLine = 'password: ' + 'x'.repeat(200)
    const result = scanForSecrets(longLine)
    expect(result.findings[0].snippet.length).toBeLessThanOrEqual(103)
  })
})

// ── withSecretScan ────────────────────────────────────────────────────────────

describe('withSecretScan', () => {
  beforeEach(() => {
    _resetAllowlistCache()
    _setAllowlistConfigPath('/nonexistent/path/does/not/exist.yml')
  })

  it('calls writeAction when content is clean', () => {
    const writeAction = vi.fn()
    const onBlock = vi.fn()
    withSecretScan('const x = 1', writeAction, onBlock)
    expect(writeAction).toHaveBeenCalledOnce()
    expect(onBlock).not.toHaveBeenCalled()
  })

  it('calls onBlock with findings when secrets are detected', () => {
    const writeAction = vi.fn()
    const onBlock = vi.fn()
    withSecretScan('key: AKIAIOSFODNN7EXAMPLE', writeAction, onBlock)
    expect(writeAction).not.toHaveBeenCalled()
    expect(onBlock).toHaveBeenCalledOnce()
    const findings = onBlock.mock.calls[0][0] as Array<{ pattern: string }>
    expect(findings[0].pattern).toBe('AWS Access Key')
  })
})

// ── Allowlist config ──────────────────────────────────────────────────────────

describe('allowlist config', () => {
  let tmpDir: string

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'gates-test-'))
    _resetAllowlistCache()
  })

  afterEach(() => {
    _resetAllowlistCache()
    rmSync(tmpDir, { recursive: true, force: true })
  })

  it('pattern+paths suppresses findings in matching file', () => {
    const configPath = join(tmpDir, 'secret-scan-config.yml')
    writeFileSync(
      configPath,
      'allowlist:\n  - pattern: "AKIA[0-9A-Z]{16}"\n    reason: "test key"\n    paths:\n      - ".test."\n',
    )
    _setAllowlistConfigPath(configPath)
    const result = scanForSecrets('key: AKIAIOSFODNN7EXAMPLE', 'src/my.test.ts')
    expect(result.clean).toBe(true)
  })

  it('pattern+paths does NOT suppress in non-matching file', () => {
    const configPath = join(tmpDir, 'secret-scan-config.yml')
    writeFileSync(
      configPath,
      'allowlist:\n  - pattern: "AKIA[0-9A-Z]{16}"\n    reason: "test key"\n    paths:\n      - ".test."\n',
    )
    _setAllowlistConfigPath(configPath)
    const result = scanForSecrets('key: AKIAIOSFODNN7EXAMPLE', 'src/config.ts')
    expect(result.clean).toBe(false)
  })

  it('literal suppresses exact string match in any file', () => {
    const configPath = join(tmpDir, 'secret-scan-config.yml')
    writeFileSync(
      configPath,
      'allowlist:\n  - literal: "AKIAIOSFODNN7EXAMPLE"\n    reason: "example key in docs"\n',
    )
    _setAllowlistConfigPath(configPath)
    const result = scanForSecrets('key: AKIAIOSFODNN7EXAMPLE', 'src/config.ts')
    expect(result.clean).toBe(true)
  })

  it('literal without paths applies across all files', () => {
    const configPath = join(tmpDir, 'secret-scan-config.yml')
    writeFileSync(
      configPath,
      'allowlist:\n  - literal: "AKIAIOSFODNN7EXAMPLE"\n    reason: "example key"\n',
    )
    _setAllowlistConfigPath(configPath)
    // Should suppress in any file
    expect(scanForSecrets('key: AKIAIOSFODNN7EXAMPLE', 'src/any.ts').clean).toBe(true)
    expect(scanForSecrets('key: AKIAIOSFODNN7EXAMPLE', 'README.md').clean).toBe(true)
  })
})

// ── runBlastRadiusGate ────────────────────────────────────────────────────────

describe('runBlastRadiusGate', () => {
  it('passes (ok) under all thresholds', () => {
    const diff = Array(100).fill('+const x = 1').join('\n')
    const result = runBlastRadiusGate(diff)
    expect(result.passed).toBe(true)
    expect(result.level).toBe('ok')
  })

  it('warns (passed=true) at exactly 200 lines changed', () => {
    const diff = Array(200).fill('+const x = 1').join('\n')
    const result = runBlastRadiusGate(diff)
    expect(result.passed).toBe(true)
    expect(result.level).toBe('warn')
  })

  it('warns at 201 lines changed', () => {
    const diff = Array(201).fill('+const x = 1').join('\n')
    const result = runBlastRadiusGate(diff)
    expect(result.passed).toBe(true)
    expect(result.level).toBe('warn')
  })

  it('blocks (passed=false) at exactly 500 lines changed', () => {
    const diff = Array(500).fill('+const x = 1').join('\n')
    const result = runBlastRadiusGate(diff)
    expect(result.passed).toBe(false)
    expect(result.level).toBe('block')
  })

  it('blocks at 501 lines changed', () => {
    const diff = Array(501).fill('+const x = 1').join('\n')
    const result = runBlastRadiusGate(diff)
    expect(result.passed).toBe(false)
    expect(result.level).toBe('block')
  })

  it('warns at exactly 5 files changed', () => {
    const diff = Array.from(
      { length: 5 },
      (_, i) => `diff --git a/file${i}.ts b/file${i}.ts\n+const x = 1`,
    ).join('\n')
    const result = runBlastRadiusGate(diff)
    expect(result.passed).toBe(true)
    expect(result.level).toBe('warn')
  })

  it('blocks at 10 files changed', () => {
    const diff = Array.from(
      { length: 10 },
      (_, i) => `diff --git a/file${i}.ts b/file${i}.ts\n+const x = 1`,
    ).join('\n')
    const result = runBlastRadiusGate(diff)
    expect(result.passed).toBe(false)
    expect(result.level).toBe('block')
  })

  it('does not count +++ and --- header lines as changes', () => {
    const diff = '+++ b/file.ts\n--- a/file.ts\n+const x = 1'
    const result = runBlastRadiusGate(diff)
    expect(result.level).toBe('ok')
  })

  it('output contains line and file counts', () => {
    const diff = Array(50).fill('+const x = 1').join('\n')
    const result = runBlastRadiusGate(diff)
    expect(result.output).toContain('50 lines changed')
    expect(result.output).toContain('0 files changed')
  })
})

// ── Gate timeout: SIGTERM then SIGKILL ────────────────────────────────────────

describe('gate timeout', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.clearAllMocks()
  })

  it('sends SIGTERM at timeout then SIGKILL after 5s', async () => {
    const { spawn } = await import('node:child_process')
    const mockChild = makeFakeChild()
    vi.mocked(spawn).mockReturnValue(mockChild as unknown as ReturnType<typeof spawn>)

    const resultPromise = runGateCommand('test-cmd', ['--arg'], '/tmp', 100)

    // Advance 100ms — SIGTERM should fire
    vi.advanceTimersByTime(100)
    expect(mockChild.kill).toHaveBeenCalledWith('SIGTERM')
    expect(mockChild.kill).not.toHaveBeenCalledWith('SIGKILL')

    // Advance 5s more — SIGKILL should fire
    vi.advanceTimersByTime(5_000)
    expect(mockChild.kill).toHaveBeenCalledWith('SIGKILL')

    // Settle the promise
    mockChild.emit('close', -1)
    const result = await resultPromise
    expect(result.timedOut).toBe(true)
    expect(result.exitCode).toBe(-1)
  })

  it('does NOT send SIGKILL if process closes before 5s deadline', async () => {
    const { spawn } = await import('node:child_process')
    const mockChild = makeFakeChild()
    vi.mocked(spawn).mockReturnValue(mockChild as unknown as ReturnType<typeof spawn>)

    const resultPromise = runGateCommand('test-cmd', [], '/tmp', 100)

    // Trigger SIGTERM
    vi.advanceTimersByTime(100)
    expect(mockChild.kill).toHaveBeenCalledWith('SIGTERM')

    // Process closes immediately after SIGTERM (before 5s)
    mockChild.emit('close', 0)
    await resultPromise

    // Advance past the 5s sigkill window — no additional kill call
    vi.advanceTimersByTime(5_000)
    expect(mockChild.kill).toHaveBeenCalledTimes(1)
  })

  it('resolves without SIGTERM when process completes before timeout', async () => {
    const { spawn } = await import('node:child_process')
    const mockChild = makeFakeChild()
    vi.mocked(spawn).mockReturnValue(mockChild as unknown as ReturnType<typeof spawn>)

    const resultPromise = runGateCommand('test-cmd', [], '/tmp', 30_000)

    // Process completes quickly
    mockChild.emit('close', 0)
    const result = await resultPromise

    expect(result.timedOut).toBe(false)
    expect(result.exitCode).toBe(0)
    expect(mockChild.kill).not.toHaveBeenCalled()
  })
})

// ── browserTestGate ───────────────────────────────────────────────────────────

describe('browserTestGate', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.clearAllMocks()
    _resetAllowlistCache()
    _setAllowlistConfigPath('/nonexistent/path/does/not/exist.yml')
  })

  const browserServer = { name: 'playwright-browser', type: 'browser', command: 'npx', args: ['playwright'] }

  it('rejects non-local URLs (SSRF prevention)', async () => {
    const resultPromise = browserTestGate({
      mcpServers: [browserServer],
      taskConfig: { urls: ['https://example.com'] },
      worktreePath: '/tmp',
    })
    vi.runAllTimersAsync()
    const result = await resultPromise
    expect(result.passed).toBe(false)
    expect(result.output).toContain('is not a local address')
  })

  it('returns fail when no browser-capable MCP server found', async () => {
    const resultPromise = browserTestGate({
      mcpServers: [],
      taskConfig: { urls: ['http://localhost:3000'] },
      worktreePath: '/tmp',
    })
    vi.runAllTimersAsync()
    const result = await resultPromise
    expect(result.passed).toBe(false)
    expect(result.output).toContain('no browser-capable MCP server found')
  })

  it('returns fail when no MCP server matches browser type', async () => {
    const resultPromise = browserTestGate({
      mcpServers: [{ name: 'my-tool', type: 'filesystem', command: 'node' }],
      taskConfig: { urls: ['http://localhost:3000'] },
      worktreePath: '/tmp',
    })
    vi.runAllTimersAsync()
    const result = await resultPromise
    expect(result.passed).toBe(false)
    expect(result.output).toContain('no browser-capable MCP server found')
  })

  it('returns pass for successful localhost HTTP check (HTTP 200)', async () => {
    const { spawn } = await import('node:child_process')
    const mockChild = makeFakeChild()
    vi.mocked(spawn).mockReturnValue(mockChild as unknown as ReturnType<typeof spawn>)

    // Server without command — so only curl is called
    const serverNoCmd = { name: 'playwright', type: 'browser' }
    const resultPromise = browserTestGate({
      mcpServers: [serverNoCmd],
      taskConfig: { urls: ['http://localhost:3000'] },
      worktreePath: '/tmp',
    })

    // Emit curl stdout (HTTP 200) and close
    mockChild.stdout.emit('data', Buffer.from('200'))
    mockChild.emit('close', 0)
    vi.runAllTimersAsync()

    const result = await resultPromise
    expect(result.passed).toBe(true)
    expect(result.output).toContain('PASS')
    expect(result.output).toContain('HTTP 200')
  })

  it('returns fail for HTTP 500 response', async () => {
    const { spawn } = await import('node:child_process')
    const mockChild = makeFakeChild()
    vi.mocked(spawn).mockReturnValue(mockChild as unknown as ReturnType<typeof spawn>)

    const serverNoCmd = { name: 'playwright', type: 'browser' }
    const resultPromise = browserTestGate({
      mcpServers: [serverNoCmd],
      taskConfig: { urls: ['http://localhost:3000'] },
      worktreePath: '/tmp',
    })

    mockChild.stdout.emit('data', Buffer.from('500'))
    mockChild.emit('close', 0)
    vi.runAllTimersAsync()

    const result = await resultPromise
    expect(result.passed).toBe(false)
    expect(result.output).toContain('FAIL')
    expect(result.output).toContain('HTTP 500')
  })

  it('returns fail when curl times out', async () => {
    const { spawn } = await import('node:child_process')
    const mockChild = makeFakeChild()
    vi.mocked(spawn).mockReturnValue(mockChild as unknown as ReturnType<typeof spawn>)

    const serverNoCmd = { name: 'playwright', type: 'browser' }
    const resultPromise = browserTestGate({
      mcpServers: [serverNoCmd],
      taskConfig: { urls: ['http://localhost:3000'] },
      worktreePath: '/tmp',
    })

    // Advance time to trigger curl timeout (35s)
    vi.advanceTimersByTime(35_000)
    mockChild.emit('close', -1)
    vi.runAllTimersAsync()

    const result = await resultPromise
    expect(result.passed).toBe(false)
    expect(result.output).toContain('timed out')
  })

  it('detects console errors when check_console_errors enabled', async () => {
    const { spawn } = await import('node:child_process')
    // First call: curl  (HTTP 200), second call: browser automation (with [console.error])
    let callCount = 0
    vi.mocked(spawn).mockImplementation(() => {
      callCount++
      const mockChild = makeFakeChild()
      if (callCount === 1) {
        // curl
        Promise.resolve().then(() => {
          mockChild.stdout.emit('data', Buffer.from('200'))
          mockChild.emit('close', 0)
        })
      } else {
        // browser automation — output contains console.error
        Promise.resolve().then(() => {
          mockChild.stdout.emit('data', Buffer.from('test passed\n[console.error] Uncaught TypeError'))
          mockChild.emit('close', 0)
        })
      }
      return mockChild as unknown as ReturnType<typeof spawn>
    })

    const resultPromise = browserTestGate({
      mcpServers: [browserServer],
      taskConfig: { urls: ['http://localhost:3000'], check_console_errors: true },
      worktreePath: '/tmp',
    })
    vi.runAllTimersAsync()

    const result = await resultPromise
    expect(result.passed).toBe(false)
    expect(result.output).toContain('Console errors detected')
  })

  it('secret-scans browser automation output', async () => {
    const { spawn } = await import('node:child_process')
    _setAllowlistConfigPath('/nonexistent/path/does/not/exist.yml')
    _resetAllowlistCache()

    let callCount = 0
    vi.mocked(spawn).mockImplementation(() => {
      callCount++
      const mockChild = makeFakeChild()
      if (callCount === 1) {
        // curl
        Promise.resolve().then(() => {
          mockChild.stdout.emit('data', Buffer.from('200'))
          mockChild.emit('close', 0)
        })
      } else {
        // Browser output with a secret
        Promise.resolve().then(() => {
          mockChild.stdout.emit('data', Buffer.from('ghp_abcdefghijklmnopqrstuvwxyz12345678ABCD'))
          mockChild.emit('close', 0)
        })
      }
      return mockChild as unknown as ReturnType<typeof spawn>
    })

    const resultPromise = browserTestGate({
      mcpServers: [browserServer],
      taskConfig: { urls: ['http://localhost:3000'] },
      worktreePath: '/tmp',
    })
    vi.runAllTimersAsync()

    const result = await resultPromise
    // Output should mention secrets were redacted, not expose them
    expect(result.output).toContain('potential secrets (redacted)')
    expect(result.output).not.toContain('ghp_')
  })

  // ── Visual diff integration ────────────────────────────────────────────────

  describe('visual diff integration', () => {
    let diffTmpDir: string

    beforeEach(() => {
      diffTmpDir = realpathSync(mkdtempSync(join(tmpdir(), 'browser-vd-')))
    })

    afterEach(() => {
      rmSync(diffTmpDir, { recursive: true, force: true })
    })

    const serverWithCmd = { name: 'playwright', type: 'browser', command: 'npx', args: ['playwright'] }

    it('visual diff: passes when no baseline exists (first run skips diff)', async () => {
      const { spawn } = await import('node:child_process')
      let callCount = 0
      vi.mocked(spawn).mockImplementation(() => {
        callCount++
        const child = makeFakeChild()
        Promise.resolve().then(() => {
          if (callCount === 1) child.stdout.emit('data', Buffer.from('200')) // curl
          child.emit('close', 0)
        })
        return child as unknown as ReturnType<typeof spawn>
      })

      const resultPromise = browserTestGate({
        mcpServers: [serverWithCmd],
        taskConfig: { urls: ['http://localhost:3000'], visual_diff_threshold: 0.05 },
        worktreePath: diffTmpDir,
      })
      vi.runAllTimersAsync()

      const result = await resultPromise
      expect(result.passed).toBe(true)
      expect(result.output).toContain('No baseline found')
    })

    it('visual diff: fails when screenshot diff exceeds threshold', async () => {
      const { spawn } = await import('node:child_process')
      // Create baseline PNG at the path browserTestGate will compute
      const baselinesDir = join(diffTmpDir, '.opencastle', 'baselines')
      mkdirSync(baselinesDir, { recursive: true })
      writeFileSync(
        join(baselinesDir, 'http-localhost-3000.png'),
        createTestPng(4, 4, [255, 0, 0, 255]),
      )

      let callCount = 0
      vi.mocked(spawn).mockImplementation(() => {
        callCount++
        const child = makeFakeChild()
        Promise.resolve().then(() => {
          if (callCount === 1) child.stdout.emit('data', Buffer.from('200')) // curl
          // call 2: browser automation — empty stdout (safe, exit 0)
          // call 3: screenshot — empty stdout → Buffer of 0 bytes → pixelDiffPercentage returns 1.0
          child.emit('close', 0)
        })
        return child as unknown as ReturnType<typeof spawn>
      })

      const resultPromise = browserTestGate({
        mcpServers: [serverWithCmd],
        taskConfig: { urls: ['http://localhost:3000'], visual_diff_threshold: 0.01 },
        worktreePath: diffTmpDir,
      })
      vi.runAllTimersAsync()

      const result = await resultPromise
      expect(result.passed).toBe(false)
      expect(result.output).toContain('FAIL')
    })
  })

  // ── A11y audit integration ─────────────────────────────────────────────────

  describe('a11y audit integration', () => {
    const serverWithCmd = { name: 'playwright', type: 'browser', command: 'npx', args: ['playwright'] }

    it('a11y: passes when audit returns no violations above threshold', async () => {
      const { spawn } = await import('node:child_process')
      let callCount = 0
      vi.mocked(spawn).mockImplementation(() => {
        callCount++
        const child = makeFakeChild()
        Promise.resolve().then(() => {
          if (callCount === 1) child.stdout.emit('data', Buffer.from('200')) // curl
          // call 2: browser automation — empty stdout
          else if (callCount === 3) child.stdout.emit('data', Buffer.from('[]')) // a11y: no findings
          child.emit('close', 0)
        })
        return child as unknown as ReturnType<typeof spawn>
      })

      const resultPromise = browserTestGate({
        mcpServers: [serverWithCmd],
        taskConfig: { urls: ['http://localhost:3000'], a11y: true },
        worktreePath: '/tmp',
      })
      vi.runAllTimersAsync()

      const result = await resultPromise
      expect(result.passed).toBe(true)
      expect(result.output).toContain('PASS')
    })

    it('a11y: fails when audit returns serious violations', async () => {
      const { spawn } = await import('node:child_process')
      const findings = JSON.stringify([
        { id: 'label', impact: 'serious', description: 'Form elements must have labels.', nodes: 2 },
      ])
      let callCount = 0
      vi.mocked(spawn).mockImplementation(() => {
        callCount++
        const child = makeFakeChild()
        Promise.resolve().then(() => {
          if (callCount === 1) child.stdout.emit('data', Buffer.from('200')) // curl
          // call 2: browser automation — empty stdout
          else if (callCount === 3) child.stdout.emit('data', Buffer.from(findings)) // a11y findings
          child.emit('close', 0)
        })
        return child as unknown as ReturnType<typeof spawn>
      })

      const resultPromise = browserTestGate({
        mcpServers: [serverWithCmd],
        taskConfig: { urls: ['http://localhost:3000'], a11y: true, severity_threshold: 'serious' },
        worktreePath: '/tmp',
      })
      vi.runAllTimersAsync()

      const result = await resultPromise
      expect(result.passed).toBe(false)
      expect(result.output).toContain('FAIL')
    })
  })

  // ── E2E integration ───────────────────────────────────────────────────────

  describe('E2E integration', () => {
    let e2eTmpDir: string

    beforeEach(() => {
      e2eTmpDir = realpathSync(mkdtempSync(join(tmpdir(), 'browser-e2e-')))
    })

    afterEach(() => {
      rmSync(e2eTmpDir, { recursive: true, force: true })
    })

    const playwrightServer = { name: 'playwright', type: 'browser', command: 'npx', args: ['playwright'] }

    it('full pipeline passes: curl + browser automation + visual diff + a11y', async () => {
      const { spawn } = await import('node:child_process')
      // No baseline file — visual diff step runs but returns "No baseline found" (passed:true)

      let callCount = 0
      vi.mocked(spawn).mockImplementation(() => {
        const currentCall = ++callCount
        const child = makeFakeChild()
        Promise.resolve().then(() => {
          if (currentCall === 1) {
            // curl → HTTP 200
            child.stdout.emit('data', Buffer.from('200'))
          } else if (currentCall === 2) {
            // browser automation → ok
            child.stdout.emit('data', Buffer.from('ok'))
          } else if (currentCall === 3) {
            // screenshot → empty (no baseline exists so diff is skipped)
            child.stdout.emit('data', Buffer.from(''))
          } else if (currentCall === 4) {
            // a11y → no findings
            child.stdout.emit('data', Buffer.from('[]'))
          }
          child.emit('close', 0)
        })
        return child as unknown as ReturnType<typeof spawn>
      })

      const resultPromise = browserTestGate({
        mcpServers: [playwrightServer],
        taskConfig: {
          urls: ['http://localhost:3000'],
          visual_diff_threshold: 0.01,
          a11y: true,
          severity_threshold: 'serious',
        },
        worktreePath: e2eTmpDir,
      })
      vi.runAllTimersAsync()

      const result = await resultPromise
      expect(result.passed).toBe(true)
      expect(result.output).toContain('PASS')
      expect(result.output).toContain('No baseline found')
      expect(callCount).toBe(4)
    })

    it('full pipeline FAIL: visual diff exceeds threshold, a11y passes', async () => {
      const { spawn } = await import('node:child_process')
      const baselinesDir = join(e2eTmpDir, '.opencastle', 'baselines')
      mkdirSync(baselinesDir, { recursive: true })
      const baselinePng = createTestPng(4, 4, [255, 0, 0, 255])
      writeFileSync(join(baselinesDir, 'http-localhost-3000.png'), baselinePng)
      // Screenshot significantly differs from baseline
      const differentPng = createTestPng(4, 4, [0, 0, 255, 255])

      let callCount = 0
      vi.mocked(spawn).mockImplementation(() => {
        const currentCall = ++callCount
        const child = makeFakeChild()
        Promise.resolve().then(() => {
          if (currentCall === 1) {
            child.stdout.emit('data', Buffer.from('200'))
          } else if (currentCall === 2) {
            child.stdout.emit('data', Buffer.from('ok'))
          } else if (currentCall === 3) {
            // different screenshot → visual diff fails
            child.stdout.emit('data', differentPng)
          } else if (currentCall === 4) {
            // a11y passes
            child.stdout.emit('data', Buffer.from('[]'))
          }
          child.emit('close', 0)
        })
        return child as unknown as ReturnType<typeof spawn>
      })

      const resultPromise = browserTestGate({
        mcpServers: [playwrightServer],
        taskConfig: {
          urls: ['http://localhost:3000'],
          visual_diff_threshold: 0.01,
          a11y: true,
          severity_threshold: 'serious',
        },
        worktreePath: e2eTmpDir,
      })
      vi.runAllTimersAsync()

      const result = await resultPromise
      expect(result.passed).toBe(false)
      expect(result.output).toContain('FAIL')
      expect(result.output).toContain('Visual diff')
    })

    it('full pipeline FAIL: visual diff passes, a11y violations above severity threshold', async () => {
      const { spawn } = await import('node:child_process')
      // No baseline → visual diff step skipped (passed:true); only a11y fails
      const a11yFindings = JSON.stringify([
        { id: 'label', impact: 'critical', description: 'No labels on form inputs', nodes: 1 },
      ])

      let callCount = 0
      vi.mocked(spawn).mockImplementation(() => {
        const currentCall = ++callCount
        const child = makeFakeChild()
        Promise.resolve().then(() => {
          if (currentCall === 1) {
            child.stdout.emit('data', Buffer.from('200'))
          } else if (currentCall === 2) {
            child.stdout.emit('data', Buffer.from('ok'))
          } else if (currentCall === 3) {
            // screenshot → empty, no baseline file exists, visual diff skipped
            child.stdout.emit('data', Buffer.from(''))
          } else if (currentCall === 4) {
            // a11y → critical finding, fails at 'serious' threshold
            child.stdout.emit('data', Buffer.from(a11yFindings))
          }
          child.emit('close', 0)
        })
        return child as unknown as ReturnType<typeof spawn>
      })

      const resultPromise = browserTestGate({
        mcpServers: [playwrightServer],
        taskConfig: {
          urls: ['http://localhost:3000'],
          visual_diff_threshold: 0.01,
          a11y: true,
          severity_threshold: 'serious',
        },
        worktreePath: e2eTmpDir,
      })
      vi.runAllTimersAsync()

      const result = await resultPromise
      expect(result.passed).toBe(false)
      expect(result.output).toContain('FAIL')
      expect(result.output).toContain('A11y')
    })

    it('runA11yAudit standalone: passes when no violations returned', async () => {
      const { spawn } = await import('node:child_process')
      const mockChild = makeFakeChild()
      vi.mocked(spawn).mockReturnValue(mockChild as unknown as ReturnType<typeof spawn>)

      const resultPromise = runA11yAudit({
        mcpServers: [{ name: 'browser-tool', type: 'browser', command: 'audit-cmd' }],
        url: 'http://localhost:3000',
        severityThreshold: 'serious',
      })
      mockChild.stdout.emit('data', Buffer.from('[]'))
      mockChild.emit('close', 0)
      vi.runAllTimersAsync()

      const result = await resultPromise
      expect(result.passed).toBe(true)
      expect(result.output).toContain('PASS')
    })

    it('runA11yAudit rejects external URLs (SSRF prevention)', async () => {
      const result = await runA11yAudit({
        mcpServers: [{ name: 'browser-tool', type: 'browser', command: 'audit-cmd' }],
        url: 'https://evil.com',
        severityThreshold: 'serious',
      })
      expect(result.passed).toBe(false)
      expect(result.output).toContain('not a local address')
    })

    it('captureAndPersistBaseline → computeVisualDiff round-trip: matching buffers pass', async () => {
      const buf = createTestPng(8, 8, [128, 128, 128, 255])
      const baselineResult = captureAndPersistBaseline(buf, 'test-roundtrip', e2eTmpDir)
      expect(baselineResult.persisted).toBe(true)

      const baselinePath = join(e2eTmpDir, 'test-roundtrip.png')
      expect(existsSync(baselinePath)).toBe(true)

      const diffResult = await computeVisualDiff({
        screenshotBuffer: buf,
        baselinePath,
        threshold: 0.01,
      })
      expect(diffResult.passed).toBe(true)
      expect(diffResult.diffPercent).toBe(0)
    })
  })
})

// ── PNG test helper ───────────────────────────────────────────────────────────

/**
 * Build a minimal valid PNG buffer with uniform RGBA pixels.
 * Uses filter_type=0 (None) per row so decompressed data is directly usable.
 * CRC fields are zeroed — our parser does not validate them.
 */
function createTestPng(
  width: number,
  height: number,
  rgba: [number, number, number, number],
): Buffer {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

  // IHDR
  const ihdrData = Buffer.alloc(13)
  ihdrData.writeUInt32BE(width, 0)
  ihdrData.writeUInt32BE(height, 4)
  ihdrData[8] = 8 // bit depth
  ihdrData[9] = 6 // color type: RGBA
  const ihdrLen = Buffer.alloc(4)
  ihdrLen.writeUInt32BE(13, 0)
  const ihdr = Buffer.concat([ihdrLen, Buffer.from('IHDR'), ihdrData, Buffer.alloc(4)])

  // Raw pixel data: filter_byte(0) + RGBA per row
  const rowBytes = 1 + width * 4
  const rawData = Buffer.alloc(height * rowBytes)
  for (let row = 0; row < height; row++) {
    rawData[row * rowBytes] = 0
    for (let col = 0; col < width; col++) {
      const off = row * rowBytes + 1 + col * 4
      rawData[off] = rgba[0]
      rawData[off + 1] = rgba[1]
      rawData[off + 2] = rgba[2]
      rawData[off + 3] = rgba[3]
    }
  }
  const compressed = deflateSync(rawData)
  const idatLen = Buffer.alloc(4)
  idatLen.writeUInt32BE(compressed.length, 0)
  const idat = Buffer.concat([idatLen, Buffer.from('IDAT'), compressed, Buffer.alloc(4)])

  // IEND
  const iend = Buffer.concat([Buffer.alloc(4), Buffer.from('IEND'), Buffer.alloc(4)])

  return Buffer.concat([sig, ihdr, idat, iend])
}

// ── pixelDiffPercentage ───────────────────────────────────────────────────────

describe('pixelDiffPercentage', () => {
  it('returns 0 for identical buffers', () => {
    const buf = createTestPng(4, 4, [100, 150, 200, 255])
    expect(pixelDiffPercentage(buf, buf)).toBe(0)
  })

  it('returns 1.0 for completely different pixel content', () => {
    const red = createTestPng(4, 4, [255, 0, 0, 255])
    const blue = createTestPng(4, 4, [0, 0, 255, 255])
    const diff = pixelDiffPercentage(red, blue)
    // All pixels differ by more than tolerance
    expect(diff).toBeGreaterThan(0.9)
  })

  it('returns 1.0 when dimensions differ', () => {
    const small = createTestPng(2, 2, [100, 100, 100, 255])
    const large = createTestPng(4, 4, [100, 100, 100, 255])
    expect(pixelDiffPercentage(small, large)).toBe(1.0)
  })

  it('returns a value between 0 and 1 for partially different buffers', () => {
    const width = 4
    const height = 4
    const base = createTestPng(width, height, [100, 100, 100, 255])
    // Build a PNG where half the pixels differ significantly
    const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    const ihdrData = Buffer.alloc(13)
    ihdrData.writeUInt32BE(width, 0)
    ihdrData.writeUInt32BE(height, 4)
    ihdrData[8] = 8
    ihdrData[9] = 6
    const ihdrLen = Buffer.alloc(4)
    ihdrLen.writeUInt32BE(13, 0)
    const ihdr = Buffer.concat([ihdrLen, Buffer.from('IHDR'), ihdrData, Buffer.alloc(4)])
    const rowBytes = 1 + width * 4
    const rawData = Buffer.alloc(height * rowBytes)
    for (let row = 0; row < height; row++) {
      rawData[row * rowBytes] = 0
      for (let col = 0; col < width; col++) {
        const off = row * rowBytes + 1 + col * 4
        // First half of pixels: same as base; second half: very different
        const isDifferent = row * width + col >= (width * height) / 2
        rawData[off] = isDifferent ? 255 : 100
        rawData[off + 1] = isDifferent ? 0 : 100
        rawData[off + 2] = isDifferent ? 0 : 100
        rawData[off + 3] = 255
      }
    }
    const compressed = deflateSync(rawData)
    const idatLen = Buffer.alloc(4)
    idatLen.writeUInt32BE(compressed.length, 0)
    const idat = Buffer.concat([idatLen, Buffer.from('IDAT'), compressed, Buffer.alloc(4)])
    const iend = Buffer.concat([Buffer.alloc(4), Buffer.from('IEND'), Buffer.alloc(4)])
    const modified = Buffer.concat([sig, ihdr, idat, iend])

    const diff = pixelDiffPercentage(base, modified)
    expect(diff).toBeGreaterThan(0)
    expect(diff).toBeLessThan(1)
  })

  it('handles empty/invalid buffers gracefully and returns 1.0', () => {
    expect(pixelDiffPercentage(Buffer.from([]), Buffer.from([]))).toBe(1.0)
    expect(pixelDiffPercentage(Buffer.from('not a png'), Buffer.from('not a png'))).toBe(1.0)
    const valid = createTestPng(2, 2, [0, 0, 0, 255])
    expect(pixelDiffPercentage(valid, Buffer.from([]))).toBe(1.0)
  })
})

// ── computeVisualDiff ─────────────────────────────────────────────────────────

describe('computeVisualDiff', () => {
  let tmpDir: string

  beforeEach(() => {
    tmpDir = realpathSync(mkdtempSync(join(tmpdir(), 'visual-diff-test-')))
  })

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true })
  })

  it('returns passed:true with "No baseline found" when baseline does not exist', async () => {
    const buf = createTestPng(2, 2, [255, 0, 0, 255])
    const result = await computeVisualDiff({
      screenshotBuffer: buf,
      baselinePath: join(tmpDir, 'nonexistent.png'),
      threshold: 0.05,
    })
    expect(result.passed).toBe(true)
    expect(result.diffPercent).toBe(0)
    expect(result.output).toContain('No baseline found')
  })

  it('returns passed:true when diff is under threshold', async () => {
    const buf = createTestPng(4, 4, [100, 100, 100, 255])
    const baselinePath = join(tmpDir, 'base.png')
    writeFileSync(baselinePath, buf)
    const result = await computeVisualDiff({
      screenshotBuffer: buf,
      baselinePath,
      threshold: 0.05,
    })
    expect(result.passed).toBe(true)
    expect(result.diffPercent).toBe(0)
    expect(result.output).toContain('PASS')
  })

  it('returns passed:false when diff exceeds threshold', async () => {
    const baseline = createTestPng(4, 4, [100, 100, 100, 255])
    const screenshot = createTestPng(4, 4, [255, 0, 0, 255])
    const baselinePath = join(tmpDir, 'base.png')
    writeFileSync(baselinePath, baseline)
    const result = await computeVisualDiff({
      screenshotBuffer: screenshot,
      baselinePath,
      threshold: 0.01,
    })
    expect(result.passed).toBe(false)
    expect(result.diffPercent).toBeGreaterThan(0.01)
    expect(result.output).toContain('FAIL')
  })
})

// ── mapA11ySeverity ───────────────────────────────────────────────────────────

describe('mapA11ySeverity', () => {
  const findings: A11yFinding[] = [
    { id: 'color-contrast', impact: 'serious', description: 'Elements must have sufficient color contrast.', nodes: 3 },
    { id: 'label', impact: 'critical', description: 'Form elements must have labels.', nodes: 1 },
    { id: 'list', impact: 'moderate', description: 'List must not be empty.', nodes: 2 },
    { id: 'alt-text', impact: 'minor', description: 'Images must have alternate text.', nodes: 5 },
  ]

  it('returns passed:true when no findings exceed threshold', () => {
    const result = mapA11ySeverity([], 'serious')
    expect(result.passed).toBe(true)
    expect(result.findings).toHaveLength(0)
    expect(result.output).toContain('PASS')
  })

  it('returns passed:false when findings exceed threshold', () => {
    const result = mapA11ySeverity(findings, 'serious')
    expect(result.passed).toBe(false)
    expect(result.output).toContain('FAIL')
  })

  it('correctly filters by severity level', () => {
    // threshold=critical: only critical findings should fail the check
    const critical = mapA11ySeverity(findings, 'critical')
    expect(critical.findings.every((f) => f.impact === 'critical')).toBe(true)
    // threshold=minor: all findings should be in failing list
    const minor = mapA11ySeverity(findings, 'minor')
    expect(minor.findings).toHaveLength(4)
    // threshold=moderate: critical, serious, moderate
    const moderate = mapA11ySeverity(findings, 'moderate')
    expect(moderate.findings.every((f) =>
      ['critical', 'serious', 'moderate'].includes(f.impact),
    )).toBe(true)
  })

  it('includes finding descriptions in output (truncated to 200 chars)', () => {
    const longDesc: A11yFinding = {
      id: 'long-rule',
      impact: 'serious',
      description: 'A'.repeat(300),
      nodes: 1,
    }
    const result = mapA11ySeverity([longDesc], 'serious')
    expect(result.passed).toBe(false)
    const lines = result.output.split('\n')
    const descLine = lines.find((l) => l.includes('long-rule'))
    expect(descLine).toBeDefined()
    // Description should be sliced to 200 chars max in the output line
    expect(descLine!.length).toBeLessThan(300)
  })
})

// ── captureAndPersistBaseline ─────────────────────────────────────────────────

describe('captureAndPersistBaseline', () => {
  let tmpDir: string

  beforeEach(() => {
    tmpDir = realpathSync(mkdtempSync(join(tmpdir(), 'baselines-test-')))
    vi.clearAllMocks()
  })

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true })
  })

  it('persists a PNG buffer to disk', () => {
    const buf = createTestPng(2, 2, [255, 0, 0, 255])
    const result = captureAndPersistBaseline(buf, 'test-red', tmpDir)
    expect(result.persisted).toBe(true)
    expect(existsSync(join(tmpDir, 'test-red.png'))).toBe(true)
    expect(readFileSync(join(tmpDir, 'test-red.png'))).toEqual(buf)
  })

  it('creates directory if it does not exist', () => {
    const newDir = join(tmpDir, 'nested', 'baselines')
    const buf = createTestPng(1, 1, [0, 255, 0, 255])
    const result = captureAndPersistBaseline(buf, 'green', newDir)
    expect(result.persisted).toBe(true)
    expect(existsSync(join(newDir, 'green.png'))).toBe(true)
  })

  it('uses slug as the filename without extension in the directory', () => {
    const buf = createTestPng(1, 1, [0, 0, 255, 255])
    const result = captureAndPersistBaseline(buf, 'my-page-home', tmpDir)
    expect(result.persisted).toBe(true)
    expect(existsSync(join(tmpDir, 'my-page-home.png'))).toBe(true)
    expect(existsSync(join(tmpDir, 'my-page-home'))).toBe(false)
  })
})

