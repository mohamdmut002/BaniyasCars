import { raw } from 'hono/html'
import type { Child } from 'hono/jsx'
import { assets } from '../ctx.js'
import type { Session } from '../../lib/auth.js'

export interface AdminCtx {
  session: Session
  nonce: string
  path: string
  flash?: { kind: 'ok' | 'error'; text: string } | null
  newInquiries?: number
}

const NAV = [
  { href: '/admin', label: 'لوحة التحكم', match: (p: string) => p === '/admin' },
  { href: '/admin/vehicles', label: 'السيارات', match: (p: string) => p.startsWith('/admin/vehicles') },
  { href: '/admin/inquiries', label: 'طلبات الاتصال', match: (p: string) => p.startsWith('/admin/inquiries') },
  { href: '/admin/offers', label: 'العروض', match: (p: string) => p.startsWith('/admin/offers') },
  { href: '/admin/import', label: 'استيراد وتصدير', match: (p: string) => p.startsWith('/admin/import') },
  { href: '/admin/settings', label: 'بيانات التواصل', match: (p: string) => p.startsWith('/admin/settings'), owner: true },
  { href: '/admin/users', label: 'المستخدمون', match: (p: string) => p.startsWith('/admin/users'), owner: true },
]

export function Csrf({ ctx }: { ctx: AdminCtx }) {
  return <input type="hidden" name="_csrf" value={ctx.session.csrf} />
}

export function AdminShell(props: { ctx: AdminCtx; title: string; children: Child; actions?: Child }) {
  const { ctx } = props
  const a = assets()
  return (
    <>
      {raw('<!doctype html>')}
      <html lang="ar" dir="rtl">
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <meta name="robots" content="noindex, nofollow" />
          <title>{props.title} | إدارة بني ياس للسيارات</title>
          <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
          <link rel="stylesheet" href={`/assets/${a.css}`} />
          <script type="module" src={`/assets/${a.admin}`} nonce={ctx.nonce} defer></script>
        </head>
        <body class="bg-stone">
          <div class="min-h-screen lg:grid lg:grid-cols-[240px_1fr]">
            <aside class="bg-petrol-950 text-petrol-100 lg:min-h-screen">
              <div class="flex items-center justify-between gap-3 px-5 py-4 lg:block">
                <a href="/admin" class="block font-display text-lg font-bold text-paper">بني ياس للسيارات</a>
                <span class="text-xs text-petrol-100/70 lg:mt-1 lg:block">لوحة الإدارة</span>
              </div>
              <nav class="flex gap-1 overflow-x-auto px-3 pb-3 lg:block lg:space-y-1 lg:overflow-visible" aria-label="القائمة">
                {NAV.filter((n) => !n.owner || ctx.session.user.role === 'owner').map((n) => (
                  <a
                    href={n.href}
                    aria-current={n.match(ctx.path) ? 'page' : undefined}
                    class="flex shrink-0 items-center justify-between rounded-lg px-3 py-2.5 text-sm font-semibold hover:bg-petrol-800 aria-[current=page]:bg-petrol-800 aria-[current=page]:text-paper"
                  >
                    {n.label}
                    {n.href === '/admin/inquiries' && ctx.newInquiries ? (
                      <span class="num ms-2 rounded-full bg-sand px-2 text-xs text-paper">{ctx.newInquiries}</span>
                    ) : null}
                  </a>
                ))}
              </nav>
              <div class="hidden border-t border-petrol-800 px-5 py-4 text-sm lg:block">
                <p class="font-semibold text-paper">{ctx.session.user.name}</p>
                <p class="text-xs text-petrol-100/70">{ctx.session.user.role === 'owner' ? 'مالك' : 'موظف'}</p>
                <div class="mt-3 flex flex-wrap gap-3 text-xs">
                  <a href="/" target="_blank" class="underline">عرض الموقع</a>
                  <a href="/admin/account" class="underline">كلمة المرور</a>
                  <form method="post" action="/admin/logout">
                    <Csrf ctx={ctx} />
                    <button class="underline">تسجيل الخروج</button>
                  </form>
                </div>
              </div>
            </aside>
            <main class="min-w-0 px-4 py-6 sm:px-8">
              <div class="mb-6 flex flex-wrap items-center justify-between gap-3">
                <h1 class="font-display text-2xl font-bold">{props.title}</h1>
                {props.actions ? <div class="flex flex-wrap gap-2">{props.actions}</div> : null}
              </div>
              {ctx.flash ? (
                <p
                  role={ctx.flash.kind === 'error' ? 'alert' : 'status'}
                  class={`mb-5 rounded-lg p-3 text-sm font-semibold ${ctx.flash.kind === 'error' ? 'bg-amber-100 text-amber' : 'bg-petrol-100 text-petrol-900'}`}
                >
                  {ctx.flash.text}
                </p>
              ) : null}
              {props.children}
              <div class="mt-10 flex gap-4 text-xs lg:hidden">
                <a href="/admin/account" class="underline">كلمة المرور</a>
                <form method="post" action="/admin/logout">
                  <Csrf ctx={ctx} />
                  <button class="underline">تسجيل الخروج</button>
                </form>
              </div>
            </main>
          </div>
        </body>
      </html>
    </>
  )
}

export function LoginPage({ nonce, error, email }: { nonce: string; error?: string | null; email?: string }) {
  const a = assets()
  return (
    <>
      {raw('<!doctype html>')}
      <html lang="ar" dir="rtl">
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <meta name="robots" content="noindex, nofollow" />
          <title>تسجيل الدخول | إدارة بني ياس للسيارات</title>
          <link rel="stylesheet" href={`/assets/${a.css}`} />
        </head>
        <body class="grid min-h-screen place-items-center bg-petrol-950 p-4">
          <main class="w-full max-w-sm rounded-[var(--radius-card)] bg-paper p-7">
            <p class="font-display text-xl font-bold">بني ياس للسيارات</p>
            <h1 class="mt-1 text-sm text-sage">تسجيل الدخول إلى لوحة الإدارة</h1>
            {error ? <p role="alert" class="mt-5 rounded-lg bg-amber-100 p-3 text-sm text-amber">{error}</p> : null}
            <form method="post" action="/admin/login" class="mt-5 space-y-4">
              <div>
                <label class="label" for="email">البريد الإلكتروني</label>
                <input id="email" name="email" type="email" required autocomplete="username" value={email ?? ''} class="field" dir="ltr" />
              </div>
              <div>
                <label class="label" for="password">كلمة المرور</label>
                <input id="password" name="password" type="password" required autocomplete="current-password" class="field" dir="ltr" />
              </div>
              <button class="btn btn-primary w-full">دخول</button>
            </form>
          </main>
          <span hidden data-nonce={nonce}></span>
        </body>
      </html>
    </>
  )
}
