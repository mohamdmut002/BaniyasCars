import { readdir, readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { sql } from './client.js'
import { log } from '../lib/logger.js'

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'migrations')

/** Applies every .sql file in src/db/migrations that has not run yet, each in its own transaction. */
export async function migrate(): Promise<string[]> {
  await sql`create table if not exists schema_migrations (name text primary key, applied_at timestamptz not null default now())`
  const done = new Set((await sql<{ name: string }[]>`select name from schema_migrations`).map((r) => r.name))
  const files = (await readdir(dir)).filter((f) => f.endsWith('.sql')).sort()
  const applied: string[] = []
  for (const file of files) {
    if (done.has(file)) continue
    const body = await readFile(path.join(dir, file), 'utf8')
    await sql.begin(async (tx) => {
      await tx.unsafe(body)
      await tx`insert into schema_migrations (name) values (${file})`
    })
    log.info('migration applied', { file })
    applied.push(file)
  }
  return applied
}
