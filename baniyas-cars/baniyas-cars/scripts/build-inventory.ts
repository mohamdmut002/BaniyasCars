/**
 * Turns the raw captures in data/sources/ into data/inventory.json (what the seed loads)
 * and data/inventory-verified.csv (a human-readable list with sources and flags).
 *
 * Rules:
 *  - Only fields stated by a source are filled. Everything else stays null and shows as "not available".
 *  - Listings older than 90 days on capture date are marked "needs_confirmation".
 *  - Known conflicts and suspicious values are written to verification_note for the dealership to check.
 */
import { readFile, writeFile } from 'node:fs/promises'
import { toCsv } from '../src/lib/csv.js'
import { vehicleSlug } from '../src/lib/slug.js'

const CAPTURED = '2026-10-22T12:00:00+04:00'
const STALE_DAYS = 90
const IMG_BASE = 'https://auto-ae-prod-storage.storage.googleapis.com/'

type Raw = {
  capturedAt: string
  columns: string[]
  rows: (string | number | null)[][]
  dealerText: Record<string, string>
}
type Ig = {
  listings: {
    postUrl: string
    alsoPosted?: string[]
    postedAt: string
    make: string
    model: string
    trim?: string
    year: number
    condition?: 'new' | 'used'
    mileageKm?: number
    priceAed?: number
    priceIncludesVat?: boolean
    engine?: string
    hp?: number
    torqueNm?: number
    transmission?: string
    gears?: number
    drivetrain?: string
    fuelTankL?: number
    warranty?: string
    features?: string[]
  }[]
  matchesToAutoAe: {
    postUrl: string
    postedAt: string
    autoAeId: string
    warranty?: string
    priceIncludesVat?: boolean
    features?: string[]
  }[]
}

export type SeedVehicle = {
  source_key: string
  slug: string
  make: string
  model: string
  trim: string | null
  generation: string | null
  year: number
  price_aed: number | null
  price_includes_vat: boolean | null
  mileage_km: number | null
  condition: 'new' | 'used' | null
  transmission: string | null
  gears: number | null
  fuel: string | null
  engine_l: string | null
  horsepower: number | null
  torque_nm: number | null
  drivetrain: string | null
  body_type: string | null
  body_detail: string | null
  exterior_color: string | null
  interior_color: string | null
  regional_spec: string | null
  export_only: boolean
  warranty_ar: string | null
  warranty_en: string | null
  features_ar: string[]
  verification: 'confirmed' | 'needs_confirmation'
  verification_note: string | null
  featured: boolean
  featured_rank: number | null
  branch_slug: string | null
  listed_at: string | null
  last_verified_at: string
  source_url: string
  source_label: string
  secondary_source_urls: string[]
  images: string[]
}

const TRANS: Record<string, string> = { AT: 'automatic', CVT: 'cvt', MT: 'manual', AMT: 'amt', DCT: 'dct' }
const DRIVE: Record<string, string> = { FWD: 'fwd', RWD: 'rwd', AWD: 'awd' }
const FEATURED = ['275749', '275742', '275743', '276720', '286356', '276719', '286427', '275765']

/** Per-listing corrections, each with the reason shown to the dealership in the dashboard. */
const OVERRIDES: Record<string, Partial<SeedVehicle> & { note?: string }> = {
  '275763': {
    price_aed: null,
    note: 'يظهر في auto.ae سعر 372,500 درهم لهذه الـ MG 5 GT، أي نحو عشرة أضعاف سعر نفس الموديل في إعلان فرع دبي (37,500 درهم). تم إخفاء السعر في الموقع حتى يؤكده المعرض.',
  },
  '260840': {
    note: 'مواصفات الإعلان تذكر محرك 2.5 لتر و171 حصاناً، بينما نص المعرض يقول "2.0L full new shape". أكّد سعة المحرك.',
  },
  '260837': {
    drivetrain: 'fwd',
    horsepower: 181,
    note: 'auto.ae يذكر دفعاً رباعياً و184 حصاناً، بينما منشور إنستغرام المعرض (4 سبتمبر 2026) لنفس السيارة وبنفس السعر يذكر 4×2 و181 حصاناً. المعروض في الموقع هو قيم إنستغرام.',
  },
  '275740': { note: 'نفس الموديل والفئة والسعر في إعلان فرع دبي رقم 286361. قد تكون نفس السيارة معروضة في الفرعين، يرجى التأكد.' },
  '286361': { note: 'نفس الموديل والفئة والسعر في إعلان فرع أبوظبي رقم 275740. قد تكون نفس السيارة معروضة في الفرعين، يرجى التأكد.' },
  '275765': { fuel: 'plugin_hybrid' },
  '260839': { fuel: 'plugin_hybrid' },
}

const WARRANTY_EN: Record<string, string> = {
  'ضمان الوكيل 3 سنوات أو 100 ألف كيلومتر': 'Dealer warranty: 3 years or 100,000 km',
  'ضمان الوكيل 6 سنوات أو 200 ألف كيلومتر': 'Dealer warranty: 6 years or 200,000 km',
  'ضمان الوكيل 6 سنوات أو 200 ألف كيلومتر، وضمان البطارية 8 سنوات أو 120 ألف كيلومتر':
    'Dealer warranty: 6 years or 200,000 km; battery warranty: 8 years or 120,000 km',
  'ضمان الوكيل (المدة غير مذكورة في الإعلان)': 'Dealer warranty (duration not stated in the listing)',
}

/** Warranty stated in auto.ae dealer text. */
const AUTO_AE_WARRANTY: Record<string, string> = {
  '260836': 'ضمان الوكيل 3 سنوات أو 100 ألف كيلومتر',
  '260837': 'ضمان الوكيل 3 سنوات أو 100 ألف كيلومتر',
  '260839': 'ضمان الوكيل 6 سنوات أو 200 ألف كيلومتر',
}
const AUTO_AE_VAT_INCLUDED = new Set(['260836', '260837', '260838', '260839'])

function bodyType(b: string): string {
  const s = b.toLowerCase()
  if (s.startsWith('sedan')) return 'sedan'
  if (s.startsWith('suv')) return 'suv'
  if (s.startsWith('pickup')) return 'pickup'
  if (s.startsWith('hatchback')) return 'hatchback'
  return 'other'
}

function daysBetween(a: string, b: string) {
  return (new Date(b).getTime() - new Date(a).getTime()) / 86_400_000
}

async function main() {
  const raw: Raw = JSON.parse(await readFile('data/sources/auto-ae-2026-10-22.json', 'utf8'))
  const ig: Ig = JSON.parse(await readFile('data/sources/instagram-2026-10-22.json', 'utf8'))
  const col = (name: string) => raw.columns.indexOf(name)
  const out: SeedVehicle[] = []

  for (const r of raw.rows) {
    const g = <T = string>(name: string) => r[col(name)] as T
    const id = g('id')
    const [ext, int] = String(g('colors')).split('/').map((s) => s.trim() || null)
    const [engineL, fuelRaw] = String(g('engine')).split(',').map((s) => s.trim())
    const mileage = Number(String(g('mileage')).replace(/[^\d]/g, ''))
    const listedAt = `${g('listedAt')}:00+04:00`
    const stale = daysBetween(listedAt, CAPTURED) > STALE_DAYS
    const ov = OVERRIDES[id] ?? {}
    const igMatch = ig.matchesToAutoAe.find((m) => m.autoAeId === id)
    const warrantyAr = igMatch?.warranty ?? AUTO_AE_WARRANTY[id] ?? null
    const notes: string[] = []
    if (stale) notes.push(`نُشر الإعلان بتاريخ ${listedAt.slice(0, 10)}، أي قبل أكثر من ${STALE_DAYS} يوماً من آخر تحقق. تأكد أن السيارة ما زالت متوفرة وأن السعر محدث.`)
    if (ov.note) notes.push(ov.note)

    const v: SeedVehicle = {
      source_key: `auto.ae:${id}`,
      slug: '',
      make: g('make'),
      model: g('model'),
      trim: g<string | null>('trim'),
      generation: g<string | null>('generation'),
      year: Number(String(g('path')).match(/(\d{4})$/)?.[1]),
      price_aed: Number(g('price')) || null,
      price_includes_vat: AUTO_AE_VAT_INCLUDED.has(id) || igMatch?.priceIncludesVat ? true : null,
      mileage_km: Number.isFinite(mileage) ? mileage : null,
      condition: g('condition') === 'New' ? 'new' : g('condition') === 'Used' ? 'used' : null,
      transmission: TRANS[g('trans')] ?? null,
      gears: null,
      fuel: fuelRaw === 'Petrol' ? 'petrol' : fuelRaw === 'Diesel' ? 'diesel' : fuelRaw === 'Hybrid' ? 'hybrid' : null,
      engine_l: engineL ? Number.parseFloat(engineL).toFixed(1) : null,
      horsepower: Number(g('hp')) || null,
      torque_nm: null,
      drivetrain: DRIVE[g('drive')] ?? null,
      body_type: bodyType(g('body')),
      body_detail: g('body'),
      exterior_color: ext ?? null,
      interior_color: int ?? null,
      regional_spec: g('regional') === 'GCC Specs' ? 'gcc' : null,
      export_only: g('tag') === 'Export only',
      warranty_ar: warrantyAr,
      warranty_en: warrantyAr ? (WARRANTY_EN[warrantyAr] ?? null) : null,
      features_ar: igMatch?.features ?? [],
      verification: stale || ov.note ? 'needs_confirmation' : 'confirmed',
      verification_note: notes.join('\n') || null,
      featured: FEATURED.includes(id),
      featured_rank: FEATURED.includes(id) ? FEATURED.indexOf(id) : null,
      branch_slug: g('branch') === 'A' ? 'abu-dhabi' : 'dubai',
      listed_at: listedAt,
      last_verified_at: CAPTURED,
      source_url: `https://auto.ae/${g('path')}/id/${id}/`,
      source_label: g('branch') === 'A' ? 'auto.ae — Baniyas Cars Abu Dhabi' : 'auto.ae — Baniyas Cars Showroom Dubai',
      secondary_source_urls: igMatch ? [igMatch.postUrl] : [],
      images: String(g('imgs'))
        .split(',')
        .map((s) => `${IMG_BASE}${g('imgPrefix')}${s}`),
    }
    // Overrides for data fields (not the note).
    const { note: _n, ...fields } = ov
    Object.assign(v, fields)
    if (id === '275765' || id === '260839') v.trim = v.trim ?? 'Plug-in Hybrid'
    v.slug = vehicleSlug(v, id)
    out.push(v)
  }

  for (const p of ig.listings) {
    const code = p.postUrl.match(/\/(?:p|reel)\/([^/]+)\//)![1]!
    const engineL = p.engine?.match(/(\d\.\d)/)?.[1] ?? null
    const v: SeedVehicle = {
      source_key: `instagram:${code}`,
      slug: '',
      make: p.make,
      model: p.model,
      trim: p.trim ?? null,
      generation: null,
      year: p.year,
      price_aed: p.priceAed ?? null,
      price_includes_vat: p.priceIncludesVat ?? null,
      mileage_km: p.mileageKm ?? (p.condition === 'new' ? 0 : null),
      condition: p.condition ?? null,
      transmission: p.transmission ? (TRANS[p.transmission] ?? null) : null,
      gears: p.gears ?? null,
      fuel: null,
      engine_l: engineL ? Number(engineL).toFixed(1) : null,
      horsepower: p.hp ?? null,
      torque_nm: p.torqueNm ?? null,
      drivetrain: p.drivetrain ? (DRIVE[p.drivetrain] ?? null) : null,
      body_type: p.model === 'Patrol' ? 'suv' : p.model === 'Sunny' || p.model === 'GT' ? 'sedan' : null,
      body_detail: null,
      exterior_color: null,
      interior_color: null,
      regional_spec: null,
      export_only: false,
      warranty_ar: p.warranty ?? null,
      warranty_en: p.warranty ? (WARRANTY_EN[p.warranty] ?? null) : null,
      features_ar: p.features ?? [],
      verification: 'confirmed',
      verification_note: [
        'إعلان من إنستغرام فقط: لم تُحفظ صور لأن روابط صور إنستغرام تنتهي صلاحيتها. ارفع صور السيارة من لوحة التحكم.',
        p.condition ? null : 'المنشور لا يذكر إن كانت السيارة جديدة أو مستعملة، ولا الممشى.',
      ]
        .filter(Boolean)
        .join('\n'),
      featured: false,
      featured_rank: null,
      branch_slug: null,
      listed_at: `${p.postedAt}T12:00:00+04:00`,
      last_verified_at: CAPTURED,
      source_url: p.postUrl,
      source_label: 'Instagram @baniyascars',
      secondary_source_urls: p.alsoPosted ?? [],
      images: [],
    }
    v.slug = vehicleSlug(v, `ig-${code}`)
    out.push(v)
  }

  const slugs = new Set<string>()
  for (const v of out) {
    if (slugs.has(v.slug)) throw new Error(`duplicate slug ${v.slug}`)
    slugs.add(v.slug)
    if (!Number.isInteger(v.year)) throw new Error(`bad year for ${v.source_key}`)
  }

  await writeFile('data/inventory.json', JSON.stringify({ generatedAt: CAPTURED, vehicles: out }, null, 2) + '\n')
  const csvCols = [
    'source_key', 'make', 'model', 'trim', 'year', 'price_aed', 'price_includes_vat', 'mileage_km', 'condition', 'transmission',
    'fuel', 'engine_l', 'horsepower', 'drivetrain', 'body_type', 'exterior_color', 'interior_color', 'regional_spec', 'export_only',
    'warranty_ar', 'branch_slug', 'listed_at', 'verification', 'verification_note', 'source_url', 'secondary_source_urls', 'photo_count',
  ]
  await writeFile(
    'data/inventory-verified.csv',
    toCsv(out.map((v) => ({ ...v, photo_count: v.images.length })), csvCols),
  )
  const flagged = out.filter((v) => v.verification !== 'confirmed').length
  console.log(`wrote ${out.length} vehicles (${flagged} need confirmation) to data/inventory.json and data/inventory-verified.csv`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
