import type { VehicleWithImages } from '../../domain/vehicle.js'
import type { Offer } from '../../repo/misc.js'
import { t } from '../../i18n/index.js'
import { makeName, modelName } from '../../domain/names.js'
import { formatNumber, displayPhone } from '../../lib/format.js'
import { whatsappLink } from '../../lib/whatsapp.js'
import { Layout } from '../layout.js'
import { href, absolute, type PageCtx } from '../ctx.js'
import { PricePlate, SectionHead, VehicleGrid } from '../components.js'
import { IconFacebook, IconInstagram, IconSearch, IconWhatsapp, IconMap } from '../icons.js'
import { dealerJsonLd } from '../seo.js'

export interface HomeData {
  featured: VehicleWithImages[]
  recent: VehicleWithImages[]
  brands: { make: string; count: number; min_price: number | null }[]
  bands: { key: string; min?: number; max?: number; count: number }[]
  offers: Offer[]
  stats: { total: number; year_min: number; year_max: number }
}

export function HomePage({ ctx, data }: { ctx: PageCtx; data: HomeData }) {
  const L = t(ctx.locale)
  const H = L.home
  const ar = ctx.locale === 'ar'
  const hero = data.featured.filter((v) => v.images.length).slice(0, 3)
  const wa = whatsappLink(ctx.settings.whatsapp, L.whatsappGeneral)

  return (
    <Layout
      ctx={ctx}
      meta={{ title: H.title, description: H.description, image: hero[0]?.images[0]?.url, jsonLd: [dealerJsonLd(ctx)] }}
    >
      {/* Hero */}
      <section class="relative overflow-hidden border-b border-line bg-paper">
        <div class="wrap grid items-center gap-10 py-10 md:py-14 lg:grid-cols-[1.05fr_1fr] lg:gap-14">
          <div>
            <h1 class="h-display text-[2.6rem] leading-[1.05] sm:text-[3.6rem] lg:text-[4.4rem]">
              {ar ? (
                <>
                  معرض
                  <br />
                  بني ياس
                  <br />
                  للسيارات
                </>
              ) : (
                <>
                  Baniyas
                  <br />
                  Cars
                </>
              )}
            </h1>
            <p class="mt-5 max-w-[34ch] text-lg leading-8 text-petrol-800">{H.heroLine}</p>

            <form action={href(ctx.locale, '/cars')} method="get" role="search" class="mt-8 max-w-xl">
              <label for="hero-q" class="label">{H.searchLabel}</label>
              <div class="flex gap-2 rounded-full border-2 border-petrol-900 bg-paper p-1.5 focus-within:border-sand">
                <span class="grid place-items-center ps-2 text-sage"><IconSearch /></span>
                <input
                  id="hero-q"
                  name="q"
                  type="search"
                  placeholder={H.searchPlaceholder}
                  autocomplete="off"
                  class="min-w-0 flex-1 bg-transparent px-1 text-base outline-none placeholder:text-sage/70"
                />
                <button class="btn btn-primary">{H.searchButton}</button>
              </div>
            </form>

            <div class="mt-6 flex flex-wrap items-center gap-2 text-sm">
              <a href={href(ctx.locale, '/cars')} class="font-semibold text-petrol-900 underline decoration-sand decoration-2 underline-offset-[6px]">
                {H.inStock(data.stats.total)}
              </a>
              <span class="mx-1 text-line" aria-hidden="true">|</span>
              <a class="rounded-full border border-line px-3 py-1.5 hover:border-petrol-700" href={href(ctx.locale, '/cars?condition=new')}>{L.enums.condition.new}</a>
              <a class="rounded-full border border-line px-3 py-1.5 hover:border-petrol-700" href={href(ctx.locale, '/cars?condition=used')}>{L.enums.condition.used}</a>
              <a class="rounded-full border border-line px-3 py-1.5 hover:border-petrol-700" href={href(ctx.locale, '/cars?gcc=1')}>{L.cars.gccOnly}</a>
            </div>
          </div>

          {hero.length ? (
            <div class="grid h-[420px] grid-cols-[1.6fr_1fr] grid-rows-2 gap-3 sm:h-[520px]">
              {hero.map((v, i) => (
                <a
                  href={href(ctx.locale, `/cars/${v.slug}`)}
                  class={`group relative overflow-hidden rounded-[var(--radius-card)] bg-stone-2 ${i === 0 ? 'row-span-2' : ''}`}
                >
                  <img
                    src={v.images[0]!.url}
                    alt={`${makeName(v.make, ctx.locale)} ${modelName(v.model, ctx.locale)} ${v.trim ?? ''} ${v.year}`}
                    width={v.images[0]!.width ?? 768}
                    height={v.images[0]!.height ?? 1024}
                    loading={i === 0 ? 'eager' : 'lazy'}
                    fetchpriority={i === 0 ? 'high' : undefined}
                    referrerpolicy="no-referrer"
                    class="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.03]"
                  />
                  <span class="absolute inset-x-0 bottom-0 flex flex-col items-start gap-2 bg-gradient-to-t from-petrol-950/85 via-petrol-950/40 to-transparent p-3 pt-12 text-paper sm:p-4">
                    <span class={`font-bold leading-tight ${i === 0 ? 'text-lg' : 'text-sm'}`}>
                      {makeName(v.make, ctx.locale)} {modelName(v.model, ctx.locale)} <span class="num">{v.year}</span>
                    </span>
                    {i === 0 ? <PricePlate price={v.price_aed} locale={ctx.locale} /> : null}
                  </span>
                </a>
              ))}
            </div>
          ) : null}
        </div>
      </section>

      {data.featured.length ? (
        <section class="wrap pt-16" aria-labelledby="featured-h">
          <SectionHead id="featured-h" title={H.featured} action={{ href: href(ctx.locale, '/cars'), label: H.viewAll }} />
          <VehicleGrid items={data.featured} ctx={ctx} mobileLimit={4} />
        </section>
      ) : null}

      {/* Brands and price bands */}
      <section class="wrap grid gap-12 pt-20 lg:grid-cols-[1.4fr_1fr]">
        <div aria-labelledby="brands-h">
          <SectionHead id="brands-h" title={H.byBrand} />
          <ul class="grid grid-cols-2 gap-px overflow-hidden rounded-[var(--radius-card)] border border-line bg-line sm:grid-cols-4" role="list">
            {data.brands.map((b) => (
              <li class="bg-paper">
                <a href={href(ctx.locale, `/cars?make=${encodeURIComponent(b.make)}`)} class="flex h-full flex-col gap-1 p-4 hover:bg-stone">
                  <span class="font-display text-xl font-bold">{makeName(b.make, ctx.locale)}</span>
                  <span class="text-xs text-sage" dir={ar ? 'rtl' : 'ltr'}>
                    {ar ? (b.count === 1 ? 'سيارة واحدة' : b.count === 2 ? 'سيارتان' : b.count <= 10 ? `${b.count} سيارات` : `${b.count} سيارة`) : `${b.count} ${b.count === 1 ? 'car' : 'cars'}`}
                  </span>
                  {b.min_price ? (
                    <span class="mt-2 text-xs text-petrol-800">
                      {ar ? 'تبدأ من ' : 'From '}
                      <span class="num font-semibold">{formatNumber(b.min_price)}</span> {ar ? 'درهم' : 'AED'}
                    </span>
                  ) : null}
                </a>
              </li>
            ))}
          </ul>
        </div>
        <div aria-labelledby="price-h">
          <SectionHead id="price-h" title={H.byPrice} />
          <ul class="space-y-2" role="list">
            {data.bands
              .filter((b) => b.count > 0)
              .map((b) => {
                const qs = new URLSearchParams()
                if (b.min) qs.set('price_min', String(b.min))
                if (b.max) qs.set('price_max', String(b.max))
                qs.set('sort', 'price_asc')
                return (
                  <li>
                    <a href={href(ctx.locale, `/cars?${qs}`)} class="flex items-center justify-between gap-3 rounded-xl border border-line bg-paper px-4 py-3.5 hover:border-petrol-700">
                      <span class="font-semibold">{L.priceBands[b.key as keyof typeof L.priceBands]} <span class="text-sm font-normal text-sage">{ar ? 'درهم' : 'AED'}</span></span>
                      <span class="num rounded-full bg-stone px-2.5 py-0.5 text-sm font-semibold">{b.count}</span>
                    </a>
                  </li>
                )
              })}
          </ul>
        </div>
      </section>

      {data.offers.length ? (
        <section class="wrap pt-20" aria-labelledby="offers-h">
          <SectionHead id="offers-h" title={H.offers} />
          <ul class="grid gap-4 md:grid-cols-2" role="list">
            {data.offers.map((o) => (
              <li class="rounded-[var(--radius-card)] border-2 border-sand bg-sand-100 p-6">
                <h3 class="text-lg font-bold">{ar ? o.title_ar : o.title_en}</h3>
                {(ar ? o.body_ar : o.body_en) ? <p class="mt-2 leading-7">{ar ? o.body_ar : o.body_en}</p> : null}
                <div class="mt-4 flex flex-wrap gap-4 text-sm">
                  {o.vehicle_slug ? <a class="font-semibold underline underline-offset-4" href={href(ctx.locale, `/cars/${o.vehicle_slug}`)}>{L.cars.details}</a> : null}
                  {o.valid_until ? <span class="text-sage">{ar ? 'ساري حتى ' : 'Valid until '}<span class="num">{o.valid_until}</span></span> : null}
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {data.recent.length ? (
        <section class="wrap pt-20" aria-labelledby="recent-h">
          <SectionHead id="recent-h" title={H.recent} action={{ href: href(ctx.locale, '/cars?sort=recent'), label: H.viewAll }} />
          <VehicleGrid items={data.recent} ctx={ctx} mobileLimit={4} />
        </section>
      ) : null}

      {/* About: only facts published by the dealership */}
      <section class="wrap pt-20" aria-labelledby="about-h">
        <div class="grid gap-10 rounded-[var(--radius-card)] bg-petrol-900 p-6 text-petrol-100 sm:p-10 lg:grid-cols-[1fr_1.6fr]">
          <div>
            <h2 id="about-h" class="h-display text-3xl text-paper">{H.why}</h2>
            <p class="mt-4 max-w-sm leading-8">
              {ar
                ? 'مؤسسة بني ياس للسيارات تعرض سيارات جديدة ومستعملة من عدة ماركات، ولها فروع في أبوظبي ودبي والعين.'
                : 'Bani Yas Cars Est. shows new and used cars from several brands, with branches in Abu Dhabi, Dubai and Al Ain.'}
            </p>
          </div>
          <dl class="grid gap-x-8 gap-y-6 sm:grid-cols-2">
            <div class="border-t border-petrol-700 pt-4">
              <dt class="font-bold text-paper">{ar ? 'ثلاثة فروع' : 'Three branches'}</dt>
              <dd class="mt-1.5 text-sm leading-7">{ctx.branches.map((b) => (ar ? b.name_ar : b.name_en)).join(ar ? '، ' : ', ')}</dd>
            </div>
            <div class="border-t border-petrol-700 pt-4">
              <dt class="font-bold text-paper">{ar ? 'جديد ومستعمل وتصدير' : 'New, used and export'}</dt>
              <dd class="mt-1.5 text-sm leading-7">
                {ar
                  ? 'قسم للسيارات الجديدة، وقسم لبيع وشراء السيارات المستعملة، وقسم للتصدير.'
                  : 'A new-car sales team, a used-car buying and selling department, and an export department.'}
              </dd>
            </div>
            <div class="border-t border-petrol-700 pt-4">
              <dt class="font-bold text-paper">{ar ? 'ماركات متعددة' : 'Many brands'}</dt>
              <dd class="mt-1.5 text-sm leading-7">{data.brands.map((b) => makeName(b.make, ctx.locale)).join(ar ? '، ' : ', ')}</dd>
            </div>
            <div class="border-t border-petrol-700 pt-4">
              <dt class="font-bold text-paper">{ar ? 'أسعار معلنة بالدرهم' : 'Prices shown in AED'}</dt>
              <dd class="mt-1.5 text-sm leading-7">
                {ar
                  ? 'كل سعر على الموقع منقول من إعلان المعرض، مع رابط الإعلان الأصلي وتاريخ آخر تحقق.'
                  : 'Every price is taken from the showroom’s own listing, with a link to the original and the date it was last checked.'}
              </dd>
            </div>
          </dl>
        </div>
      </section>

      {/* Contact band */}
      <section class="wrap pt-20" aria-labelledby="contact-h">
        <div class="grid items-center gap-8 rounded-[var(--radius-card)] border border-line bg-paper p-6 sm:p-10 md:grid-cols-[1.3fr_1fr]">
          <div>
            <h2 id="contact-h" class="h-display text-3xl">{H.contactTitle}</h2>
            <p class="mt-3 max-w-[52ch] leading-8 text-petrol-800">{H.contactBody}</p>
            <div class="mt-6 flex flex-wrap gap-3">
              {wa ? (
                <a href={wa} class="btn btn-wa" target="_blank" rel="noopener" data-track="wa-home">
                  <IconWhatsapp size={19} /> {L.contactCta}
                  <span class="num text-paper/80">{displayPhone(ctx.settings.whatsapp!)}</span>
                </a>
              ) : null}
              <a href={href(ctx.locale, '/contact')} class="btn btn-ghost">
                <IconMap size={18} /> {L.contact.branches}
              </a>
            </div>
          </div>
          <div>
            <p class="mb-3 text-sm font-semibold text-sage">{H.followUs}</p>
            <div class="flex flex-wrap gap-3">
              {ctx.settings.instagram_url ? (
                <a href={ctx.settings.instagram_url} target="_blank" rel="noopener" class="btn btn-ghost">
                  <IconInstagram size={18} /> Instagram
                </a>
              ) : null}
              {ctx.settings.facebook_url ? (
                <a href={ctx.settings.facebook_url} target="_blank" rel="noopener" class="btn btn-ghost">
                  <IconFacebook size={18} /> Facebook
                </a>
              ) : null}
            </div>
          </div>
        </div>
      </section>
    </Layout>
  )
}

export { absolute }
