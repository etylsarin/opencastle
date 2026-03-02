import { createServer } from 'node:http'
import type { IncomingMessage, ServerResponse, Server } from 'node:http'
import { readFile, access } from 'node:fs/promises'
import { resolve, join, extname } from 'node:path'
import { exec } from 'node:child_process'
import type { CliContext } from './types.js'

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.ndjson': 'application/x-ndjson',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
}

const DATA_FILES = [
  'sessions.ndjson',
  'delegations.ndjson',
  'panels.ndjson',
]

interface DashboardArgs {
  port: number
  openBrowser: boolean
  seed: boolean
}

function parseArgs(args: string[]): DashboardArgs {
  let port = 4300
  let openBrowser = true
  let seed = false

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--port' && args[i + 1]) {
      port = parseInt(args[i + 1], 10)
      i++
    } else if (args[i] === '--no-open') {
      openBrowser = false
    } else if (args[i] === '--seed') {
      seed = true
    }
  }

  return { port, openBrowser, seed }
}

function openUrl(url: string): void {
  const plat = process.platform
  const cmd =
    plat === 'darwin'
      ? 'open'
      : plat === 'win32'
        ? 'start'
        : 'xdg-open'
  exec(`${cmd} ${url}`)
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath)
    return true
  } catch {
    return false
  }
}

function tryListen(
  server: Server,
  port: number,
  maxAttempts = 10
): Promise<number> {
  return new Promise((res, rej) => {
    let attempt = 0

    function attemptListen(): void {
      const currentPort = port + attempt

      const onError = (err: Error & { code?: string }): void => {
        if (err.code === 'EADDRINUSE' && attempt < maxAttempts) {
          attempt++
          attemptListen()
        } else {
          rej(err)
        }
      }

      server.once('error', onError)
      server.listen(currentPort, '127.0.0.1', () => {
        server.removeListener('error', onError)
        res(currentPort)
      })
    }

    attemptListen()
  })
}

export default async function dashboard({
  pkgRoot,
  args,
}: CliContext): Promise<void> {
  const { port, openBrowser, seed } = parseArgs(args)

  const distDir = resolve(pkgRoot, 'src', 'dashboard', 'dist')
  const seedDir = resolve(pkgRoot, 'src', 'dashboard', 'seed-data')
  const projectRoot = process.cwd()
  const logsDir = resolve(projectRoot, '.github', 'customizations', 'logs')

  // Check if dist exists
  if (!(await fileExists(distDir))) {
    throw new Error(
      'Dashboard not built. Run "npm run dashboard:build" in the opencastle package first.'
    )
  }

  // Check if any log files exist (for messaging)
  let hasLogs = false
  if (!seed) {
    for (const f of DATA_FILES) {
      if (await fileExists(join(logsDir, f))) {
        hasLogs = true
        break
      }
    }
  }

  const server = createServer(
    async (req: IncomingMessage, res: ServerResponse) => {
      try {
        const url = new URL(req.url ?? '/', `http://${req.headers.host}`)
        let pathname = decodeURIComponent(url.pathname)

        // Serve index.html for root
        if (pathname === '/') {
          pathname = '/index.html'
        }

        // Handle data file requests — proxy to project logs or dist
        const dataMatch = pathname.match(/^\/data\/(.+\.ndjson)$/)
        if (dataMatch && DATA_FILES.includes(dataMatch[1])) {
          const filename = dataMatch[1]
          let filePath: string

          if (seed) {
            filePath = join(seedDir, filename)
          } else {
            filePath = join(logsDir, filename)
          }

          if (await fileExists(filePath)) {
            const content = await readFile(filePath)
            res.writeHead(200, { 'Content-Type': 'application/x-ndjson' })
            res.end(content)
          } else {
            // Graceful fallback — empty body
            res.writeHead(200, { 'Content-Type': 'application/x-ndjson' })
            res.end('')
          }
          return
        }

        // Serve static files from dist/
        const filePath = resolve(distDir, pathname.slice(1))

        // Security: prevent path traversal
        if (!filePath.startsWith(distDir)) {
          res.writeHead(403)
          res.end('Forbidden')
          return
        }

        if (await fileExists(filePath)) {
          const ext = extname(filePath)
          const contentType = MIME_TYPES[ext] ?? 'application/octet-stream'
          const content = await readFile(filePath)
          res.writeHead(200, { 'Content-Type': contentType })
          res.end(content)
        } else {
          res.writeHead(404)
          res.end('Not Found')
        }
      } catch {
        res.writeHead(500)
        res.end('Internal Server Error')
      }
    }
  )

  const actualPort = await tryListen(server, port)
  const url = `http://localhost:${actualPort}`

  console.log('')
  console.log('  \u{1F3F0} OpenCastle Dashboard')
  console.log('')
  console.log(`  \u2192 ${url}`)

  if (seed) {
    console.log(
      '  \u{1F4C2} Showing demo data (use without --seed to read project logs)'
    )
  } else if (hasLogs) {
    console.log('  \u{1F4C2} Reading logs from .github/customizations/logs/')
  } else {
    console.log(
      '  \u{1F4A1} No agent logs found. Run agents with OpenCastle to generate data, or use --seed for demo data.'
    )
  }

  console.log('')
  console.log('  Press Ctrl+C to stop')
  console.log('')

  if (openBrowser) {
    openUrl(url)
  }

  // Graceful shutdown
  process.on('SIGINT', () => {
    console.log('\n  Dashboard stopped.\n')
    server.close()
    process.exit(0)
  })

  // Keep the process alive
  await new Promise<never>(() => {})
}
