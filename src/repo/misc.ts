import { z } from 'zod'
import { sql } from '../db/client.js'

/* ------------------------------ offers ------------------------------ */

export interface Offer {
  id: string
  title_ar: string
  title_en: string
  body_ar: string | null
  body_en: string | null
  vehicle_id: string | null
  valid_until: string | null
  active: boolean
  source_url: string | null
  created_at: Date
  vehicle_slug?: string | null
}

export const offerSchema = z.object({
  title_ar: z.string().trim().min(2).max(120),
  title_en: z.string().trim().min(2).max(120),
  body_ar: z.string().trim().max(600).optional().transform((v) => v || null),
  body_en: z.string().trim().max(600).optional().transform((v) => v || null),
  vehicle_id: z
    .string()
    .optional()
    .transform((v) => (v && /^[0-9a-f-]{36}$/.test(v) ? v : null)),
  valid_until: z
    .string()
    .optional()
    .transform((v) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null)),
  active: z
    .string()
    .optional()
    .transform((v) => v === 'on'),
  source_url: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v && /^https?:\/\//.test(v) ? v : null)),
})

/** Offers shown publicly: active and not expired (Dubai date). */
export async function activeOffers() {
  return sql<Offer[]>`
    select o.*, o.valid_until::text as valid_until, v.slug as vehicle_slug from offers o
    left join vehicles v on v.id = o.vehicle_id and v.status in ('available', 'reserved')
    where o.active and (o.valid_until is null or o.valid_until >= (now() at time zone 'Asia/Dubai')::date)
    order by o.created_at desc limit 6`
}

export async function allOffers() {
  return sql<Offer[]>`select o.*, o.valid_until::text as valid_until from offers o order by o.created_at desc`
}

export async function saveOffer(id: string | null, input: z.infer<typeof offerSchema>) {
  if (id) await sql`update offers set ${sql(input as Record<string, any>)}, updated_at = now() where id = ${id}`
  else await sql`insert into offers ${sql(input as Record<string, any>)}`
}

export async function deleteOffer(id: string) {
  await sql`delete from offers where id = ${id}`
}

/* ------------------------------ inquiries ------------------------------ */

export interface Inquiry {
  id: string
  vehicle_id: string | null
  name: string
  phone: string
  message: string | null
  locale: string
  status: 'new' | 'contacted' | 'closed'
  created_at: Date
  vehicle_slug: string | null
  vehicle_title: string | null
}

export async function createInquiry(i: { vehicle_id: string | null; name: string; phone: string; message: string | null; locale: string; ip_hash: string }) {
  await sql`insert into inquiries ${sql(i)}`
}

export async function countRecentInquiries(ipHash: string, minutes: number) {
  const [r] = await sql<{ n: number }[]>`
    select count(*)::int as n from inquiries where ip_hash = ${ipHash} and created_at > now() - make_interval(mins => ${minutes})`
  return r?.n ?? 0
}

export async function listInquiries(status?: string) {
  return sql<Inquiry[]>`
    select i.*, v.slug as vehicle_slug, (v.make || ' ' || v.model || ' ' || v.year) as vehicle_title
    from inquiries i left join vehicles v on v.id = i.vehicle_id
    where ${status ? sql`i.status = ${status}` : sql`true`}
    order by i.created_at desc limit 200`
}

export async function setInquiryStatus(id: string, status: string) {
  await sql`update inquiries set status = ${status} where id = ${id}`
}

export async function newInquiryCount() {
  const [r] = await sql<{ n: number }[]>`select count(*)::int as n from inquiries where status = 'new'`
  return r?.n ?? 0
}

/* ------------------------------ audit ------------------------------ */

export async function audit(userId: string | null, action: string, entity: string, entityId: string | null, details?: Record<string, unknown>) {
  await sql`
    insert into audit_log (user_id, action, entity, entity_id, details)
    values (${userId}, ${action}, ${entity}, ${entityId}, ${details ? sql.json(details as any) : null})`
}

export async function recentAudit(limit = 30) {
  return sql<{ id: number; action: string; entity: string; entity_id: string | null; created_at: Date; user_name: string | null; details: any }[]>`
    select a.*, u.name as user_name from audit_log a left join admin_users u on u.id = a.user_id
    order by a.created_at desc limit ${limit}`
}
