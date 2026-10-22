import type { Locale } from '../i18n/index.js'
import { siteUrl } from '../config/site.js'

export interface PageCtx {
  locale: Locale
  /** Path without the /en prefix, e.g. "/cars/nissan-patrol-2026-275740". Used for the language switch and hreflang. */
  path: string
  /** Hashed asset file names from the build. */
  assets: { css: string; main: string }
}

export interface PageMeta {
  title: string
  description: string
  image?: string | null
  noindex?: boolean
  /** Path (without locale prefix) for canonical/hreflang; defaults to ctx.path. null omits them. */
  canonicalPath?: string | null
  jsonLd?: object[]
  ogType?: 'website' | 'product'
}

/** Arabic pages live at the root; English pages under /en. */
export function href(locale: Locale, p: string): string {
  const clean = p.startsWith('/') ? p : `/${p}`
  if (locale === 'ar') return clean
  return clean === '/' ? '/en/' : `/en${clean}`
}

/** Absolute URL, or null when the public site address is not configured yet. */
export const absolute = (p: string): string | null => (/^https?:\/\//.test(p) ? p : siteUrl ? `${siteUrl}${p}` : null)
