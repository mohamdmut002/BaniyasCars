/**
 * Search, filter and sort for the inventory page. Runs in the browser on a compact index that the
 * build embeds in /cars, and is unit-tested in Node. No server involved.
 */
import { makeName, modelName, normalizeArabic, translateQuery } from '../domain/names.js'
import type { Vehicle } from '../data/types.js'

/** One row per car in the embedded index (short keys keep the page small). */
export interface CarIndex {
  s: string // slug
  mk: string // make
  md: string // model
  y: number
  p: number | null // price AED
  km: number | null
  tr: string | null // transmission
  fu: string | null // fuel
  c: string | null // condition
  g: 0 | 1 // GCC specs confirmed
  x: 0 | 1 // export only
  r: 0 | 1 // reserved
  ph: 0 | 1 // has photos
  l: number // listed date (ms), 0 when unknown
  q: string // search text
}

export const SORTS = ['recent', 'price_asc', 'price_desc', 'year_desc', 'year_asc', 'mileage_asc'] as const
export type Sort = (typeof SORTS)[number]

export interface Filters {
  q: string
  make: string
  model: string
  yearMin: number | null
  yearMax: number | null
  priceMin: number | null
  priceMax: number | null
  mileageMax: number | null
  transmission: string[]
  fuel: string[]
  condition: '' | 'new' | 'used'
  gcc: boolean
  hideExport: boolean
  sort: Sort
}

export const emptyFilters = (): Filters => ({
  q: '',
  make: '',
  model: '',
  yearMin: null,
  yearMax: null,
  priceMin: null,
  priceMax: null,
  mileageMax: null,
  transmission: [],
  fuel: [],
  condition: '',
  gcc: false,
  hideExport: false,
  sort: 'recent',
})

export function toIndex(v: Vehicle): CarIndex {
  const text = [v.make, v.model, v.trim ?? '', String(v.year)].join(' ').toLowerCase()
  const arabic = normalizeArabic([makeName(v.make, 'ar'), modelName(v.model, 'ar')].join(' '))
  return {
    s: v.slug,
    mk: v.make,
    md: v.model,
    y: v.year,
    p: v.price_aed,
    km: v.mileage_km,
    tr: v.transmission,
    fu: v.fuel,
    c: v.condition,
    g: v.regional_spec === 'gcc' ? 1 : 0,
    x: v.export_only ? 1 : 0,
    r: v.status === 'reserved' ? 1 : 0,
    ph: v.images.length ? 1 : 0,
    l: v.listed_at ? Date.parse(v.listed_at) || 0 : 0,
    q: `${text} ${arabic}`,
  }
}

const num = (v: string | null, min: number, max: number): number | null => {
  if (!v) return null
  const n = Number(v.replace(/[,\s٬]/g, '').replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))))
  return Number.isFinite(n) && n >= min && n <= max ? Math.round(n) : null
}

/** Reads filters from a query string; anything malformed is ignored. */
export function parseFilters(params: URLSearchParams): Filters {
  const sort = params.get('sort') as Sort
  const cond = params.get('condition')
  return {
    q: (params.get('q') ?? '').trim().slice(0, 80),
    make: (params.get('make') ?? '').slice(0, 60),
    model: (params.get('model') ?? '').slice(0, 80),
    yearMin: num(params.get('year_min'), 1950, 2100),
    yearMax: num(params.get('year_max'), 1950, 2100),
    priceMin: num(params.get('price_min'), 0, 100_000_000),
    priceMax: num(params.get('price_max'), 0, 100_000_000),
    mileageMax: num(params.get('mileage_max'), 0, 5_000_000),
    transmission: params.getAll('transmission').filter(Boolean),
    fuel: params.getAll('fuel').filter(Boolean),
    condition: cond === 'new' || cond === 'used' ? cond : '',
    gcc: params.get('gcc') === '1',
    hideExport: params.get('hide_export') === '1',
    sort: SORTS.includes(sort) ? sort : 'recent',
  }
}

/** The reverse of parseFilters: only non-default values, so shared links stay short. */
export function toParams(f: Filters): URLSearchParams {
  const p = new URLSearchParams()
  if (f.q) p.set('q', f.q)
  if (f.make) p.set('make', f.make)
  if (f.model) p.set('model', f.model)
  if (f.yearMin != null) p.set('year_min', String(f.yearMin))
  if (f.yearMax != null) p.set('year_max', String(f.yearMax))
  if (f.priceMin != null) p.set('price_min', String(f.priceMin))
  if (f.priceMax != null) p.set('price_max', String(f.priceMax))
  if (f.mileageMax != null) p.set('mileage_max', String(f.mileageMax))
  f.transmission.forEach((t) => p.append('transmission', t))
  f.fuel.forEach((t) => p.append('fuel', t))
  if (f.condition) p.set('condition', f.condition)
  if (f.gcc) p.set('gcc', '1')
  if (f.hideExport) p.set('hide_export', '1')
  if (f.sort !== 'recent') p.set('sort', f.sort)
  return p
}

export function matches(c: CarIndex, f: Filters): boolean {
  if (f.q) {
    const tokens = translateQuery(f.q).toLowerCase().split(' ').filter(Boolean)
    if (!tokens.every((t) => c.q.includes(t))) return false
  }
  if (f.make && c.mk.toLowerCase() !== f.make.toLowerCase()) return false
  if (f.model && c.md.toLowerCase() !== f.model.toLowerCase()) return false
  if (f.yearMin != null && c.y < f.yearMin) return false
  if (f.yearMax != null && c.y > f.yearMax) return false
  // A price or mileage filter excludes cars whose value is unknown: we cannot say they qualify.
  if (f.priceMin != null && (c.p == null || c.p < f.priceMin)) return false
  if (f.priceMax != null && (c.p == null || c.p > f.priceMax)) return false
  if (f.mileageMax != null && (c.km == null || c.km > f.mileageMax)) return false
  if (f.transmission.length && !f.transmission.includes(c.tr ?? '')) return false
  if (f.fuel.length && !f.fuel.includes(c.fu ?? '')) return false
  if (f.condition && c.c !== f.condition) return false
  if (f.gcc && !c.g) return false
  if (f.hideExport && c.x) return false
  return true
}

const nullsLast = (a: number | null, b: number | null, dir: 1 | -1) => {
  if (a == null && b == null) return 0
  if (a == null) return 1
  if (b == null) return -1
  return (a - b) * dir
}

export function compare(sort: Sort) {
  return (a: CarIndex, b: CarIndex): number => {
    switch (sort) {
      case 'price_asc':
        return nullsLast(a.p, b.p, 1) || b.l - a.l
      case 'price_desc':
        return nullsLast(a.p, b.p, -1) || b.l - a.l
      case 'year_desc':
        return b.y - a.y || nullsLast(a.p, b.p, -1)
      case 'year_asc':
        return a.y - b.y || nullsLast(a.p, b.p, 1)
      case 'mileage_asc':
        return nullsLast(a.km, b.km, 1) || b.y - a.y
      default:
        // Available before reserved, cars with photos first, then newest listing.
        return a.r - b.r || b.ph - a.ph || b.l - a.l || a.s.localeCompare(b.s)
    }
  }
}

export function applyFilters(list: CarIndex[], f: Filters): CarIndex[] {
  return list.filter((c) => matches(c, f)).sort(compare(f.sort))
}
