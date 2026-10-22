/**
 * End-to-end tests of the real app against a real PostgreSQL database.
 * Needs TEST_DATABASE_URL pointing at a database whose name contains "test" (it is wiped).
 *   TEST_DATABASE_URL=postgres://postgres@localhost:5432/baniyas_test npm test
 */
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, readdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

const TEST_DB = process.env.TEST_DATABASE_URL
const skip = !TEST_DB || !/test/.test(new URL(TEST_DB).pathname) ? 'set TEST_DATABASE_URL to a *test* database to run integration tests' : false

process.env.NODE_ENV = 'test'
if (TEST_DB) process.env.DATABASE_URL = TEST_DB
process.env.SESSION_SECRET ??= 'integration-secret-'.padEnd(48, 'x')
process.env.SITE_URL = 'http://localhost:3000'
const uploadDir = await mkdtemp(path.join(tmpdir(), 'baniyas-uploads-'))
process.env.LOCAL_STORAGE_DIR = uploadDir
process.env.STORAGE_DRIVER = 'local'

const ORIGIN = 'http://localhost:3000'
let app: { request: (input: string, init?: RequestInit) => Response | Promise<Response> }
let sql: any

before(async () => {
  if (skip) return
  ;({ sql } = await import('../src/db/client.js'))
  await sql`drop schema public cascade`
  await sql`create schema public`
  const { seed } = await import('../scripts/seed.js')
  await seed({ quiet: true })
  const { createAdmin } = await import('../src/lib/auth.js')
  await createAdmin('owner@test.local', 'Owner', 'OwnerPass2026', 'owner')
  await createAdmin('staff@test.local', 'Staff', 'StaffPass2026', 'staff')
  const { createApp } = await import('../src/app.js')
  app = createApp()
})

after(async () => {
  if (sql) await sql.end()
})

const get = (p: string, cookie?: string) => app.request(`${ORIGIN}${p}`, { headers: cookie ? { cookie } : {} })
const post = (p: string, body: Record<string, string> | FormData, cookie?: string, origin = ORIGIN) =>
  app.request(`${ORIGIN}${p}`, {
    method: 'POST',
    headers: { ...(cookie ? { cookie } : {}), ...(origin ? { origin } : {}), host: 'localhost:3000' },
    body: body instanceof FormData ? body : new URLSearchParams(body),
  })

async function loginAs(email: string, password: string) {
  const res = await post('/admin/login', { email, password })
  assert.equal(res.status, 303)
  const cookie = res.headers.get('set-cookie')!.split(';')[0]!
  const html = await (await get('/admin', cookie)).text()
  const csrf = /name="_csrf" value="([^"]+)"/.exec(html)![1]!
  return { cookie, csrf }
}

test('home page renders real inventory in Arabic with RTL and SEO tags', { skip }, async () => {
  const res = await get('/')
  assert.equal(res.status, 200)
  const html = await res.text()
  assert.match(html, /<html lang="ar" dir="rtl">/)
  assert.match(html, /معرض/)
  assert.match(html, /hreflang="en-AE"/)
  assert.match(html, /"@type":"AutoDealer"/)
  assert.doesNotMatch(html, /aggregateRating|"review"/)
  assert.match(html, /https:\/\/wa\.me\/971504422050/)
  assert.ok(res.headers.get('content-security-policy')?.includes("frame-ancestors 'none'"))
})

test('English pages are served under /en', { skip }, async () => {
  const html = await (await get('/en/cars')).text()
  assert.match(html, /<html lang="en" dir="ltr">/)
  assert.match(html, /Cars for sale/)
})

test('Arabic search finds Patrols only', { skip }, async () => {
  const html = await (await get(`/cars?q=${encodeURIComponent('باترول')}`)).text()
  const titles = [...html.matchAll(/<h3[^>]*><a href="\/cars\/([a-z0-9-]+)"/g)].map((m) => m[1]!)
  assert.ok(titles.length >= 10)
  assert.ok(titles.every((s) => s.startsWith('nissan-patrol')))
})

test('price filter and sort work together', { skip }, async () => {
  const html = await (await get('/cars?price_max=60000&sort=price_asc')).text()
  const prices = [...html.matchAll(/<span class="plate-num num">([\d,]+)<\/span>/g)].map((m) => Number(m[1]!.replace(/,/g, '')))
  assert.ok(prices.length > 0)
  assert.ok(prices.every((p) => p <= 60000))
  assert.deepEqual(prices, [...prices].sort((a, b) => a - b))
})

test('filters with no results show the empty state', { skip }, async () => {
  const html = await (await get('/cars?make=Nissan&price_max=1000')).text()
  assert.match(html, /لا توجد سيارات تطابق هذا البحث/)
})

test('vehicle page shows specs, source and a prefilled WhatsApp message', { skip }, async () => {
  const res = await get('/cars/nissan-patrol-le-t2-2026-275740')
  assert.equal(res.status, 200)
  const html = await res.text()
  assert.match(html, /318,000/)
  assert.match(html, /auto\.ae/)
  const wa = /href="(https:\/\/wa\.me\/[^"]+)"[^>]*data-track="wa-vehicle"/.exec(html)![1]!.replace(/&amp;/g, '&')
  const text = decodeURIComponent(wa.split('text=')[1]!)
  assert.match(text, /^السلام عليكم، استفسر عن سيارة نيسان باترول LE T2 موديل 2026، المعروضة بسعر 318,000 درهم\. هل السيارة متوفرة؟/)
  assert.match(html, /"@type":\["Car","Product"\]/)
  assert.match(html, /يرجى تأكيد التوفر/) // flagged as a possible duplicate in the dataset
})

test('suspicious source price is hidden, not shown', { skip }, async () => {
  const html = await (await get('/cars/mg-5-gt-2026-275763')).text()
  assert.doesNotMatch(html, /372,500/)
  assert.match(html, /يرجى التواصل للاستفسار/)
})

test('unknown car returns a 404 page', { skip }, async () => {
  const res = await get('/cars/not-a-real-car')
  assert.equal(res.status, 404)
  assert.match(await res.text(), /الصفحة غير موجودة/)
})

test('sitemap and robots are generated', { skip }, async () => {
  const xml = await (await get('/sitemap.xml')).text()
  assert.match(xml, /<loc>http:\/\/localhost:3000\/cars\/nissan-patrol-le-t2-2026-275740<\/loc>/)
  assert.match(xml, /<loc>http:\/\/localhost:3000\/en\/cars\/nissan-patrol-le-t2-2026-275740<\/loc>/)
  assert.match(await (await get('/robots.txt')).text(), /Disallow: \/admin/)
})

test('call-back form validates, stores and blocks bots', { skip }, async () => {
  const url = '/cars/nissan-patrol-le-t2-2026-275740/inquiry'
  const ok = await post(url, { name: 'Test Buyer', phone: '050 123 4567', message: 'Is it available?' })
  assert.equal(ok.status, 303)
  assert.match(ok.headers.get('location')!, /sent=1/)
  const bad = await post(url, { name: 'X', phone: 'abc' })
  assert.match(bad.headers.get('location')!, /sent=invalid/)
  await post(url, { name: 'Bot', phone: '0501111111', website: 'spam.example' })
  const rows = await sql`select name, phone from inquiries order by created_at`
  assert.deepEqual(rows.map((r: any) => [r.name, r.phone]), [['Test Buyer', '+971501234567']])
})

test('admin requires login, same-origin requests and a CSRF token', { skip }, async () => {
  const anon = await get('/admin/vehicles')
  assert.equal(anon.status, 302)
  assert.equal(anon.headers.get('location'), '/admin/login')
  assert.equal((await post('/admin/login', { email: 'owner@test.local', password: 'nope' })).status, 401)
  assert.equal((await post('/admin/login', { email: 'owner@test.local', password: 'OwnerPass2026' }, undefined, 'https://evil.example')).status, 403)
  const { cookie } = await loginAs('owner@test.local', 'OwnerPass2026')
  const noToken = await post('/admin/vehicles/new', { make: 'Toyota', model: 'Camry', year: '2026' }, cookie)
  assert.equal(noToken.status, 403)
})

test('admin can create, edit, sell and delete a vehicle, and the site follows', { skip }, async () => {
  const { cookie, csrf } = await loginAs('owner@test.local', 'OwnerPass2026')
  const invalid = await post('/admin/vehicles/new', { _csrf: csrf, make: '', model: 'Camry', year: '2026' }, cookie)
  assert.equal(invalid.status, 422)

  const created = await post(
    '/admin/vehicles/new',
    { _csrf: csrf, make: 'Toyota', model: 'Camry', trim: 'Test Trim', year: '2026', price_aed: '99,000', condition: 'new', mileage_km: '0', status: 'available', verification: 'confirmed' },
    cookie,
  )
  assert.equal(created.status, 303)
  const id = /\/admin\/vehicles\/([0-9a-f-]{36})/.exec(created.headers.get('location')!)![1]!
  const [{ slug }] = await sql`select slug from vehicles where id = ${id}`
  assert.match(await (await get(`/cars/${slug}`)).text(), /99,000/)

  // Edit price
  const edit = await post(`/admin/vehicles/${id}`, { _csrf: csrf, make: 'Toyota', model: 'Camry', trim: 'Test Trim', year: '2026', price_aed: '97500', status: 'available', verification: 'confirmed' }, cookie)
  assert.equal(edit.status, 303)
  const page = await (await get(`/cars/${slug}`)).text()
  assert.match(page, /97,500/)
  assert.doesNotMatch(page, /99,000/)

  // Upload a photo (validated and re-encoded by sharp)
  const sharp = (await import('sharp')).default
  const jpeg = await sharp({ create: { width: 900, height: 1200, channels: 3, background: '#335566' } }).jpeg().toBuffer()
  const fd = new FormData()
  fd.set('_csrf', csrf)
  fd.append('photos', new File([new Uint8Array(jpeg)], 'car.jpg', { type: 'image/jpeg' }))
  fd.append('photos', new File([new TextEncoder().encode('not an image')], 'evil.jpg', { type: 'image/jpeg' }))
  const up = await post(`/admin/vehicles/${id}/images`, fd, cookie)
  assert.equal(up.status, 303)
  assert.match(up.headers.get('location')!, /m=upload_error/) // the fake image is rejected
  const imgs = await sql`select url, storage_key from vehicle_images where vehicle_id = ${id}`
  assert.equal(imgs.length, 1)
  const files = await readdir(path.join(uploadDir, path.dirname(imgs[0].storage_key)))
  assert.equal(files.length, 2) // large + thumbnail
  const served = await get(imgs[0].url)
  assert.equal(served.status, 200)

  // Mark as sold: leaves the listing, page still resolves with a sold notice
  await post(`/admin/vehicles/${id}/status`, { _csrf: csrf, status: 'sold' }, cookie)
  assert.doesNotMatch(await (await get('/cars?q=camry')).text(), new RegExp(slug))
  assert.match(await (await get(`/cars/${slug}`)).text(), /تم بيع هذه السيارة/)

  // Delete removes the record and stored files
  await post(`/admin/vehicles/${id}/delete`, { _csrf: csrf }, cookie)
  assert.equal((await get(`/cars/${slug}`)).status, 404)
  const audit = await sql`select action from audit_log where entity_id = ${id}`
  assert.ok(audit.length >= 4)
})

test('staff cannot change contact settings; owner can, with validation', { skip }, async () => {
  const staff = await loginAs('staff@test.local', 'StaffPass2026')
  const res = await get('/admin/settings', staff.cookie)
  assert.equal(res.status, 302)
  const owner = await loginAs('owner@test.local', 'OwnerPass2026')
  const bad = await post('/admin/settings', { _csrf: owner.csrf, whatsapp: 'not a phone' }, owner.cookie)
  assert.equal(bad.status, 422)
  const good = await post(
    '/admin/settings',
    { _csrf: owner.csrf, whatsapp: '0504422050', phone: '0508001443', email: 'info@baniyascars.com', instagram_url: 'https://www.instagram.com/baniyascars/', departments: 'قسم التصدير | Export | 0506131744' },
    owner.cookie,
  )
  assert.equal(good.status, 303)
  const [{ value }] = await sql`select value from settings where key = 'site'`
  assert.equal(value.whatsapp, '+971504422050')
  assert.equal(value.departments[0].phone, '+971506131744')
})

test('CSV export, preview and import: updates by source_key, skips duplicates, reports errors', { skip }, async () => {
  const { cookie, csrf } = await loginAs('owner@test.local', 'OwnerPass2026')
  const bytes = new Uint8Array(await (await get('/admin/export.csv', cookie)).arrayBuffer())
  assert.deepEqual([...bytes.slice(0, 3)], [0xef, 0xbb, 0xbf]) // UTF-8 BOM so Excel shows Arabic correctly
  const exported = new TextDecoder().decode(bytes)
  assert.ok(exported.startsWith('source_key,make,model'))
  assert.match(exported, /auto\.ae:275740/)

  const csv = [
    'source_key,make,model,trim,year,price_aed,mileage_km,status,branch,images',
    'auto.ae:275740,Nissan,Patrol,LE T2,2026,315000,,,abu-dhabi,',
    ',Kia,Sportage,LX,2025,88000,15000,available,dubai,https://example.com/a.jpg | https://example.com/b.jpg',
    ',Nissan,Patrol,LE T2,2026,318000,0,available,,',
    ',Toyota,,,,,,,,',
    'manual:1,Ford,Explorer,,2024,120000,30000,available,mars,',
  ].join('\n')
  const fd = new FormData()
  fd.set('_csrf', csrf)
  fd.set('file', new File([csv], 'inv.csv', { type: 'text/csv' }))
  const preview = await (await post('/admin/import/preview', fd, cookie)).text()
  assert.match(preview, /تحديث/)
  assert.match(preview, /إضافة/)
  assert.match(preview, /تجاهل/)
  assert.match(preview, /الفرع &quot;mars&quot; غير موجود|الفرع "mars" غير موجود/)

  const apply = await post('/admin/import/apply', { _csrf: csrf, csv }, cookie)
  assert.equal(apply.status, 303)
  const [patrol] = await sql`select price_aed, trim, mileage_km from vehicles where source_key = 'auto.ae:275740'`
  assert.equal(patrol.price_aed, 315000)
  assert.equal(patrol.mileage_km, 0) // empty cell kept the stored value
  const kia = await sql`select v.id, (select count(*)::int from vehicle_images i where i.vehicle_id = v.id) as n from vehicles v where make = 'Kia'`
  assert.equal(kia.length, 1)
  assert.equal(kia[0].n, 2)
  assert.equal((await sql`select 1 from vehicles where make = 'Ford'`).length, 0)
})

test('re-running the seed updates without duplicating or overwriting dashboard edits', { skip }, async () => {
  await sql`update vehicles set status = 'reserved' where source_key = 'auto.ae:275749'`
  const before = (await sql`select count(*)::int as n from vehicles`)[0].n
  const { seed } = await import('../scripts/seed.js')
  const r = await seed({ quiet: true })
  assert.equal(r.created, 0)
  assert.equal((await sql`select count(*)::int as n from vehicles`)[0].n, before)
  const [v] = await sql`select status from vehicles where source_key = 'auto.ae:275749'`
  assert.equal(v.status, 'reserved')
})
