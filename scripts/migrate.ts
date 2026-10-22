import { migrate } from '../src/db/migrate.js'
import { sql } from '../src/db/client.js'

migrate()
  .then((a) => {
    console.log(a.length ? `applied ${a.length} migration(s): ${a.join(', ')}` : 'database is up to date')
    return sql.end()
  })
  .catch(async (e) => {
    console.error('migration failed:', e)
    await sql.end()
    process.exit(1)
  })
