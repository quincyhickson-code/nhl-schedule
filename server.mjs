import { createServer } from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import { dirname, join, extname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFile } from 'node:child_process'

const __dirname   = dirname(fileURLToPath(import.meta.url))
const PUBLIC_DIR  = join(__dirname, 'public')
const DATA_FILE   = join(__dirname, 'data', 'schedule.json')
const CHANGES_FILE= join(__dirname, 'data', 'changes.json')
const ARCHIVE_FILE= join(__dirname, 'data', 'archive.json')
const SCRAPER     = join(__dirname, 'scraper.mjs')
const PORT        = 4884
const REFRESH_MS  = 10 * 60 * 1000
const STALE_MS    = REFRESH_MS

const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg',
}

function runScraper() {
  return new Promise((resolve, reject) => {
    execFile('node', [SCRAPER], { cwd: __dirname }, (err, stdout) => {
      if (err) return reject(err)
      console.log(stdout.trim())
      resolve()
    })
  })
}

let refreshInFlight = null
function refresh() {
  if (!refreshInFlight) {
    refreshInFlight = runScraper().finally(() => { refreshInFlight = null })
  }
  return refreshInFlight
}

async function ensureFreshData() {
  try {
    const s = await stat(DATA_FILE)
    if (Date.now() - s.mtimeMs < STALE_MS) return
  } catch { /* file missing */ }
  console.log('Data missing or stale — refreshing…')
  await refresh().catch(e => console.error('Refresh failed:', e.message))
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`)

  if (url.pathname === '/api/refresh' && req.method === 'POST') {
    try {
      await refresh()
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ ok: true }))
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ ok: false, error: e.message }))
    }
    return
  }

  if (url.pathname === '/data/schedule.json') {
    try {
      const body = await readFile(DATA_FILE)
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(body)
    } catch {
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ games: [], generatedAt: null, errors: ['No data yet — click Refresh'] }))
    }
    return
  }

  if (url.pathname === '/data/changes.json') {
    try {
      const body = await readFile(CHANGES_FILE)
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(body)
    } catch {
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ changes: [] }))
    }
    return
  }

  if (url.pathname === '/data/archive.json') {
    try {
      const body = await readFile(ARCHIVE_FILE)
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(body)
    } catch {
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ games: [] }))
    }
    return
  }

  let filePath = join(PUBLIC_DIR, url.pathname === '/' ? 'index.html' : url.pathname)
  if (!filePath.startsWith(PUBLIC_DIR)) { res.writeHead(403); res.end('Forbidden'); return }

  try {
    const body = await readFile(filePath)
    res.writeHead(200, { 'Content-Type': MIME[extname(filePath)] || 'application/octet-stream' })
    res.end(body)
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain' })
    res.end('Not found')
  }
})

server.listen(PORT, () => {
  console.log(`NHL Schedule running at http://localhost:${PORT}`)
  ensureFreshData().catch(e => console.error('Initial data load failed:', e.message))
})
setInterval(() => refresh().catch(e => console.error('Periodic refresh failed:', e.message)), REFRESH_MS)
