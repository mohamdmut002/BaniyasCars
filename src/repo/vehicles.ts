import { sql } from '../db/client.js'
import type { Branch, Vehicle, VehicleImage, VehicleInput, VehicleWithImages } from '../domain/vehicle.js'
import { FUELS, TRANSMISSIONS } from '../domain/vehicle.js'
import { translateQuery } from '../domain/names.js'
import { vehicleSlug } from '../lib/slug.js'
import { randomBytes } from 'node:crypto'

export const SORTS = ['recent', 'price_asc', 'price_desc', 'year_desc', 'mileage_asc'] as const
export type Sort = (typeof SORTS)[number]

export interface VehicleFilters {
  q?: string
  make?: string
  model?: string
  yearMin?: number
  yearMax?: number
  priceMin?: number
  priceMax?: number
  mileageMax?: number
  transmission?: string[]
  fuel?: string[]
  condition?: 'new' | 'used'
  gcc?: boolean
  hideExport?: boolean
  sort?: Sort
  page?: number
  perPage?: number
}

const int = (v: string | null | undefined, min: number, max: number): number | undefined => {
  if (!v) return undefined
  const n = Number(v.replace(/[,\s]/g, ''))
  return Number.isInteger(n) && n >= min && n <= max ? n : undefined
}

/** Reads filters from a URL query string, ignoring anything malformed rather than failing the page. */
export function parseFilters(params: URLSearchParams): VehicleFilters {
  const list = (k: string, allowed: readonly string[]) => params.getAll(k).filter((v) => allowed.includes(v))
  const sort = params.get('sort')
  const cond = params.get('condition')
  return {
    q: params.get('q')?.trim().slice(0, 80) || undefined,
    make: params.get('make')?.slice(0, 60) || undefined,
    model: params.get('model')?.slice(0, 80) || undefined,
    yearMin: int(params.get('year_min'), 1950, 2100),
    yearMax: int(params.get('year_max'), 1950, 2100),
    priceMin: int(params.get('price_min'), 0, 100_000_000),
    priceMax: int(params.get('price_max'), 0, 100_000_000),
    mileageMax: int(params.get('mileage_max'), 0, 5_000_000),
    transmission: list('transmission', TRANSMISSIONS),
    fuel: list('fuel', FUELS),
    condition: cond === 'new' || cond === 'used' ? cond : undefined,
    gcc: params.get('gcc') === '1',
    hideExport: params.get('hide_export') === '1',
    sort: (SORTS as readonly string[]).includes(sort ?? '') ? (sort as Sort) : 'recent',
    page: int(params.get('page'), 1, 1000) ?? 1,
  }
}

/** Public listing: available and reserved cars that are not historical. */
const PUBLIC = sql`v.status in ('available', 'reserved') and v.verification <> 'historical'`

function whereClause(f: VehicleFilters) {
  const parts = [PUBLIC]
  if (f.q) {
    const tokens = translateQuery(f.q)
      .split(' ')
      .filter((t) => t.length > 0)
      .slice(0, 6)
    for (const tok of tokens) {
      const like = `%${tok.replace(/[%_\\]/g, (m) => '\\' + m)}%`
      parts.push(sql`lower(v.make || ' ' || v.model || ' ' || coalesce(v.trim, '') || ' ' || v.year::text) like ${like}`)
    }
  }
  if (f.make) parts.push(sql`lower(v.make) = lower(${f.make})`)
  if (f.model) parts.push(sql`lower(v.model) = lower(${f.model})`)
  if (f.yearMin) parts.push(sql`v.year >= ${f.yearMin}`)
  if (f.yearMax) parts.push(sql`v.year <= ${f.yearMax}`)
  if (f.priceMin) parts.push(sql`v.price_aed >= ${f.priceMin}`)
  if (f.priceMax) parts.push(sql`v.price_aed <= ${f.priceMax}`)
  if (f.mileageMax != null) parts.push(sql`v.mileage_km <= ${f.mileageMax}`)
  if (f.transmission?.length) parts.push(sql`v.transmission = any(${f.transmission})`)
  if (f.fuel?.length) parts.push(sql`v.fuel = any(${f.fuel})`)
  if (f.condition) parts.push(sql`v.condition = ${f.condition}`)
  if (f.gcc) parts.push(sql`v.regional_spec = 'gcc'`)
  if (f.hideExport) parts.push(sql`not v.export_only`)
  return parts.reduce((acc, p, i) => (i === 0 ? p : sql`${acc} and ${p}`))
}

function orderClause(sort: Sort = 'recent') {
  switch (sort) {
    case 'price_asc':
      return sql`v.price_aed asc nulls last, v.created_at desc`
    case 'price_desc':
      return sql`v.price_aed desc nulls last, v.created_at desc`
    case 'year_desc':
      return sql`v.year desc, v.price_aed desc nulls last`
    case 'mileage_asc':
      return sql`v.mileage_km asc nulls last, v.year desc`
    default:
      // Cars with photos first, then newest listing date.
      return sql`v.status = 'reserved', not exists (select 1 from vehicle_images i where i.vehicle_id = v.id), coalesce(v.listed_at, v.created_at) desc, v.id`
  }
}

async function attach(rows: Vehicle[], opts: { allImages?: boolean } = {}): Promise<VehicleWithImages[]> {
  if (!rows.length) return []
  const ids = rows.map((r) => r.id)
  const images = opts.allImages
    ? await sql<(VehicleImage & { vehicle_id: string })[]>`
        select * from vehicle_images where vehicle_id = any(${ids}) order by position, created_at`
    : await sql<(VehicleImage & { vehicle_id: string })[]>`
        select distinct on (vehicle_id) * from vehicle_images where vehicle_id = any(${ids}) order by vehicle_id, position, created_at`
  const branchIds = [...new Set(rows.map((r) => r.branch_id).filter((x): x is string => !!x))]
  const branches = branchIds.length ? await sql<Branch[]>`select * from branches where id = any(${branchIds})` : []
  return rows.map((r) => ({
    ...r,
    images: images.filter((i) => i.vehicle_id === r.id),
    branch: branches.find((b) => b.id === r.branch_id) ?? null,
  }))
}

export async function searchVehicles(f: VehicleFilters) {
  const perPage = f.perPage ?? 24
  const page = Math.max(1, f.page ?? 1)
  const where = whereClause(f)
  const { count } = (await sql<{ count: number }[]>`select count(*)::int as count from vehicles v where ${where}`)[0]!
  const rows = await sql<Vehicle[]>`
    select v.* from vehicles v where ${where}
    order by ${orderClause(f.sort)}
    limit ${perPage} offset ${(page - 1) * perPage}`
  return { total: count, page, perPage, pages: Math.max(1, Math.ceil(count / perPage)), items: await attach(rows) }
}

export async function featuredVehicles(limit = 8) {
  const rows = await sql<Vehicle[]>`
    select v.* from vehicles v
    where ${PUBLIC} and v.featured and exists (select 1 from vehicle_images i where i.vehicle_id = v.id)
    order by v.featured_rank nulls last, v.updated_at desc limit ${limit}`
  return attach(rows)
}

export async function recentVehicles(limit = 8, excludeIds: string[] = []) {
  const rows = await sql<Vehicle[]>`
    select v.* from vehicles v
    where ${PUBLIC} and v.verification = 'confirmed' and not (v.id = any(${excludeIds}))
    order by coalesce(v.listed_at, v.created_at) desc limit ${limit}`
  return attach(rows)
}

export async function brandCounts() {
  return sql<{ make: string; count: number; min_price: number | null }[]>`
    select v.make, count(*)::int as count, min(v.price_aed)::int as min_price
    from vehicles v where ${PUBLIC} group by v.make order by count(*) desc, v.make`
}

export async function modelsByMake() {
  return sql<{ make: string; model: string; count: number }[]>`
    select v.make, v.model, count(*)::int as count from vehicles v where ${PUBLIC}
    group by v.make, v.model order by v.make, v.model`
}

export const PRICE_BANDS = [
  { key: 'under50', min: undefined, max: 49_999 },
  { key: '50to100', min: 50_000, max: 100_000 },
  { key: '100to200', min: 100_001, max: 200_000 },
  { key: '200to300', min: 200_001, max: 300_000 },
  { key: 'over300', min: 300_001, max: undefined },
] as const

export async function priceBandCounts() {
  const rows = await sql<{ price_aed: number }[]>`select v.price_aed from vehicles v where ${PUBLIC} and v.price_aed is not null`
  return PRICE_BANDS.map((b) => ({
    ...b,
    count: rows.filter((r) => (b.min == null || r.price_aed >= b.min) && (b.max == null || r.price_aed <= b.max)).length,
  }))
}

export async function inventoryStats() {
  const [s] = await sql<{ total: number; year_min: number; year_max: number }[]>`
    select count(*)::int as total, min(year)::int as year_min, max(year)::int as year_max from vehicles v where ${PUBLIC}`
  return s ?? { total: 0, year_min: 0, year_max: 0 }
}

/** Detail page: anything except hidden cars. Sold or historical cars still resolve so shared links do not break. */
export async function getVehicleBySlug(slug: string) {
  const rows = await sql<Vehicle[]>`select * from vehicles where slug = ${slug} and status <> 'hidden' limit 1`
  const [v] = await attach(rows, { allImages: true })
  return v ?? null
}

export async function similarVehicles(v: Vehicle, limit = 4) {
  const rows = await sql<Vehicle[]>`
    select x.* from vehicles x
    where x.status in ('available', 'reserved') and x.verification <> 'historical' and x.id <> ${v.id}
    order by
      (lower(x.make) = lower(${v.make}) and lower(x.model) = lower(${v.model}))::int desc,
      (x.body_type is not distinct from ${v.body_type}::text)::int desc,
      abs(coalesce(x.price_aed, 0) - ${v.price_aed ?? 0}::int) asc
    limit ${limit}`
  return attach(rows)
}

export async function sitemapVehicles() {
  return sql<{ slug: string; updated_at: Date }[]>`
    select slug, updated_at from vehicles v where ${PUBLIC} order by updated_at desc`
}

/* ------------------------------ admin ------------------------------ */

export interface AdminVehicleFilters {
  q?: string
  status?: string
  verification?: string
  page?: number
}

export async function adminListVehicles(f: AdminVehicleFilters) {
  const perPage = 40
  const page = Math.max(1, f.page ?? 1)
  const parts = [sql`true`]
  if (f.q) {
    for (const tok of translateQuery(f.q).split(' ').filter(Boolean).slice(0, 6)) {
      const like = `%${tok.replace(/[%_\\]/g, (m) => '\\' + m)}%`
      parts.push(
        sql`lower(v.make || ' ' || v.model || ' ' || coalesce(v.trim, '') || ' ' || v.year::text || ' ' || coalesce(v.source_key, '')) like ${like}`,
      )
    }
  }
  if (f.status) parts.push(sql`v.status = ${f.status}`)
  if (f.verification) parts.push(sql`v.verification = ${f.verification}`)
  const where = parts.reduce((a, p) => sql`${a} and ${p}`)
  const { count } = (await sql<{ count: number }[]>`select count(*)::int as count from vehicles v where ${where}`)[0]!
  const rows = await sql<Vehicle[]>`
    select v.* from vehicles v where ${where}
    order by v.verification = 'confirmed', v.updated_at desc limit ${perPage} offset ${(page - 1) * perPage}`
  return { total: count, page, pages: Math.max(1, Math.ceil(count / perPage)), items: await attach(rows) }
}

export async function adminGetVehicle(id: string) {
  if (!/^[0-9a-f-]{36}$/.test(id)) return null
  const rows = await sql<Vehicle[]>`select * from vehicles where id = ${id}`
  const [v] = await attach(rows, { allImages: true })
  return v ?? null
}

export async function adminCounts() {
  const [c] = await sql<{ total: number; available: number; reserved: number; sold: number; flagged: number; no_photos: number }[]>`
    select count(*)::int as total,
      count(*) filter (where status = 'available')::int as available,
      count(*) filter (where status = 'reserved')::int as reserved,
      count(*) filter (where status = 'sold')::int as sold,
      count(*) filter (where verification <> 'confirmed' and status <> 'sold')::int as flagged,
      count(*) filter (where status <> 'sold' and not exists (select 1 from vehicle_images i where i.vehicle_id = vehicles.id))::int as no_photos
    from vehicles`
  return c!
}

const COLUMNS = [
  'make', 'model', 'trim', 'generation', 'year', 'price_aed', 'price_includes_vat', 'mileage_km', 'condition', 'transmission',
  'gears', 'fuel', 'engine_l', 'horsepower', 'torque_nm', 'drivetrain', 'body_type', 'body_detail', 'exterior_color',
  'interior_color', 'regional_spec', 'export_only', 'warranty_ar', 'warranty_en', 'features_ar', 'features_en',
  'description_ar', 'description_en', 'status', 'verification', 'verification_note', 'featured', 'featured_rank',
  'branch_id', 'listed_at', 'source_url', 'source_label',
] as const

function pick(input: VehicleInput) {
  return Object.fromEntries(COLUMNS.map((c) => [c, (input as Record<string, unknown>)[c] ?? null])) as Record<
    (typeof COLUMNS)[number],
    unknown
  >
}

export async function createVehicle(input: VehicleInput, extra: { source_key?: string | null } = {}) {
  const data = {
    ...pick(input),
    features_ar: input.features_ar,
    features_en: input.features_en,
    slug: vehicleSlug(input, randomBytes(3).toString('hex')),
    source_key: extra.source_key ?? null,
    last_verified_at: new Date(),
  }
  const [row] = await sql<{ id: string; slug: string }[]>`insert into vehicles ${sql(data as Record<string, any>)} returning id, slug`
  return row!
}

export async function updateVehicle(id: string, input: VehicleInput) {
  const data = { ...pick(input), features_ar: input.features_ar, features_en: input.features_en, updated_at: new Date() }
  const [row] = await sql<{ id: string; slug: string }[]>`
    update vehicles set ${sql(data as Record<string, any>)} where id = ${id} returning id, slug`
  return row ?? null
}

export async function setVehicleStatus(id: string, status: string) {
  await sql`update vehicles set status = ${status}, updated_at = now() where id = ${id}`
}

export async function markVerified(id: string) {
  await sql`update vehicles set verification = 'confirmed', last_verified_at = now(), updated_at = now() where id = ${id}`
}

export async function deleteVehicle(id: string) {
  const keys = await sql<{ storage_key: string }[]>`
    select storage_key from vehicle_images where vehicle_id = ${id} and storage_key is not null`
  await sql`delete from vehicles where id = ${id}`
  return keys.map((k) => k.storage_key)
}

export async function addImage(
  vehicleId: string,
  img: { url: string; storage_key: string | null; width?: number | null; height?: number | null; source: 'upload' | 'remote' },
) {
  const { next } = (await sql<{ next: number }[]>`
    select coalesce(max(position), -1)::int + 1 as next from vehicle_images where vehicle_id = ${vehicleId}`)[0]!
  await sql`
    insert into vehicle_images (vehicle_id, url, storage_key, width, height, position, source)
    values (${vehicleId}, ${img.url}, ${img.storage_key}, ${img.width ?? null}, ${img.height ?? null}, ${next}, ${img.source})`
  await sql`update vehicles set updated_at = now() where id = ${vehicleId}`
}

export async function deleteImage(vehicleId: string, imageId: string) {
  const [row] = await sql<{ storage_key: string | null }[]>`
    delete from vehicle_images where id = ${imageId} and vehicle_id = ${vehicleId} returning storage_key`
  return row ?? null
}

export async function reorderImages(vehicleId: string, orderedIds: string[]) {
  await sql.begin(async (tx) => {
    for (const [i, id] of orderedIds.entries()) {
      await tx`update vehicle_images set position = ${i} where id = ${id} and vehicle_id = ${vehicleId}`
    }
  })
}

export async function allVehiclesForExport() {
  const rows = await sql<(Vehicle & { branch_slug: string | null; image_urls: string[] })[]>`
    select v.*, b.slug as branch_slug,
      coalesce((select array_agg(i.url order by i.position) from vehicle_images i where i.vehicle_id = v.id), '{}') as image_urls
    from vehicles v left join branches b on b.id = v.branch_id
    order by v.created_at`
  return rows
}
