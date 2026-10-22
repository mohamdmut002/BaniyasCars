/**
 * Loads the verified dataset into the database. Safe to run repeatedly:
 *  - vehicles are matched on source_key, so re-running updates rather than duplicates;
 *  - status, featured flags and descriptions edited in the dashboard are kept;
 *  - nothing is deleted, even if a listing disappears from the source.
 */
import { readFile } from 'node:fs/promises'
import { sql } from '../src/db/client.js'
import { migrate } from '../src/db/migrate.js'
import type { SeedVehicle } from './build-inventory.js'

const BRANCHES = [
  {
    slug: 'abu-dhabi',
    name_ar: 'فرع أبوظبي — مدينة رحايل للسيارات',
    name_en: 'Abu Dhabi — Rahayel Cars City',
    address_ar: 'آيكاد 5 (مدينة أبوظبي الصناعية)، مدينة رحايل للسيارات، أبوظبي — ص.ب 55805',
    address_en: 'ICAD V (Abu Dhabi Industrial City), Rahayel Cars City, Abu Dhabi — P.O. Box 55805',
    phone: '+971508001443',
    whatsapp: '+971504422050',
    maps_url: null,
    position: 0,
  },
  {
    slug: 'dubai',
    name_ar: 'فرع دبي — رأس الخور',
    name_en: 'Dubai — Ras Al Khor',
    address_ar: 'منطقة رأس الخور الصناعية 3، دبي',
    address_en: 'Ras Al Khor Industrial Area 3, Dubai',
    phone: '+971508131408',
    whatsapp: null,
    maps_url: null,
    position: 1,
  },
  {
    slug: 'al-ain',
    name_ar: 'فرع العين',
    name_en: 'Al Ain',
    address_ar: null,
    address_en: null,
    phone: '+971564404320',
    whatsapp: null,
    maps_url: null,
    position: 2,
  },
]

const SETTINGS = {
  whatsapp: '+971504422050',
  phone: '+971508001443',
  email: 'info@baniyascars.com',
  hours_ar: '9:00 صباحاً – 9:00 مساءً',
  hours_en: '9:00 AM – 9:00 PM',
  instagram_url: 'https://www.instagram.com/baniyascars/',
  facebook_url: 'https://www.facebook.com/bce1981/',
  threads_url: 'https://www.threads.com/@baniyascars',
  tiktok_url: null,
  maps_url: 'https://maps.app.goo.gl/BWHbL7VTG3TRc3g68',
  departments: [
    { name_ar: 'السيارات المستعملة — بيع وشراء', name_en: 'Used cars — buy and sell', phone: '+971506812224' },
    { name_ar: 'قسم التصدير', name_en: 'Export department', phone: '+971506131744' },
  ],
}

export async function seed(opts: { quiet?: boolean } = {}) {
  await migrate()
  const say = (m: string) => !opts.quiet && console.log(m)

  for (const b of BRANCHES) {
    await sql`
      insert into branches ${sql(b)}
      on conflict (slug) do nothing`
  }
  await sql`insert into settings (key, value) values ('site', ${sql.json(SETTINGS)}) on conflict (key) do nothing`

  const branchIds = Object.fromEntries((await sql<{ slug: string; id: string }[]>`select slug, id from branches`).map((b) => [b.slug, b.id]))
  const { vehicles } = JSON.parse(await readFile('data/inventory.json', 'utf8')) as { vehicles: SeedVehicle[] }

  let created = 0
  let updated = 0
  for (const v of vehicles) {
    const { images, branch_slug, ...fields } = v
    const facts = {
      ...fields,
      branch_id: branch_slug ? (branchIds[branch_slug] ?? null) : null,
      features_en: [] as string[],
    }
    const [existing] = await sql<{ id: string; description_ar: string | null }[]>`
      select id, description_ar from vehicles where source_key = ${v.source_key}`
    if (!existing) {
      // Descriptions stay null: the site writes them from the current specs, so they follow price edits.
      const row = { ...facts, status: 'available' }
      const [ins] = await sql<{ id: string }[]>`insert into vehicles ${sql(row as Record<string, any>)} returning id`
      for (const [i, url] of images.entries()) {
        await sql`insert into vehicle_images (vehicle_id, url, position, source) values (${ins!.id}, ${url}, ${i}, 'remote')`
      }
      created++
    } else {
      // Refresh source facts only; keep dashboard edits (status, featured, descriptions, slug, verification).
      // Verification set in the dashboard also wins over the original capture.
      const { slug: _s, featured: _f, featured_rank: _r, verification: _v, verification_note: _vn, ...sourceFacts } = facts
      await sql`update vehicles set ${sql(sourceFacts as Record<string, any>)}, updated_at = now() where id = ${existing.id}`
      const { n } = (await sql<{ n: number }[]>`select count(*)::int as n from vehicle_images where vehicle_id = ${existing.id}`)[0]!
      if (n === 0) {
        for (const [i, url] of images.entries()) {
          await sql`insert into vehicle_images (vehicle_id, url, position, source) values (${existing.id}, ${url}, ${i}, 'remote')`
        }
      }
      updated++
    }
  }

  const offers = (await sql<{ n: number }[]>`select count(*)::int as n from offers`)[0]!.n
  if (offers === 0) {
    const [mg8] = await sql<{ id: string }[]>`select id from vehicles where source_key = 'auto.ae:260839'`
    await sql`
      insert into offers (title_ar, title_en, body_ar, body_en, vehicle_id, active, source_url) values (
        'عرض خط الدفاع الأول على إم جي 8 الهايبرد',
        'First responders offer on the MG 8 hybrid',
        'سعر خاص 75,000 درهم لخط الدفاع الأول بدلاً من 82,000 درهم.',
        'Special price of AED 75,000 for first responders instead of AED 82,000.',
        ${mg8?.id ?? null}, false, 'https://auto.ae/dubai/sale/car/mg/mg-8-2026/id/260839/')`
  }

  say(`seed complete: ${created} vehicles created, ${updated} updated`)
  return { created, updated }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  seed()
    .then(() => sql.end())
    .catch(async (e) => {
      console.error(e)
      await sql.end()
      process.exit(1)
    })
}
