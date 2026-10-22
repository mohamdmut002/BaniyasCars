import { t } from '../../i18n/index.js'
import { displayPhone, telHref } from '../../lib/format.js'
import { whatsappLink } from '../../lib/whatsapp.js'
import { Layout } from '../layout.js'
import { href, type PageCtx } from '../ctx.js'
import { IconClock, IconMail, IconMap, IconPhone, IconWhatsapp } from '../icons.js'
import { dealerJsonLd } from '../seo.js'
import { site } from '../../config/site.js'
import { IconInstagram, IconFacebook } from '../icons.js'

export function ContactPage({ ctx }: { ctx: PageCtx }) {
  const L = t(ctx.locale)
  const C = L.contact
  const s = site
  const ar = ctx.locale === 'ar'
  const wa = whatsappLink(s.whatsapp, L.whatsappGeneral)

  return (
    <Layout ctx={ctx} meta={{ title: `${C.title}`, description: C.description, jsonLd: [dealerJsonLd(ctx)] }}>
      <div class="bg-navy-900 text-paper">
        <div class="wrap pb-10 pt-9">
          <p class="eyebrow text-gold">{L.nav.contact}</p>
          <h1 class="h-display mt-3 text-3xl sm:text-[2.6rem]">{C.title}</h1>
          <p class="mt-3 max-w-[56ch] leading-8 text-navy-100">{L.home.contactBody}</p>
        </div>
      </div>

      <div class="wrap grid gap-8 pt-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        <section class="space-y-4" aria-label={L.footer.contact}>
          {wa ? (
            <a href={wa} target="_blank" rel="noopener" class="flex items-center gap-4 rounded-[var(--radius-card)] bg-wa p-5 text-paper hover:bg-wa-hover" data-track="wa-contact">
              <IconWhatsapp size={30} />
              <span>
                <span class="block text-sm opacity-85">{C.generalWhatsapp}</span>
                <span class="num block text-2xl font-bold">{displayPhone(s.whatsapp!)}</span>
              </span>
            </a>
          ) : null}
          {s.phone ? (
            <a href={telHref(s.phone)} class="flex items-center gap-4 rounded-[var(--radius-card)] border border-line bg-paper p-5 hover:border-navy-700">
              <IconPhone size={26} />
              <span>
                <span class="block text-sm text-muted">{L.call}</span>
                <span class="num block text-xl font-bold">{displayPhone(s.phone)}</span>
              </span>
            </a>
          ) : null}
          {s.email ? (
            <a href={`mailto:${s.email}`} class="flex items-center gap-4 rounded-[var(--radius-card)] border border-line bg-paper p-5 hover:border-navy-700">
              <IconMail size={26} />
              <span>
                <span class="block text-sm text-muted">{C.email}</span>
                <span class="block font-bold">{s.email}</span>
              </span>
            </a>
          ) : null}
          {!wa && !s.phone && !s.email ? (
            <p class="rounded-[var(--radius-card)] border border-dashed border-line bg-paper p-5 leading-7">
              {ar ? 'يرجى التواصل للاستفسار عبر حسابات المعرض الرسمية.' : 'Please contact the showroom through its official accounts.'}
            </p>
          ) : null}
          <div class="flex flex-wrap gap-3">
            <a href={s.instagram} target="_blank" rel="noopener" class="btn btn-ghost"><IconInstagram size={18} /> Instagram</a>
            <a href={s.facebook} target="_blank" rel="noopener" class="btn btn-ghost"><IconFacebook size={18} /> Facebook</a>
          </div>
          {s.hours_ar || s.hours_en ? (
            <div class="flex items-start gap-4 rounded-[var(--radius-card)] border border-line bg-paper p-5">
              <IconClock size={26} class="mt-1" />
              <div>
                <span class="block text-sm text-muted">{C.hours}</span>
                <span class="block font-bold">{ar ? s.hours_ar : s.hours_en}</span>
                <span class="mt-1 block text-xs text-muted">{C.hoursNote}</span>
              </div>
            </div>
          ) : null}
        </section>

        <section aria-labelledby="branches-h">
          <h2 id="branches-h" class="h-display mb-4 text-2xl">{C.branches}</h2>
          <ul class="space-y-3" role="list">
            {site.branches.map((b) => (
              <li class="rounded-[var(--radius-card)] border border-line bg-paper p-5">
                <h3 class="text-lg font-bold">{ar ? b.name_ar : b.name_en}</h3>
                {(ar ? b.address_ar : b.address_en) ? <p class="mt-1.5 leading-7 text-navy-800">{ar ? b.address_ar : b.address_en}</p> : null}
                <div class="mt-3 flex flex-wrap gap-2">
                  {b.phone ? (
                    <a href={telHref(b.phone)} class="btn btn-ghost btn-sm">
                      <IconPhone size={16} /> <span class="num">{displayPhone(b.phone)}</span>
                    </a>
                  ) : null}
                  {b.whatsapp ? (
                    <a href={whatsappLink(b.whatsapp, L.whatsappGeneral)!} target="_blank" rel="noopener" class="btn btn-wa btn-sm">
                      <IconWhatsapp size={16} /> {L.whatsapp}
                    </a>
                  ) : null}
                  {b.maps_url ? (
                    <a href={b.maps_url} target="_blank" rel="noopener" class="btn btn-ghost btn-sm">
                      <IconMap size={16} /> {C.directions}
                    </a>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
          {s.maps_url ? (
            <a href={s.maps_url} target="_blank" rel="noopener" class="btn btn-ghost mt-4">
              <IconMap size={18} /> {C.directions}
            </a>
          ) : null}

          {s.departments.length ? (
            <>
              <h2 class="h-display mb-4 mt-10 text-2xl">{C.departments}</h2>
              <ul class="divide-y divide-line overflow-hidden rounded-[var(--radius-card)] border border-line bg-paper" role="list">
                {s.departments.map((d) => (
                  <li class="flex flex-wrap items-center justify-between gap-3 p-4">
                    <span class="font-semibold">{ar ? d.name_ar : d.name_en}</span>
                    {d.phone ? (
                      <a href={telHref(d.phone)} class="num font-semibold text-navy-700 underline underline-offset-4">{displayPhone(d.phone)}</a>
                    ) : null}
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </section>
      </div>
    </Layout>
  )
}

export function NotFoundPage({ ctx }: { ctx: PageCtx }) {
  const L = t(ctx.locale)
  return (
    <Layout ctx={ctx} meta={{ title: `${L.notFound.title} | ${L.siteNameFull}`, description: L.notFound.body, noindex: true, canonicalPath: null }}>
      <section class="wrap grid min-h-[50vh] place-items-center py-20 text-center">
        <div>
          <p class="plate plate-lg mx-auto" dir="ltr" aria-hidden="true">
            <span class="plate-code">404</span>
            <span class="plate-num">— — —</span>
          </p>
          <h1 class="h-display mt-8 text-3xl">{L.notFound.title}</h1>
          <p class="mx-auto mt-3 max-w-[44ch] leading-8 text-navy-800">{L.notFound.body}</p>
          <div class="mt-8 flex flex-wrap justify-center gap-3">
            <a href={href(ctx.locale, '/cars/')} class="btn btn-primary">{L.notFound.cta}</a>
            <a href={href(ctx.locale, '/')} class="btn btn-ghost">{L.nav.home}</a>
          </div>
          {ctx.locale === 'ar' ? (
            <p class="mt-8 text-sm text-muted" lang="en" dir="ltr">
              Page not found. <a class="font-semibold text-navy-700 underline" href="/en/cars/">Browse cars in English</a>
            </p>
          ) : null}
        </div>
      </section>
    </Layout>
  )
}
