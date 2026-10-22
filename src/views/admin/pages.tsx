import type { Branch, VehicleWithImages } from '../../domain/vehicle.js'
import { BODY_TYPES, CONDITIONS, DRIVETRAINS, FUELS, REGIONAL_SPECS, STATUSES, TRANSMISSIONS, VERIFICATIONS } from '../../domain/vehicle.js'
import { t } from '../../i18n/index.js'
import { displayPhone, formatDate, formatNumber } from '../../lib/format.js'
import { thumbUrl } from '../../lib/images.js'
import type { Inquiry, Offer } from '../../repo/misc.js'
import type { SiteSettings } from '../../repo/settings.js'
import type { AdminUser } from '../../lib/auth.js'
import { AdminShell, Csrf, type AdminCtx } from './layout.js'

const A = t('ar')
const statusClass: Record<string, string> = {
  available: 'bg-petrol-100 text-petrol-900',
  reserved: 'bg-sand-100 text-amber',
  sold: 'bg-stone-2 text-sold',
  hidden: 'bg-stone-2 text-sage',
}
const verifyClass: Record<string, string> = {
  confirmed: 'text-petrol-700',
  needs_confirmation: 'bg-amber-100 text-amber',
  historical: 'bg-stone-2 text-sage',
}

function Pill({ text, cls }: { text: string; cls: string }) {
  return <span class={`tag ${cls}`}>{text}</span>
}

const title = (v: { make: string; model: string; trim: string | null; year: number }) => [v.make, v.model, v.trim, v.year].filter(Boolean).join(' ')

/* ------------------------------ dashboard ------------------------------ */

export function DashboardPage({
  ctx,
  counts,
  flagged,
  inquiries,
  activity,
  whatsappMissing,
}: {
  ctx: AdminCtx
  counts: { total: number; available: number; reserved: number; sold: number; flagged: number; no_photos: number }
  flagged: VehicleWithImages[]
  inquiries: Inquiry[]
  activity: { action: string; entity: string; entity_id: string | null; created_at: Date; user_name: string | null }[]
  whatsappMissing: boolean
}) {
  const tiles = [
    { label: 'كل السيارات', value: counts.total, href: '/admin/vehicles' },
    { label: 'متوفرة', value: counts.available, href: '/admin/vehicles?status=available' },
    { label: 'محجوزة', value: counts.reserved, href: '/admin/vehicles?status=reserved' },
    { label: 'مُباعة', value: counts.sold, href: '/admin/vehicles?status=sold' },
    { label: 'بحاجة لتأكيد', value: counts.flagged, href: '/admin/vehicles?verification=needs_confirmation' },
    { label: 'بدون صور', value: counts.no_photos, href: '/admin/vehicles' },
  ]
  return (
    <AdminShell ctx={ctx} title="لوحة التحكم" actions={<a href="/admin/vehicles/new" class="btn btn-primary btn-sm">إضافة سيارة</a>}>
      {whatsappMissing ? (
        <p class="mb-5 rounded-lg bg-amber-100 p-3 text-sm text-amber">
          لم يُضبط رقم واتساب المبيعات، لذلك أزرار واتساب مخفية في الموقع. أضفه من <a class="underline" href="/admin/settings">بيانات التواصل</a>.
        </p>
      ) : null}
      <ul class="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        {tiles.map((x) => (
          <li>
            <a href={x.href} class="block rounded-xl border border-line bg-paper p-4 hover:border-petrol-700">
              <span class="block text-sm text-sage">{x.label}</span>
              <span class="num mt-1 block text-2xl font-bold">{x.value}</span>
            </a>
          </li>
        ))}
      </ul>

      <div class="mt-8 grid gap-6 xl:grid-cols-2">
        <section class="rounded-xl border border-line bg-paper p-5">
          <h2 class="mb-1 font-bold">سيارات بحاجة لتأكيد</h2>
          <p class="mb-4 text-sm text-sage">إعلانات قديمة أو فيها معلومة متعارضة. راجعها ثم اضغط «تم التحقق» أو غيّر حالتها.</p>
          {flagged.length ? (
            <ul class="divide-y divide-line">
              {flagged.map((v) => (
                <li class="py-3">
                  <a href={`/admin/vehicles/${v.id}`} class="font-semibold underline-offset-4 hover:underline">{title(v)}</a>
                  {v.verification_note ? <p class="mt-1 whitespace-pre-line text-xs leading-5 text-sage" dir="auto">{v.verification_note}</p> : null}
                </li>
              ))}
            </ul>
          ) : (
            <p class="text-sm text-sage">لا توجد سيارات بحاجة لتأكيد.</p>
          )}
        </section>
        <section class="rounded-xl border border-line bg-paper p-5">
          <h2 class="mb-4 font-bold">أحدث طلبات الاتصال</h2>
          {inquiries.length ? (
            <ul class="divide-y divide-line text-sm">
              {inquiries.map((i) => (
                <li class="flex flex-wrap items-center justify-between gap-2 py-2.5">
                  <span>
                    <span class="font-semibold">{i.name}</span> — <a class="num underline" href={`tel:${i.phone}`}>{displayPhone(i.phone)}</a>
                    {i.vehicle_title ? <span class="block text-xs text-sage">{i.vehicle_title}</span> : null}
                  </span>
                  <span class="text-xs text-sage">{formatDate(i.created_at, 'ar')}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p class="text-sm text-sage">لا توجد طلبات بعد.</p>
          )}
          <a href="/admin/inquiries" class="mt-3 inline-block text-sm font-semibold underline">كل الطلبات</a>
        </section>
      </div>

      <section class="mt-6 rounded-xl border border-line bg-paper p-5">
        <h2 class="mb-4 font-bold">آخر التعديلات</h2>
        {activity.length ? (
          <ul class="space-y-1.5 text-sm">
            {activity.map((a) => (
              <li class="flex flex-wrap gap-x-3 text-petrol-800">
                <span class="text-xs text-sage">{new Date(a.created_at).toLocaleString('en-GB', { timeZone: 'Asia/Dubai' })}</span>
                <span class="font-semibold">{a.user_name ?? 'النظام'}</span>
                <span>{a.action}</span>
                <span class="text-sage" dir="ltr">{a.entity}{a.entity_id ? ` ${a.entity_id.slice(0, 8)}` : ''}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p class="text-sm text-sage">لا توجد تعديلات بعد.</p>
        )}
      </section>
    </AdminShell>
  )
}

/* ------------------------------ vehicles list ------------------------------ */

export function VehicleListPage({
  ctx,
  result,
  q,
}: {
  ctx: AdminCtx
  result: { total: number; page: number; pages: number; items: VehicleWithImages[] }
  q: { q?: string; status?: string; verification?: string }
}) {
  const qs = (p: number) => {
    const s = new URLSearchParams(Object.entries(q).filter(([, v]) => v) as [string, string][])
    s.set('page', String(p))
    return `/admin/vehicles?${s}`
  }
  return (
    <AdminShell ctx={ctx} title="السيارات" actions={<a href="/admin/vehicles/new" class="btn btn-primary btn-sm">إضافة سيارة</a>}>
      <form method="get" class="mb-5 flex flex-wrap gap-2">
        <input name="q" value={q.q ?? ''} placeholder="بحث: الماركة، الموديل، السنة، رقم الإعلان" class="field max-w-xs" />
        <select name="status" class="field w-auto">
          <option value="">كل الحالات</option>
          {STATUSES.map((s) => <option value={s} selected={q.status === s}>{A.enums.status[s]}</option>)}
        </select>
        <select name="verification" class="field w-auto">
          <option value="">كل حالات التحقق</option>
          {VERIFICATIONS.map((s) => <option value={s} selected={q.verification === s}>{A.enums.verification[s]}</option>)}
        </select>
        <button class="btn btn-ghost btn-sm">عرض</button>
      </form>
      <p class="mb-3 text-sm text-sage"><span class="num">{result.total}</span> سيارة</p>
      <div class="overflow-x-auto rounded-xl border border-line bg-paper">
        <table class="w-full min-w-[820px] text-sm">
          <thead class="bg-stone text-start text-xs text-sage">
            <tr>
              <th class="p-3 text-start font-semibold">السيارة</th>
              <th class="p-3 text-start font-semibold">السعر</th>
              <th class="p-3 text-start font-semibold">الحالة</th>
              <th class="p-3 text-start font-semibold">التحقق</th>
              <th class="p-3 text-start font-semibold">تغيير سريع</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-line">
            {result.items.map((v) => (
              <tr>
                <td class="p-3">
                  <a href={`/admin/vehicles/${v.id}`} class="flex items-center gap-3">
                    {v.images[0] ? (
                      <img src={thumbUrl(v.images[0])} alt="" referrerpolicy="no-referrer" loading="lazy" class="h-12 w-10 rounded object-cover" />
                    ) : (
                      <span class="grid h-12 w-10 place-items-center rounded bg-stone-2 text-[10px] text-sage">بدون صور</span>
                    )}
                    <span>
                      <span class="block font-semibold hover:underline" dir="ltr">{title(v)}</span>
                      <span class="block text-xs text-sage" dir="ltr">{v.source_key ?? 'أضيفت يدوياً'}{v.featured ? ' · ★' : ''}{v.export_only ? ' · export' : ''}</span>
                    </span>
                  </a>
                </td>
                <td class="num p-3">{v.price_aed != null ? formatNumber(v.price_aed) : '—'}</td>
                <td class="p-3"><Pill text={A.enums.status[v.status]} cls={statusClass[v.status]!} /></td>
                <td class="p-3"><Pill text={A.enums.verification[v.verification]} cls={verifyClass[v.verification]!} /></td>
                <td class="p-3">
                  <form method="post" action={`/admin/vehicles/${v.id}/status`} class="flex gap-1.5" data-autosubmit>
                    <Csrf ctx={ctx} />
                    <input type="hidden" name="back" value={ctx.path} />
                    <select name="status" class="field w-auto py-1.5 text-xs" aria-label="تغيير الحالة">
                      {STATUSES.map((s) => <option value={s} selected={v.status === s}>{A.enums.status[s]}</option>)}
                    </select>
                    <noscript><button class="btn btn-ghost btn-sm">حفظ</button></noscript>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {result.pages > 1 ? (
        <nav class="mt-5 flex gap-2" aria-label="الصفحات">
          {Array.from({ length: result.pages }, (_, i) => i + 1).map((p) => (
            <a href={qs(p)} aria-current={p === result.page ? 'page' : undefined} class="num grid h-9 min-w-9 place-items-center rounded-full px-2 text-sm aria-[current=page]:bg-petrol-900 aria-[current=page]:text-paper">{p}</a>
          ))}
        </nav>
      ) : null}
    </AdminShell>
  )
}

/* ------------------------------ vehicle form ------------------------------ */

type FormValues = Record<string, any>

function Field(p: { name: string; label: string; v: FormValues; errors: Record<string, string>; type?: string; hint?: string; dir?: string; required?: boolean; list?: string; inputmode?: string }) {
  const id = `f-${p.name}`
  const err = p.errors[p.name]
  return (
    <div>
      <label class="label" for={id}>{p.label}{p.required ? <span class="text-sold"> *</span> : null}</label>
      <input
        id={id}
        name={p.name}
        type={p.type ?? 'text'}
        value={p.v[p.name] ?? ''}
        required={p.required}
        list={p.list}
        dir={p.dir}
        inputmode={p.inputmode as any}
        aria-invalid={err ? 'true' : undefined}
        aria-describedby={err ? `${id}-err` : p.hint ? `${id}-hint` : undefined}
        class={`field ${err ? 'border-sold' : ''}`}
      />
      {p.hint && !err ? <p id={`${id}-hint`} class="mt-1 text-xs text-sage">{p.hint}</p> : null}
      {err ? <p id={`${id}-err`} class="mt-1 text-xs font-semibold text-sold">{err}</p> : null}
    </div>
  )
}

function Select(p: { name: string; label: string; v: FormValues; options: readonly string[]; labels: Record<string, string>; empty?: string }) {
  return (
    <div>
      <label class="label" for={`f-${p.name}`}>{p.label}</label>
      <select id={`f-${p.name}`} name={p.name} class="field">
        {p.empty !== undefined ? <option value="">{p.empty}</option> : null}
        {p.options.map((o) => <option value={o} selected={String(p.v[p.name] ?? '') === o}>{p.labels[o] ?? o}</option>)}
      </select>
    </div>
  )
}

function Area(p: { name: string; label: string; v: FormValues; rows?: number; dir?: string; hint?: string; errors: Record<string, string> }) {
  const val = Array.isArray(p.v[p.name]) ? p.v[p.name].join('\n') : (p.v[p.name] ?? '')
  return (
    <div>
      <label class="label" for={`f-${p.name}`}>{p.label}</label>
      <textarea id={`f-${p.name}`} name={p.name} rows={p.rows ?? 4} dir={p.dir} class="field leading-7">{val}</textarea>
      {p.hint ? <p class="mt-1 text-xs text-sage">{p.hint}</p> : null}
      {p.errors[p.name] ? <p class="mt-1 text-xs font-semibold text-sold">{p.errors[p.name]}</p> : null}
    </div>
  )
}

export function VehicleFormPage({
  ctx,
  vehicle,
  values,
  errors,
  branches,
  makes,
}: {
  ctx: AdminCtx
  vehicle: VehicleWithImages | null
  values: FormValues
  errors: Record<string, string>
  branches: Branch[]
  makes: string[]
}) {
  const v = values
  const action = vehicle ? `/admin/vehicles/${vehicle.id}` : '/admin/vehicles/new'
  const yes = (x: unknown) => x === true || x === 'on' || x === 'true'
  const tri = v.price_includes_vat === true ? 'yes' : v.price_includes_vat === false ? 'no' : (v.price_includes_vat ?? '')
  const listed = v.listed_at instanceof Date ? v.listed_at.toISOString().slice(0, 10) : typeof v.listed_at === 'string' ? v.listed_at.slice(0, 10) : ''

  return (
    <AdminShell
      ctx={ctx}
      title={vehicle ? `تعديل: ${title(vehicle)}` : 'إضافة سيارة'}
      actions={
        vehicle ? (
          <>
            <a href={`/cars/${vehicle.slug}`} target="_blank" class="btn btn-ghost btn-sm">عرض في الموقع</a>
            {vehicle.verification !== 'confirmed' ? (
              <form method="post" action={`/admin/vehicles/${vehicle.id}/verify`}>
                <Csrf ctx={ctx} />
                <button class="btn btn-primary btn-sm">تم التحقق من البيانات</button>
              </form>
            ) : null}
          </>
        ) : null
      }
    >
      {Object.keys(errors).length ? (
        <p role="alert" class="mb-5 rounded-lg bg-amber-100 p-3 text-sm text-amber">يوجد {Object.keys(errors).length} حقل بحاجة لتصحيح. راجع الحقول المحددة بالأحمر.</p>
      ) : null}
      {vehicle?.verification_note ? (
        <div class="mb-5 rounded-lg border border-sand bg-sand-100 p-4 text-sm leading-6">
          <p class="font-bold">ملاحظات التحقق</p>
          <p class="mt-1 whitespace-pre-line" dir="auto">{vehicle.verification_note}</p>
        </div>
      ) : null}

      <div class="grid gap-6 xl:grid-cols-[1fr_340px]">
        <form method="post" action={action} class="space-y-6" id="vehicle-form">
          <Csrf ctx={ctx} />
          <datalist id="makes">{makes.map((m) => <option value={m} />)}</datalist>

          <fieldset class="rounded-xl border border-line bg-paper p-5">
            <legend class="px-2 font-bold">البيانات الأساسية</legend>
            <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Field name="make" label="الماركة (بالإنجليزية)" v={v} errors={errors} required list="makes" dir="ltr" hint="مثال: Nissan, Toyota" />
              <Field name="model" label="الموديل (بالإنجليزية)" v={v} errors={errors} required dir="ltr" hint="مثال: Patrol, Land Cruiser" />
              <Field name="trim" label="الفئة" v={v} errors={errors} dir="ltr" hint="مثال: LE Platinum City" />
              <Field name="year" label="سنة الصنع" v={v} errors={errors} required type="number" dir="ltr" />
              <Select name="condition" label="الحالة" v={v} options={CONDITIONS} labels={A.enums.condition} empty="غير محددة" />
              <div>
                <label class="label" for="f-branch_id">الفرع</label>
                <select id="f-branch_id" name="branch_id" class="field">
                  <option value="">غير محدد</option>
                  {branches.map((b) => <option value={b.id} selected={v.branch_id === b.id}>{b.name_ar}</option>)}
                </select>
              </div>
              <Field name="generation" label="الجيل (اختياري)" v={v} errors={errors} dir="ltr" />
            </div>
          </fieldset>

          <fieldset class="rounded-xl border border-line bg-paper p-5">
            <legend class="px-2 font-bold">السعر</legend>
            <div class="grid gap-4 sm:grid-cols-2">
              <Field name="price_aed" label="السعر بالدرهم" v={v} errors={errors} inputmode="numeric" dir="ltr" hint="اتركه فارغاً ليظهر «يرجى التواصل للاستفسار»" />
              <div>
                <label class="label" for="f-vat">هل السعر شامل الضريبة؟</label>
                <select id="f-vat" name="price_includes_vat" class="field">
                  <option value="" selected={tri === ''}>غير مذكور</option>
                  <option value="yes" selected={tri === 'yes'}>نعم، شامل الضريبة</option>
                  <option value="no" selected={tri === 'no'}>لا</option>
                </select>
              </div>
            </div>
          </fieldset>

          <fieldset class="rounded-xl border border-line bg-paper p-5">
            <legend class="px-2 font-bold">المواصفات</legend>
            <p class="mb-4 text-xs text-sage">اترك أي حقل غير مؤكد فارغاً، وسيظهر في الموقع «غير متوفر».</p>
            <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Field name="mileage_km" label="الممشى (كم)" v={v} errors={errors} inputmode="numeric" dir="ltr" />
              <Field name="engine_l" label="سعة المحرك (لتر)" v={v} errors={errors} inputmode="decimal" dir="ltr" hint="مثال: 3.5" />
              <Field name="horsepower" label="القوة (حصان)" v={v} errors={errors} inputmode="numeric" dir="ltr" />
              <Field name="torque_nm" label="عزم الدوران (نيوتن متر)" v={v} errors={errors} inputmode="numeric" dir="ltr" />
              <Select name="transmission" label="ناقل الحركة" v={v} options={TRANSMISSIONS} labels={A.enums.transmission} empty="غير محدد" />
              <Field name="gears" label="عدد السرعات" v={v} errors={errors} inputmode="numeric" dir="ltr" />
              <Select name="fuel" label="الوقود" v={v} options={FUELS} labels={A.enums.fuel} empty="غير محدد" />
              <Select name="drivetrain" label="نظام الدفع" v={v} options={DRIVETRAINS} labels={A.enums.drivetrain} empty="غير محدد" />
              <Select name="body_type" label="نوع الهيكل" v={v} options={BODY_TYPES} labels={A.enums.body} empty="غير محدد" />
              <Field name="body_detail" label="تفاصيل الهيكل" v={v} errors={errors} dir="ltr" hint="مثال: Pickup double cab" />
              <Field name="exterior_color" label="اللون الخارجي (بالإنجليزية)" v={v} errors={errors} dir="ltr" hint="مثال: White" />
              <Field name="interior_color" label="لون المقصورة (بالإنجليزية)" v={v} errors={errors} dir="ltr" />
              <Select name="regional_spec" label="المواصفات الإقليمية" v={v} options={REGIONAL_SPECS} labels={A.enums.regional} empty="غير مؤكدة" />
            </div>
            <label class="mt-4 flex items-center gap-2.5 text-sm font-semibold">
              <input type="checkbox" name="export_only" checked={yes(v.export_only)} class="h-4 w-4 accent-petrol-900" />
              للتصدير فقط
            </label>
          </fieldset>

          <fieldset class="rounded-xl border border-line bg-paper p-5">
            <legend class="px-2 font-bold">الوصف والتجهيزات</legend>
            <div class="grid gap-4 lg:grid-cols-2">
              <Area name="description_ar" label="الوصف بالعربية" v={v} rows={7} errors={errors} hint="اتركه فارغاً ليُكتب تلقائياً من المواصفات. لا تذكر «بدون حوادث» أو «ضمان» إلا إذا كانت مؤكدة." />
              <Area name="description_en" label="Description (English)" v={v} rows={7} dir="ltr" errors={errors} hint="Leave empty to generate it from the specifications." />
              <Area name="features_ar" label="التجهيزات (سطر لكل ميزة)" v={v} rows={6} errors={errors} />
              <Area name="features_en" label="Features (one per line)" v={v} rows={6} dir="ltr" errors={errors} />
              <Field name="warranty_ar" label="الضمان (عربي)" v={v} errors={errors} hint="مثال: ضمان الوكيل 3 سنوات أو 100 ألف كيلومتر" />
              <Field name="warranty_en" label="Warranty (English)" v={v} errors={errors} dir="ltr" />
            </div>
          </fieldset>

          <fieldset class="rounded-xl border border-line bg-paper p-5">
            <legend class="px-2 font-bold">النشر والمصدر</legend>
            <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Select name="status" label="حالة السيارة" v={v} options={STATUSES} labels={A.enums.status} />
              <Select name="verification" label="حالة التحقق" v={v} options={VERIFICATIONS} labels={A.enums.verification} />
              <Field name="listed_at" label="تاريخ الإعلان" v={{ ...v, listed_at: listed }} errors={errors} type="date" dir="ltr" />
              <Field name="source_url" label="رابط الإعلان الأصلي" v={v} errors={errors} type="url" dir="ltr" hint="منشور إنستغرام أو فيسبوك أو auto.ae" />
              <Field name="source_label" label="اسم المصدر" v={v} errors={errors} dir="ltr" />
              <Field name="featured_rank" label="ترتيب الظهور في المختارة" v={v} errors={errors} inputmode="numeric" dir="ltr" hint="الأصغر يظهر أولاً" />
            </div>
            <label class="mt-4 flex items-center gap-2.5 text-sm font-semibold">
              <input type="checkbox" name="featured" checked={yes(v.featured)} class="h-4 w-4 accent-petrol-900" />
              اعرضها في «سيارات مختارة» على الصفحة الرئيسية (تحتاج صورة واحدة على الأقل)
            </label>
            <div class="mt-4">
              <Area name="verification_note" label="ملاحظات التحقق (داخلية)" v={v} rows={3} errors={errors} />
            </div>
          </fieldset>

          <div class="sticky bottom-0 -mx-4 flex gap-3 border-t border-line bg-stone/95 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-xl sm:border">
            <button class="btn btn-primary">{vehicle ? 'حفظ التعديلات' : 'إضافة السيارة'}</button>
            <a href="/admin/vehicles" class="btn btn-ghost">إلغاء</a>
          </div>
        </form>

        {vehicle ? (
          <div class="space-y-6">
            <section class="rounded-xl border border-line bg-paper p-5">
              <h2 class="font-bold">الصور</h2>
              <p class="mt-1 text-xs leading-5 text-sage">الصورة الأولى هي الرئيسية. يتم ضغط الصور وحذف بيانات الموقع الجغرافي منها تلقائياً.</p>
              <form method="post" action={`/admin/vehicles/${vehicle.id}/images`} enctype="multipart/form-data" class="mt-4 space-y-3" data-resize-upload>
                <Csrf ctx={ctx} />
                <input type="file" name="photos" accept="image/jpeg,image/png,image/webp,image/heic,image/heif,image/avif" multiple required class="block w-full text-sm file:me-3 file:rounded-full file:border-0 file:bg-petrol-900 file:px-4 file:py-2 file:text-paper" />
                <button class="btn btn-ghost btn-sm w-full">رفع الصور</button>
              </form>
              {vehicle.images.length ? (
                <ul class="mt-5 grid grid-cols-3 gap-2">
                  {vehicle.images.map((img, i) => (
                    <li class="relative">
                      <img src={thumbUrl(img)} alt="" loading="lazy" referrerpolicy="no-referrer" class="aspect-[3/4] w-full rounded-md object-cover" />
                      <div class="mt-1 flex justify-between gap-1">
                        {i > 0 ? (
                          <form method="post" action={`/admin/vehicles/${vehicle.id}/images/${img.id}/cover`}>
                            <Csrf ctx={ctx} />
                            <button class="text-[11px] font-semibold text-petrol-700 underline" title="اجعلها الرئيسية">رئيسية</button>
                          </form>
                        ) : (
                          <span class="text-[11px] font-semibold text-sand">الرئيسية</span>
                        )}
                        <form method="post" action={`/admin/vehicles/${vehicle.id}/images/${img.id}/delete`} data-confirm="حذف هذه الصورة؟">
                          <Csrf ctx={ctx} />
                          <button class="text-[11px] font-semibold text-sold underline">حذف</button>
                        </form>
                      </div>
                      {img.source === 'remote' ? <span class="absolute start-1 top-1 rounded bg-petrol-950/70 px-1 text-[10px] text-paper">مصدر</span> : null}
                    </li>
                  ))}
                </ul>
              ) : (
                <p class="mt-4 text-sm text-sage">لا توجد صور بعد.</p>
              )}
            </section>

            <section class="rounded-xl border border-line bg-paper p-5 text-sm">
              <h2 class="font-bold">معلومات الإعلان</h2>
              <dl class="mt-3 space-y-2">
                <div><dt class="text-xs text-sage">الرابط في الموقع</dt><dd dir="ltr" class="break-all">/cars/{vehicle.slug}</dd></div>
                <div><dt class="text-xs text-sage">مفتاح المصدر</dt><dd dir="ltr">{vehicle.source_key ?? '—'}</dd></div>
                <div><dt class="text-xs text-sage">آخر تحقق</dt><dd>{formatDate(vehicle.last_verified_at, 'ar') ?? '—'}</dd></div>
                {vehicle.secondary_source_urls.length ? (
                  <div><dt class="text-xs text-sage">مصادر إضافية</dt><dd>{vehicle.secondary_source_urls.map((u) => <a href={u} target="_blank" rel="noopener" class="block break-all underline" dir="ltr">{u}</a>)}</dd></div>
                ) : null}
              </dl>
              <form method="post" action={`/admin/vehicles/${vehicle.id}/describe`} class="mt-4">
                <Csrf ctx={ctx} />
                <button class="btn btn-ghost btn-sm w-full">إعادة كتابة الوصف من المواصفات</button>
              </form>
            </section>

            <section class="rounded-xl border border-sold/30 bg-paper p-5">
              <h2 class="font-bold text-sold">حذف السيارة</h2>
              <p class="mt-1 text-xs leading-5 text-sage">يحذف السيارة وصورها نهائياً. إذا بيعت السيارة، يُفضّل تغيير حالتها إلى «مُباعة» بدلاً من حذفها.</p>
              <form method="post" action={`/admin/vehicles/${vehicle.id}/delete`} data-confirm="حذف هذه السيارة وصورها نهائياً؟ لا يمكن التراجع." class="mt-3">
                <Csrf ctx={ctx} />
                <button class="btn btn-sm w-full border border-sold text-sold hover:bg-sold hover:text-paper">حذف نهائي</button>
              </form>
            </section>
          </div>
        ) : (
          <p class="text-sm text-sage">يمكنك رفع الصور بعد حفظ السيارة.</p>
        )}
      </div>
    </AdminShell>
  )
}

/* ------------------------------ inquiries ------------------------------ */

export function InquiriesPage({ ctx, items, status }: { ctx: AdminCtx; items: Inquiry[]; status?: string }) {
  const labels = { new: 'جديد', contacted: 'تم التواصل', closed: 'مغلق' } as const
  return (
    <AdminShell ctx={ctx} title="طلبات الاتصال">
      <nav class="mb-5 flex gap-2 text-sm">
        {[['', 'الكل'], ['new', 'جديد'], ['contacted', 'تم التواصل'], ['closed', 'مغلق']].map(([k, l]) => (
          <a href={k ? `/admin/inquiries?status=${k}` : '/admin/inquiries'} aria-current={(status ?? '') === k ? 'page' : undefined} class="rounded-full border border-line bg-paper px-3 py-1.5 aria-[current=page]:border-petrol-900 aria-[current=page]:bg-petrol-900 aria-[current=page]:text-paper">{l}</a>
        ))}
      </nav>
      {items.length ? (
        <ul class="space-y-3">
          {items.map((i) => (
            <li class="rounded-xl border border-line bg-paper p-4">
              <div class="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p class="font-bold">{i.name} — <a class="num underline" href={`tel:${i.phone}`}>{displayPhone(i.phone)}</a></p>
                  {i.vehicle_title ? <p class="text-sm text-sage">بخصوص: <a class="underline" href={`/cars/${i.vehicle_slug}`} target="_blank" dir="ltr">{i.vehicle_title}</a></p> : null}
                  <p class="text-xs text-sage">{new Date(i.created_at).toLocaleString('en-GB', { timeZone: 'Asia/Dubai' })} · {i.locale === 'ar' ? 'عربي' : 'English'}</p>
                </div>
                <form method="post" action={`/admin/inquiries/${i.id}`} class="flex gap-2" data-autosubmit>
                  <Csrf ctx={ctx} />
                  <select name="status" class="field w-auto py-1.5 text-sm" aria-label="حالة الطلب">
                    {(['new', 'contacted', 'closed'] as const).map((s) => <option value={s} selected={i.status === s}>{labels[s]}</option>)}
                  </select>
                  <noscript><button class="btn btn-ghost btn-sm">حفظ</button></noscript>
                </form>
              </div>
              {i.message ? <p class="mt-3 whitespace-pre-line rounded-lg bg-stone p-3 text-sm leading-6" dir="auto">{i.message}</p> : null}
              <a class="btn btn-wa btn-sm mt-3" target="_blank" rel="noopener" href={`https://wa.me/${i.phone.replace(/\D/g, '')}`}>مراسلة عبر واتساب</a>
            </li>
          ))}
        </ul>
      ) : (
        <p class="rounded-xl border border-dashed border-line bg-paper p-8 text-center text-sage">لا توجد طلبات في هذه القائمة.</p>
      )}
    </AdminShell>
  )
}

/* ------------------------------ offers ------------------------------ */

export function OffersPage({ ctx, offers, vehicles, editing }: { ctx: AdminCtx; offers: Offer[]; vehicles: { id: string; label: string }[]; editing: Offer | null }) {
  const o = editing
  return (
    <AdminShell ctx={ctx} title="العروض">
      <p class="mb-5 max-w-3xl text-sm leading-6 text-sage">
        قسم «العروض الحالية» يظهر في الصفحة الرئيسية فقط عند وجود عرض مفعّل وغير منتهٍ. فعّل العرض فقط بعد التأكد منه من المعرض.
      </p>
      <div class="grid gap-6 xl:grid-cols-[1fr_420px]">
        <ul class="space-y-3">
          {offers.length ? (
            offers.map((x) => (
              <li class="rounded-xl border border-line bg-paper p-4">
                <div class="flex flex-wrap items-center justify-between gap-2">
                  <p class="font-bold">{x.title_ar}</p>
                  <Pill text={x.active ? 'مفعّل' : 'غير مفعّل'} cls={x.active ? 'bg-petrol-100 text-petrol-900' : 'bg-stone-2 text-sage'} />
                </div>
                {x.body_ar ? <p class="mt-1 text-sm">{x.body_ar}</p> : null}
                <p class="mt-1 text-xs text-sage">{x.valid_until ? `ينتهي ${x.valid_until}` : 'بدون تاريخ انتهاء'}{x.source_url ? ' · ' : ''}{x.source_url ? <a class="underline" href={x.source_url} target="_blank" rel="noopener">المصدر</a> : null}</p>
                <div class="mt-3 flex gap-3 text-sm">
                  <a class="font-semibold underline" href={`/admin/offers?edit=${x.id}`}>تعديل</a>
                  <form method="post" action={`/admin/offers/${x.id}/delete`} data-confirm="حذف هذا العرض؟">
                    <Csrf ctx={ctx} />
                    <button class="font-semibold text-sold underline">حذف</button>
                  </form>
                </div>
              </li>
            ))
          ) : (
            <li class="rounded-xl border border-dashed border-line bg-paper p-8 text-center text-sage">لا توجد عروض.</li>
          )}
        </ul>
        <form method="post" action={o ? `/admin/offers/${o.id}` : '/admin/offers/new'} class="space-y-4 rounded-xl border border-line bg-paper p-5">
          <Csrf ctx={ctx} />
          <h2 class="font-bold">{o ? 'تعديل العرض' : 'عرض جديد'}</h2>
          <div><label class="label" for="o-tar">العنوان بالعربية</label><input id="o-tar" name="title_ar" required value={o?.title_ar ?? ''} class="field" /></div>
          <div><label class="label" for="o-ten">Title (English)</label><input id="o-ten" name="title_en" required dir="ltr" value={o?.title_en ?? ''} class="field" /></div>
          <div><label class="label" for="o-bar">التفاصيل بالعربية</label><textarea id="o-bar" name="body_ar" rows={3} class="field">{o?.body_ar ?? ''}</textarea></div>
          <div><label class="label" for="o-ben">Details (English)</label><textarea id="o-ben" name="body_en" rows={3} dir="ltr" class="field">{o?.body_en ?? ''}</textarea></div>
          <div>
            <label class="label" for="o-veh">السيارة (اختياري)</label>
            <select id="o-veh" name="vehicle_id" class="field">
              <option value="">بدون</option>
              {vehicles.map((x) => <option value={x.id} selected={o?.vehicle_id === x.id}>{x.label}</option>)}
            </select>
          </div>
          <div><label class="label" for="o-until">ينتهي في</label><input id="o-until" type="date" name="valid_until" value={o?.valid_until ?? ''} class="field" dir="ltr" /></div>
          <div><label class="label" for="o-src">رابط المصدر</label><input id="o-src" type="url" name="source_url" value={o?.source_url ?? ''} class="field" dir="ltr" /></div>
          <label class="flex items-center gap-2.5 text-sm font-semibold"><input type="checkbox" name="active" checked={o?.active} class="h-4 w-4 accent-petrol-900" /> مفعّل ويظهر في الموقع</label>
          <div class="flex gap-2">
            <button class="btn btn-primary">{o ? 'حفظ' : 'إضافة العرض'}</button>
            {o ? <a class="btn btn-ghost" href="/admin/offers">إلغاء</a> : null}
          </div>
        </form>
      </div>
    </AdminShell>
  )
}

/* ------------------------------ import / export ------------------------------ */

export interface ImportPreviewRow {
  line: number
  action: 'create' | 'update' | 'skip' | 'error'
  label: string
  message?: string
}

export function ImportPage({ ctx, preview, csv }: { ctx: AdminCtx; preview?: ImportPreviewRow[]; csv?: string }) {
  const counts = preview?.reduce((acc, r) => ({ ...acc, [r.action]: (acc[r.action] ?? 0) + 1 }), {} as Record<string, number>)
  const actionLabel = { create: 'إضافة', update: 'تحديث', skip: 'تجاهل', error: 'خطأ' }
  return (
    <AdminShell ctx={ctx} title="استيراد وتصدير المخزون">
      <div class="grid gap-6 xl:grid-cols-2">
        <section class="rounded-xl border border-line bg-paper p-5">
          <h2 class="font-bold">تصدير</h2>
          <p class="mt-1 text-sm leading-6 text-sage">ملف CSV بكل السيارات وبياناتها وروابط صورها، يفتح في Excel.</p>
          <div class="mt-4 flex flex-wrap gap-2">
            <a href="/admin/export.csv" class="btn btn-primary btn-sm">تنزيل المخزون (CSV)</a>
            <a href="/admin/template.csv" class="btn btn-ghost btn-sm">تنزيل قالب فارغ</a>
          </div>
        </section>
        <section class="rounded-xl border border-line bg-paper p-5">
          <h2 class="font-bold">استيراد</h2>
          <p class="mt-1 text-sm leading-6 text-sage">
            ارفع ملف CSV بنفس أعمدة القالب. السيارات التي لها <span dir="ltr">source_key</span> موجود تُحدَّث، والجديدة تُضاف. لا يتم حذف أي سيارة.
            ستظهر معاينة قبل التنفيذ.
          </p>
          <form method="post" action="/admin/import/preview" enctype="multipart/form-data" class="mt-4 flex flex-wrap items-center gap-3">
            <Csrf ctx={ctx} />
            <input type="file" name="file" accept=".csv,text/csv" required class="text-sm file:me-3 file:rounded-full file:border-0 file:bg-petrol-900 file:px-4 file:py-2 file:text-paper" />
            <button class="btn btn-ghost btn-sm">معاينة</button>
          </form>
        </section>
      </div>

      {preview ? (
        <section class="mt-6 rounded-xl border border-line bg-paper p-5">
          <h2 class="font-bold">المعاينة</h2>
          <p class="mt-1 text-sm text-sage">
            {(['create', 'update', 'skip', 'error'] as const).map((k) => (counts?.[k] ? `${actionLabel[k]}: ${counts[k]}  ` : '')).join('')}
          </p>
          <div class="mt-4 max-h-[420px] overflow-auto">
            <table class="w-full text-sm">
              <thead class="sticky top-0 bg-stone text-xs text-sage"><tr><th class="p-2 text-start">السطر</th><th class="p-2 text-start">الإجراء</th><th class="p-2 text-start">السيارة</th><th class="p-2 text-start">ملاحظة</th></tr></thead>
              <tbody class="divide-y divide-line">
                {preview.map((r) => (
                  <tr class={r.action === 'error' ? 'bg-amber-100' : ''}>
                    <td class="num p-2">{r.line}</td>
                    <td class="p-2 font-semibold">{actionLabel[r.action]}</td>
                    <td class="p-2" dir="ltr">{r.label}</td>
                    <td class="p-2 text-xs">{r.message ?? ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {csv && preview.some((r) => r.action === 'create' || r.action === 'update') ? (
            <form method="post" action="/admin/import/apply" class="mt-4">
              <Csrf ctx={ctx} />
              <textarea name="csv" hidden>{csv}</textarea>
              <button class="btn btn-primary">تنفيذ الاستيراد (الصفوف التي فيها أخطاء ستُتجاهل)</button>
            </form>
          ) : null}
        </section>
      ) : null}
    </AdminShell>
  )
}

/* ------------------------------ settings ------------------------------ */

export function SettingsPage({ ctx, settings, branches, errors }: { ctx: AdminCtx; settings: SiteSettings; branches: Branch[]; errors: Record<string, string> }) {
  const s = settings
  const f = (name: keyof SiteSettings, label: string, opts: { dir?: string; hint?: string; type?: string } = {}) => (
    <div>
      <label class="label" for={`s-${name}`}>{label}</label>
      <input id={`s-${name}`} name={name} type={opts.type ?? 'text'} value={(s[name] as string) ?? ''} dir={opts.dir} class={`field ${errors[name] ? 'border-sold' : ''}`} />
      {errors[name] ? <p class="mt-1 text-xs font-semibold text-sold">{errors[name]}</p> : opts.hint ? <p class="mt-1 text-xs text-sage">{opts.hint}</p> : null}
    </div>
  )
  return (
    <AdminShell ctx={ctx} title="بيانات التواصل">
      <form method="post" action="/admin/settings" class="space-y-6">
        <Csrf ctx={ctx} />
        <fieldset class="rounded-xl border border-line bg-paper p-5">
          <legend class="px-2 font-bold">التواصل</legend>
          <div class="grid gap-4 sm:grid-cols-2">
            {f('whatsapp', 'رقم واتساب المبيعات', { dir: 'ltr', hint: 'يُستخدم في كل أزرار واتساب. اتركه فارغاً لإخفاء الأزرار.' })}
            {f('phone', 'رقم الاتصال', { dir: 'ltr' })}
            {f('email', 'البريد الإلكتروني', { dir: 'ltr', type: 'email' })}
            {f('maps_url', 'رابط خرائط جوجل', { dir: 'ltr' })}
            {f('hours_ar', 'ساعات العمل (عربي)')}
            {f('hours_en', 'Opening hours (English)', { dir: 'ltr' })}
          </div>
        </fieldset>
        <fieldset class="rounded-xl border border-line bg-paper p-5">
          <legend class="px-2 font-bold">الحسابات الرسمية</legend>
          <div class="grid gap-4 sm:grid-cols-2">
            {f('instagram_url', 'Instagram', { dir: 'ltr' })}
            {f('facebook_url', 'Facebook', { dir: 'ltr' })}
            {f('threads_url', 'Threads', { dir: 'ltr' })}
            {f('tiktok_url', 'TikTok', { dir: 'ltr' })}
          </div>
        </fieldset>
        <fieldset class="rounded-xl border border-line bg-paper p-5">
          <legend class="px-2 font-bold">الأقسام</legend>
          <p class="mb-3 text-xs text-sage">سطر لكل قسم بالصيغة: الاسم بالعربية | Name in English | الرقم</p>
          <textarea name="departments" rows={4} class="field leading-7">{s.departments.map((d) => `${d.name_ar} | ${d.name_en} | ${d.phone ?? ''}`).join('\n')}</textarea>
          {errors.departments ? <p class="mt-1 text-xs font-semibold text-sold">{errors.departments}</p> : null}
        </fieldset>
        <button class="btn btn-primary">حفظ بيانات التواصل</button>
      </form>

      <h2 class="mb-4 mt-10 font-display text-xl font-bold">الفروع</h2>
      <div class="grid gap-4 xl:grid-cols-3">
        {branches.map((b) => (
          <form method="post" action={`/admin/branches/${b.id}`} class="space-y-3 rounded-xl border border-line bg-paper p-5">
            <Csrf ctx={ctx} />
            <div><label class="label">الاسم بالعربية</label><input name="name_ar" required value={b.name_ar} class="field" /></div>
            <div><label class="label">Name (English)</label><input name="name_en" required value={b.name_en} dir="ltr" class="field" /></div>
            <div><label class="label">العنوان بالعربية</label><input name="address_ar" value={b.address_ar ?? ''} class="field" /></div>
            <div><label class="label">Address (English)</label><input name="address_en" value={b.address_en ?? ''} dir="ltr" class="field" /></div>
            <div class="grid grid-cols-2 gap-2">
              <div><label class="label">الهاتف</label><input name="phone" value={b.phone ?? ''} dir="ltr" class="field" /></div>
              <div><label class="label">واتساب</label><input name="whatsapp" value={b.whatsapp ?? ''} dir="ltr" class="field" /></div>
            </div>
            <div><label class="label">رابط الخريطة</label><input name="maps_url" value={b.maps_url ?? ''} dir="ltr" class="field" /></div>
            <input type="hidden" name="position" value={b.position} />
            <button class="btn btn-ghost btn-sm">حفظ الفرع</button>
          </form>
        ))}
      </div>
    </AdminShell>
  )
}

/* ------------------------------ users ------------------------------ */

export function UsersPage({ ctx, users }: { ctx: AdminCtx; users: (AdminUser & { last_login_at: Date | null })[] }) {
  return (
    <AdminShell ctx={ctx} title="المستخدمون">
      <div class="grid gap-6 xl:grid-cols-[1fr_380px]">
        <ul class="divide-y divide-line rounded-xl border border-line bg-paper">
          {users.map((u) => (
            <li class="flex flex-wrap items-center justify-between gap-3 p-4">
              <div>
                <p class="font-bold">{u.name} <span class="text-xs font-normal text-sage">{u.role === 'owner' ? 'مالك' : 'موظف'}</span></p>
                <p class="text-sm text-sage" dir="ltr">{u.email}</p>
                <p class="text-xs text-sage">آخر دخول: {u.last_login_at ? formatDate(u.last_login_at, 'ar') : 'لم يدخل بعد'}</p>
              </div>
              {u.id !== ctx.session.user.id ? (
                <form method="post" action={`/admin/users/${u.id}/active`}>
                  <Csrf ctx={ctx} />
                  <input type="hidden" name="active" value={u.active ? '0' : '1'} />
                  <button class={`btn btn-sm ${u.active ? 'btn-ghost' : 'btn-primary'}`}>{u.active ? 'إيقاف الحساب' : 'تفعيل الحساب'}</button>
                </form>
              ) : (
                <span class="text-xs text-sage">حسابك</span>
              )}
            </li>
          ))}
        </ul>
        <form method="post" action="/admin/users" class="space-y-4 rounded-xl border border-line bg-paper p-5">
          <Csrf ctx={ctx} />
          <h2 class="font-bold">إضافة مستخدم</h2>
          <div><label class="label" for="u-name">الاسم</label><input id="u-name" name="name" required class="field" /></div>
          <div><label class="label" for="u-email">البريد الإلكتروني</label><input id="u-email" name="email" type="email" required dir="ltr" class="field" /></div>
          <div><label class="label" for="u-pw">كلمة مرور مؤقتة</label><input id="u-pw" name="password" type="password" required minlength={10} autocomplete="new-password" dir="ltr" class="field" /><p class="mt-1 text-xs text-sage">10 أحرف على الأقل، حروف وأرقام.</p></div>
          <div>
            <label class="label" for="u-role">الصلاحية</label>
            <select id="u-role" name="role" class="field">
              <option value="staff">موظف: إدارة السيارات والعروض والطلبات</option>
              <option value="owner">مالك: كل الصلاحيات بما فيها المستخدمون والتواصل</option>
            </select>
          </div>
          <button class="btn btn-primary">إضافة</button>
        </form>
      </div>
    </AdminShell>
  )
}

export function AccountPage({ ctx }: { ctx: AdminCtx }) {
  return (
    <AdminShell ctx={ctx} title="تغيير كلمة المرور">
      <form method="post" action="/admin/account" class="max-w-md space-y-4 rounded-xl border border-line bg-paper p-5">
        <Csrf ctx={ctx} />
        <div><label class="label" for="pw-cur">كلمة المرور الحالية</label><input id="pw-cur" name="current" type="password" required autocomplete="current-password" dir="ltr" class="field" /></div>
        <div><label class="label" for="pw-new">كلمة المرور الجديدة</label><input id="pw-new" name="password" type="password" required minlength={10} autocomplete="new-password" dir="ltr" class="field" /></div>
        <button class="btn btn-primary">حفظ</button>
      </form>
    </AdminShell>
  )
}
