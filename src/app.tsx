import { Hono } from 'hono'
import { bodyLimit } from 'hono/body-limit'
import { compress } from 'hono/compress'
import { env } from './config/env.js'
import { isWorkers } from './config/runtime.js'
import { type AppEnv, baseMiddleware, pageCtx } from './http/common.js'
import { publicRoutes } from './http/public.js'
import { seoRoutes } from './http/seo.js'
import { admin } from './http/admin.js'
import { NotFoundPage, ErrorPage } from './views/pages/misc.js'
import { log, errorDetails } from './lib/logger.js'
import { sql } from './db/client.js'
import { R2Storage, getStorage } from './lib/storage.js'

export interface AppOptions {
  /** Registers static file routes (Node only; Cloudflare Pages serves static files itself). */
  mountStatic?: (app: Hono<AppEnv>) => void
}

export function createApp(opts: AppOptions = {}) {
  const app = new Hono<AppEnv>()

  app.use('*', baseMiddleware)
  // Cloudflare compresses responses at the edge; Node compresses here.
  if (!isWorkers) app.use('*', compress())
  opts.mountStatic?.(app)

  // Photos stored in R2 are served through the app (no public bucket needed).
  if (env.STORAGE_DRIVER === 'r2') {
    app.get('/uploads/*', async (c) => {
      const key = c.req.path.replace(/^\/uploads\//, '')
      if (!/^[a-z0-9][a-z0-9/_.-]{0,200}$/.test(key) || key.includes('..')) return c.notFound()
      const obj = await (getStorage() as R2Storage).get(key)
      if (!obj) return c.notFound()
      return new Response(obj.body, {
        headers: {
          'Content-Type': obj.httpMetadata?.contentType ?? 'application/octet-stream',
          'Cache-Control': 'public, max-age=31536000, immutable',
          'X-Content-Type-Options': 'nosniff',
          ...(obj.httpEtag ? { ETag: obj.httpEtag } : {}),
        },
      })
    })
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
