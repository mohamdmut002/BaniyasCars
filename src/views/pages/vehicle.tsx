import type { Vehicle } from '../../data/types.js'
import { site } from '../../config/site.js'
import { t } from '../../i18n/index.js'
import { colorName, makeName, modelName, vehicleTitle } from '../../domain/names.js'
import { describeAr, describeEn } from '../../lib/describe.js'
import { displayPhone, formatDate, formatMileage, telHref } from '../../lib/format.js'
import { Layout } from '../layout.js'
import { absolute, href, type PageCtx } from '../ctx.js'
import { NoPhoto, PricePlate, SectionHead, StatusTags, VehicleGrid, inquiryTarget } from '../components.js'
import { IconAlert, IconChevron, IconLink, IconPhone, IconShare, IconWhatsapp, IconClose } from '../icons.js'
import { breadcrumbJsonLd, vehicleJsonLd } from '../seo.js'

export function VehiclePage({ ctx, v, similar }: { ctx: PageCtx; v: Vehicle; similar: Vehicle[] }) {
  const L = t(ctx.locale)
  const S = L.spec
  const ar = ctx.locale === 'ar'
  const url = href(ctx.locale, `/cars/${v.slug}/`)
  const fullTitle = vehicleTitle(v, ctx.locale)
  const shortTitle = `${makeName(v.make, ctx.locale)} ${modelName(v.model, ctx.locale)}`
  const ask = inquiryTarget(v, ctx.locale)
  const branch = site.branches.find((b) => b.id === v.branch) ?? null
  const phone = branch?.phone ?? site.phone
  const description = (ar ? v.description_ar : v.description_en) ?? (ar ? describeAr(v) : describeEn(v))
  const features = ar ? v.features_ar : v.features_en.length ? v.features_en : v.features_ar
  const featuresLang = ar || !v.features_en.length ? 'ar' : 'en'
  const warranty = ar ? v.warranty_ar : v.warranty_en
  const na = <span class="text-muted">{L.notAvailable}</span>

  const specs: [string, any][] = [
    [S.year, <span class="num">{v.year}</span>],
    [S.trim, v.trim ? <span dir="auto">{v.trim}</span> : na],
    [S.condition, v.condition ? L.enums.condition[v.condition] : na],
    [S.mileage, v.mileage_km != null ? <span class="num">{formatMileage(v.mileage_km, ctx.locale)}</span> : na],
    [S.engine, v.engine_l ? <span><span class="num">{v.engine_l}</span> {S.litre}</span> : na],
    [S.horsepower, v.horsepower ? <span><span class="num">{v.horsepower}</span> {S.hp}</span> : na],
    ...(v.torque_nm ? ([[S.torque, <span><span class="num">{v.torque_nm}</span> {S.nm}</span>]] as [string, any][]) : []),
    [S.transmission, v.transmission ? `${L.enums.transmission[v.transmission]}${v.gears ? `، ${S.gears(v.gears)}`.replace('،', ar ? '،' : ',') : ''}` : na],
    [S.fuel, v.fuel ? L.enums.fuel[v.fuel] : na],
    [S.drivetrain, v.drivetrain ? L.enums.drivetrain[v.drivetrain] : na],
    [S.body, v.body_type ? L.enums.body[v.body_type] : na],
    [S.exterior, v.exterior_color ? colorName(v.exterior_color, ctx.locale) : na],
    [S.interior, v.interior_color ? colorName(v.interior_color, ctx.locale) : na],
    [S.regional, v.regional_spec ? L.enums.regional[v.regional_spec] : <span class="text-muted">{ar ? 'يرجى التواصل للاستفسار' : 'Ask the showroom'}</span>],
  ]

  const keyFacts = [
    { label: S.year, value: String(v.year), num: true },
    v.mileage_km != null ? { label: S.mileage, value: formatMileage(v.mileage_km, ctx.locale)!, num: true } : null,
    v.transmission ? { label: S.transmission, value: L.enums.transmission[v.transmission].replace(/ \(.+\)$/, ''), num: false } : null,
    v.fuel ? { label: S.fuel, value: L.enums.fuel[v.fuel], num: false } : null,
  ].filter(Boolean) as { label: string; value: string; num: boolean }[]

  const sold = v.status === 'sold'
  const image = v.images[0]

  return (
    <Layout
      ctx={ctx}
      meta={{
        title: ar
          ? `${fullTitle} للبيع${v.price_aed ? ` بسعر ${v.price_aed.toLocaleString('en-US')} درهم` : ''} | معرض بني ياس للسيارات`
          : `${fullTitle} for sale${v.price_aed ? ` – AED ${v.price_aed.toLocaleString('en-US')}` : ''} | Baniyas Cars`,
        description: description.slice(0, 158),
        image,
        ogType: 'product',
        noindex: sold || v.verification === 'sample',
        jsonLd: [
          vehicleJsonLd(v, ctx),
          breadcrumbJsonLd([
            { name: L.nav.home, path: href(ctx.locale, '/') },
            { name: L.nav.cars, path: href(ctx.locale, '/cars/') },
            { name: fullTitle, path: url },
          ]),
        ],
      }}
      bodyClass="pb-24 lg:pb-0"
    >
      <div class="wrap pt-5">
        <nav aria-label={ar ? 'مسار التصفح' : 'Breadcrumb'} class="text-sm text-muted">
          <ol class="flex flex-wrap items-center gap-1.5">
            <li><a class="hover:text-navy-900" href={href(ctx.locale, '/')}>{L.nav.home}</a></li>
            <li aria-hidden="true"><IconChevron size={14} dir={ar ? 'start' : 'end'} /></li>
            <li><a class="hover:text-navy-900" href={href(ctx.locale, '/cars/')}>{L.nav.cars}</a></li>
            <li aria-hidden="true"><IconChevron size={14} dir={ar ? 'start' : 'end'} /></li>
            <li><a class="hover:text-navy-900" href={href(ctx.locale, `/cars/?make=${encodeURIComponent(v.make)}`)}>{makeName(v.make, ctx.locale)}</a></li>
          </ol>
        </nav>
      </div>

      <div class="wrap grid gap-8 pt-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] lg:gap-10">
        {/* Gallery */}
        <section aria-label={L.car.gallery}>
          {v.images.length ? (
            <div data-gallery class="select-none">
              <div class="relative overflow-hidden rounded-[var(--radius-card)] bg-navy-950">
                <ul class="flex aspect-[4/5] snap-x snap-mandatory overflow-x-auto scroll-smooth [scrollbar-width:none] sm:aspect-[5/5] lg:aspect-[4/4.2]" data-track-list tabindex={0} aria-label={L.car.gallery}>
                  {v.images.map((img, i) => (
                    <li class="relative h-full w-full shrink-0 snap-center" aria-label={L.car.photoOf(i + 1, v.images.length)}>
                      <button type="button" class="block h-full w-full cursor-zoom-in" data-open={i} aria-label={`${L.car.photoOf(i + 1, v.images.length)} — ${ar ? 'تكبير' : 'enlarge'}`}>
                        <img
                          src={img}
                          alt={`${fullTitle} — ${L.car.photoOf(i + 1, v.images.length)}`}
                          width={768}
                          height={1024}
                          loading={i === 0 ? 'eager' : 'lazy'}
                          fetchpriority={i === 0 ? 'high' : undefined}
                          decoding="async"
                          referrerpolicy="no-referrer"
                          class="h-full w-full object-contain"
                        />
                      </button>
                    </li>
                  ))}
                </ul>
                {v.images.length > 1 ? (
                  <>
                    <button type="button" data-prev class="absolute start-3 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-paper/90 text-navy-900 shadow hover:bg-paper" aria-label={ar ? 'الصورة السابقة' : 'Previous photo'}>
                      <IconChevron dir={ar ? 'end' : 'start'} />
                    </button>
                    <button type="button" data-next class="absolute end-3 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-paper/90 text-navy-900 shadow hover:bg-paper" aria-label={ar ? 'الصورة التالية' : 'Next photo'}>
                      <IconChevron dir={ar ? 'start' : 'end'} />
                    </button>
                    <span class="num absolute bottom-3 end-3 rounded-full bg-navy-950/75 px-3 py-1 text-xs font-semibold text-paper" data-counter>
                      1 / {v.images.length}
                    </span>
                  </>
                ) : null}
              </div>
              {v.images.length > 1 ? (
                <ul class="mt-3 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:thin]" aria-label={ar ? 'الصور المصغرة' : 'Thumbnails'}>
                  {v.images.map((img, i) => (
                    <li class="shrink-0">
                      <button type="button" data-thumb={i} aria-current={i === 0 ? 'true' : undefined} class="block h-16 w-14 overflow-hidden rounded-md opacity-60 ring-2 ring-transparent aria-[current=true]:opacity-100 aria-[current=true]:ring-navy-900 sm:h-20 sm:w-16" aria-label={L.car.photoOf(i + 1, v.images.length)}>
                        <img src={img} alt="" loading="lazy" referrerpolicy="no-referrer" class="h-full w-full object-cover" />
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
              <dialog data-lightbox class="m-0 h-full max-h-none w-full max-w-none bg-navy-950/95 p-0 backdrop:bg-navy-950/80">
                <button type="button" data-close class="fixed end-4 top-4 z-10 grid h-11 w-11 place-items-center rounded-full bg-paper text-navy-900" aria-label={L.nav.close}>
                  <IconClose />
                </button>
                <img data-lightbox-img alt="" referrerpolicy="no-referrer" class="h-full w-full object-contain p-4" />
              </dialog>
            </div>
          ) : (
            <div class="aspect-[4/5] overflow-hidden rounded-[var(--radius-card)] border border-line sm:aspect-square">
              <NoPhoto v={v} locale={ctx.locale} />
            </div>
          )}
        </section>

        {/* Summary panel */}
        <section aria-labelledby="car-title" class="lg:sticky lg:top-24 lg:self-start">
          <StatusTags v={v} locale={ctx.locale} />
          <h1 id="car-title" class="h-display mt-3 text-[2rem] sm:text-[2.5rem]">{shortTitle}</h1>
          <p class="mt-1 text-lg text-navy-800" dir="auto">
            {[v.trim, String(v.year)].filter(Boolean).join(' ')}
          </p>

          <div class="mt-6">
            <PricePlate price={v.price_aed} locale={ctx.locale} size="lg" vat={v.price_includes_vat} />
          </div>

          {keyFacts.length ? (
            <dl class="mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-4">
              {keyFacts.map((k) => (
                <div class="bg-paper p-3">
                  <dt class="text-xs text-muted">{k.label}</dt>
                  <dd class={`mt-1 font-bold ${k.num ? 'num' : ''}`}>{k.value}</dd>
                </div>
              ))}
            </dl>
          ) : null}

          {sold ? (
            <p class="mt-6 rounded-xl bg-stone-2 p-4 text-sm leading-7">{L.car.soldNote}</p>
          ) : (
            <div class="mt-6 flex flex-col gap-3">
              {ask.external ? (
                <a href={ask.url} class="btn btn-wa min-h-13 text-base" target="_blank" rel="noopener" data-wa-vehicle>
                  <IconWhatsapp size={21} /> {L.car.askWhatsapp}
                </a>
              ) : (
                <a href={ask.url} class="btn btn-primary min-h-13 text-base">
                  {L.car.contactUs}
                </a>
              )}
              <div class="flex gap-3">
                {phone ? (
                  <a href={telHref(phone)} class="btn btn-ghost flex-1">
                    <IconPhone size={18} /> <span class="num">{displayPhone(phone)}</span>
                  </a>
                ) : null}
                <button
                  type="button"
                  class="btn btn-ghost"
                  data-share
                  data-url={absolute(url) ?? undefined}
                  data-title={fullTitle}
                  data-copied={L.car.copied}
                >
                  <IconShare size={18} /> {L.car.share}
                </button>
              </div>
            </div>
          )}

          {v.export_only ? (
            <p class="mt-5 flex gap-2.5 rounded-xl border border-line bg-paper p-4 text-sm leading-7">
              <IconAlert size={18} class="mt-1 shrink-0 text-navy-700" />
              <span>{L.car.exportNote}</span>
            </p>
          ) : null}
          {v.verification === 'needs_confirmation' && !sold ? (
            <p class="mt-3 flex gap-2.5 rounded-xl bg-amber-100 p-4 text-sm leading-7 text-amber">
              <IconAlert size={18} class="mt-1 shrink-0" />
              <span>
                <strong class="block">{L.car.needsConfirmation}</strong>
                {L.car.needsConfirmationNote}
              </span>
            </p>
          ) : null}
          {v.verification === 'sample' ? (
            <p class="mt-3 flex gap-2.5 rounded-xl bg-sold p-4 text-sm leading-7 text-paper">
              <IconAlert size={18} class="mt-1 shrink-0" />
              <span>{L.car.sampleNote}</span>
            </p>
          ) : null}
          {branch ? (
            <p class="mt-5 text-sm text-muted">
              {L.car.branch}: <span class="font-semibold text-navy-900">{ar ? branch.name_ar : branch.name_en}</span>
            </p>
          ) : null}
        </section>
      </div>

      <div class="wrap mt-14 grid gap-10 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] lg:gap-10">
        <div class="space-y-12">
          <section aria-labelledby="about-h">
            <h2 id="about-h" class="h-display mb-4 text-2xl">{L.car.about}</h2>
            <div class="prose-ar max-w-[68ch] text-[1.02rem] text-navy-900">
              {description.split(/\n{2,}/).map((p) => <p>{p}</p>)}
            </div>
          </section>

          <section aria-labelledby="specs-h">
            <h2 id="specs-h" class="h-display mb-4 text-2xl">{L.car.specs}</h2>
            <dl class="divide-y divide-line overflow-hidden rounded-[var(--radius-card)] border border-line bg-paper">
              {specs.map(([k, val]) => (
                <div class="grid grid-cols-[minmax(8rem,40%)_1fr] gap-4 px-4 py-3 text-[0.95rem]">
                  <dt class="text-muted">{k}</dt>
                  <dd class="font-semibold">{val}</dd>
                </div>
              ))}
            </dl>
            <p class="mt-3 text-xs leading-6 text-muted">{L.car.generalSpecsNote}</p>
          </section>

          {features.length ? (
            <section aria-labelledby="features-h">
              <h2 id="features-h" class="h-display mb-4 text-2xl">{L.car.features}</h2>
              <ul class="grid gap-x-6 gap-y-2.5 sm:grid-cols-2" lang={featuresLang} dir={featuresLang === 'ar' ? 'rtl' : 'ltr'}>
                {features.map((f) => (
                  <li class="relative ps-4 leading-7 before:absolute before:start-0 before:top-3 before:h-1.5 before:w-1.5 before:rounded-full before:bg-gold">{f}</li>
                ))}
              </ul>
            </section>
          ) : null}

          {warranty ? (
            <section aria-labelledby="warranty-h">
              <h2 id="warranty-h" class="h-display mb-3 text-2xl">{L.car.warranty}</h2>
              <p class="leading-8">{warranty}</p>
            </section>
          ) : null}
        </div>

        <aside class="space-y-6">
          {v.source_url ? (
            <section class="rounded-[var(--radius-card)] border border-line bg-paper p-5" aria-labelledby="src-h">
              <h2 id="src-h" class="font-bold">{L.car.source}</h2>
              <ul class="mt-3 space-y-2 text-sm">
                {[v.source_url, ...v.secondary_source_urls].map((s) => (
                  <li>
                    <a href={s} target="_blank" rel="noopener nofollow" class="inline-flex items-center gap-2 font-semibold text-navy-700 underline underline-offset-4">
                      <IconLink size={16} /> {sourceName(s, v.source_label)}
                    </a>
                  </li>
                ))}
              </ul>
              {v.last_verified_at ? (
                <p class="mt-3 text-xs text-muted">
                  {L.car.lastVerified}: {formatDate(v.last_verified_at, ctx.locale)}
                </p>
              ) : null}
            </section>
          ) : null}

        </aside>
      </div>

      {similar.length ? (
        <section class="wrap pt-16" aria-labelledby="similar-h">
          <SectionHead id="similar-h" title={L.car.similar} action={{ href: href(ctx.locale, `/cars/?make=${encodeURIComponent(v.make)}`), label: L.home.viewAll }} />
          <VehicleGrid items={similar} ctx={ctx} mobileLimit={2} />
        </section>
      ) : null}

      {/* Mobile action bar */}
      {!sold ? (
        <div class="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-paper/95 px-4 py-3 backdrop-blur lg:hidden" style="padding-bottom: max(0.75rem, env(safe-area-inset-bottom))">
          <div class="flex items-center gap-3">
            <div class="min-w-0 flex-1">
              <PricePlate price={v.price_aed} locale={ctx.locale} />
            </div>
            {ask.external ? (
              <a href={ask.url} class="btn btn-wa shrink-0" target="_blank" rel="noopener">
                <IconWhatsapp size={19} /> {L.whatsapp}
              </a>
            ) : (
              <a href={ask.url} class="btn btn-primary shrink-0">{L.car.contactUs}</a>
            )}
          </div>
        </div>
      ) : null}
    </Layout>
  )
}

function sourceName(url: string, label: string | null) {
  if (url.includes('instagram.com')) return 'Instagram @baniyascars'
  if (url.includes('facebook.com')) return 'Facebook'
  if (url.includes('auto.ae')) return label ?? 'auto.ae'
  return label ?? new URL(url).hostname
}
