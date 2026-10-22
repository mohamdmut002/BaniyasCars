import type { VehicleWithImages } from '../../domain/vehicle.js'
import { FUELS, TRANSMISSIONS } from '../../domain/vehicle.js'
import type { VehicleFilters } from '../../repo/vehicles.js'
import { SORTS } from '../../repo/vehicles.js'
import { t } from '../../i18n/index.js'
import { makeName, modelName } from '../../domain/names.js'
import { formatNumber } from '../../lib/format.js'
import { whatsappLink } from '../../lib/whatsapp.js'
import { Layout } from '../layout.js'
import { href, type PageCtx } from '../ctx.js'
import { VehicleGrid } from '../components.js'
import { IconFilter, IconSearch, IconWhatsapp, IconClose } from '../icons.js'
import { breadcrumbJsonLd } from '../seo.js'

export interface InventoryData {
  filters: VehicleFilters
  result: { total: number; page: number; pages: number; items: VehicleWithImages[] }
  makes: { make: string; count: number }[]
  models: { make: string; model: string; count: number }[]
  years: { min: number; max: number }
  query: URLSearchParams
}

export function InventoryPage({ ctx, data }: { ctx: PageCtx; data: InventoryData }) {
  const L = t(ctx.locale)
  const C = L.cars
  const f = data.filters
  const ar = ctx.locale === 'ar'
  const base = href(ctx.locale, '/cars')
  const activeCount = [...data.query.keys()].filter((k) => !['sort', 'page'].includes(k)).length
  const without = (key: string, value?: string) => {
    const q = new URLSearchParams(data.query)
    if (value === undefined) q.delete(key)
    else {
      const rest = q.getAll(key).filter((v) => v !== value)
      q.delete(key)
      rest.forEach((v) => q.append(key, v))
    }
    if (key === 'make') q.delete('model')
    q.delete('page')
    const s = q.toString()
    return s ? `${base}?${s}` : base
  }
  const pageUrl = (p: number) => {
    const q = new URLSearchParams(data.query)
    if (p <= 1) q.delete('page')
    else q.set('page', String(p))
    const s = q.toString()
    return s ? `${base}?${s}` : base
  }
  const chips: { label: string; url: string }[] = []
  if (f.q) chips.push({ label: `“${f.q}”`, url: without('q') })
  if (f.make) chips.push({ label: makeName(f.make, ctx.locale), url: without('make') })
  if (f.model) chips.push({ label: modelName(f.model, ctx.locale), url: without('model') })
  if (f.yearMin) chips.push({ label: `${C.yearFrom} ${f.yearMin}`, url: without('year_min') })
  if (f.yearMax) chips.push({ label: `${C.yearTo} ${f.yearMax}`, url: without('year_max') })
  if (f.priceMin) chips.push({ label: `${C.priceMin}: ${formatNumber(f.priceMin)}`, url: without('price_min') })
  if (f.priceMax) chips.push({ label: `${C.priceMax}: ${formatNumber(f.priceMax)}`, url: without('price_max') })
  if (f.mileageMax != null) chips.push({ label: `≤ ${formatNumber(f.mileageMax)} ${L.km}`, url: without('mileage_max') })
  f.transmission?.forEach((v) => chips.push({ label: L.enums.transmission[v as keyof typeof L.enums.transmission], url: without('transmission', v) }))
  f.fuel?.forEach((v) => chips.push({ label: L.enums.fuel[v as keyof typeof L.enums.fuel], url: without('fuel', v) }))
  if (f.condition) chips.push({ label: L.enums.condition[f.condition], url: without('condition') })
  if (f.gcc) chips.push({ label: C.gccOnly, url: without('gcc') })
  if (f.hideExport) chips.push({ label: C.hideExport, url: without('hide_export') })

  const titleParts = [f.make ? makeName(f.make, ctx.locale) : null, f.model ? modelName(f.model, ctx.locale) : null].filter(Boolean)
  const title = titleParts.length
    ? ar
      ? `${titleParts.join(' ')} للبيع | معرض بني ياس للسيارات`
      : `${titleParts.join(' ')} for sale | Baniyas Cars`
    : ar
      ? 'سيارات للبيع في أبوظبي ودبي | معرض بني ياس للسيارات'
      : 'Cars for sale in Abu Dhabi and Dubai | Baniyas Cars'
  // Canonical points at the unfiltered list except for the clean brand pages, which are worth indexing.
  const onlyMake = f.make && [...data.query.keys()].every((k) => k === 'make')
  const canonicalPath = onlyMake ? `/cars?make=${encodeURIComponent(f.make!)}` : '/cars'
  const modelsForMake = f.make ? data.models.filter((m) => m.make.toLowerCase() === f.make!.toLowerCase()) : []
  const notFoundWa = whatsappLink(ctx.settings.whatsapp, L.whatsappSearch + (f.q ?? titleParts.join(' ')))

  const filterForm = (px: string) => (
    <form method="get" action={base} class="space-y-5" data-autosubmit>
      {f.q ? <input type="hidden" name="q" value={f.q} /> : null}
      {f.sort && f.sort !== 'recent' ? <input type="hidden" name="sort" value={f.sort} /> : null}
      <div>
        <label class="label" for={`${px}f-make`}>{C.make}</label>
        <select id={`${px}f-make`} name="make" class="field">
          <option value="">{C.any}</option>
          {data.makes.map((m) => (
            <option value={m.make} selected={f.make?.toLowerCase() === m.make.toLowerCase()}>
              {makeName(m.make, ctx.locale)} ({m.count})
            </option>
          ))}
        </select>
      </div>
      {modelsForMake.length ? (
        <div>
          <label class="label" for={`${px}f-model`}>{C.model}</label>
          <select id={`${px}f-model`} name="model" class="field">
            <option value="">{C.any}</option>
            {modelsForMake.map((m) => (
              <option value={m.model} selected={f.model?.toLowerCase() === m.model.toLowerCase()}>
                {modelName(m.model, ctx.locale)} ({m.count})
              </option>
            ))}
          </select>
        </div>
      ) : null}
      <fieldset class="grid grid-cols-2 gap-2">
        <legend class="label">{L.spec.year}</legend>
        <label class="sr-only" for={`${px}f-ymin`}>{C.yearFrom}</label>
        <select id={`${px}f-ymin`} name="year_min" class="field">
          <option value="">{C.yearFrom}</option>
          {range(data.years.max, data.years.min).map((y) => <option value={y} selected={f.yearMin === y}>{y}</option>)}
        </select>
        <label class="sr-only" for={`${px}f-ymax`}>{C.yearTo}</label>
        <select id={`${px}f-ymax`} name="year_max" class="field">
          <option value="">{C.yearTo}</option>
          {range(data.years.max, data.years.min).map((y) => <option value={y} selected={f.yearMax === y}>{y}</option>)}
        </select>
      </fieldset>
      <fieldset class="grid grid-cols-2 gap-2">
        <legend class="label">{L.spec.price} ({ar ? 'درهم' : 'AED'})</legend>
        <label class="sr-only" for={`${px}f-pmin`}>{C.priceMin}</label>
        <input id={`${px}f-pmin`} name="price_min" inputmode="numeric" pattern="[0-9,]*" class="field num w-full" placeholder={C.priceMin} value={f.priceMin ?? ''} />
        <label class="sr-only" for={`${px}f-pmax`}>{C.priceMax}</label>
        <input id={`${px}f-pmax`} name="price_max" inputmode="numeric" pattern="[0-9,]*" class="field num w-full" placeholder={C.priceMax} value={f.priceMax ?? ''} />
      </fieldset>
      <div>
        <label class="label" for={`${px}f-km`}>{C.mileageMax}</label>
        <select id={`${px}f-km`} name="mileage_max" class="field">
          <option value="">{C.any}</option>
          {[0, 10000, 50000, 100000, 150000, 200000].map((k) => (
            <option value={k} selected={f.mileageMax === k}>{k === 0 ? (ar ? 'جديدة (صفر كم)' : 'New (0 km)') : `≤ ${formatNumber(k)}`}</option>
          ))}
        </select>
      </div>
      <fieldset>
        <legend class="label">{C.condition}</legend>
        <div class="flex gap-2">
          {(['', 'new', 'used'] as const).map((c) => (
            <label class="flex-1 cursor-pointer">
              <input type="radio" name="condition" value={c} checked={(f.condition ?? '') === c} class="peer sr-only" />
              <span class="block rounded-lg border border-line bg-paper px-2 py-2 text-center text-sm font-semibold peer-checked:border-petrol-900 peer-checked:bg-petrol-900 peer-checked:text-paper peer-focus-visible:outline-2 peer-focus-visible:outline-sand">
                {c ? L.enums.condition[c] : C.any}
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      <fieldset>
        <legend class="label">{C.transmission}</legend>
        <div class="space-y-1.5">
          {TRANSMISSIONS.map((tr) => (
            <label class="flex items-center gap-2.5 text-sm">
              <input type="checkbox" name="transmission" value={tr} checked={f.transmission?.includes(tr)} class="h-4 w-4 accent-petrol-900" />
              {L.enums.transmission[tr]}
            </label>
          ))}
        </div>
      </fieldset>
      <fieldset>
        <legend class="label">{C.fuel}</legend>
        <div class="space-y-1.5">
          {FUELS.filter((x) => x !== 'electric').map((fu) => (
            <label class="flex items-center gap-2.5 text-sm">
              <input type="checkbox" name="fuel" value={fu} checked={f.fuel?.includes(fu)} class="h-4 w-4 accent-petrol-900" />
              {L.enums.fuel[fu]}
            </label>
          ))}
        </div>
      </fieldset>
      <fieldset class="space-y-1.5 border-t border-line pt-4">
        <legend class="sr-only">{C.spec}</legend>
        <label class="flex items-center gap-2.5 text-sm">
          <input type="checkbox" name="gcc" value="1" checked={f.gcc} class="h-4 w-4 accent-petrol-900" />
          {C.gccOnly}
        </label>
        <label class="flex items-center gap-2.5 text-sm">
          <input type="checkbox" name="hide_export" value="1" checked={f.hideExport} class="h-4 w-4 accent-petrol-900" />
          {C.hideExport}
        </label>
      </fieldset>
      <div class="flex gap-2 pt-1">
        <button class="btn btn-primary flex-1" data-apply>{C.apply}</button>
        {activeCount ? <a href={base} class="btn btn-ghost">{C.reset}</a> : null}
      </div>
    </form>
  )

  return (
    <Layout
      ctx={ctx}
      meta={{
        title,
        description: C.description,
        canonicalPath,
        noindex: data.query.toString() !== '' && !onlyMake,
        jsonLd: [breadcrumbJsonLd([{ name: L.nav.home, path: href(ctx.locale, '/') }, { name: L.nav.cars, path: base }])],
      }}
    >
      <div class="border-b border-line bg-paper">
        <div class="wrap py-8">
          <h1 class="h-display text-3xl sm:text-4xl">{titleParts.length ? titleParts.join(' ') : C.title}</h1>
          <form method="get" action={base} role="search" class="mt-5 flex max-w-2xl gap-2">
            {[...data.query.entries()]
              .filter(([k]) => !['q', 'page'].includes(k))
              .map(([k, v]) => <input type="hidden" name={k} value={v} />)}
            <label for="inv-q" class="sr-only">{C.search}</label>
            <div class="flex min-w-0 flex-1 items-center gap-2 rounded-full border border-line bg-stone px-4 focus-within:border-petrol-700">
              <IconSearch class="shrink-0 text-sage" />
              <input id="inv-q" name="q" type="search" value={f.q ?? ''} placeholder={L.home.searchPlaceholder} class="min-w-0 flex-1 bg-transparent py-3 outline-none" />
            </div>
            <button class="btn btn-primary">{C.search}</button>
          </form>
        </div>
      </div>

      <div class="wrap grid gap-8 pt-8 lg:grid-cols-[270px_1fr]">
        <aside class="hidden lg:block" aria-label={C.filters}>
          <div class="sticky top-24 rounded-[var(--radius-card)] border border-line bg-paper p-5">
            <h2 class="mb-4 font-bold">{C.filters}</h2>
            {filterForm('d-')}
          </div>
        </aside>

        <div>
          <div class="mb-5 flex flex-wrap items-center justify-between gap-3">
            <p class="font-semibold" role="status">
              {C.results(data.result.total)}
            </p>
            <div class="flex flex-wrap items-center gap-2">
              <details class="lg:hidden" data-filters>
                <summary class="btn btn-ghost btn-sm cursor-pointer list-none [&::-webkit-details-marker]:hidden">
                  <IconFilter size={18} /> {C.showFilters}
                  {activeCount ? <span class="num rounded-full bg-petrol-900 px-2 text-xs text-paper">{activeCount}</span> : null}
                </summary>
                <div class="fixed inset-0 z-40 overflow-y-auto bg-paper p-5">
                  <div class="mb-4 flex items-center justify-between">
                    <h2 class="text-lg font-bold">{C.filters}</h2>
                    <button type="button" class="grid h-10 w-10 place-items-center rounded-full hover:bg-stone" data-close-details aria-label={L.nav.close}>
                      <IconClose />
                    </button>
                  </div>
                  {filterForm('m-')}
                </div>
              </details>
              <form method="get" action={base} class="flex items-center gap-2" data-autosubmit>
                {[...data.query.entries()]
                  .filter(([k]) => !['sort', 'page'].includes(k))
                  .map(([k, v]) => <input type="hidden" name={k} value={v} />)}
                <label for="sort" class="sr-only text-sm text-sage sm:not-sr-only">{C.sort}</label>
                <select id="sort" name="sort" class="field w-auto py-2 text-sm">
                  {SORTS.map((s) => <option value={s} selected={f.sort === s}>{C.sortOptions[s]}</option>)}
                </select>
                <noscript><button class="btn btn-ghost btn-sm">{C.apply}</button></noscript>
              </form>
            </div>
          </div>

          {chips.length ? (
            <ul class="mb-5 flex flex-wrap gap-2" aria-label={C.filters}>
              {chips.map((c) => (
                <li>
                  <a href={c.url} class="inline-flex items-center gap-1.5 rounded-full bg-petrol-100 px-3 py-1.5 text-sm font-semibold hover:bg-stone-2">
                    {c.label}
                    <IconClose size={14} />
                    <span class="sr-only">{ar ? 'إزالة' : 'remove'}</span>
                  </a>
                </li>
              ))}
            </ul>
          ) : null}

          {data.result.items.length ? (
            <VehicleGrid items={data.result.items} ctx={ctx} eagerCount={4} />
          ) : (
            <div class="rounded-[var(--radius-card)] border border-dashed border-line bg-paper px-6 py-14 text-center">
              <h2 class="text-xl font-bold">{C.emptyTitle}</h2>
              <p class="mx-auto mt-3 max-w-[48ch] leading-7 text-petrol-800">{C.emptyBody}</p>
              <div class="mt-6 flex flex-wrap justify-center gap-3">
                <a href={base} class="btn btn-ghost">{C.reset}</a>
                {notFoundWa ? (
                  <a href={notFoundWa} class="btn btn-wa" target="_blank" rel="noopener">
                    <IconWhatsapp size={18} /> {C.emptyWhatsapp}
                  </a>
                ) : null}
              </div>
            </div>
          )}

          {data.result.pages > 1 ? (
            <nav class="mt-10 flex items-center justify-center gap-2" aria-label={C.page}>
              {data.result.page > 1 ? <a class="btn btn-ghost btn-sm" rel="prev" href={pageUrl(data.result.page - 1)}>{C.prev}</a> : null}
              {range(1, data.result.pages).map((p) => (
                <a
                  href={pageUrl(p)}
                  aria-current={p === data.result.page ? 'page' : undefined}
                  class={`num grid h-9 min-w-9 place-items-center rounded-full px-2 text-sm font-semibold ${p === data.result.page ? 'bg-petrol-900 text-paper' : 'hover:bg-stone-2'}`}
                >
                  {p}
                </a>
              ))}
              {data.result.page < data.result.pages ? <a class="btn btn-ghost btn-sm" rel="next" href={pageUrl(data.result.page + 1)}>{C.next}</a> : null}
            </nav>
          ) : null}
        </div>
      </div>
    </Layout>
  )
}

function range(a: number, b: number) {
  const out: number[] = []
  if (a <= b) for (let i = a; i <= b; i++) out.push(i)
  else for (let i = a; i >= b; i--) out.push(i)
  return out
}
