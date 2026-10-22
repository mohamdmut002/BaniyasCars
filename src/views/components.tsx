import type { VehicleWithImages } from '../domain/vehicle.js'
import { t, type Locale } from '../i18n/index.js'
import { makeName, modelName, vehicleTitle } from '../domain/names.js'
import { formatMileage, formatNumber } from '../lib/format.js'
import { thumbUrl } from '../lib/images.js'
import { vehicleWhatsappText, whatsappLink } from '../lib/whatsapp.js'
import { absolute, href, type PageCtx } from './ctx.js'
import { IconAlert, IconPhoto, IconWhatsapp } from './icons.js'

export function PricePlate({ price, locale, size, vat }: { price: number | null; locale: Locale; size?: 'lg'; vat?: boolean | null }) {
  const L = t(locale)
  if (price == null) {
    return (
      <span class={`plate plate-muted ${size === 'lg' ? 'plate-lg' : ''}`}>
        <span class="plate-code">{locale === 'ar' ? 'د.إ' : 'AED'}</span>
        <span class="plate-num">{L.priceOnRequest}</span>
      </span>
    )
  }
  return (
    <span class="inline-flex flex-col items-start gap-1">
      <span class={`plate ${size === 'lg' ? 'plate-lg' : ''}`} dir="ltr" aria-label={locale === 'ar' ? `${formatNumber(price)} درهم` : `AED ${formatNumber(price)}`}>
        <span class="plate-code">AED</span>
        <span class="plate-num num">{formatNumber(price)}</span>
      </span>
      {vat && size === 'lg' ? <span class="text-xs font-semibold text-sage">{L.inclVat}</span> : null}
    </span>
  )
}

export function StatusTags({ v, locale }: { v: VehicleWithImages; locale: Locale }) {
  const L = t(locale)
  const tags = []
  if (v.status === 'reserved') tags.push(<span class="tag bg-petrol-900 text-paper">{L.car.reserved}</span>)
  if (v.status === 'sold') tags.push(<span class="tag bg-sold text-paper">{L.car.sold}</span>)
  if (v.export_only) tags.push(<span class="tag bg-paper/95 text-petrol-900 ring-1 ring-line">{L.car.exportOnly}</span>)
  if (v.verification === 'needs_confirmation' && v.status !== 'sold')
    tags.push(
      <span class="tag bg-amber-100 text-amber">
        <IconAlert size={13} />
        {locale === 'ar' ? 'تأكد من التوفر' : 'Check availability'}
      </span>,
    )
  return tags.length ? <div class="flex flex-wrap gap-1.5">{tags}</div> : null
}

export function NoPhoto({ v, locale, class: c = '' }: { v: VehicleWithImages; locale: Locale; class?: string }) {
  return (
    <div class={`flex h-full w-full flex-col items-center justify-center gap-2 bg-[repeating-linear-gradient(135deg,var(--color-stone-2)_0_10px,var(--color-stone)_10px_20px)] p-4 text-center ${c}`}>
      <IconPhoto size={28} class="text-sage" />
      <span class="font-display text-lg font-bold text-petrol-800">{makeName(v.make, locale)} {modelName(v.model, locale)}</span>
      <span class="text-xs text-sage">{locale === 'ar' ? 'الصور على حساب إنستغرام المعرض' : 'Photos on the showroom’s Instagram'}</span>
    </div>
  )
}

export function VehicleCard({ v, ctx, eager }: { v: VehicleWithImages; ctx: PageCtx; eager?: boolean }) {
  const { locale } = ctx
  const L = t(locale)
  const url = href(locale, `/cars/${v.slug}`)
  const img = v.images[0]
  const title = `${makeName(v.make, locale)} ${modelName(v.model, locale)}`
  const sub = [v.trim, String(v.year)].filter(Boolean).join(' ')
  const facts = [
    v.mileage_km != null ? formatMileage(v.mileage_km, locale) : null,
    v.transmission ? L.enums.transmission[v.transmission].replace(/ \(.+\)$/, '') : null,
    v.fuel ? L.enums.fuel[v.fuel] : null,
  ].filter(Boolean) as string[]
  const wa = whatsappLink(ctx.settings.whatsapp, vehicleWhatsappText(v, locale, absolute(url)))
  const alt = img ? ((locale === 'ar' ? img.alt_ar : img.alt_en) ?? `${vehicleTitle(v, locale)}`) : ''

  return (
    <article class="group relative flex w-full flex-col overflow-hidden rounded-[var(--radius-card)] border border-line bg-paper">
      <div class="relative aspect-[4/5] overflow-hidden bg-stone-2">
        {img ? (
          <img
            src={thumbUrl(img)}
            alt={alt}
            width={img.width ?? 768}
            height={img.height ?? 1024}
            loading={eager ? 'eager' : 'lazy'}
            fetchpriority={eager ? 'high' : undefined}
            decoding="async"
            referrerpolicy="no-referrer"
            class="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
          />
        ) : (
          <NoPhoto v={v} locale={locale} />
        )}
        <div class="absolute inset-x-3 top-3">
          <StatusTags v={v} locale={locale} />
        </div>
      </div>
      <div class="flex flex-1 flex-col gap-3 p-4">
        <div>
          <h3 class="text-[1.06rem] font-bold leading-snug">
            <a href={url} class="after:absolute after:inset-0 focus-visible:outline-none">
              {title}
            </a>
          </h3>
          <p class="mt-0.5 text-sm text-sage" dir="auto">{sub}</p>
        </div>
        {facts.length ? (
          <ul class="flex flex-wrap gap-x-3 gap-y-1 text-[0.82rem] text-petrol-800">
            {facts.map((f) => (
              <li class="relative ps-3 before:absolute before:start-0 before:top-1/2 before:h-1 before:w-1 before:-translate-y-1/2 before:rounded-full before:bg-sand">
                <span class={/\d/.test(f) ? 'num' : ''}>{f}</span>
              </li>
            ))}
          </ul>
        ) : null}
        <div class="mt-auto flex items-end justify-between gap-2 pt-1">
          <PricePlate price={v.price_aed} locale={locale} />
          {wa ? (
            <a
              href={wa}
              target="_blank"
              rel="noopener"
              class="relative z-10 grid h-10 w-10 shrink-0 place-items-center rounded-full bg-wa text-paper hover:bg-wa-hover"
              aria-label={`${L.car.askWhatsapp}: ${vehicleTitle(v, locale)}`}
              data-track="wa-card"
            >
              <IconWhatsapp size={19} />
            </a>
          ) : null}
        </div>
      </div>
    </article>
  )
}

export function VehicleGrid({ items, ctx, eagerCount = 0, mobileLimit }: { items: VehicleWithImages[]; ctx: PageCtx; eagerCount?: number; mobileLimit?: number }) {
  return (
    <ul class="grid grid-cols-1 gap-4 min-[480px]:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" role="list">
      {items.map((v, i) => (
        <li class={mobileLimit != null && i >= mobileLimit ? 'hidden min-[480px]:flex' : 'flex'}>
          <div class="flex w-full">
            <VehicleCard v={v} ctx={ctx} eager={i < eagerCount} />
          </div>
        </li>
      ))}
    </ul>
  )
}

export function SectionHead({ title, action, id }: { title: string; action?: { href: string; label: string }; id?: string }) {
  return (
    <div class="mb-6 flex items-end justify-between gap-4">
      <h2 id={id} class="h-display text-2xl sm:text-[1.9rem]">{title}</h2>
      {action ? (
        <a href={action.href} class="shrink-0 text-sm font-semibold text-petrol-700 underline decoration-sand decoration-2 underline-offset-[6px] hover:text-petrol-900">
          {action.label}
        </a>
      ) : null}
    </div>
  )
}
