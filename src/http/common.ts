import type { Context, MiddlewareHandler } from 'hono'
import { randomBytes } from 'node:crypto'
import { env, isProd } from '../config/env.js'
import { isWorkers } from '../config/runtime.js'
import { log } from '../lib/logger.js'
import { getBranches, getSiteSettings } from '../repo/settings.js'
import type { Locale } from '../i18n/index.js'
import type { PageCtx } from '../views/ctx.js'
import type { Session } from '../lib/auth.js'

export type AppEnv = {
  Variables: {
    nonce: string
    requestId: string
    session: Session | null
  }
}

export function clientIp(c: Context): string {
  // Cloudflare sets cf-connecting-ip itself; elsewhere it could be forged, so it is only trusted on Workers.
  if (isWorkers) return c.req.header('cf-connecting-ip') ?? 'unknown'
  if (env.TRUST_PROXY) {
    const xff = c.req.header('x-forwarded-for')
    if (xff) return xff.split(',')[0]!.trim()
  }
  // @hono/node-server exposes the Node request as c.env.incoming.
  return (c.env as { incoming?: { socket?: { remoteAddress?: string } } } | undefined)?.incoming?.socket?.remoteAddress ?? 'unknown'
}

/** Request id, timing log, and security headers (CSP with a per-request nonce). */
export const baseMiddleware: MiddlewareHandler<AppEnv> = async (c, next) => {
  const start = performance.now()
  const nonce = randomBytes(16).toString('base64')
  c.set('nonce', nonce)
  c.set('requestId', randomBytes(6).toString('hex'))
  await next()
  const imgHosts = ['https://auto-ae-prod-storage.storage.googleapis.com', env.S3_PUBLIC_BASE_URL?.startsWith('http') ? new URL(env.S3_PUBLIC_BASE_URL).origin : null]
    .filter(Boolean)
    .join(' ')
  c.header(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      `script-src 'self' 'nonce-${nonce}'`,
      "style-src 'self' 'unsafe-inline'",
      `img-src 'self' data: blob: ${imgHosts}`,
      "font-src 'self'",
      "connect-src 'self'",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "object-src 'none'",
    ].join('; '),
  )
  c.header('X-Content-Type-Options', 'nosniff')
  c.header('Referrer-Policy', 'strict-origin-when-cross-origin')
  c.header('X-Frame-Options', 'DENY')
  c.header('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')
  if (isProd) c.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains')
  const ms = Math.round(performance.now() - start)
  const status = c.res.status
  if (!c.req.path.startsWith('/assets/') && !c.req.path.startsWith('/fonts/')) {
    log[status >= 500 ? 'error' : 'info']('request', { id: c.get('requestId'), method: c.req.method, path: c.req.path, status, ms })
  }
}

export async function pageCtx(c: Context<AppEnv>, locale: Locale): Promise<PageCtx> {
  const url = new URL(c.req.url)
  let path = url.pathname
  if (locale === 'en') path = path.replace(/^\/en(?=\/|$)/, '') || '/'
  return {
    locale,
    path,
    search: url.search,
    settings: await getSiteSettings(),
    branches: await getBranches(),
    nonce: c.get('nonce'),
  }
}
