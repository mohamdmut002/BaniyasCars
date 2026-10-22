import type { Locale } from '../i18n/index.js'
import type { SiteSettings } from '../repo/settings.js'
import type { Branch } from '../domain/vehicle.js'
import { env } from '../config/env.js'

export interface PageCtx {
  locale: Locale
  /** Path without the locale prefix, e.g. "/cars/nissan-patrol-2026-275740". Used for the language switch and hreflang. */
  path: string
  /** Current query string (with leading "?" or empty), kept when switching language. */
  search: string
  settings: SiteSettings
  branches: Branch[]
  nonce: string
}

export interface PageMeta {
  title: string
  description: string
  image?: string | null
  noindex?: boolean
  /** Path (without locale prefix) for the canonical URL; defaults to ctx.path. Set null to omit. */
  canonicalPath?: string | null
  jsonLd?: object[]
  ogType?: 'website' | 'product'
}

/** Arabic pages live at the root; English pages are prefixed with /en. */
export function href(locale: Locale, p: string): string {
  const clean = p.startsWith('/') ? p : `/${p}`
  if (locale === 'ar') return clean
  return clean === '/' ? '/en' : `/en${clean}`
}

export const absolute = (p: string) => (/^https?:\/\//.test(p) ? p : `${env.SITE_URL}${p}`)

type Manifest = { css: string; main: string; admin: string }
// Injected by scripts/build-pages.mjs for the Cloudflare bundle (no file system there).
declare const __ASSET_MANIFEST__: Manifest | undefined

let manifest: Manifest | null = null
export function assets(): Manifest {
  if (typeof __ASSET_MANIFEST__ !== 'undefined') return __ASSET_MANIFEST__
  if (manifest && env.NODE_ENV === 'production') return manifest
  const fs = process.getBuiltinModule('node:fs') as typeof import('node:fs')
  const file = 'public/assets/manifest.json'
  manifest = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : { css: 'missing.css', main: 'missing.js', admin: 'missing.js' }
  return manifest!
}
