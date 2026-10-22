import type { Locale } from '../i18n/index.js'

/** Prices and mileage use Western digits in both languages, as UAE dealers and plates do. */
const nf = new Intl.NumberFormat('en-US')
export const formatNumber = (n: number) => nf.format(n)

export function formatPrice(n: number | null, locale: Locale): string | null {
  if (n == null) return null
  return locale === 'ar' ? `${nf.format(n)} درهم` : `AED ${nf.format(n)}`
}

export function formatMileage(km: number | null, locale: Locale): string | null {
  if (km == null) return null
  return locale === 'ar' ? `${nf.format(km)} كم` : `${nf.format(km)} km`
}

export function formatDate(d: Date | string | null, locale: Locale): string | null {
  if (!d) return null
  const date = typeof d === 'string' ? new Date(d) : d
  if (Number.isNaN(date.getTime())) return null
  return new Intl.DateTimeFormat(locale === 'ar' ? 'ar-AE-u-nu-latn' : 'en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Asia/Dubai',
  }).format(date)
}

/** Normalises a UAE phone number to E.164 (+9715XXXXXXXX). Returns null when it is not a plausible number. */
export function normalizeUaePhone(input: string): string | null {
  const digits = input.replace(/[^\d+]/g, '').replace(/^\+/, '').replace(/^00/, '')
  let d = digits
  if (d.startsWith('971')) d = d.slice(3)
  if (d.startsWith('0')) d = d.slice(1)
  if (/^5\d{8}$/.test(d) || /^[234679]\d{7}$/.test(d)) return `+971${d}`
  // Accept other international numbers as long as they look like E.164.
  if (/^\d{8,15}$/.test(digits) && !digits.startsWith('971')) return `+${digits}`
  return null
}

/** Displays +971501234567 as 050 123 4567 (local style). */
export function displayPhone(e164: string): string {
  const m = /^\+971(5\d)(\d{3})(\d{4})$/.exec(e164)
  if (m) return `0${m[1]} ${m[2]} ${m[3]}`
  const l = /^\+971([234679])(\d{3})(\d{4})$/.exec(e164)
  if (l) return `0${l[1]} ${l[2]} ${l[3]}`
  return e164
}

export const telHref = (e164: string) => `tel:${e164}`
