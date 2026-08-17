/**
 * Minimal static server for the production build.
 *
 * Deliberately dependency-free and single-process: it is started detached by
 * hicup.bat and expected to outlive the terminal that launched it, so there is
 * no npm/npx shim in the way and exactly one PID to track.
 */
import { createReadStream, existsSync, statSync } from 'node:fs'
import { createServer } from 'node:http'
import { extname, join, normalize, resolve, sep } from 'node:path'

const ROOT = resolve(import.meta.dirname, '..', 'dist')
const PORT = Number(process.env.HICUP_PORT ?? 5180)
// Localhost by default — this is a private library, not a web service.
const HOST = process.env.HICUP_HOST ?? '127.0.0.1'

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.webmanifest': 'application/manifest+json',
}

if (!existsSync(join(ROOT, 'index.html'))) {
  console.error(`No build found in ${ROOT}. Run: npm run build`)
  process.exit(1)
}

function resolveFile(urlPath) {
  // Strip query/hash, decode, and refuse anything escaping the build directory.
  let pathname
  try {
    pathname = decodeURIComponent(new URL(urlPath, 'http://localhost').pathname)
  } catch {
    return null
  }
  const candidate = resolve(join(ROOT, normalize(pathname)))
  if (candidate !== ROOT && !candidate.startsWith(ROOT + sep)) return null
  if (existsSync(candidate) && statSync(candidate).isFile()) return candidate
  return null
}

const server = createServer((req, res) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { Allow: 'GET, HEAD' }).end()
    return
  }

  // Client-side routes (/library, /feed, …) fall back to the SPA shell.
  const file = resolveFile(req.url ?? '/') ?? join(ROOT, 'index.html')
  const ext = extname(file).toLowerCase()
  const isShell = file.endsWith('index.html')

  res.writeHead(200, {
    'Content-Type': TYPES[ext] ?? 'application/octet-stream',
    // Vite fingerprints asset filenames, so they can be cached hard; the shell
    // must not be, or a rebuild would never reach the browser.
    'Cache-Control': isShell ? 'no-cache' : 'public, max-age=31536000, immutable',
    'X-Content-Type-Options': 'nosniff',
  })
  if (req.method === 'HEAD') return res.end()
  createReadStream(file).on('error', () => res.end()).pipe(res)
})

server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use — Hicup may already be running.`)
    process.exit(2)
  }
  console.error(error)
  process.exit(1)
})

server.listen(PORT, HOST, () => {
  console.log(`Hicup serving ${ROOT} at http://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${PORT}`)
})

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => server.close(() => process.exit(0)))
}
