/**
 * Copies photos that are still loaded from the original listing site into our own storage
 * (local disk or S3), so the website no longer depends on the source site keeping them online.
 *   npm run images:localize            # all remote photos
 *   npm run images:localize -- --limit 50
 * Safe to re-run: photos already copied are skipped; failures are logged and left as they were.
 */
import { sql } from '../src/db/client.js'
import { processAndStore } from '../src/lib/images.js'

const limitArg = process.argv.indexOf('--limit')
const limit = limitArg > -1 ? Number(process.argv[limitArg + 1]) : 10_000

async function main() {
  const rows = await sql<{ id: string; url: string; slug: string }[]>`
    select i.id, i.url, v.slug from vehicle_images i join vehicles v on v.id = i.vehicle_id
    where i.source = 'remote' order by v.updated_at desc, i.position limit ${limit}`
  let ok = 0
  let failed = 0
  for (const r of rows) {
    try {
      const res = await fetch(r.url, { signal: AbortSignal.timeout(20_000), headers: { 'user-agent': 'BaniyasCarsSite/1.0 (image import)' } })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const buf = Buffer.from(await res.arrayBuffer())
      if (buf.length > 25 * 1024 * 1024) throw new Error('image larger than 25 MB')
      const stored = await processAndStore(buf, r.slug)
      await sql`
        update vehicle_images set url = ${stored.url}, storage_key = ${stored.storage_key}, width = ${stored.width},
          height = ${stored.height}, source = 'upload'
        where id = ${r.id}`
      ok++
    } catch (e) {
      failed++
      console.warn(`skip ${r.url}: ${(e as Error).message}`)
    }
  }
  console.log(`localized ${ok} photo(s), ${failed} failed, ${rows.length - ok - failed} untouched`)
}

main()
  .then(() => sql.end())
  .catch(async (e) => {
    console.error(e)
    await sql.end()
    process.exit(1)
  })
