import { raw } from 'hono/html'
import type { Child } from 'hono/jsx'
import { t, dir } from '../i18n/index.js'
import { absolute, assets, href, type PageCtx, type PageMeta } from './ctx.js'
import { whatsappLink } from '../lib/whatsapp.js'
import { displayPhone, telHref } from '../lib/format.js'
import { IconFacebook, IconInstagram, IconMail, IconMenu, IconPhone, IconThreads, IconWhatsapp, IconClose } from './icons.js'

export function Wordmark({ locale, small }: { locale: PageCtx['locale']; small?: boolean }) {
  return (
    <span class="flex items-center gap-2.5">
      <span
        aria-hidden="true"
        class={`grid place-items-center rounded-[6px] border-2 border-petrol-900 bg-paper font-display font-bold text-petrol-900 ${small ? 'h-8 w-8 text-sm' : 'h-10 w-10 text-base'}`}
      >
        ب
      </span>
      <span class="flex flex-col leading-none">
        <span class={`font-display font-bold ${small ? 'text-lg' : 'text-xl'}`}>{locale === 'ar' ? 'بني ياس للسيارات' : 'Baniyas Cars'}</span>
        <span class="mt-1 text-[0.68rem] font-semibold tracking-[0.08em] text-sage">{locale === 'ar' ? 'BANIYAS CARS' : 'بني ياس للسيارات'}</span>
      </span>
    </span>
  )
}

export function Layout(props: { ctx: PageCtx; meta: PageMeta; children: Child; bodyClass?: string }) {
  const { ctx, meta } = props
  const L = t(ctx.locale)
  const a = assets()
  const other = ctx.locale === 'ar' ? 'en' : 'ar'
  const canonical = meta.canonicalPath === null ? null : absolute(href(ctx.locale, meta.canonicalPath ?? ctx.path))
  const wa = whatsappLink(ctx.settings.whatsapp, L.whatsappGeneral)
  const ogImage = meta.image ? absolute(meta.image) : absolute('/og-default.png')

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
          {meta.canonicalPath !== null ? (
            <>
              <link rel="alternate" hreflang="ar-AE" href={absolute(href('ar', meta.canonicalPath ?? ctx.path))} />
              <link rel="alternate" hreflang="en-AE" href={absolute(href('en', meta.canonicalPath ?? ctx.path))} />
              <link rel="alternate" hreflang="x-default" href={absolute(href('ar', meta.canonicalPath ?? ctx.path))} />
            </>
          ) : null}
          <meta property="og:site_name" content={L.siteNameFull} />
          <meta property="og:locale" content={ctx.locale === 'ar' ? 'ar_AE' : 'en_AE'} />
          <meta property="og:type" content={meta.ogType ?? 'website'} />
          <meta property="og:title" content={meta.title} />
          <meta property="og:description" content={meta.description} />
          {canonical ? <meta property="og:url" content={canonical} /> : null}
          <meta property="og:image" content={ogImage} />
          <meta name="twitter:card" content="summary_large_image" />
          <meta name="theme-color" content="#0f2e33" />
          <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
          <link rel="preload" href="/fonts/plex-arabic-regular.woff" as="font" type="font/woff" crossorigin="anonymous" />
          <link rel="preload" href="/fonts/reem-kufi.woff" as="font" type="font/woff" crossorigin="anonymous" />
          <link rel="stylesheet" href={`/assets/${a.css}`} />
          {(meta.jsonLd ?? []).map((j) => (
            <script type="application/ld+json" nonce={ctx.nonce}>
              {raw(JSON.stringify(j).replace(/</g, '\\u003c'))}
            </script>
          ))}
          <script type="module" src={`/assets/${a.main}`} nonce={ctx.nonce} defer></script>
        </head>
        <body class={props.bodyClass ?? ''}>
          <a href="#main" class="sr-only focus:not-sr-only focus:fixed focus:start-3 focus:top-3 focus:z-50 focus:rounded-lg focus:bg-paper focus:px-4 focus:py-2">
            {L.skip}
          </a>
          <header class="sticky top-0 z-30 border-b border-line/80 bg-stone/92 backdrop-blur supports-[backdrop-filter]:bg-stone/80">
            <div class="wrap flex h-16 items-center gap-4">
              <a href={href(ctx.locale, '/')} class="me-auto" aria-label={L.siteNameFull}>
                <Wordmark locale={ctx.locale} small />
              </a>
              <nav aria-label={L.nav.menu} class="hidden items-center gap-1 md:flex">
                <a href={href(ctx.locale, '/cars')} class="rounded-full px-4 py-2 text-[0.95rem] font-semibold hover:bg-stone-2" aria-current={ctx.path.startsWith('/cars') ? 'page' : undefined}>
                  {L.nav.cars}
                </a>
                <a href={href(ctx.locale, '/contact')} class="rounded-full px-4 py-2 text-[0.95rem] font-semibold hover:bg-stone-2" aria-current={ctx.path === '/contact' ? 'page' : undefined}>
                  {L.nav.contact}
                </a>
              </nav>
              <a
                href={href(other, ctx.path) + ctx.search}
                hreflang={other}
                lang={other}
                class="rounded-full px-3 py-2 text-sm font-semibold text-petrol-800 hover:bg-stone-2"
              >
                {L.langSwitch}
              </a>
              {wa ? (
                <a href={wa} class="btn btn-wa btn-sm hidden sm:inline-flex" data-track="wa-header" rel="noopener" target="_blank">
                  <IconWhatsapp size={18} />
                  {L.whatsapp}
                </a>
              ) : null}
              <details class="relative md:hidden" data-menu>
                <summary class="grid h-10 w-10 cursor-pointer list-none place-items-center rounded-full hover:bg-stone-2 [&::-webkit-details-marker]:hidden" aria-label={L.nav.menu}>
                  <IconMenu />
                </summary>
                <div class="absolute end-0 top-12 w-64 rounded-[var(--radius-card)] border border-line bg-paper p-2 shadow-xl">
                  <a href={href(ctx.locale, '/')} class="block rounded-lg px-3 py-3 font-semibold hover:bg-stone">{L.nav.home}</a>
                  <a href={href(ctx.locale, '/cars')} class="block rounded-lg px-3 py-3 font-semibold hover:bg-stone">{L.nav.cars}</a>
                  <a href={href(ctx.locale, '/contact')} class="block rounded-lg px-3 py-3 font-semibold hover:bg-stone">{L.nav.contact}</a>
                  {wa ? (
                    <a href={wa} class="btn btn-wa mt-2 w-full" target="_blank" rel="noopener">
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
  const s = ctx.settings
  const wa = whatsappLink(s.whatsapp, L.whatsappGeneral)
  const year = new Date().getFullYear()
  const socials = [
    s.instagram_url && { url: s.instagram_url, label: 'Instagram', Icon: IconInstagram },
    s.facebook_url && { url: s.facebook_url, label: 'Facebook', Icon: IconFacebook },
    s.threads_url && { url: s.threads_url, label: 'Threads', Icon: IconThreads },
  ].filter(Boolean) as { url: string; label: string; Icon: typeof IconInstagram }[]

  return (
    <footer class="mt-24 bg-petrol-950 text-petrol-100">
      <div class="wrap grid gap-10 py-14 md:grid-cols-[1.3fr_1fr_1fr_1.2fr]">
        <div>
          <div class="text-paper">
            <Wordmark locale={ctx.locale} />
          </div>
          <p class="mt-5 max-w-sm text-sm leading-7 text-petrol-100/80">{L.footer.about}</p>
        </div>
        <nav aria-label={L.footer.explore}>
          <h2 class="mb-4 text-sm font-bold text-paper">{L.footer.explore}</h2>
          <ul class="space-y-2.5 text-sm">
            <li><a class="hover:text-paper" href={href(ctx.locale, '/cars')}>{L.nav.cars}</a></li>
            <li><a class="hover:text-paper" href={href(ctx.locale, '/cars?condition=new')}>{L.enums.condition.new}</a></li>
            <li><a class="hover:text-paper" href={href(ctx.locale, '/cars?condition=used')}>{L.enums.condition.used}</a></li>
            <li><a class="hover:text-paper" href={href(ctx.locale, '/contact')}>{L.nav.contact}</a></li>
          </ul>
        </nav>
        <div>
          <h2 class="mb-4 text-sm font-bold text-paper">{L.footer.contact}</h2>
          <ul class="space-y-3 text-sm">
            {wa ? (
              <li>
                <a class="inline-flex items-center gap-2 hover:text-paper" href={wa} target="_blank" rel="noopener">
                  <IconWhatsapp size={16} /> <span class="num">{displayPhone(s.whatsapp!)}</span>
                </a>
              </li>
            ) : null}
            {s.phone ? (
              <li>
                <a class="inline-flex items-center gap-2 hover:text-paper" href={telHref(s.phone)}>
                  <IconPhone size={16} /> <span class="num">{displayPhone(s.phone)}</span>
                </a>
              </li>
            ) : null}
            {s.email ? (
              <li>
                <a class="inline-flex items-center gap-2 hover:text-paper" href={`mailto:${s.email}`}>
                  <IconMail size={16} /> {s.email}
                </a>
              </li>
            ) : null}
          </ul>
        </div>
        <div>
          <h2 class="mb-4 text-sm font-bold text-paper">{L.contact.branches}</h2>
          <ul class="space-y-2.5 text-sm">
            {ctx.branches.map((b) => (
              <li>{ctx.locale === 'ar' ? b.name_ar : b.name_en}</li>
            ))}
          </ul>
          {socials.length ? (
            <>
              <h2 class="mb-3 mt-7 text-sm font-bold text-paper">{L.footer.follow}</h2>
              <ul class="flex gap-2">
                {socials.map(({ url, label, Icon }) => (
                  <li>
                    <a href={url} target="_blank" rel="noopener" aria-label={label} class="grid h-10 w-10 place-items-center rounded-full border border-petrol-700 hover:border-paper hover:text-paper">
                      <Icon size={18} />
                    </a>
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </div>
      </div>
      <div class="border-t border-petrol-800">
        <div class="wrap flex flex-col gap-3 py-6 text-xs leading-6 text-petrol-100/70 md:flex-row md:items-center md:justify-between">
          <p class="max-w-3xl">{L.footer.disclaimer}</p>
          <p class="shrink-0">
            © <span class="num">{year}</span> {L.siteNameFull}. {L.footer.rights}.
          </p>
        </div>
      </div>
    </footer>
  )
}

export { IconClose }
