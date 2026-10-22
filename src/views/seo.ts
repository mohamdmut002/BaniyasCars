import type { Vehicle } from '../data/types.js'
import { vehicleTitle } from '../domain/names.js'
import { site } from '../config/site.js'
import { absolute, href, type PageCtx } from './ctx.js'

const withUrl = (key: string, url: string | null) => (url ? { [key]: url } : {})

/** AutoDealer schema built only from published contact details. No ratings or reviews. */
export function dealerJsonLd(ctx: PageCtx) {
  const sameAs = [site.instagram, site.facebook, site.threads].filter(Boolean)
  return {
    '@context': 'https://schema.org',
    '@type': 'AutoDealer',
    name: ctx.locale === 'ar' ? 'معرض بني ياس للسيارات' : 'Baniyas Cars',
    alternateName: ctx.locale === 'ar' ? 'Baniyas Cars' : 'معرض بني ياس للسيارات',
    ...withUrl('url', absolute(href(ctx.locale, '/'))),
    ...(site.phone ? { telephone: site.phone } : {}),
    ...(site.email ? { email: site.email } : {}),
    sameAs,
    address: {
      '@type': 'PostalAddress',
      streetAddress: 'ICAD V, Rahayel Cars City',
      addressLocality: 'Abu Dhabi',
      postOfficeBoxNumber: '55805',
      addressCountry: 'AE',
    },
    areaServed: 'AE',
    currenciesAccepted: 'AED',
  }
}

export function vehicleJsonLd(v: Vehicle, ctx: PageCtx) {
  const url = absolute(href(ctx.locale, `/cars/${v.slug}/`))
  const ld: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': ['Car', 'Product'],
    name: vehicleTitle(v, ctx.locale),
    ...withUrl('url', url),
    brand: { '@type': 'Brand', name: v.make },
    model: v.model,
    vehicleModelDate: String(v.year),
    ...(v.images.length ? { image: v.images.slice(0, 6).map((i) => absolute(i) ?? i) } : {}),
    ...(v.condition ? { itemCondition: v.condition === 'new' ? 'https://schema.org/NewCondition' : 'https://schema.org/UsedCondition' } : {}),
    ...(v.mileage_km != null ? { mileageFromOdometer: { '@type': 'QuantitativeValue', value: v.mileage_km, unitCode: 'KMT' } } : {}),
    ...(v.transmission ? { vehicleTransmission: v.transmission === 'manual' ? 'Manual' : 'Automatic' } : {}),
    ...(v.engine_l || v.horsepower
      ? {
          vehicleEngine: {
            '@type': 'EngineSpecification',
            ...(v.engine_l ? { engineDisplacement: { '@type': 'QuantitativeValue', value: v.engine_l, unitCode: 'LTR' } } : {}),
            ...(v.horsepower ? { enginePower: { '@type': 'QuantitativeValue', value: v.horsepower, unitCode: 'BHP' } } : {}),
          },
        }
      : {}),
    ...(v.exterior_color ? { color: v.exterior_color } : {}),
  }
  if (v.price_aed != null && v.status !== 'sold' && v.verification !== 'sample') {
    ld.offers = {
      '@type': 'Offer',
      price: v.price_aed,
      priceCurrency: 'AED',
      ...withUrl('url', url),
      availability: v.status === 'reserved' ? 'https://schema.org/LimitedAvailability' : 'https://schema.org/InStock',
    }
  }
  return ld
}

export function breadcrumbJsonLd(items: { name: string; path: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((it, i) => ({ '@type': 'ListItem', position: i + 1, name: it.name, ...withUrl('item', absolute(it.path)) })),
  }
}
