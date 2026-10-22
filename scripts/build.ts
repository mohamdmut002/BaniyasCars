/**
 * Static site build: renders every page to plain HTML files in dist/.
 *   npm run build              → dist/ (deploy this folder to any static host)
 *   SITE_URL=https://… npm run build   → also writes canonical links, sitemap.xml and absolute share URLs
 */
import { cp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { compile } from 'tailwindcss'
import * as esbuild from 'esbuild'
import type { Html } from '../src/jsx/jsx-runtime.js'
import { vehicles } from '../src/data/vehicles.js'
import type { Vehicle } from '../src/data/types.js'
import { siteUrl } from '../src/config/site.js'
import type { Locale } from '../src/i18n/index.js'
import { absolute, href, type PageCtx } from '../src/views/ctx.js'
import { HomePage, type HomeData } from '../src/views/pages/home.js'
import { InventoryPage } from '../src/views/pages/inventory.js'
import { VehiclePage } from '../src/views/pages/vehicle.js'
import { ContactPage, NotFoundPage } from '../src/views/pages/misc.js'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const out = path.join(root, 'dist')
const require = createRequire(import.meta.url)
const hash = (buf: string | Uint8Array) => createHash('sha256').update(buf).digest('hex').slice(0, 10)

/* ------------------------------ data checks ------------------------------ */

export function validate(list: Vehicle[]): string[] {
  const problems: string[] = []
  const seen = new Set<string>()
  for (const v of list) {
    const id = v.slug || `${v.make} ${v.model}`
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(v.slug)) problems.push(`${id}: slug must use a-z, 0-9 and dashes`)
    if (seen.has(v.slug)) problems.push(`${id}: duplicate slug`)
    seen.add(v.slug)
    if (!v.make || !v.model) problems.push(`${id}: make and model are required`)
    if (!Number.isInteger(v.year) || v.year < 1950 || v.year > new Date().getFullYear() + 2) problems.push(`${id}: invalid year ${v.year}`)
    if (v.price_aed != null && (!Number.isFinite(v.price_aed) || v.price_aed <= 0)) problems.push(`${id}: price_aed must be a positive number or left out`)
    if (v.mileage_km != null && v.mileage_km < 0) problems.push(`${id}: mileage_km cannot be negative`)
    for (const img of v.images) if (!/^(https?:\/\/|\/)/.test(img)) problems.push(`${id}: image "${img}" must be a full URL or start with /`)
  }
  return problems
}

/* ------------------------------ derived data ------------------------------ */

const listed = (v: Vehicle) => (v.listed_at ? Date.parse(v.listed_at) : 0)
export const publicCars = (list: Vehicle[]) => list.filter((v) => v.status !== 'sold')

export const PRICE_BANDS = [
  { key: 'under50', max: 49_999 },
  { key: '50to100', min: 50_000, max: 100_000 },
  { key: '100to200', min: 100_001, max: 200_000 },
  { key: '200to300', min: 200_001, max: 300_000 },
  { key: 'over300', min: 300_001 },
] as { key: string; min?: number; max?: number }[]

export function homeData(list: Vehicle[]): HomeData {
  const cars = publicCars(list)
  const real = cars.filter((v) => v.verification !== 'sample')
  const featured = real.filter((v) => v.featured && v.images.length).slice(0, 8)
  const recent = real
    .filter((v) => !featured.includes(v) && v.verification === 'confirmed')
    .sort((a, b) => listed(b) - listed(a))
    .slice(0, 8)
  const brandMap = new Map<string, { make: string; count: number; min_price: number | null }>()
  for (const v of cars) {
    const b = brandMap.get(v.make) ?? { make: v.make, count: 0, min_price: null }
    b.count++
    if (v.price_aed != null) b.min_price = b.min_price == null ? v.price_aed : Math.min(b.min_price, v.price_aed)
    brandMap.set(v.make, b)
  }
  const years = cars.map((v) => v.year)
  return {
    featured,
    recent,
    brands: [...brandMap.values()].sort((a, b) => b.count - a.count || a.make.localeCompare(b.make)),
    bands: PRICE_BANDS.map((b) => ({
      ...b,
      count: cars.filter((v) => v.price_aed != null && (b.min == null || v.price_aed >= b.min) && (b.max == null || v.price_aed <= b.max)).length,
    })),
    stats: { total: cars.length, brands: brandMap.size, year_min: Math.min(...years), year_max: Math.max(...years) },
  }
}

export function similarTo(v: Vehicle, list: Vehicle[], limit = 4): Vehicle[] {
  return publicCars(list)
    .filter((x) => x.slug !== v.slug)
    .map((x) => ({
      x,
      score:
        (x.make === v.make && x.model === v.model ? 2 : 0) + (x.body_type === v.body_type ? 1 : 0),
      diff: Math.abs((x.price_aed ?? 0) - (v.price_aed ?? 0)),
    }))
    .sort((a, b) => b.score - a.score || a.diff - b.diff)
    .slice(0, limit)
    .map((s) => s.x)
}

/* ------------------------------ assets ------------------------------ */

async function walk(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true })
  const nested = await Promise.all(entries.map((e) => (e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)])))
  return nested.flat()
}

async function buildCss(): Promise<string> {
  const twDir = path.dirname(require.resolve('tailwindcss/package.json'))
  const input = await readFile(path.join(root, 'src/styles/app.css'), 'utf8')
  const compiler = await compile(input, {
    base: path.join(root, 'src/styles'),
    async loadStylesheet(id: string, base: string) {
      const map: Record<string, string> = { tailwindcss: 'index.css', 'tailwindcss/theme': 'theme.css', 'tailwindcss/preflight': 'preflight.css', 'tailwindcss/utilities': 'utilities.css' }
      const file = map[id] ? path.join(twDir, map[id]!) : path.resolve(base, id)
      return { path: file, base: path.dirname(file), content: await readFile(file, 'utf8') }
    },
  })
  const candidates = new Set<string>()
  for (const f of (await walk(path.join(root, 'src'))).filter((f) => /\.(tsx?|ts)$/.test(f) && !f.includes('/data/'))) {
    for (const m of (await readFile(f, 'utf8')).matchAll(/[^\s"'`<>{}]+/g)) candidates.add(m[0])
  }
  const css = await esbuild.transform(compiler.build([...candidates]), { loader: 'css', minify: true, target: ['chrome105', 'safari15', 'firefox110'] })
  const name = `app.${hash(css.code)}.css`
  await writeFile(path.join(out, 'assets', name), css.code)
  return name
}

async function buildJs(): Promise<string> {
  const result = await esbuild.build({
    entryPoints: [path.join(root, 'src/client/main.ts')],
    bundle: true,
    minify: true,
    format: 'esm',
    target: ['chrome105', 'safari15', 'firefox110'],
    write: false,
  })
  const code = result.outputFiles[0]!.contents
  const name = `main.${hash(code)}.js`
  await writeFile(path.join(out, 'assets', name), code)
  return name
}

/* ------------------------------ pages ------------------------------ */

async function writePage(urlPath: string, page: Html) {
  // "/cars/x/" → dist/cars/x/index.html, so links work on any static host.
  const file = urlPath.endsWith('/') ? path.join(out, urlPath, 'index.html') : path.join(out, urlPath)
  await mkdir(path.dirname(file), { recursive: true })
  await writeFile(file, page.value)
}

export async function build({ quiet = false } = {}) {
  const started = performance.now()
  const problems = validate(vehicles)
  if (problems.length) throw new Error(`src/data/vehicles.ts has problems:\n  - ${problems.join('\n  - ')}`)

  await rm(out, { recursive: true, force: true })
  await mkdir(path.join(out, 'assets'), { recursive: true })
  await cp(path.join(root, 'public'), out, { recursive: true })
  const assets = { css: await buildCss(), main: await buildJs() }

  const ctx = (locale: Locale, p: string): PageCtx => ({ locale, path: p, assets })
  const cars = publicCars(vehicles)
  const home = homeData(vehicles)
  const urls: string[] = []
  const add = (p: string) => urls.push(p)

  for (const locale of ['ar', 'en'] as const) {
    await writePage(href(locale, '/'), HomePage({ ctx: ctx(locale, '/'), data: home }))
    await writePage(href(locale, '/cars/'), InventoryPage({ ctx: ctx(locale, '/cars/'), cars: [...cars].sort((a, b) => Number(!b.images.length) - Number(!a.images.length) || listed(b) - listed(a)) }))
    await writePage(href(locale, '/contact/'), ContactPage({ ctx: ctx(locale, '/contact/') }))
    for (const v of vehicles) {
      const p = `/cars/${v.slug}/`
      await writePage(href(locale, p), VehiclePage({ ctx: ctx(locale, p), v, similar: similarTo(v, vehicles) }))
    }
  }
  await writePage('/404.html', NotFoundPage({ ctx: ctx('ar', '/') }))
  await writePage('/en/404.html', NotFoundPage({ ctx: ctx('en', '/') }))
  add('/')
  add('/cars/')
  add('/contact/')
  for (const v of cars) if (v.verification !== 'sample') add(`/cars/${v.slug}/`)

  // Security and caching headers for hosts that read a _headers file (Cloudflare Pages, Netlify).
  await writeFile(
    path.join(out, '_headers'),
    [
      '/*',
      '  X-Content-Type-Options: nosniff',
      '  Referrer-Policy: strict-origin-when-cross-origin',
      '  X-Frame-Options: DENY',
      '/assets/*',
      '  Cache-Control: public, max-age=31536000, immutable',
      '/fonts/*',
      '  Cache-Control: public, max-age=31536000, immutable',
      '',
    ].join('\n'),
  )

  const robots = ['User-agent: *', 'Allow: /']
  if (siteUrl) {
    const entries = urls.flatMap((p) =>
      (['ar', 'en'] as const).map(
        (l) =>
          `  <url><loc>${absolute(href(l, p))}</loc><xhtml:link rel="alternate" hreflang="ar-AE" href="${absolute(href('ar', p))}"/><xhtml:link rel="alternate" hreflang="en-AE" href="${absolute(href('en', p))}"/></url>`,
      ),
    )
    await writeFile(
      path.join(out, 'sitemap.xml'),
      `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${entries.join('\n')}\n</urlset>\n`,
    )
    robots.push(`Sitemap: ${siteUrl}/sitemap.xml`)
  }
  await writeFile(path.join(out, 'robots.txt'), robots.join('\n') + '\n')

  if (!quiet) {
    const pages = (await walk(out)).filter((f) => f.endsWith('.html')).length
    console.log(`Built ${pages} pages (${vehicles.length} cars) into dist/ in ${Math.round(performance.now() - started)} ms`)
    if (!siteUrl) console.log('Note: SITE_URL is not set, so canonical links and sitemap.xml were skipped (fine for local preview).')
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  build().catch((e) => {
    console.error(e instanceof Error ? e.message : e)
    process.exit(1)
  })
}
