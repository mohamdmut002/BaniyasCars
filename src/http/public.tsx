import { Hono } from 'hono'
import { z } from 'zod'
import type { Locale } from '../i18n/index.js'
import { type AppEnv, clientIp, pageCtx } from './common.js'
import {
  brandCounts,
  featuredVehicles,
  getVehicleBySlug,
  inventoryStats,
  modelsByMake,
  parseFilters,
  priceBandCounts,
  recentVehicles,
  searchVehicles,
  similarVehicles,
} from '../repo/vehicles.js'
import { activeOffers, countRecentInquiries, createInquiry } from '../repo/misc.js'
import { HomePage } from '../views/pages/home.js'
import { InventoryPage } from '../views/pages/inventory.js'
import { VehiclePage } from '../views/pages/vehicle.js'
import { ContactPage, NotFoundPage } from '../views/pages/misc.js'
import { href } from '../views/ctx.js'
import { hmac } from '../lib/auth.js'
import { normalizeUaePhone } from '../lib/format.js'
import { rateLimit } from '../lib/rate-limit.js'
import { log } from '../lib/logger.js'

const PUBLIC_CACHE = 'public, max-age=0, s-maxage=60, stale-while-revalidate=300'

const inquirySchema = z.object({
  name: z.string().trim().min(2).max(80),
  phone: z.string().trim().min(7).max(25),
  message: z.string().trim().max(600).optional().default(''),
  website: z.string().optional().default(''),
})

export function publicRoutes(locale: Locale) {
  const app = new Hono<AppEnv>()

  app.get('/', async (c) => {
    const [featured, brands, bands, offers, stats] = await Promise.all([
      featuredVehicles(8),
      brandCounts(),
      priceBandCounts(),
      activeOffers(),
      inventoryStats(),
    ])
    const recent = await recentVehicles(8, featured.map((v) => v.id))
    const ctx = await pageCtx(c, locale)
    c.header('Cache-Control', PUBLIC_CACHE)
    return c.html(<HomePage ctx={ctx} data={{ featured, recent, brands, bands, offers, stats }} />)
  })

  app.get('/cars', async (c) => {
    const url = new URL(c.req.url)
    const filters = parseFilters(url.searchParams)
    // Keep only recognised, non-empty parameters so chip links and canonical logic stay clean.
    const known = ['q', 'make', 'model', 'year_min', 'year_max', 'price_min', 'price_max', 'mileage_max', 'transmission', 'fuel', 'condition', 'gcc', 'hide_export', 'sort', 'page']
    const query = new URLSearchParams()
    for (const [k, v] of url.searchParams) if (known.includes(k) && v !== '' && !(k === 'sort' && v === 'recent')) query.append(k, v)
    const [result, makes, models, stats] = await Promise.all([searchVehicles(filters), brandCounts(), modelsByMake(), inventoryStats()])
    if (filters.page && filters.page > result.pages && result.total > 0) {
      query.delete('page')
      return c.redirect(`${href(locale, '/cars')}${query.size ? `?${query}` : ''}`, 302)
    }
    const ctx = await pageCtx(c, locale)
    c.header('Cache-Control', PUBLIC_CACHE)
    return c.html(
      <InventoryPage
        ctx={ctx}
        data={{ filters, result, makes, models, years: { min: stats.year_min || 2015, max: stats.year_max || new Date().getFullYear() }, query }}
      />,
    )
  })

  app.get('/cars/:slug', async (c) => {
    const slug = c.req.param('slug')
    const ctx = await pageCtx(c, locale)
    if (!/^[a-z0-9-]{3,140}$/.test(slug)) return c.html(<NotFoundPage ctx={ctx} />, 404)
    const v = await getVehicleBySlug(slug)
    if (!v) return c.html(<NotFoundPage ctx={ctx} />, 404)
    const similar = await similarVehicles(v, 4)
    const sent = c.req.query('sent')
    const formState = sent === '1' ? 'sent' : sent === 'invalid' ? 'invalid' : sent === 'rate' ? 'rate' : null
    c.header('Cache-Control', formState ? 'private, no-store' : PUBLIC_CACHE)
    return c.html(<VehiclePage ctx={ctx} v={v} similar={similar} formState={formState} />)
  })

  app.post('/cars/:slug/inquiry', async (c) => {
    const slug = c.req.param('slug')
    const back = (state: string) => c.redirect(`${href(locale, `/cars/${slug}`)}?sent=${state}#callback`, 303)
    const v = /^[a-z0-9-]{3,140}$/.test(slug) ? await getVehicleBySlug(slug) : null
    if (!v) return c.notFound()
    const ipHash = hmac(`ip:${clientIp(c)}`).slice(0, 32)
    if (!rateLimit(`inq:${ipHash}`, 5, 10 * 60_000).ok || (await countRecentInquiries(ipHash, 60)) >= 10) return back('rate')
    const body = await c.req.parseBody()
    const parsed = inquirySchema.safeParse(body)
    if (!parsed.success) return back('invalid')
    // Bots fill the hidden "website" field; pretend success so they do not retry.
    if (parsed.data.website) return back('1')
    const phone = normalizeUaePhone(parsed.data.phone)
    if (!phone) return back('invalid')
    await createInquiry({ vehicle_id: v.id, name: parsed.data.name, phone, message: parsed.data.message || null, locale, ip_hash: ipHash })
    log.info('inquiry received', { vehicle: v.slug })
    return back('1')
  })

  app.get('/contact', async (c) => {
    const ctx = await pageCtx(c, locale)
    c.header('Cache-Control', PUBLIC_CACHE)
    return c.html(<ContactPage ctx={ctx} />)
  })

  return app
}
