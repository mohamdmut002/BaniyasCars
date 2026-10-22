import postgres from 'postgres'
import { AsyncLocalStorage } from 'node:async_hooks'
import { env } from '../config/env.js'
import { isWorkers } from '../config/runtime.js'

type Client = ReturnType<typeof postgres>

export function createClient(url: string, opts: { max?: number } = {}): Client {
  return postgres(url, {
    ssl: env.DATABASE_SSL === 'require' ? 'require' : false,
    max: opts.max ?? Number(process.env.DATABASE_POOL_MAX ?? 10),
    idle_timeout: isWorkers ? 0 : 30,
    connect_timeout: 15,
    // Supabase's transaction pooler (port 6543) does not support prepared statements.
    prepare: !/:6543\//.test(url),
    onnotice: () => {},
    transform: { undefined: null },
  })
}

/*
 * On Node one pooled client serves the whole process. On Workers, sockets cannot be shared between
 * requests, so src/worker.ts opens a client per request and runs the request inside `withClient`.
 * `sql` always resolves to the right one, so the rest of the code just imports `sql`.
 */
const store = new AsyncLocalStorage<Client>()
let shared: Client | null = null

function current(): Client {
  const c = store.getStore()
  if (c) return c
  if (isWorkers) throw new Error('No database client for this request')
  shared ??= createClient(env.DATABASE_URL)
  return shared
}

export function withClient<T>(client: Client, fn: () => T): T {
  return store.run(client, fn)
}

export const sql = new Proxy(function () {} as unknown as Client, {
  apply(_t, _this, args) {
    return (current() as unknown as (...a: unknown[]) => unknown)(...args)
  },
  get(_t, prop) {
    const c = current() as unknown as Record<string | symbol, unknown>
    const v = c[prop]
    return typeof v === 'function' ? (v as (...a: unknown[]) => unknown).bind(c) : v
  },
}) as Client

export type Sql = Client
