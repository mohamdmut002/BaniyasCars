import { test } from 'node:test'
import assert from 'node:assert/strict'
import { normalizeUaePhone, displayPhone, formatPrice } from '../src/lib/format.js'
import { whatsappLink, vehicleWhatsappText } from '../src/lib/whatsapp.js'
import { describeAr, describeEn } from '../src/lib/describe.js'
import { translateQuery } from '../src/domain/names.js'
import { applyFilters, emptyFilters, parseFilters, toIndex, toParams } from '../src/lib/filter.js'
import { vehicles } from '../src/data/vehicles.js'
import { defineVehicle } from '../src/data/types.js'
import { validate, homeData, similarTo } from '../scripts/build.js'
import { jsx, raw } from '../src/jsx/jsx-runtime.js'

test('JSX renderer escapes text and attributes, keeps raw HTML', () => {
  const html = jsx('a', { href: '/x?a=1&b="2"', hidden: true, title: null, children: ['<b>', raw('<i>ok</i>'), 3] })
  assert.equal(html.value, '<a href="/x?a=1&amp;b=&quot;2&quot;" hidden>&lt;b&gt;<i>ok</i>3</a>')
})

test('inventory file is valid and every real car has a source', () => {
  assert.deepEqual(validate(vehicles), [])
  assert.equal(vehicles.length, 72)
  for (const v of vehicles) {
    if (v.verification === 'sample') continue
    assert.ok(v.source_url, `${v.slug} has no source_url`)
    assert.ok(v.last_verified_at, `${v.slug} has no last_verified_at`)
  }
})

test('validation catches bad entries', () => {
  const bad = [
    defineVehicle({ slug: 'Bad Slug', make: 'X', model: 'Y', year: 2020 }),
    defineVehicle({ slug: 'dup', make: 'X', model: 'Y', year: 1800 }),
    defineVehicle({ slug: 'dup', make: 'X', model: 'Y', year: 2020, price_aed: -5, images: ['photo.jpg'] }),
  ]
  const problems = validate(bad).join('\n')
  assert.match(problems, /slug must use/)
  assert.match(problems, /duplicate slug/)
  assert.match(problems, /invalid year/)
  assert.match(problems, /price_aed/)
  assert.match(problems, /must be a full URL/)
})

test('UAE phone numbers normalise and display', () => {
  assert.equal(normalizeUaePhone('050 442 2050'), '+971504422050')
  assert.equal(normalizeUaePhone('00971504422050'), '+971504422050')
  assert.equal(displayPhone('+971504422050'), '050 442 2050')
})

test('prices use western digits with the AED label', () => {
  assert.equal(formatPrice(318000, 'ar'), '318,000 درهم')
  assert.equal(formatPrice(318000, 'en'), 'AED 318,000')
})

test('WhatsApp link carries the prefilled Arabic message; no number → no link', () => {
  const text = vehicleWhatsappText({ make: 'Nissan', model: 'Patrol', trim: 'LE T2', year: 2026, price_aed: 318000 }, 'ar')
  assert.equal(text, 'السلام عليكم، استفسر عن سيارة نيسان باترول LE T2 موديل 2026، المعروضة بسعر 318,000 درهم. هل السيارة متوفرة؟')
  const link = whatsappLink('+971504422050', text)!
  assert.ok(link.startsWith('https://wa.me/971504422050?text='))
  assert.equal(decodeURIComponent(link.split('text=')[1]!), text)
  assert.equal(whatsappLink(null, 'x'), null)
  assert.match(vehicleWhatsappText({ make: 'MG', model: '5 (GT)', trim: null, year: 2026, price_aed: null }, 'ar'), /وما سعرها/)
})

test('descriptions only state listed facts', () => {
  const v = defineVehicle({ slug: 'x', make: 'Nissan', model: 'X-Trail', year: 2023, price_aed: 68000, mileage_km: 69240, condition: 'used', transmission: 'cvt', fuel: 'petrol', engine_l: 2.5, horsepower: 184, drivetrain: 'awd' })
  for (const d of [describeAr(v), describeEn(v)]) assert.doesNotMatch(d, /حوادث|accident|ممتازة|excellent|ضمان|warranty|خليجية|GCC/i)
  assert.match(describeAr(v), /69,240 كيلومتر/)
  assert.match(describeAr({ ...v, regional_spec: 'gcc' }), /خليجية/)
})

test('Arabic search words map to stored English names', () => {
  assert.equal(translateQuery('باترول ٢٠٢٦'), 'patrol 2026')
  assert.equal(translateQuery('لاندكروزر'), 'land cruiser')
})

const index = vehicles.filter((v) => v.status !== 'sold').map(toIndex)
const f = (q: string) => applyFilters(index, parseFilters(new URLSearchParams(q)))

test('search works in Arabic and English', () => {
  const ar = f('q=' + encodeURIComponent('باترول'))
  assert.ok(ar.length >= 10)
  assert.ok(ar.every((c) => c.md === 'Patrol'))
  assert.deepEqual(f('q=patrol').map((c) => c.s).sort(), ar.map((c) => c.s).sort())
  assert.ok(f('q=' + encodeURIComponent('تويوتا كامري')).every((c) => c.mk === 'Toyota' && c.md === 'Camry'))
  assert.equal(f('q=lamborghini').length, 0)
})

test('filters combine and exclude unknown values', () => {
  const r = f('make=Toyota&price_max=150000&transmission=automatic&gcc=1')
  assert.ok(r.length > 0)
  assert.ok(r.every((c) => c.mk === 'Toyota' && c.p != null && c.p <= 150000 && c.tr === 'automatic' && c.g === 1))
  assert.ok(f('price_min=1').every((c) => c.p != null)) // the hidden-price MG is not "over 1 AED"
  assert.ok(f('condition=used&mileage_max=100000').every((c) => c.c === 'used' && c.km! <= 100000))
  assert.ok(f('hide_export=1').every((c) => c.x === 0))
})

test('price and year sorting', () => {
  const asc = f('sort=price_asc').map((c) => c.p)
  const known = asc.filter((p) => p != null) as number[]
  assert.deepEqual(known, [...known].sort((a, b) => a - b))
  assert.equal(asc.at(-1), null) // unknown prices go last
  const desc = f('sort=price_desc').map((c) => c.p).filter((p) => p != null) as number[]
  assert.deepEqual(desc, [...desc].sort((a, b) => b - a))
  const years = f('sort=year_asc').map((c) => c.y)
  assert.deepEqual(years, [...years].sort((a, b) => a - b))
  const recent = f('')
  assert.ok(recent.findIndex((c) => !c.ph) > recent.findLastIndex((c) => c.ph)) // cars with photos first
})

test('filter state round-trips through the URL', () => {
  const s = parseFilters(new URLSearchParams('q=patrol&make=Nissan&year_min=2024&price_max=300,000&transmission=automatic&fuel=petrol&condition=new&gcc=1&sort=price_desc&junk=1'))
  assert.equal(s.priceMax, 300000)
  assert.deepEqual(parseFilters(toParams(s)), s)
  assert.equal(toParams(emptyFilters()).toString(), '')
})

test('home data uses only real, unsold cars', () => {
  const h = homeData(vehicles)
  assert.equal(h.stats.total, vehicles.filter((v) => v.status !== 'sold').length)
  assert.ok(h.featured.every((v) => v.featured && v.images.length && v.verification !== 'sample'))
  assert.ok(h.brands.length >= 5)
  const patrol = vehicles.find((v) => v.model === 'Patrol')!
  assert.equal(similarTo(patrol, vehicles)[0]!.model, 'Patrol')
})
