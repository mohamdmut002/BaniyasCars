import { sql } from '../db/client.js'
import { vehicleInput, type Vehicle } from '../domain/vehicle.js'
import { parseCsv, toCsv } from './csv.js'
import { addImage, allVehiclesForExport, createVehicle, updateVehicle } from '../repo/vehicles.js'

export const CSV_COLUMNS = [
  'source_key', 'make', 'model', 'trim', 'generation', 'year', 'price_aed', 'price_includes_vat', 'mileage_km', 'condition',
  'transmission', 'gears', 'fuel', 'engine_l', 'horsepower', 'torque_nm', 'drivetrain', 'body_type', 'body_detail',
  'exterior_color', 'interior_color', 'regional_spec', 'export_only', 'status', 'verification', 'verification_note', 'featured',
  'featured_rank', 'branch', 'listed_at', 'source_url', 'source_label', 'warranty_ar', 'warranty_en', 'features_ar',
  'features_en', 'description_ar', 'description_en', 'images',
] as const

const LIST_SEP = /\s*\|\s*/
const bool = (v: unknown) => (v === true ? 'yes' : v === false ? 'no' : '')

export async function exportCsv(): Promise<string> {
  const rows = await allVehiclesForExport()
  return toCsv(
    rows.map((v) => ({
      ...v,
      price_includes_vat: bool(v.price_includes_vat),
      export_only: v.export_only ? 'yes' : 'no',
      featured: v.featured ? 'yes' : 'no',
      branch: v.branch_slug,
      listed_at: v.listed_at ? v.listed_at.toISOString().slice(0, 10) : '',
      features_ar: v.features_ar.join(' | '),
      features_en: v.features_en.join(' | '),
      images: v.image_urls.join(' | '),
    })),
    [...CSV_COLUMNS],
  )
}

export function templateCsv(): string {
  return toCsv(
    [
      {
        make: 'Nissan', model: 'Patrol', trim: 'LE Platinum City', year: 2026, price_aed: 390000, price_includes_vat: 'yes',
        mileage_km: 0, condition: 'new', transmission: 'automatic', fuel: 'petrol', engine_l: '3.5', horsepower: 425,
        drivetrain: 'awd', body_type: 'suv', exterior_color: 'White', interior_color: 'Tan', regional_spec: 'gcc', export_only: 'no',
        status: 'available', verification: 'confirmed', featured: 'no', branch: 'abu-dhabi', listed_at: '2026-10-22',
        source_url: 'https://www.instagram.com/baniyascars/', warranty_ar: 'ضمان الوكيل 3 سنوات أو 100 ألف كيلومتر',
        features_ar: 'فتحة سقف | كاميرات 360', images: 'https://example.com/photo-1.jpg | https://example.com/photo-2.jpg',
      },
    ],
    [...CSV_COLUMNS],
  )
}

type Prepared =
  | { line: number; action: 'error'; label: string; message: string }
  | { line: number; action: 'skip'; label: string; message: string }
  | { line: number; action: 'create' | 'update'; label: string; message?: string; existingId: string | null; input: ReturnType<typeof vehicleInput.parse>; sourceKey: string | null; images: string[] }

/** Validates every row and decides create / update / skip without writing anything. */
export async function prepareImport(text: string): Promise<Prepared[]> {
  const { header, rows } = parseCsv(text)
  if (!header.includes('make') || !header.includes('model') || !header.includes('year')) {
    return [{ line: 1, action: 'error', label: '—', message: 'الملف لا يحتوي على الأعمدة الأساسية make و model و year. استخدم القالب.' }]
  }
  if (rows.length > 2000) return [{ line: 1, action: 'error', label: '—', message: 'الحد الأقصى 2000 سطر في الملف الواحد.' }]
  const branches = Object.fromEntries((await sql<{ slug: string; id: string }[]>`select slug, id from branches`).map((b) => [b.slug, b.id]))
  const out: Prepared[] = []
  const seenKeys = new Set<string>()

  for (const [i, row] of rows.entries()) {
    const line = i + 2
    const label = [row.make, row.model, row.trim, row.year].filter(Boolean).join(' ') || '—'
    const sourceKey = row.source_key?.trim() || null
    if (sourceKey && seenKeys.has(sourceKey)) {
      out.push({ line, action: 'skip', label, message: `source_key مكرر في الملف (${sourceKey})` })
      continue
    }
    if (sourceKey) seenKeys.add(sourceKey)

    const [existing] = sourceKey ? await sql<Vehicle[]>`select * from vehicles where source_key = ${sourceKey}` : []
    // Start from the stored values so empty cells never erase existing data.
    const baseValues: Record<string, unknown> = existing
      ? {
          ...existing,
          price_includes_vat: bool(existing.price_includes_vat),
          export_only: existing.export_only ? 'on' : '',
          featured: existing.featured ? 'on' : '',
          features_ar: existing.features_ar.join('\n'),
          features_en: existing.features_en.join('\n'),
          listed_at: existing.listed_at ? existing.listed_at.toISOString() : '',
          year: String(existing.year),
        }
      : {}
    const cells: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(row)) {
      if (v === '') continue
      if (k === 'export_only' || k === 'featured') cells[k] = /^(yes|true|1|نعم)$/i.test(v) ? 'on' : ''
      else if (k === 'price_includes_vat') cells[k] = /^(yes|true|1|نعم)$/i.test(v) ? 'yes' : /^(no|false|0|لا)$/i.test(v) ? 'no' : ''
      else if (k === 'features_ar' || k === 'features_en') cells[k] = v.split(LIST_SEP).join('\n')
      else if (k === 'branch') cells.branch_id = branches[v] ?? ''
      else cells[k] = v
    }
    if (row.branch && !branches[row.branch]) {
      out.push({ line, action: 'error', label, message: `الفرع "${row.branch}" غير موجود. القيم المتاحة: ${Object.keys(branches).join('، ')}` })
      continue
    }
    const merged = Object.fromEntries(
      Object.entries({ ...baseValues, ...cells }).map(([k, v]) => [k, v === null || v === undefined ? undefined : typeof v === 'number' ? String(v) : v]),
    )
    const parsed = vehicleInput.safeParse(merged)
    if (!parsed.success) {
      out.push({ line, action: 'error', label, message: parsed.error.issues.map((x) => `${x.path.join('.')}: ${x.message}`).join('؛ ') })
      continue
    }
    const images = (row.images ?? '')
      .split(LIST_SEP)
      .map((s) => s.trim())
      .filter((s) => /^https?:\/\/[^\s]+$/.test(s))
      .slice(0, 40)

    if (!existing) {
      const d = parsed.data
      const [dup] = await sql<{ id: string }[]>`
        select id from vehicles
        where lower(make) = lower(${d.make}) and lower(model) = lower(${d.model}) and year = ${d.year}
          and price_aed is not distinct from ${d.price_aed}::int and mileage_km is not distinct from ${d.mileage_km}::int
          and coalesce(lower(exterior_color), '') = coalesce(lower(${d.exterior_color}::text), '')
          and coalesce(trim, '') = coalesce(${d.trim}::text, '')
        limit 1`
      if (dup && !sourceKey) {
        out.push({ line, action: 'skip', label, message: 'يبدو أنها مكررة لسيارة موجودة (نفس الماركة والموديل والسنة والسعر واللون والممشى). أضف source_key للتمييز.' })
        continue
      }
    }
    out.push({ line, action: existing ? 'update' : 'create', label, existingId: existing?.id ?? null, input: parsed.data, sourceKey, images })
  }
  return out
}

export async function applyImport(prepared: Prepared[]) {
  let created = 0
  let updated = 0
  for (const p of prepared) {
    if (p.action !== 'create' && p.action !== 'update') continue
    const input = { ...p.input }
    if (p.action === 'create') {
      const row = await createVehicle(input, { source_key: p.sourceKey })
      for (const url of p.images) await addImage(row.id, { url, storage_key: null, source: 'remote' })
      created++
    } else if (p.existingId) {
      await updateVehicle(p.existingId, input)
      const { n } = (await sql<{ n: number }[]>`select count(*)::int as n from vehicle_images where vehicle_id = ${p.existingId}`)[0]!
      if (n === 0) for (const url of p.images) await addImage(p.existingId, { url, storage_key: null, source: 'remote' })
      updated++
    }
  }
  return { created, updated }
}
