// Minimal static file server for previewing dist/ locally (no dependencies).
//   node scripts/serve.mjs [port]
// Serves folder index.html files for clean URLs and dist/404.html for anything missing, like most static hosts.
import { createServer } from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist')
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.xml': 'application/xml',
  '.txt': 'text/plain; charset=utf-8',
}

async function resolveFile(urlPath) {
  const decoded = decodeURIComponent(urlPath)
  const file = path.normalize(path.join(root, decoded))
  if (!file.startsWith(root)) return null
  try {
    const s = await stat(file)
    if (s.isDirectory()) {
      // Redirect /cars → /cars/ so relative behaviour matches static hosts.
      if (!decoded.endsWith('/')) return { redirect: `${urlPath}/` }
      const index = path.join(file, 'index.html')
      return (await stat(index).catch(() => null)) ? { file: index } : null
    }
    return { file }
  } catch {
    return null
  }
}

export function startServer(port = Number(process.env.PORT) || 4173) {
  const server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url ?? '/', 'http://localhost')
      const found = await resolveFile(url.pathname)
      if (found?.redirect) {
        res.writeHead(301, { Location: found.redirect + url.search })
        return res.end()
      }
      if (found?.file) {
        const body = await readFile(found.file)
        res.writeHead(200, { 'Content-Type': TYPES[path.extname(found.file)] ?? 'application/octet-stream', 'Cache-Control': 'no-cache' })
        return res.end(body)
      }
      const notFound = url.pathname.startsWith('/en/') ? 'en/404.html' : '404.html'
      res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' })
      res.end(await readFile(path.join(root, notFound)).catch(() => 'Not found'))
    } catch {
      res.writeHead(500, { 'Content-Type': 'text/plain' })
      res.end('Server error')
    }
  })
  server.listen(port, () => console.log(`Baniyas Cars site: http://localhost:${port}/  (English: http://localhost:${port}/en/)`))
  return server
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  startServer(Number(process.argv[2]) || undefined)
}
