process.env.DATABASE_URL ??= 'postgres://unused@localhost:1/unused'
process.env.SESSION_SECRET ??= 'x'.repeat(40)
process.env.NODE_ENV = 'test'

import { test } from 'node:test'
import assert from 'node:assert/strict'

const { parseCsv, toCsv } = await import('../src/lib/csv.js')
const { slugify, vehicleSlug } = await import('../src/lib/slug.js')
const { normalizeUaePhone, displayPhone, formatPrice } = await import('../src/lib/format.js')
const { whatsappLink, vehicleWhatsappText } = await import('../src/lib/whatsapp.js')
const { describeAr, describeEn } = await import('../src/lib/describe.js')
const { translateQuery } = await import('../src/domain/names.js')
const { signV4 } = await import('../src/lib/storage.js')
const { vehicleInput } = await import('../src/domain/vehicle.js')
const { hashPassword, verifyPassword, passwordProblem } = await import('../src/lib/auth.js')

test('CSV round-trips Arabic text, quotes, commas and newlines', () => {
  const rows = [{ a: 'نيسان باترول', b: 'He said "hi", ok', c: 'line1\nline2' }]
  const out = parseCsv(toCsv(rows, ['a', 'b', 'c']))
  assert.deepEqual(out.header, ['a', 'b', 'c'])
  assert.deepEqual(out.rows[0], rows[0])
})

test('CSV neutralises spreadsheet formulas but keeps negative numbers', () => {
  const csv = toCsv([{ a: '=HYPERLINK("x")', b: '-5' }], ['a', 'b'])
  assert.match(csv, /'=HYPERLINK/)
  assert.match(csv, /,-5\r\n/)
})

test('slugs are latin, unique-suffixed and safe', () => {
  assert.equal(slugify('Land Cruiser Prado TXL3'), 'land-cruiser-prado-txl3')
  assert.equal(vehicleSlug({ make: 'Nissan', model: 'Patrol', trim: 'LE Titanium+', year: 2026 }, '275742'), 'nissan-patrol-le-titanium-plus-2026-275742')
})

test('UAE phone numbers normalise to E.164', () => {
  assert.equal(normalizeUaePhone('050 442 2050'), '+971504422050')
  assert.equal(normalizeUaePhone('00971504422050'), '+971504422050')
  assert.equal(normalizeUaePhone('+971 2 583 1305'), '+97125831305')
  assert.equal(normalizeUaePhone('12'), null)
  assert.equal(displayPhone('+971504422050'), '050 442 2050')
})

test('prices use western digits with the AED label', () => {
  assert.equal(formatPrice(318000, 'ar'), '318,000 درهم')
  assert.equal(formatPrice(318000, 'en'), 'AED 318,000')
  assert.equal(formatPrice(null, 'ar'), null)
})

test('WhatsApp link carries the requested Arabic message', () => {
  const text = vehicleWhatsappText({ make: 'Nissan', model: 'Patrol', trim: 'LE T2', year: 2026, price_aed: 318000 }, 'ar')
  assert.equal(text, 'السلام عليكم، استفسر عن سيارة نيسان باترول LE T2 موديل 2026، المعروضة بسعر 318,000 درهم. هل السيارة متوفرة؟')
  const link = whatsappLink('+971504422050', text)!
  assert.ok(link.startsWith('https://wa.me/971504422050?text='))
  assert.equal(decodeURIComponent(link.split('text=')[1]!), text)
  assert.equal(whatsappLink(null, 'x'), null)
})

test('WhatsApp text without a price asks for it instead of inventing one', () => {
  const text = vehicleWhatsappText({ make: 'MG', model: '5 (GT)', trim: null, year: 2026, price_aed: null }, 'ar')
  assert.match(text, /وما سعرها/)
  assert.doesNotMatch(text, /درهم/)
})

const base = {
  make: 'Nissan', model: 'X-Trail', trim: null, year: 2023, price_aed: 68000, price_includes_vat: null, mileage_km: 69240,
  condition: 'used' as const, transmission: 'cvt' as const, gears: null, fuel: 'petrol' as const, engine_l: '2.5', horsepower: 184,
  drivetrain: 'awd' as const, body_type: 'suv' as const, exterior_color: 'White', regional_spec: null, export_only: false,
  warranty_ar: null, warranty_en: null,
}

test('descriptions only state verified facts', () => {
  for (const d of [describeAr(base), describeEn(base)]) {
    assert.doesNotMatch(d, /حوادث|accident|service history is|original paint|صبغ|excellent condition|ممتازة|ضمان|warranty/i)
  }
  assert.match(describeAr(base), /69,240 كيلومتر/)
  assert.match(describeEn(base), /CVT/)
  assert.doesNotMatch(describeAr({ ...base, regional_spec: null }), /خليجية/)
  assert.match(describeAr({ ...base, regional_spec: 'gcc' }), /خليجية/)
  assert.match(describeAr({ ...base, warranty_ar: 'ضمان الوكيل 3 سنوات' }), /ضمان الوكيل 3 سنوات/)
})

test('Arabic search words map to stored English names', () => {
  assert.equal(translateQuery('باترول ٢٠٢٦'), 'patrol 2026')
  assert.equal(translateQuery('لاندكروزر'), 'land cruiser')
  assert.equal(translateQuery('تويوتا لاند كروزر برادو'), 'toyota land cruiser prado')
})

test('vehicle form validation turns empty fields into null and rejects bad values', () => {
  const ok = vehicleInput.parse({ make: 'Toyota', model: 'Camry', year: '2026', price_aed: '134,000', mileage_km: '', export_only: 'on' })
  assert.equal(ok.price_aed, 134000)
  assert.equal(ok.mileage_km, null)
  assert.equal(ok.export_only, true)
  assert.equal(ok.featured, false)
  assert.equal(vehicleInput.safeParse({ make: '', model: 'X', year: 2026 }).success, false)
  assert.equal(vehicleInput.safeParse({ make: 'A', model: 'X', year: 2026, engine_l: '45' }).success, false)
  assert.equal(vehicleInput.safeParse({ make: 'A', model: 'X', year: 2026, source_url: 'javascript:alert(1)' }).success, false)
})

test('passwords are hashed with PBKDF2 and verified', async () => {
  const h = await hashPassword('Correct horse 42')
  assert.ok(h.startsWith('pbkdf2-sha256$'))
  assert.equal(await verifyPassword('Correct horse 42', h), true)
  assert.equal(await verifyPassword('wrong', h), false)
  assert.ok(passwordProblem('short1'))
  assert.equal(passwordProblem('longenough12'), null)
})

test('S3 signature matches the AWS SigV4 documented example', () => {
  const headers = signV4({
    method: 'GET',
    url: new URL('https://examplebucket.s3.amazonaws.com/test.txt'),
    region: 'us-east-1',
    accessKeyId: 'AKIAIOSFODNN7EXAMPLE',
    secretAccessKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
    body: Buffer.alloc(0),
    headers: { Range: 'bytes=0-9' },
    now: new Date('2013-05-24T00:00:00Z'),
  })
  assert.match(headers.authorization!, /Signature=f0e8bdb87c964420e857bd35b5d6ed310bd44f0170aba48dd91039c6036bdb41$/)
})

test('image signatures and sizes are read without native libraries (Cloudflare path)', async () => {
  const { sniff, stripJpegMetadata } = await import('../src/lib/images.js')
  const sharp = (await import('sharp')).default
  const jpeg = await sharp({ create: { width: 640, height: 480, channels: 3, background: '#123' } }).jpeg().withMetadata({ exif: { IFD0: { Copyright: 'GPS-secret' } } }).toBuffer()
  const png = await sharp({ create: { width: 320, height: 400, channels: 3, background: '#123' } }).png().toBuffer()
  const webp = await sharp({ create: { width: 1200, height: 900, channels: 3, background: '#123' } }).webp().toBuffer()
  assert.deepEqual(sniff(jpeg), { type: 'jpeg', width: 640, height: 480 })
  assert.deepEqual(sniff(png), { type: 'png', width: 320, height: 400 })
  assert.deepEqual(sniff(webp), { type: 'webp', width: 1200, height: 900 })
  assert.equal(sniff(Buffer.from('<?php echo 1; ?>'.padEnd(64, ' '))), null)
  assert.ok(jpeg.includes('GPS-secret'))
  const clean = stripJpegMetadata(jpeg)
  assert.ok(!clean.includes('GPS-secret'))
  assert.deepEqual((await sharp(clean).metadata()).width, 640) // still a valid JPEG
})
