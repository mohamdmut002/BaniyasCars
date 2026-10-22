import { t, type Locale } from '../i18n/index.js'
import { vehicleTitle } from '../domain/names.js'
import { formatNumber } from './format.js'

/** Builds a wa.me link. Returns null when no WhatsApp number is configured, so callers can hide the button. */
export function whatsappLink(numberE164: string | null | undefined, text: string): string | null {
  if (!numberE164) return null
  const digits = numberE164.replace(/\D/g, '')
  if (digits.length < 8) return null
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`
}

export function vehicleWhatsappText(
  v: { make: string; model: string; trim: string | null; year: number; price_aed: number | null },
  locale: Locale,
  pageUrl?: string,
): string {
  const name = vehicleTitle(v, locale, { withYear: false })
  const msg = t(locale).whatsappVehicle(name, v.year, v.price_aed != null ? formatNumber(v.price_aed) : null)
  return pageUrl ? `${msg}\n${pageUrl}` : msg
}
