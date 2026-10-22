import postgres from 'postgres'
import { env } from '../config/env.js'

export const sql = postgres(env.DATABASE_URL, {
  ssl: env.DATABASE_SSL === 'require' ? 'require' : false,
  max: Number(process.env.DATABASE_POOL_MAX ?? 10),
  idle_timeout: 30,
  connect_timeout: 15,
  // Supabase's transaction pooler (port 6543) does not support prepared statements.
  prepare: !/:6543\//.test(env.DATABASE_URL),
  onnotice: () => {},
  transform: { undefined: null },
})

export type Sql = typeof sql
