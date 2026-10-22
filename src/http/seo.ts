import { Hono } from 'hono'
import type { AppEnv } from './common.js'
import { env } from '../config/env.js'
import { brandCounts, sitemapVehicles } from '../repo/vehicles.js'
import { absolute, href } from '../views/ctx.js'

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

export const seoRoutes = new Hono<AppEnv>()

seoRoutes.get('/robots.txt', (c) => {
  c.header('Cache-Control', 'public, max-age=3600')
  return c.text(['User-agent: *', 'Allow: /', 'Disallow: /admin', 'Disallow: /*?*q=', `Sitemap: ${env.SITE_URL}/sitemap.xml`, ''].join('\n'))
})

seoRoutes.get('/sitemap.xml', async (c) => {
  const [vehicles, brands] = await Promise.all([sitemapVehicles(), brandCounts()])
  const entries: { path: string; lastmod?: Date; priority: string }[] = [
    { path: '/', priority: '1.0' },
    { path: '/cars', priority: '0.9' },
    { path: '/contact', priority: '0.5' },
    ...brands.map((b) => ({ path: `/cars?make=${encodeURIComponent(b.make)}`, priority: '0.7' })),
    ...vehicles.map((v) => ({ path: `/cars/${v.slug}`, lastmod: v.updated_at, priority: '0.8' })),
  ]
  const urls = entries.flatMap((e) =>
    (['ar', 'en'] as const).map(
      (l) => `  <url>
    <loc>${esc(absolute(href(l, e.path)))}</loc>${e.lastmod ? `\n    <lastmod>${e.lastmod.toISOString()}</lastmod>` : ''}
    <priority>${e.priority}</priority>
    <xhtml:link rel="alternate" hreflang="ar-AE" href="${esc(absolute(href('ar', e.path)))}"/>
    <xhtml:link rel="alternate" hreflang="en-AE" href="${esc(absolute(href('en', e.path)))}"/>
  </url>`,
    ),
  )
  c.header('Content-Type', 'application/xml; charset=utf-8')
  c.header('Cache-Control', 'public, max-age=900')
  return c.body(
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${urls.join('\n')}\n</urlset>\n`,
  )
})
