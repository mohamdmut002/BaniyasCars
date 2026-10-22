import { raw, type Child } from '@jsx/jsx-runtime'
import { t, dir } from '../i18n/index.js'
import { absolute, href, type PageCtx, type PageMeta } from './ctx.js'
import { site } from '../config/site.js'
import { whatsappLink } from '../lib/whatsapp.js'
import { displayPhone, telHref } from '../lib/format.js'
import { IconFacebook, IconInstagram, IconMail, IconMenu, IconPhone, IconThreads, IconWhatsapp } from './icons.js'

export function Wordmark({ locale, small, light }: { locale: PageCtx['locale']; small?: boolean; light?: boolean }) {
  return (
    <span class="flex items-center gap-3">
      <span
        aria-hidden="true"
        class={`grid place-items-center rounded-[7px] border border-gold/70 font-display font-bold text-gold ${small ? 'h-9 w-9 text-base' : 'h-11 w-11 text-lg'}`}
      >
        ب
      </span>
      <span class="flex flex-col leading-none">
        <span class={`font-display font-bold ${light ? 'text-paper' : 'text-navy-900'} ${small ? 'text-lg' : 'text-xl'}`}>
          {locale === 'ar' ? 'بني ياس للسيارات' : 'Baniyas Cars'}
        </span>
        <span class="mt-1 text-[0.64rem] font-semibold tracking-[0.18em] text-gold">{locale === 'ar' ? 'BANIYAS CARS' : 'بني ياس للسيارات'}</span>
      </span>
    </span>
  )
}

/** WhatsApp link with a prefilled message, or the contact page when no number is configured. */
export function contactTarget(locale: PageCtx['locale'], text: string): { url: string; external: boolean } {
  const wa = whatsappLink(site.whatsapp, text)
  return wa ? { url: wa, external: true } : { url: href(locale, '/contact/'), external: false }
}

export function Layout(props: { ctx: PageCtx; meta: PageMeta; children: Child; bodyClass?: string }) {
  const { ctx, meta } = props
  const L = t(ctx.locale)
  const other = ctx.locale === 'ar' ? 'en' : 'ar'
  const canonicalPath = meta.canonicalPath === null ? null : (meta.canonicalPath ?? ctx.path)
  const canonical = canonicalPath ? absolute(href(ctx.locale, canonicalPath)) : null
  const contact = contactTarget(ctx.locale, L.whatsappGeneral)
  const ogImage = absolute(meta.image ?? '/og-default.png')
  const navLink = (p: string, label: string, current: boolean) => (
    <a
      href={href(ctx.locale, p)}
      aria-current={current ? 'page' : undefined}
      class="rounded-full px-4 py-2 text-[0.95rem] font-semibold text-navy-100 hover:text-paper aria-[current=page]:text-gold"
    >
      {label}
    </a>
  )

  return (
    <>
      {raw('<!doctype html>')}
      <html lang={ctx.locale} dir={dir(ctx.locale)}>
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
          <title>{meta.title}</title>
          <meta name="description" content={meta.description} />
          {meta.noindex ? <meta name="robots" content="noindex, follow" /> : null}
          {canonical ? <link rel="canonical" href={canonical} /> : null}
          {canonicalPath && absolute('/') ? (
            <>
              <link rel="alternate" hreflang="ar-AE" href={absolute(href('ar', canonicalPath))} />
              <link rel="alternate" hreflang="en-AE" href={absolute(href('en', canonicalPath))} />
              <link rel="alternate" hreflang="x-default" href={absolute(href('ar', canonicalPath))} />
            </>
          ) : null}
          <meta property="og:site_name" content={L.siteNameFull} />
          <meta property="og:locale" content={ctx.locale === 'ar' ? 'ar_AE' : 'en_AE'} />
          <meta property="og:type" content={meta.ogType ?? 'website'} />
          <meta property="og:title" content={meta.title} />
          <meta property="og:description" content={meta.description} />
          {canonical ? <meta property="og:url" content={canonical} /> : null}
          {ogImage ? <meta property="og:image" content={ogImage} /> : null}
          <meta name="twitter:card" content="summary_large_image" />
          <meta name="theme-color" content="#0b1a33" />
          <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
          <link rel="preload" href="/fonts/plex-arabic-regular.woff" as="font" type="font/woff" crossorigin="anonymous" />
          <link rel="preload" href="/fonts/reem-kufi.woff" as="font" type="font/woff" crossorigin="anonymous" />
          <link rel="stylesheet" href={`/assets/${ctx.assets.css}`} />
          {(meta.jsonLd ?? []).map((j) => (
            <script type="application/ld+json">{raw(JSON.stringify(j).replace(/</g, '\\u003c'))}</script>
          ))}
          <script type="module" src={`/assets/${ctx.assets.main}`}></script>
        </head>
        <body class={props.bodyClass ?? ''}>
          <a href="#main" class="sr-only focus:not-sr-only focus:fixed focus:start-3 focus:top-3 focus:z-50 focus:rounded-lg focus:bg-paper focus:px-4 focus:py-2">
            {L.skip}
          </a>
          <header class="sticky top-0 z-30 border-b border-white/10 bg-navy-900">
            <div class="wrap flex h-[68px] items-center gap-3">
              <a href={href(ctx.locale, '/')} class="me-auto" aria-label={L.siteNameFull}>
                <Wordmark locale={ctx.locale} small light />
              </a>
              <nav aria-label={L.nav.menu} class="hidden items-center gap-1 md:flex">
                {navLink('/', L.nav.home, ctx.path === '/')}
                {navLink('/cars/', L.nav.cars, ctx.path.startsWith('/cars'))}
                {navLink('/contact/', L.nav.contact, ctx.path === '/contact/')}
              </nav>
              <a
                href={href(other, ctx.path)}
                hreflang={other}
                lang={other}
                data-lang-switch
                class="rounded-full border border-white/15 px-3.5 py-1.5 text-sm font-semibold text-paper hover:border-gold hover:text-gold"
              >
                {L.langSwitch}
              </a>
              <a
                href={contact.url}
                target={contact.external ? '_blank' : undefined}
                rel={contact.external ? 'noopener' : undefined}
                class="btn btn-gold btn-sm hidden sm:inline-flex"
              >
                {contact.external ? <IconWhatsapp size={17} /> : <IconPhone size={16} />}
                {contact.external ? L.whatsapp : L.nav.contact}
              </a>
              <details class="relative md:hidden" data-menu>
                <summary class="grid h-10 w-10 cursor-pointer list-none place-items-center rounded-full text-paper hover:bg-white/10 [&::-webkit-details-marker]:hidden" aria-label={L.nav.menu}>
                  <IconMenu />
                </summary>
                <div class="absolute end-0 top-12 w-64 rounded-[var(--radius-card)] border border-line bg-paper p-2 shadow-2xl">
                  <a href={href(ctx.locale, '/')} class="block rounded-lg px-3 py-3 font-semibold hover:bg-stone">{L.nav.home}</a>
                  <a href={href(ctx.locale, '/cars/')} class="block rounded-lg px-3 py-3 font-semibold hover:bg-stone">{L.nav.cars}</a>
                  <a href={href(ctx.locale, '/contact/')} class="block rounded-lg px-3 py-3 font-semibold hover:bg-stone">{L.nav.contact}</a>
                  {contact.external ? (
                    <a href={contact.url} class="btn btn-wa mt-2 w-full" target="_blank" rel="noopener">
                      <IconWhatsapp size={18} /> {L.contactCta}
                    </a>
                  ) : null}
                </div>
              </details>
            </div>
          </header>
          <main id="main">{props.children}</main>
          <Footer ctx={ctx} />
          <p class="sr-only" aria-live="polite" id="live-region"></p>
        </body>
      </html>
    </>
  )
}

function Footer({ ctx }: { ctx: PageCtx }) {
  const L = t(ctx.locale)
  const wa = whatsappLink(site.whatsapp, L.whatsappGeneral)
  const socials = [
    { url: site.instagram, label: 'Instagram', Icon: IconInstagram },
    { url: site.facebook, label: 'Facebook', Icon: IconFacebook },
    site.threads ? { url: site.threads, label: 'Threads', Icon: IconThreads } : null,
  ].filter(Boolean) as { url: string; label: string; Icon: typeof IconInstagram }[]

  return (
    <footer class="mt-24 bg-navy-950 text-navy-100">
      <div class="h-px bg-gradient-to-r from-transparent via-gold/60 to-transparent"></div>
      <div class="wrap grid gap-10 py-14 md:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.2fr)]">
        <div>
          <Wordmark locale={ctx.locale} light />
          <p class="mt-5 max-w-sm text-sm leading-7 text-navy-100/75">{L.footer.about}</p>
        </div>
        <nav aria-label={L.footer.explore}>
          <h2 class="mb-4 text-sm font-bold text-gold">{L.footer.explore}</h2>
          <ul class="space-y-2.5 text-sm">
            <li><a class="hover:text-paper" href={href(ctx.locale, '/cars/')}>{L.nav.cars}</a></li>
            <li><a class="hover:text-paper" href={href(ctx.locale, '/cars/?condition=new')}>{L.enums.condition.new}</a></li>
            <li><a class="hover:text-paper" href={href(ctx.locale, '/cars/?condition=used')}>{L.enums.condition.used}</a></li>
            <li><a class="hover:text-paper" href={href(ctx.locale, '/contact/')}>{L.nav.contact}</a></li>
          </ul>
        </nav>
        <div>
          <h2 class="mb-4 text-sm font-bold text-gold">{L.footer.contact}</h2>
          <ul class="space-y-3 text-sm">
            {wa ? (
              <li>
                <a class="inline-flex items-center gap-2 hover:text-paper" href={wa} target="_blank" rel="noopener">
                  <IconWhatsapp size={16} /> <span class="num">{displayPhone(site.whatsapp!)}</span>
                </a>
              </li>
            ) : null}
            {site.phone ? (
              <li>
                <a class="inline-flex items-center gap-2 hover:text-paper" href={telHref(site.phone)}>
                  <IconPhone size={16} /> <span class="num">{displayPhone(site.phone)}</span>
                </a>
              </li>
            ) : null}
            {site.email ? (
              <li>
                <a class="inline-flex items-center gap-2 hover:text-paper" href={`mailto:${site.email}`}>
                  <IconMail size={16} /> {site.email}
                </a>
              </li>
            ) : null}
            {!wa && !site.phone && !site.email ? <li>{L.priceOnRequest}</li> : null}
          </ul>
        </div>
        <div>
          <h2 class="mb-4 text-sm font-bold text-gold">{L.contact.branches}</h2>
          <ul class="space-y-2.5 text-sm">
            {site.branches.map((b) => (
              <li>{ctx.locale === 'ar' ? b.name_ar : b.name_en}</li>
            ))}
          </ul>
          <h2 class="mb-3 mt-7 text-sm font-bold text-gold">{L.footer.follow}</h2>
          <ul class="flex gap-2">
            {socials.map(({ url, label, Icon }) => (
              <li>
                <a href={url} target="_blank" rel="noopener" aria-label={label} class="grid h-10 w-10 place-items-center rounded-full border border-white/15 hover:border-gold hover:text-gold">
                  <Icon size={18} />
                </a>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div class="border-t border-white/10">
        <div class="wrap flex flex-col gap-3 py-6 text-xs leading-6 text-navy-100/60 md:flex-row md:items-center md:justify-between">
          <p class="max-w-3xl">{L.footer.disclaimer}</p>
          <p class="shrink-0">
            © <span class="num">{new Date().getFullYear()}</span> {L.siteNameFull}. {L.footer.rights}.
          </p>
        </div>
      </div>
    </footer>
  )
}
