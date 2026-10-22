import { Hono } from 'hono'
import { serveStatic } from '@hono/node-server/serve-static'
import { bodyLimit } from 'hono/body-limit'
import { compress } from 'hono/compress'
import path from 'node:path'
import { env } from './config/env.js'
import { type AppEnv, baseMiddleware, pageCtx } from './http/common.js'
import { publicRoutes } from './http/public.js'
import { seoRoutes } from './http/seo.js'
import { admin } from './http/admin.js'
import { NotFoundPage, ErrorPage } from './views/pages/misc.js'
import { log, errorDetails } from './lib/logger.js'
import { sql } from './db/client.js'

export function createApp() {
  const app = new Hono<AppEnv>()

  app.use('*', baseMiddleware)
  app.use('*', compress())

  // Long-cached static files. Asset names contain a content hash.
  app.use('/assets/*', async (c, next) => {
    await next()
    if (c.res.status === 200) c.header('Cache-Control', 'public, max-age=31536000, immutable')
  })
  app.use('/fonts/*', async (c, next) => {
    await next()
    if (c.res.status === 200) c.header('Cache-Control', 'public, max-age=31536000, immutable')
  })
  app.use('/assets/*', serveStatic({ root: './public' }))
  app.use('/fonts/*', serveStatic({ root: './public' }))
  app.get('/favicon.svg', serveStatic({ path: './public/favicon.svg' }))
  app.get('/favicon.ico', serveStatic({ path: './public/favicon.svg' }))
  app.get('/og-default.png', serveStatic({ path: './public/og-default.png' }))
  if (env.STORAGE_DRIVER === 'local') {
    const root = path.relative(process.cwd(), path.resolve(env.LOCAL_STORAGE_DIR)) || '.'
    app.use('/uploads/*', async (c, next) => {
      await next()
      if (c.res.status === 200) {
        c.header('Cache-Control', 'public, max-age=31536000, immutable')
        c.header('X-Content-Type-Options', 'nosniff')
      }
    })
    app.use('/uploads/*', serveStatic({ root, rewriteRequestPath: (p) => p.replace(/^\/uploads/, '') }))
  }

  app.get('/healthz', async (c) => {
    try {
      await sql`select 1`
      return c.json({ ok: true })
    } catch (e) {
      log.error('health check failed', errorDetails(e))
      return c.json({ ok: false }, 503)
    }
  })

  app.route('/', seoRoutes)

  // Uploads can carry several photos; every other admin request is a small form.
  app.use('/admin/vehicles/:id/images', bodyLimit({ maxSize: (env.MAX_UPLOAD_MB * 12 + 2) * 1024 * 1024, onError: (c) => c.text('الملفات أكبر من الحد المسموح.', 413) }))
  app.use('/admin/import/*', bodyLimit({ maxSize: 12 * 1024 * 1024, onError: (c) => c.text('الملف أكبر من الحد المسموح.', 413) }))
  app.use('/admin/*', async (c, next) => {
    if (/\/images$|\/import\//.test(c.req.path)) return next()
    return bodyLimit({ maxSize: 1024 * 1024, onError: (cc) => cc.text('Request too large', 413) })(c, next)
  })
  app.route('/admin', admin)

  // Old or mistyped trailing slashes.
  app.use('*', async (c, next) => {
    const p = c.req.path
    if (p.length > 1 && p.endsWith('/')) {
      const url = new URL(c.req.url)
      return c.redirect(p.replace(/\/+$/, '') + url.search, 301)
    }
    await next()
  })
  app.route('/en', publicRoutes('en'))
  app.route('/', publicRoutes('ar'))

  app.notFound(async (c) => {
    const locale = c.req.path === '/en' || c.req.path.startsWith('/en/') ? 'en' : 'ar'
    if (c.req.path.startsWith('/admin') || c.req.path.startsWith('/assets') || c.req.path.startsWith('/uploads')) return c.text('Not found', 404)
    return c.html(<NotFoundPage ctx={await pageCtx(c, locale)} />, 404)
  })

  app.onError(async (err, c) => {
    log.error('unhandled error', { id: c.get('requestId'), path: c.req.path, ...errorDetails(err) })
    try {
      const locale = c.req.path.startsWith('/en') ? 'en' : 'ar'
      return c.html(<ErrorPage ctx={await pageCtx(c, locale)} />, 500)
    } catch {
      return c.text('Server error', 500)
    }
  })

  return app
}
