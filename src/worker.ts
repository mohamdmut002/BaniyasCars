/**
 * Cloudflare Pages entry ("advanced mode": built to pages-dist/_worker.js by scripts/build-pages.mjs).
 *
 * Bindings (configured in wrangler.toml or the Pages dashboard):
 *   HYPERDRIVE   Hyperdrive config in front of PostgreSQL (recommended), or set DATABASE_URL instead
 *   UPLOADS      R2 bucket for photos uploaded from the dashboard
 *   ASSETS       provided by Pages: the static files in pages-dist
 *   plus the text variables and secrets listed in .env.example (SITE_URL, SESSION_SECRET, …)
 */
import { runtime, type R2Like } from './config/runtime.js'

interface Env {
  ASSETS: { fetch(request: Request): Promise<Response> }
  UPLOADS?: R2Like
  HYPERDRIVE?: { connectionString: string }
  [key: string]: unknown
}
interface ExecutionContext {
  waitUntil(p: Promise<unknown>): void
  passThroughOnException(): void
}

// Paths served straight from the build output (also excluded from the Function in _routes.json).
const STATIC = /^\/(assets|fonts)\/|^\/(favicon\.svg|og-default\.png)$/

type Loaded = {
  app: ReturnType<typeof import('./app.js').createApp>
  createClient: typeof import('./db/client.js').createClient
  withClient: typeof import('./db/client.js').withClient
}
let appModule: Promise<Loaded> | null = null

function load(env: Env) {
  if (appModule) return appModule
  // Copy text bindings and secrets into process.env before the app reads its configuration.
  for (const [k, v] of Object.entries(env)) if (typeof v === 'string') process.env[k] = v
  if (env.HYPERDRIVE?.connectionString) {
    process.env.DATABASE_URL = env.HYPERDRIVE.connectionString
    // Hyperdrive terminates TLS to the database itself; the hop from the Worker is local.
    process.env.DATABASE_SSL = 'disable'
  }
  process.env.STORAGE_DRIVER ??= 'r2'
  process.env.NODE_ENV ??= 'production'
  appModule = (async () => {
    const [{ createApp }, db] = await Promise.all([import('./app.js'), import('./db/client.js')])
    return { app: createApp(), createClient: db.createClient, withClient: db.withClient }
  })()
  return appModule
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url)
    if (STATIC.test(url.pathname)) return env.ASSETS.fetch(request)

    let mod: Loaded
    try {
      mod = await load(env)
    } catch (e) {
      appModule = null
      console.error(JSON.stringify({ level: 'error', msg: 'configuration error', error: String(e) }))
      return new Response('The site is not configured correctly. Check the Pages environment variables.', { status: 500 })
    }
    runtime.r2 = env.UPLOADS ?? null

    // One small connection per request: Workers cannot share sockets between requests.
    const client = mod.createClient(process.env.DATABASE_URL!, { max: 1 })
    try {
      return await mod.withClient(client, () => mod.app.fetch(request, env, ctx as never))
    } finally {
      ctx.waitUntil(client.end({ timeout: 2 }).catch(() => {}))
    }
  },
}
