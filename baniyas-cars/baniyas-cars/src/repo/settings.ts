import { z } from 'zod'
import { sql } from '../db/client.js'
import type { Branch } from '../domain/vehicle.js'
import { normalizeUaePhone } from '../lib/format.js'

const phone = z
  .string()
  .trim()
  .optional()
  .nullable()
  .transform((v, ctx) => {
    if (!v) return null
    const n = normalizeUaePhone(v)
    if (!n) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'enter a valid phone number, e.g. 0501234567' })
      return z.NEVER
    }
    return n
  })

const link = z
  .string()
  .trim()
  .optional()
  .nullable()
  .transform((v, ctx) => {
    if (!v) return null
    try {
      const u = new URL(v)
      if (u.protocol !== 'https:' && u.protocol !== 'http:') throw new Error()
      return u.toString()
    } catch {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'enter a full link starting with https://' })
      return z.NEVER
    }
  })

const text = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .nullable()
    .transform((v) => v || null)

export const departmentSchema = z.object({ name_ar: z.string().trim().min(1).max(60), name_en: z.string().trim().min(1).max(60), phone })

export const siteSettingsSchema = z.object({
  whatsapp: phone,
  phone: phone,
  email: z
    .string()
    .trim()
    .optional()
    .nullable()
    .transform((v, ctx) => {
      if (!v) return null
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'enter a valid email address' })
        return z.NEVER
      }
      return v.toLowerCase()
    }),
  hours_ar: text(120),
  hours_en: text(120),
  instagram_url: link,
  facebook_url: link,
  threads_url: link,
  tiktok_url: link,
  maps_url: link,
  departments: z.array(departmentSchema).max(12).default([]),
})

export type SiteSettings = z.infer<typeof siteSettingsSchema>

const EMPTY: SiteSettings = {
  whatsapp: null,
  phone: null,
  email: null,
  hours_ar: null,
  hours_en: null,
  instagram_url: null,
  facebook_url: null,
  threads_url: null,
  tiktok_url: null,
  maps_url: null,
  departments: [],
}

let cache: { at: number; value: SiteSettings; branches: Branch[] } | null = null
const TTL = 30_000

/** Site-wide contact settings, cached briefly because every page reads them. */
export async function getSiteSettings(): Promise<SiteSettings> {
  return (await load()).value
}
export async function getBranches(): Promise<Branch[]> {
  return (await load()).branches
}

async function load() {
  if (cache && Date.now() - cache.at < TTL) return cache
  const [row] = await sql<{ value: unknown }[]>`select value from settings where key = 'site'`
  const parsed = siteSettingsSchema.safeParse(row?.value ?? {})
  const branches = await sql<Branch[]>`select * from branches order by position, name_en`
  cache = { at: Date.now(), value: parsed.success ? parsed.data : EMPTY, branches }
  return cache
}

export function invalidateSettings() {
  cache = null
}

export async function saveSiteSettings(value: SiteSettings, userId: string | null) {
  await sql`
    insert into settings (key, value, updated_by) values ('site', ${sql.json(value as any)}, ${userId})
    on conflict (key) do update set value = excluded.value, updated_at = now(), updated_by = excluded.updated_by`
  invalidateSettings()
}

export const branchSchema = z.object({
  name_ar: z.string().trim().min(1).max(80),
  name_en: z.string().trim().min(1).max(80),
  address_ar: text(300),
  address_en: text(300),
  phone,
  whatsapp: phone,
  maps_url: link,
  position: z.coerce.number().int().min(0).max(99).default(0),
})

export async function updateBranch(id: string, input: z.infer<typeof branchSchema>) {
  await sql`update branches set ${sql(input as Record<string, any>)}, updated_at = now() where id = ${id}`
  invalidateSettings()
}
