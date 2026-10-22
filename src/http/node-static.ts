import type { Hono } from 'hono'
import { serveStatic } from '@hono/node-server/serve-static'
import path from 'node:path'
import { env } from '../config/env.js'
import type { AppEnv } from './common.js'

/** Static files for the Node server. On Cloudflare Pages the same files are served from the build output. */
export function mountNodeStatic(app: Hono<AppEnv>) {
  const immutable = async (c: any, next: () => Promise<void>) => {
    await next()
    if (c.res.status === 200) {
      c.header('Cache-Control', 'public, max-age=31536000, immutable')
      c.header('X-Content-Type-Options', 'nosniff')
    }
  }
  app.use('/assets/*', immutable, serveStatic({ root: './public' }))
  app.use('/fonts/*', immutable, serveStatic({ root: './public' }))
  app.get('/favicon.svg', serveStatic({ path: './public/favicon.svg' }))
  app.get('/favicon.ico', serveStatic({ path: './public/favicon.svg' }))
  app.get('/og-default.png', serveStatic({ path: './public/og-default.png' }))
  if (env.STORAGE_DRIVER === 'local') {
    const root = path.relative(process.cwd(), path.resolve(env.LOCAL_STORAGE_DIR)) || '.'
    app.use('/uploads/*', immutable, serveStatic({ root, rewriteRequestPath: (p) => p.replace(/^\/uploads/, '') }))
  }
}
