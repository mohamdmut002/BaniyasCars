import type { VehicleWithImages } from '../domain/vehicle.js'
import { vehicleTitle } from '../domain/names.js'
import { absolute, href, type PageCtx } from './ctx.js'

/** AutoDealer schema built only from contact data stored in settings. No ratings or reviews are emitted. */
export function dealerJsonLd(ctx: PageCtx) {
  const s = ctx.settings
  const abuDhabi = ctx.branches.find((b) => b.slug === 'abu-dhabi')
  const sameAs = [s.instagram_url, s.facebook_url, s.threads_url, s.tiktok_url].filter(Boolean)
  return {
    '@context': 'https://schema.org',
    '@type': 'AutoDealer',
    '@id': absolute('/#dealer'),
    name: ctx.locale === 'ar' ? 'معرض بني ياس للسيارات' : 'Baniyas Cars',
    alternateName: ctx.locale === 'ar' ? 'Baniyas Cars' : 'معرض بني ياس للسيارات',
    url: absolute(href(ctx.locale, '/')),
    ...(s.phone ? { telephone: s.phone } : {}),
    ...(s.email ? { email: s.email } : {}),
    ...(sameAs.length ? { sameAs } : {}),
    ...(abuDhabi?.address_en
      ? {
          address: {
            '@type': 'PostalAddress',
            streetAddress: 'ICAD V, Rahayel Cars City',
            addressLocality: 'Abu Dhabi',
            postOfficeBoxNumber: '55805',
            addressCountry: 'AE',
          },
        }
      : {}),
    areaServed: 'AE',
    currenciesAccepted: 'AED',
  }
}

export function vehicleJsonLd(v: VehicleWithImages, ctx: PageCtx) {
  const url = absolute(href(ctx.locale, `/cars/${v.slug}`))
  const name = vehicleTitle(v, ctx.locale)
  const ld: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': ['Car', 'Product'],
    name,
    url,
    brand: { '@type': 'Brand', name: v.make },
    model: v.model,
    vehicleModelDate: String(v.year),
    ...(v.images.length ? { image: v.images.slice(0, 6).map((i) => absolute(i.url)) } : {}),
    ...(v.condition ? { itemCondition: v.condition === 'new' ? 'https://schema.org/NewCondition' : 'https://schema.org/UsedCondition' } : {}),
    ...(v.mileage_km != null ? { mileageFromOdometer: { '@type': 'QuantitativeValue', value: v.mileage_km, unitCode: 'KMT' } } : {}),
    ...(v.fuel ? { fuelType: v.fuel === 'plugin_hybrid' ? 'Plug-in hybrid' : v.fuel[0]!.toUpperCase() + v.fuel.slice(1) } : {}),
    ...(v.transmission ? { vehicleTransmission: v.transmission === 'manual' ? 'Manual' : 'Automatic' } : {}),
    ...(v.drivetrain ? { driveWheelConfiguration: { fwd: 'https://schema.org/FrontWheelDriveConfiguration', rwd: 'https://schema.org/RearWheelDriveConfiguration', awd: 'https://schema.org/AllWheelDriveConfiguration', '4wd': 'https://schema.org/FourWheelDriveConfiguration' }[v.drivetrain] } : {}),
    ...(v.engine_l || v.horsepower
      ? {
          vehicleEngine: {
            '@type': 'EngineSpecification',
            ...(v.engine_l ? { engineDisplacement: { '@type': 'QuantitativeValue', value: Number(v.engine_l), unitCode: 'LTR' } } : {}),
            ...(v.horsepower ? { enginePower: { '@type': 'QuantitativeValue', value: v.horsepower, unitCode: 'BHP' } } : {}),
          },
        }
      : {}),
    ...(v.exterior_color ? { color: v.exterior_color } : {}),
    ...(v.interior_color ? { vehicleInteriorColor: v.interior_color } : {}),
  }
  if (v.price_aed != null && v.status !== 'sold') {
    ld.offers = {
      '@type': 'Offer',
      price: v.price_aed,
      priceCurrency: 'AED',
      url,
      availability: v.status === 'reserved' ? 'https://schema.org/LimitedAvailability' : 'https://schema.org/InStock',
      seller: { '@id': absolute('/#dealer') },
    }
  }
  return ld
}

export function breadcrumbJsonLd(items: { name: string; path: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((it, i) => ({ '@type': 'ListItem', position: i + 1, name: it.name, item: absolute(it.path) })),
  }
}
