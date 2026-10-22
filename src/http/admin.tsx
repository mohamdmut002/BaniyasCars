import { Hono, type Context } from 'hono'
import { getCookie, setCookie, deleteCookie } from 'hono/cookie'
import { z } from 'zod'
import { type AppEnv, clientIp } from './common.js'
import { env, isProd } from '../config/env.js'
import {
  SESSION_COOKIE,
  SESSION_DAYS,
  changePassword,
  createAdmin,
  getSession,
  listAdmins,
  login,
  logout,
  revokeUserSessions,
  safeEqual,
  setAdminActive,
  verifyPassword,
  type Session,
} from '../lib/auth.js'
import { rateLimit } from '../lib/rate-limit.js'
import { log, errorDetails } from '../lib/logger.js'
import { vehicleInput, STATUSES } from '../domain/vehicle.js'
import {
  addImage,
  adminCounts,
  adminGetVehicle,
  adminListVehicles,
  brandCounts,
  createVehicle,
  deleteImage,
  deleteVehicle,
  markVerified,
  reorderImages,
  setVehicleStatus,
  updateVehicle,
} from '../repo/vehicles.js'
import { allOffers, audit, deleteOffer, listInquiries, newInquiryCount, offerSchema, recentAudit, saveOffer, setInquiryStatus } from '../repo/misc.js'
import { branchSchema, getBranches, getSiteSettings, invalidateSettings, saveSiteSettings, siteSettingsSchema, updateBranch } from '../repo/settings.js'
import { ImageError, deleteStored, processAndStore } from '../lib/images.js'
import { applyImport, exportCsv, prepareImport, templateCsv } from '../lib/inventory-csv.js'
import { sql } from '../db/client.js'
import { LoginPage, type AdminCtx } from '../views/admin/layout.js'
import {
  AccountPage,
  DashboardPage,
  ImportPage,
  InquiriesPage,
  OffersPage,
  SettingsPage,
  UsersPage,
  VehicleFormPage,
  VehicleListPage,
} from '../views/admin/pages.js'

export const admin = new Hono<AppEnv>()
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

const FLASH: Record<string, { kind: 'ok' | 'error'; text: string }> = {
  saved: { kind: 'ok', text: 'تم الحفظ.' },
  created: { kind: 'ok', text: 'تمت إضافة السيارة. يمكنك الآن رفع الصور.' },
  deleted: { kind: 'ok', text: 'تم الحذف.' },
  uploaded: { kind: 'ok', text: 'تم رفع الصور.' },
  verified: { kind: 'ok', text: 'تم تسجيل التحقق بتاريخ اليوم.' },
  imported: { kind: 'ok', text: 'تم الاستيراد.' },
  password: { kind: 'ok', text: 'تم تغيير كلمة المرور.' },
  badpassword: { kind: 'error', text: 'كلمة المرور الحالية غير صحيحة.' },
  upload_error: { kind: 'error', text: 'تعذّر رفع بعض الصور. تأكد أنها صور JPG أو PNG أو WebP أو HEIC وحجم كل صورة أقل من الحد المسموح.' },
  forbidden: { kind: 'error', text: 'هذه الصفحة متاحة لمالك الحساب فقط.' },
  user_error: { kind: 'error', text: 'تعذّر إضافة المستخدم. تحقق من البريد وكلمة المرور (10 أحرف على الأقل، حروف وأرقام).' },
}

/* ------------------------------ guards ------------------------------ */

admin.use('*', async (c, next) => {
  c.header('Cache-Control', 'no-store')
  c.header('X-Robots-Tag', 'noindex, nofollow')
  // Same-origin check for every state-changing request (CSRF defence in depth, also covers the login form).
  if (c.req.method !== 'GET' && c.req.method !== 'HEAD') {
    const origin = c.req.header('origin') ?? c.req.header('referer')
    const host = c.req.header('x-forwarded-host') ?? c.req.header('host')
    let ok = false
    try {
      ok = !!origin && !!host && new URL(origin).host === host
    } catch {
      ok = false
    }
    if (!ok) return c.text('Cross-site request blocked', 403)
  }
  await next()
})

admin.get('/login', async (c) => {
  const s = await getSession(getCookie(c, SESSION_COOKIE))
  if (s) return c.redirect('/admin')
  return c.html(<LoginPage nonce={c.get('nonce')} />)
})

admin.post('/login', async (c) => {
  const body = await c.req.parseBody()
  const email = String(body.email ?? '').slice(0, 200)
  const password = String(body.password ?? '').slice(0, 200)
  const ip = clientIp(c)
  if (!rateLimit(`login:${ip}`, 10, 15 * 60_000).ok) {
    return c.html(<LoginPage nonce={c.get('nonce')} email={email} error="محاولات كثيرة من هذا الجهاز. انتظر 15 دقيقة ثم حاول مجدداً." />, 429)
  }
  const result = await login(email, password, c.req.header('user-agent') ?? null)
  if (!result.ok) {
    log.warn('admin login failed', { email, reason: result.reason })
    const msg = result.reason === 'locked' ? 'تم إيقاف الحساب مؤقتاً بعد عدة محاولات خاطئة. حاول بعد 15 دقيقة.' : 'البريد الإلكتروني أو كلمة المرور غير صحيحة.'
    return c.html(<LoginPage nonce={c.get('nonce')} email={email} error={msg} />, 401)
  }
  setCookie(c, SESSION_COOKIE, result.token, {
    httpOnly: true,
    secure: isProd || env.SITE_URL.startsWith('https://'),
    sameSite: 'Lax',
    path: '/',
    maxAge: SESSION_DAYS * 86400,
  })
  log.info('admin login', { email })
  return c.redirect('/admin', 303)
})

admin.use('*', async (c, next) => {
  const session = await getSession(getCookie(c, SESSION_COOKIE))
  if (!session) {
    if (c.req.method === 'GET') return c.redirect('/admin/login')
    return c.text('Session expired. Sign in again.', 401)
  }
  c.set('session', session)
  if (c.req.method === 'POST') {
    const ct = c.req.header('content-type') ?? ''
    const token =
      c.req.header('x-csrf-token') ??
      (ct.includes('form') ? String((await c.req.parseBody({ all: true }))._csrf ?? '') : '')
    if (!token || !safeEqual(token, session.csrf)) return c.text('Invalid form token. Reload the page and try again.', 403)
  }
  await next()
})

async function actx(c: Context<AppEnv>): Promise<AdminCtx> {
  const flashKey = c.req.query('m')
  return {
    session: c.get('session')!,
    nonce: c.get('nonce'),
    path: new URL(c.req.url).pathname + new URL(c.req.url).search,
    flash: flashKey ? (FLASH[flashKey] ?? null) : null,
    newInquiries: await newInquiryCount(),
  }
}

const ownerOnly = (c: Context<AppEnv>) => c.get('session')?.user.role === 'owner'
const user = (c: Context<AppEnv>) => (c.get('session') as Session).user

/* ------------------------------ dashboard & session ------------------------------ */

admin.post('/logout', async (c) => {
  await logout(c.get('session')!.tokenHash)
  deleteCookie(c, SESSION_COOKIE, { path: '/' })
  return c.redirect('/admin/login', 303)
})

admin.get('/', async (c) => {
  const [counts, flagged, inquiries, activity, settings] = await Promise.all([
    adminCounts(),
    adminListVehicles({ verification: 'needs_confirmation' }),
    listInquiries(),
    recentAudit(15),
    getSiteSettings(),
  ])
  return c.html(
    <DashboardPage
      ctx={await actx(c)}
      counts={counts}
      flagged={flagged.items.filter((v) => v.status !== 'sold').slice(0, 12)}
      inquiries={inquiries.slice(0, 8)}
      activity={activity}
      whatsappMissing={!settings.whatsapp}
    />,
  )
})

/* ------------------------------ vehicles ------------------------------ */

admin.get('/vehicles', async (c) => {
  const q = { q: c.req.query('q')?.slice(0, 80), status: c.req.query('status'), verification: c.req.query('verification') }
  if (q.status && !(STATUSES as readonly string[]).includes(q.status)) q.status = undefined
  if (q.verification && !['confirmed', 'needs_confirmation', 'historical'].includes(q.verification)) q.verification = undefined
  const result = await adminListVehicles({ ...q, page: Number(c.req.query('page') ?? 1) || 1 })
  return c.html(<VehicleListPage ctx={await actx(c)} result={result} q={q} />)
})

async function makesList() {
  const fromDb = (await brandCounts()).map((b) => b.make)
  return [...new Set([...fromDb, 'Toyota', 'Nissan', 'Lexus', 'MG', 'GMC', 'Jeep', 'Renault', 'Chevrolet', 'Mitsubishi', 'Hyundai', 'Kia', 'Ford'])]
}

function zodErrors(err: z.ZodError) {
  const out: Record<string, string> = {}
  for (const i of err.issues) {
    const k = String(i.path[0] ?? '_')
    if (!out[k]) out[k] = translateIssue(i)
  }
  return out
}
function translateIssue(i: z.ZodIssue) {
  if (i.code === 'too_small' && i.type === 'string') return 'هذا الحقل مطلوب.'
  if (i.code === 'invalid_enum_value') return 'اختر قيمة من القائمة.'
  if (i.code === 'too_small' || i.code === 'too_big') return 'القيمة خارج النطاق المسموح.'
  if (i.code === 'invalid_type') return 'قيمة غير صالحة.'
  if (i.message.includes('whole number')) return 'أدخل رقماً صحيحاً.'
  if (i.message.includes('engine size')) return 'سعة المحرك بين 0.5 و 9.9 لتر.'
  if (i.message.includes('http')) return 'أدخل رابطاً كاملاً يبدأ بـ https://'
  return i.message
}

admin.get('/vehicles/new', async (c) => {
  return c.html(
    <VehicleFormPage
      ctx={await actx(c)}
      vehicle={null}
      values={{ status: 'available', verification: 'confirmed', year: new Date().getFullYear() }}
      errors={{}}
      branches={await getBranches()}
      makes={await makesList()}
    />,
  )
})

admin.post('/vehicles/new', async (c) => {
  const body = await c.req.parseBody()
  const parsed = vehicleInput.safeParse(body)
  if (!parsed.success) {
    return c.html(
      <VehicleFormPage ctx={await actx(c)} vehicle={null} values={body} errors={zodErrors(parsed.error)} branches={await getBranches()} makes={await makesList()} />,
      422,
    )
  }
  const row = await createVehicle(parsed.data)
  await audit(user(c).id, 'إضافة سيارة', 'vehicle', row.id, { slug: row.slug })
  return c.redirect(`/admin/vehicles/${row.id}?m=created`, 303)
})

admin.get('/vehicles/:id', async (c) => {
  const v = await adminGetVehicle(c.req.param('id'))
  if (!v) return c.notFound()
  return c.html(<VehicleFormPage ctx={await actx(c)} vehicle={v} values={v} errors={{}} branches={await getBranches()} makes={await makesList()} />)
})

admin.post('/vehicles/:id', async (c) => {
  const v = await adminGetVehicle(c.req.param('id'))
  if (!v) return c.notFound()
  const body = await c.req.parseBody()
  const parsed = vehicleInput.safeParse(body)
  if (!parsed.success) {
    return c.html(
      <VehicleFormPage ctx={await actx(c)} vehicle={v} values={body} errors={zodErrors(parsed.error)} branches={await getBranches()} makes={await makesList()} />,
      422,
    )
  }
  await updateVehicle(v.id, parsed.data)
  await audit(user(c).id, 'تعديل سيارة', 'vehicle', v.id, priceChange(v.price_aed, parsed.data.price_aed))
  return c.redirect(`/admin/vehicles/${v.id}?m=saved`, 303)
})

const priceChange = (from: number | null, to: number | null) => (from !== to ? { price_from: from, price_to: to } : undefined)

admin.post('/vehicles/:id/status', async (c) => {
  const id = c.req.param('id')
  const body = await c.req.parseBody()
  const status = String(body.status)
  if (!UUID.test(id) || !(STATUSES as readonly string[]).includes(status)) return c.text('Invalid status', 400)
  await setVehicleStatus(id, status)
  await audit(user(c).id, `تغيير الحالة إلى ${status}`, 'vehicle', id)
  const back = String(body.back ?? '')
  return c.redirect(back.startsWith('/admin/') ? back : '/admin/vehicles', 303)
})

admin.post('/vehicles/:id/verify', async (c) => {
  const id = c.req.param('id')
  if (!UUID.test(id)) return c.notFound()
  await markVerified(id)
  await audit(user(c).id, 'تحقق من البيانات', 'vehicle', id)
  return c.redirect(`/admin/vehicles/${id}?m=verified`, 303)
})

admin.post('/vehicles/:id/describe', async (c) => {
  const id = c.req.param('id')
  if (!UUID.test(id)) return c.notFound()
  // Clearing the custom text makes the site write the description from the current specs again.
  await sql`update vehicles set description_ar = null, description_en = null, updated_at = now() where id = ${id}`
  await audit(user(c).id, 'إعادة الوصف التلقائي', 'vehicle', id)
  return c.redirect(`/admin/vehicles/${id}?m=saved`, 303)
})

admin.post('/vehicles/:id/delete', async (c) => {
  const id = c.req.param('id')
  if (!UUID.test(id)) return c.notFound()
  const keys = await deleteVehicle(id)
  for (const k of keys) await deleteStored(k).catch((e) => log.warn('image delete failed', { key: k, ...errorDetails(e) }))
  await audit(user(c).id, 'حذف سيارة', 'vehicle', id)
  return c.redirect('/admin/vehicles?m=deleted', 303)
})

admin.post('/vehicles/:id/images', async (c) => {
  const v = await adminGetVehicle(c.req.param('id'))
  if (!v) return c.notFound()
  const body = await c.req.parseBody({ all: true })
  const files = ([] as unknown[]).concat(body.photos ?? []).filter((f): f is File => f instanceof File && f.size > 0)
  // The dashboard script sends a browser-made thumbnail for each photo, in the same order.
  const thumbs = ([] as unknown[]).concat(body.thumbs ?? []).map((f) => (f instanceof File && f.size > 0 ? f : null))
  const max = env.MAX_UPLOAD_MB * 1024 * 1024
  let failed = 0
  for (const [i, f] of files.slice(0, 30).entries()) {
    if (f.size > max) {
      failed++
      continue
    }
    try {
      const t = thumbs[i]
      const stored = await processAndStore(Buffer.from(await f.arrayBuffer()), v.slug, t && t.size < max ? Buffer.from(await t.arrayBuffer()) : null)
      await addImage(v.id, { ...stored, source: 'upload' })
    } catch (e) {
      failed++
      if (!(e instanceof ImageError)) log.error('image upload failed', { vehicle: v.id, ...errorDetails(e) })
    }
  }
  await audit(user(c).id, `رفع ${files.length - failed} صورة`, 'vehicle', v.id)
  return c.redirect(`/admin/vehicles/${v.id}?m=${failed ? 'upload_error' : 'uploaded'}`, 303)
})

admin.post('/vehicles/:id/images/:imageId/delete', async (c) => {
  const { id, imageId } = c.req.param()
  if (!UUID.test(id) || !UUID.test(imageId)) return c.notFound()
  const row = await deleteImage(id, imageId)
  if (row?.storage_key) await deleteStored(row.storage_key).catch((e) => log.warn('image delete failed', errorDetails(e)))
  await audit(user(c).id, 'حذف صورة', 'vehicle', id)
  return c.redirect(`/admin/vehicles/${id}?m=deleted`, 303)
})

admin.post('/vehicles/:id/images/:imageId/cover', async (c) => {
  const { id, imageId } = c.req.param()
  const v = await adminGetVehicle(id)
  if (!v || !UUID.test(imageId)) return c.notFound()
  const ids = v.images.map((i) => i.id)
  await reorderImages(id, [imageId, ...ids.filter((x) => x !== imageId)])
  return c.redirect(`/admin/vehicles/${id}?m=saved`, 303)
})

/* ------------------------------ inquiries ------------------------------ */

admin.get('/inquiries', async (c) => {
  const status = c.req.query('status')
  const valid = status && ['new', 'contacted', 'closed'].includes(status) ? status : undefined
  return c.html(<InquiriesPage ctx={await actx(c)} items={await listInquiries(valid)} status={valid} />)
})

admin.post('/inquiries/:id', async (c) => {
  const id = c.req.param('id')
  const status = String((await c.req.parseBody()).status)
  if (!UUID.test(id) || !['new', 'contacted', 'closed'].includes(status)) return c.text('Invalid', 400)
  await setInquiryStatus(id, status)
  return c.redirect('/admin/inquiries?m=saved', 303)
})

/* ------------------------------ offers ------------------------------ */

async function offerVehicles() {
  return (
    await sql<{ id: string; make: string; model: string; trim: string | null; year: number; price_aed: number | null }[]>`
      select id, make, model, trim, year, price_aed from vehicles where status in ('available', 'reserved') order by make, model, year`
  ).map((v) => ({ id: v.id, label: [v.make, v.model, v.trim, v.year, v.price_aed ? `— ${v.price_aed.toLocaleString('en-US')}` : ''].filter(Boolean).join(' ') }))
}

admin.get('/offers', async (c) => {
  const offers = await allOffers()
  const edit = c.req.query('edit')
  return c.html(<OffersPage ctx={await actx(c)} offers={offers} vehicles={await offerVehicles()} editing={offers.find((o) => o.id === edit) ?? null} />)
})

admin.post('/offers/:id', async (c) => {
  const id = c.req.param('id')
  const parsed = offerSchema.safeParse(await c.req.parseBody())
  if (!parsed.success) return c.redirect('/admin/offers?m=user_error', 303)
  await saveOffer(id === 'new' ? null : UUID.test(id) ? id : null, parsed.data)
  await audit(user(c).id, id === 'new' ? 'إضافة عرض' : 'تعديل عرض', 'offer', id === 'new' ? null : id)
  return c.redirect('/admin/offers?m=saved', 303)
})

admin.post('/offers/:id/delete', async (c) => {
  const id = c.req.param('id')
  if (UUID.test(id)) await deleteOffer(id)
  await audit(user(c).id, 'حذف عرض', 'offer', id)
  return c.redirect('/admin/offers?m=deleted', 303)
})

/* ------------------------------ import / export ------------------------------ */

admin.get('/import', async (c) => c.html(<ImportPage ctx={await actx(c)} />))

admin.get('/export.csv', async (c) => {
  c.header('Content-Type', 'text/csv; charset=utf-8')
  c.header('Content-Disposition', `attachment; filename="baniyas-inventory-${new Date().toISOString().slice(0, 10)}.csv"`)
  return c.body(await exportCsv())
})

admin.get('/template.csv', (c) => {
  c.header('Content-Type', 'text/csv; charset=utf-8')
  c.header('Content-Disposition', 'attachment; filename="baniyas-inventory-template.csv"')
  return c.body(templateCsv())
})

admin.post('/import/preview', async (c) => {
  const body = await c.req.parseBody()
  const file = body.file
  if (!(file instanceof File) || file.size === 0 || file.size > 5 * 1024 * 1024) {
    return c.html(<ImportPage ctx={{ ...(await actx(c)), flash: { kind: 'error', text: 'اختر ملف CSV حجمه أقل من 5 ميجابايت.' } }} />, 400)
  }
  const text = await file.text()
  try {
    const prepared = await prepareImport(text)
    return c.html(<ImportPage ctx={await actx(c)} preview={prepared.map(({ line, action, label, message }) => ({ line, action, label, message }))} csv={text} />)
  } catch (e) {
    return c.html(<ImportPage ctx={{ ...(await actx(c)), flash: { kind: 'error', text: `تعذّرت قراءة الملف: ${(e as Error).message}` } }} />, 400)
  }
})

admin.post('/import/apply', async (c) => {
  const text = String((await c.req.parseBody()).csv ?? '')
  if (!text || text.length > 5 * 1024 * 1024) return c.redirect('/admin/import', 303)
  const result = await applyImport(await prepareImport(text))
  await audit(user(c).id, `استيراد CSV: ${result.created} جديدة، ${result.updated} محدّثة`, 'import', null, result)
  return c.redirect('/admin/import?m=imported', 303)
})

/* ------------------------------ settings (owner) ------------------------------ */

admin.get('/settings', async (c) => {
  if (!ownerOnly(c)) return c.redirect('/admin?m=forbidden')
  invalidateSettings()
  return c.html(<SettingsPage ctx={await actx(c)} settings={await getSiteSettings()} branches={await getBranches()} errors={{}} />)
})

admin.post('/settings', async (c) => {
  if (!ownerOnly(c)) return c.redirect('/admin?m=forbidden', 303)
  const body = await c.req.parseBody()
  const departments = String(body.departments ?? '')
    .split(/\r?\n/)
    .map((l) => l.split('|').map((s) => s.trim()))
    .filter((p) => p[0])
    .map(([name_ar, name_en, phone]) => ({ name_ar, name_en: name_en || name_ar, phone: phone || null }))
  const parsed = siteSettingsSchema.safeParse({ ...body, departments })
  if (!parsed.success) {
    const errors = zodErrors(parsed.error)
    return c.html(<SettingsPage ctx={await actx(c)} settings={{ ...(await getSiteSettings()), ...(body as any), departments }} branches={await getBranches()} errors={errors} />, 422)
  }
  await saveSiteSettings(parsed.data, user(c).id)
  await audit(user(c).id, 'تعديل بيانات التواصل', 'settings', 'site')
  return c.redirect('/admin/settings?m=saved', 303)
})

admin.post('/branches/:id', async (c) => {
  if (!ownerOnly(c)) return c.redirect('/admin?m=forbidden', 303)
  const id = c.req.param('id')
  const parsed = branchSchema.safeParse(await c.req.parseBody())
  if (!UUID.test(id) || !parsed.success) return c.redirect('/admin/settings?m=user_error', 303)
  await updateBranch(id, parsed.data)
  await audit(user(c).id, 'تعديل فرع', 'branch', id)
  return c.redirect('/admin/settings?m=saved', 303)
})

/* ------------------------------ users ------------------------------ */

admin.get('/users', async (c) => {
  if (!ownerOnly(c)) return c.redirect('/admin?m=forbidden')
  return c.html(<UsersPage ctx={await actx(c)} users={await listAdmins()} />)
})

admin.post('/users', async (c) => {
  if (!ownerOnly(c)) return c.redirect('/admin?m=forbidden', 303)
  const b = await c.req.parseBody()
  const email = String(b.email ?? '').trim().toLowerCase()
  const name = String(b.name ?? '').trim()
  const role = b.role === 'owner' ? 'owner' : 'staff'
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || name.length < 2) return c.redirect('/admin/users?m=user_error', 303)
  const [exists] = await sql`select 1 from admin_users where email = ${email}`
  if (exists) return c.redirect('/admin/users?m=user_error', 303)
  try {
    const id = await createAdmin(email, name, String(b.password ?? ''), role)
    await audit(user(c).id, 'إضافة مستخدم', 'user', id, { email, role })
  } catch {
    return c.redirect('/admin/users?m=user_error', 303)
  }
  return c.redirect('/admin/users?m=saved', 303)
})

admin.post('/users/:id/active', async (c) => {
  if (!ownerOnly(c)) return c.redirect('/admin?m=forbidden', 303)
  const id = c.req.param('id')
  if (!UUID.test(id) || id === user(c).id) return c.redirect('/admin/users', 303)
  const active = (await c.req.parseBody()).active === '1'
  await setAdminActive(id, active)
  await audit(user(c).id, active ? 'تفعيل مستخدم' : 'إيقاف مستخدم', 'user', id)
  return c.redirect('/admin/users?m=saved', 303)
})

admin.get('/account', async (c) => c.html(<AccountPage ctx={await actx(c)} />))

admin.post('/account', async (c) => {
  const b = await c.req.parseBody()
  const s = c.get('session')!
  const [row] = await sql<{ password_hash: string }[]>`select password_hash from admin_users where id = ${s.user.id}`
  if (!row || !(await verifyPassword(String(b.current ?? ''), row.password_hash))) return c.redirect('/admin/account?m=badpassword', 303)
  try {
    await changePassword(s.user.id, String(b.password ?? ''))
  } catch {
    return c.redirect('/admin/account?m=user_error', 303)
  }
  // Sign out other devices after a password change.
  await revokeUserSessions(s.user.id, s.tokenHash)
  await audit(s.user.id, 'تغيير كلمة المرور', 'user', s.user.id)
  return c.redirect('/admin/account?m=password', 303)
})
