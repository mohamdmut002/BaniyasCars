import { serve } from '@hono/node-server'
import { env } from './config/env.js'
import { createApp } from './app.js'
import { mountNodeStatic } from './http/node-static.js'
import { mkdir } from 'node:fs/promises'
import { migrate } from './db/migrate.js'
import { sql } from './db/client.js'
import { log, errorDetails } from './lib/logger.js'

async function main() {
  // Apply pending migrations on boot so a fresh deploy is ready without a manual step.
  await migrate()
  if (env.STORAGE_DRIVER === 'local') await mkdir(env.LOCAL_STORAGE_DIR, { recursive: true })
  const app = createApp({ mountStatic: mountNodeStatic })
  const server = serve({ fetch: app.fetch, port: env.PORT, hostname: '0.0.0.0' }, (info) => {
    log.info('server listening', { port: info.port, url: env.SITE_URL })
  })
  const shutdown = async (signal: string) => {
    log.info('shutting down', { signal })
    server.close()
    await sql.end({ timeout: 5 })
    process.exit(0)
  }
  process.on('SIGTERM', () => void shutdown('SIGTERM'))
  process.on('SIGINT', () => void shutdown('SIGINT'))
}

process.on('unhandledRejection', (e) => log.error('unhandled rejection', errorDetails(e)))

main().catch((e) => {
  log.error('failed to start', errorDetails(e))
  process.exit(1)
})
