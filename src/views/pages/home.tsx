import type { Vehicle } from '../../data/types.js'
import { t } from '../../i18n/index.js'
import { makeName, modelName } from '../../domain/names.js'
import { formatNumber, displayPhone } from '../../lib/format.js'
import { site } from '../../config/site.js'
import { Layout, contactTarget } from '../layout.js'
import { href, type PageCtx } from '../ctx.js'
import { PricePlate, SectionHead, VehicleGrid } from '../components.js'
import { IconFacebook, IconInstagram, IconSearch, IconWhatsapp, IconMap, IconPhone } from '../icons.js'
import { dealerJsonLd } from '../seo.js'

export interface HomeData {
  featured: Vehicle[]
  recent: Vehicle[]
  brands: { make: string; count: number; min_price: number | null }[]
  bands: { key: string; min?: number; max?: number; count: number }[]
  stats: { total: number; brands: number; year_min: number; year_max: number }
}

export function HomePage({ ctx, data }: { ctx: PageCtx; data: HomeData }) {
  const L = t(ctx.locale)
  const H = L.home
  const ar = ctx.locale === 'ar'
  const hero = data.featured.filter((v) => v.images.length).slice(0, 3)
  const contact = contactTarget(ctx.locale, L.whatsappGeneral)
  const count = (n: number) =>
    ar ? (n === 1 ? 'سيارة واحدة' : n === 2 ? 'سيارتان' : n <= 10 ? `${n} سيارات` : `${n} سيارة`) : `${n} ${n === 1 ? 'car' : 'cars'}`

  return (
    <Layout ctx={ctx} meta={{ title: H.title, description: H.description, image: hero[0]?.images[0], jsonLd: [dealerJsonLd(ctx)] }}>
      {/* Hero */}
      <section class="relative overflow-hidden bg-navy-900 text-paper">
        <div aria-hidden="true" class="pointer-events-none absolute inset-0 bg-[radial-gradient(70%_60%_at_85%_10%,rgba(184,151,90,0.18),transparent_60%),radial-gradient(60%_60%_at_0%_100%,rgba(30,58,102,0.7),transparent_70%)]"></div>
        <div class="wrap relative grid items-center gap-10 pb-14 pt-10 md:pb-20 md:pt-14 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] lg:gap-14">
          <div>
            <p class="eyebrow text-gold">{ar ? 'أبوظبي · دبي · العين' : 'Abu Dhabi · Dubai · Al Ain'}</p>
            <h1 class="h-display mt-5 text-[2.7rem] leading-[1.06] sm:text-[3.7rem] lg:text-[4.5rem]">
              {ar ? (
                <>
                  معرض بني ياس
                  <br />
                  <span class="text-gold">للسيارات</span>
                </>
              ) : (
                <>
                  Baniyas
                  <br />
                  <span class="text-gold">Cars</span>
                </>
              )}
            </h1>
            <p class="mt-5 max-w-[36ch] text-lg leading-8 text-navy-100">{H.heroLine}</p>

            <form action={href(ctx.locale, '/cars/')} method="get" role="search" class="mt-8 max-w-xl">
              <label for="hero-q" class="mb-2 block text-sm font-semibold text-navy-100">{H.searchLabel}</label>
              <div class="flex gap-2 rounded-full bg-paper p-1.5 ring-1 ring-white/10 focus-within:ring-2 focus-within:ring-gold">
                <span class="grid place-items-center ps-2 text-muted"><IconSearch /></span>
                <input
                  id="hero-q"
                  name="q"
                  type="search"
                  placeholder={H.searchPlaceholder}
                  autocomplete="off"
                  class="min-w-0 flex-1 bg-transparent px-1 text-base text-navy-900 outline-none placeholder:text-muted/70"
                />
                <button class="btn btn-primary">{H.searchButton}</button>
              </div>
            </form>

            <div class="mt-6 flex flex-wrap items-center gap-2 text-sm">
              <a class="rounded-full border border-white/20 px-3.5 py-1.5 hover:border-gold hover:text-gold" href={href(ctx.locale, '/cars/?condition=new')}>{L.enums.condition.new}</a>
              <a class="rounded-full border border-white/20 px-3.5 py-1.5 hover:border-gold hover:text-gold" href={href(ctx.locale, '/cars/?condition=used')}>{L.enums.condition.used}</a>
              <a class="rounded-full border border-white/20 px-3.5 py-1.5 hover:border-gold hover:text-gold" href={href(ctx.locale, '/cars/?gcc=1')}>{L.cars.gccOnly}</a>
            </div>

            <dl class="mt-10 grid max-w-md grid-cols-3 gap-6 border-t border-white/10 pt-6">
              <div>
                <dt class="text-xs text-navy-100/70">{ar ? 'سيارة معروضة' : 'Cars listed'}</dt>
                <dd class="num mt-1 font-display text-2xl font-bold text-paper">{data.stats.total}</dd>
              </div>
              <div>
                <dt class="text-xs text-navy-100/70">{ar ? 'ماركات' : 'Brands'}</dt>
                <dd class="num mt-1 font-display text-2xl font-bold text-paper">{data.stats.brands}</dd>
              </div>
              <div>
                <dt class="text-xs text-navy-100/70">{ar ? 'فروع' : 'Branches'}</dt>
                <dd class="num mt-1 font-display text-2xl font-bold text-paper">{site.branches.length}</dd>
              </div>
            </dl>
          </div>

          {hero.length ? (
            <div class="grid h-[400px] grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] grid-rows-2 gap-3 sm:h-[520px]">
              {hero.map((v, i) => (
                <a
                  href={href(ctx.locale, `/cars/${v.slug}/`)}
                  class={`group relative overflow-hidden rounded-[var(--radius-card)] bg-navy-800 ring-1 ring-white/10 ${i === 0 ? 'row-span-2' : ''}`}
                >
                  <img
                    src={v.images[0]!}
                    alt={`${makeName(v.make, ctx.locale)} ${modelName(v.model, ctx.locale)} ${v.trim ?? ''} ${v.year}`}
                    width={768}
                    height={1024}
                    loading={i === 0 ? 'eager' : 'lazy'}
                    fetchpriority={i === 0 ? 'high' : undefined}
                    referrerpolicy="no-referrer"
                    class="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.03]"
                  />
                  <span class="absolute inset-x-0 bottom-0 flex flex-col items-start gap-2 bg-gradient-to-t from-navy-950/90 via-navy-950/40 to-transparent p-3 pt-12 sm:p-4">
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
          <SectionHead id="featured-h" eyebrow={ar ? 'من المعرض' : 'From the showroom'} title={H.featured} action={{ href: href(ctx.locale, '/cars/'), label: H.viewAll }} />
          <VehicleGrid items={data.featured} ctx={ctx} mobileLimit={4} />
        </section>
      ) : null}

      {/* Brands and price bands */}
      <section class="wrap grid gap-12 pt-20 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div aria-labelledby="brands-h">
          <SectionHead id="brands-h" title={H.byBrand} />
          <ul class="grid grid-cols-2 gap-px overflow-hidden rounded-[var(--radius-card)] border border-line bg-line sm:grid-cols-4" role="list">
            {data.brands.map((b) => (
              <li class="bg-paper">
                <a href={href(ctx.locale, `/cars/?make=${encodeURIComponent(b.make)}`)} class="group flex h-full flex-col gap-1 p-4 hover:bg-stone">
                  <span class="font-display text-xl font-bold group-hover:text-navy-700">{makeName(b.make, ctx.locale)}</span>
                  <span class="text-xs text-muted">{count(b.count)}</span>
                  {b.min_price ? (
                    <span class="mt-2 text-xs text-navy-800">
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
                    <a href={href(ctx.locale, `/cars/?${qs}`)} class="flex items-center justify-between gap-3 rounded-xl border border-line bg-paper px-4 py-3.5 hover:border-gold">
                      <span class="font-semibold">
                        {L.priceBands[b.key as keyof typeof L.priceBands]} <span class="text-sm font-normal text-muted">{ar ? 'درهم' : 'AED'}</span>
                      </span>
                      <span class="num rounded-full bg-gold-100 px-2.5 py-0.5 text-sm font-semibold text-gold-600">{b.count}</span>
                    </a>
                  </li>
                )
              })}
          </ul>
        </div>
      </section>

      {data.recent.length ? (
        <section class="wrap pt-20" aria-labelledby="recent-h">
          <SectionHead id="recent-h" title={H.recent} action={{ href: href(ctx.locale, '/cars/'), label: H.viewAll }} />
          <VehicleGrid items={data.recent} ctx={ctx} mobileLimit={4} />
        </section>
      ) : null}

      {/* About: only facts published by the dealership */}
      <section class="wrap pt-20" aria-labelledby="about-h">
        <div class="relative overflow-hidden rounded-[var(--radius-card)] bg-navy-900 p-6 text-navy-100 sm:p-10">
          <div class="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-gold/70 to-transparent" aria-hidden="true"></div>
          <div class="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)]">
            <div>
              <p class="eyebrow">{ar ? 'المعرض' : 'The showroom'}</p>
              <h2 id="about-h" class="h-display mt-3 text-3xl text-paper">{H.why}</h2>
              <p class="mt-4 max-w-sm leading-8">
                {ar
                  ? 'مؤسسة بني ياس للسيارات تعرض سيارات جديدة ومستعملة من عدة ماركات، ولها فروع في أبوظبي ودبي والعين.'
                  : 'Bani Yas Cars Est. shows new and used cars from several brands, with branches in Abu Dhabi, Dubai and Al Ain.'}
              </p>
            </div>
            <dl class="grid gap-x-8 gap-y-6 sm:grid-cols-2">
              <div class="border-t border-white/10 pt-4">
                <dt class="font-bold text-paper">{ar ? 'ثلاثة فروع' : 'Three branches'}</dt>
                <dd class="mt-1.5 text-sm leading-7">{site.branches.map((b) => (ar ? b.name_ar : b.name_en)).join(ar ? '، ' : ', ')}</dd>
              </div>
              <div class="border-t border-white/10 pt-4">
                <dt class="font-bold text-paper">{ar ? 'جديد ومستعمل وتصدير' : 'New, used and export'}</dt>
                <dd class="mt-1.5 text-sm leading-7">
                  {ar ? 'قسم للسيارات الجديدة، وقسم لبيع وشراء السيارات المستعملة، وقسم للتصدير.' : 'A new-car sales team, a used-car buying and selling department, and an export department.'}
                </dd>
              </div>
              <div class="border-t border-white/10 pt-4">
                <dt class="font-bold text-paper">{ar ? 'ماركات متعددة' : 'Many brands'}</dt>
                <dd class="mt-1.5 text-sm leading-7">{data.brands.map((b) => makeName(b.make, ctx.locale)).join(ar ? '، ' : ', ')}</dd>
              </div>
              <div class="border-t border-white/10 pt-4">
                <dt class="font-bold text-paper">{ar ? 'أسعار معلنة بالدرهم' : 'Prices shown in AED'}</dt>
                <dd class="mt-1.5 text-sm leading-7">
                  {ar
                    ? 'كل سعر على الموقع منقول من إعلان المعرض، مع رابط الإعلان الأصلي وتاريخ آخر تحقق.'
                    : 'Every price is taken from the showroom’s own listing, with a link to the original and the date it was last checked.'}
                </dd>
              </div>
            </dl>
          </div>
        </div>
      </section>

      {/* Contact band */}
      <section class="wrap pt-20" aria-labelledby="contact-h">
        <div class="grid items-center gap-8 rounded-[var(--radius-card)] border border-line bg-paper p-6 sm:p-10 md:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
          <div>
            <h2 id="contact-h" class="h-display text-3xl">{H.contactTitle}</h2>
            <p class="mt-3 max-w-[52ch] leading-8 text-navy-800">{H.contactBody}</p>
            <div class="mt-6 flex flex-wrap gap-3">
              {contact.external ? (
                <a href={contact.url} class="btn btn-wa" target="_blank" rel="noopener">
                  <IconWhatsapp size={19} /> {L.contactCta}
                  <span class="num text-paper/80">{displayPhone(site.whatsapp!)}</span>
                </a>
              ) : (
                <a href={contact.url} class="btn btn-primary">
                  <IconPhone size={18} /> {L.nav.contact}
                </a>
              )}
              <a href={href(ctx.locale, '/contact/')} class="btn btn-ghost">
                <IconMap size={18} /> {L.contact.branches}
              </a>
            </div>
          </div>
          <div>
            <p class="mb-3 text-sm font-semibold text-muted">{H.followUs}</p>
            <div class="flex flex-wrap gap-3">
              <a href={site.instagram} target="_blank" rel="noopener" class="btn btn-ghost">
                <IconInstagram size={18} /> Instagram
              </a>
              <a href={site.facebook} target="_blank" rel="noopener" class="btn btn-ghost">
                <IconFacebook size={18} /> Facebook
              </a>
            </div>
          </div>
        </div>
      </section>
    </Layout>
  )
}
