import { raw } from '@jsx/jsx-runtime'
import type { Vehicle } from '../../data/types.js'
import { FUELS, TRANSMISSIONS } from '../../data/types.js'
import { SORTS, toIndex } from '../../lib/filter.js'
import { t } from '../../i18n/index.js'
import { makeName, modelName } from '../../domain/names.js'
import { formatNumber } from '../../lib/format.js'
import { Layout, contactTarget } from '../layout.js'
import { href, type PageCtx } from '../ctx.js'
import { VehicleGrid } from '../components.js'
import { IconFilter, IconSearch, IconWhatsapp, IconClose } from '../icons.js'

const json = (v: unknown) => raw(JSON.stringify(v).replace(/</g, '\\u003c'))

export function InventoryPage({ ctx, cars }: { ctx: PageCtx; cars: Vehicle[] }) {
  const L = t(ctx.locale)
  const C = L.cars
  const ar = ctx.locale === 'ar'
  const makes = [...new Map(cars.map((v) => [v.make, cars.filter((x) => x.make === v.make).length])).entries()].sort((a, b) => b[1] - a[1])
  const models = [...new Set(cars.map((v) => `${v.make}\u0000${v.model}`))].map((k) => k.split('\u0000') as [string, string]).sort((a, b) => a[1].localeCompare(b[1]))
  const years = cars.map((v) => v.year)
  const yearRange: number[] = []
  for (let y = Math.max(...years); y >= Math.min(...years); y--) yearRange.push(y)
  const ask = contactTarget(ctx.locale, L.whatsappSearch)

  // Labels the browser script needs to describe active filters.
  const labels = {
    make: Object.fromEntries(makes.map(([m]) => [m, makeName(m, ctx.locale)])),
    model: Object.fromEntries(models.map(([, m]) => [m, modelName(m, ctx.locale)])),
    transmission: L.enums.transmission,
    fuel: L.enums.fuel,
    condition: L.enums.condition,
    gcc: C.gccOnly,
    hideExport: C.hideExport,
    yearFrom: C.yearFrom,
    yearTo: C.yearTo,
    priceMin: C.priceMin,
    priceMax: C.priceMax,
    km: L.km,
    remove: ar ? 'إزالة' : 'remove',
  }

  return (
    <Layout
      ctx={ctx}
      meta={{
        title: ar ? 'سيارات للبيع في أبوظبي ودبي | معرض بني ياس للسيارات' : 'Cars for sale in Abu Dhabi and Dubai | Baniyas Cars',
        description: C.description,
      }}
    >
      <div class="bg-navy-900 text-paper">
        <div class="wrap pb-8 pt-9">
          <p class="eyebrow text-gold">{ar ? 'المخزون' : 'Inventory'}</p>
          <h1 class="h-display mt-3 text-3xl sm:text-4xl">{C.title}</h1>
          <form class="mt-6 flex max-w-2xl gap-2" role="search" action={href(ctx.locale, '/cars/')} data-search-form>
            <label for="inv-q" class="sr-only">{C.search}</label>
            <div class="flex min-w-0 flex-1 items-center gap-2 rounded-full bg-paper px-4 focus-within:ring-2 focus-within:ring-gold">
              <IconSearch class="shrink-0 text-muted" />
              <input id="inv-q" name="q" type="search" placeholder={L.home.searchPlaceholder} autocomplete="off" class="min-w-0 flex-1 bg-transparent py-3 text-navy-900 outline-none" />
            </div>
            <button class="btn btn-gold">{C.search}</button>
          </form>
        </div>
      </div>

      <div class="wrap grid gap-8 pt-8 lg:grid-cols-[270px_minmax(0,1fr)]">
        <aside
          aria-label={C.filters}
          data-filters-panel
          class="hidden data-[open=true]:fixed data-[open=true]:inset-0 data-[open=true]:z-40 data-[open=true]:block data-[open=true]:overflow-y-auto data-[open=true]:bg-paper data-[open=true]:p-5 lg:block lg:data-[open=true]:static lg:data-[open=true]:bg-transparent lg:data-[open=true]:p-0"
        >
          <div class="rounded-[var(--radius-card)] border border-line bg-paper p-5 lg:sticky lg:top-24">
            <div class="mb-4 flex items-center justify-between">
              <h2 class="font-bold">{C.filters}</h2>
              <button type="button" class="grid h-10 w-10 place-items-center rounded-full hover:bg-stone lg:hidden" data-filters-close aria-label={L.nav.close}>
                <IconClose />
              </button>
            </div>
            <form class="space-y-5" data-filters-form>
              <div>
                <label class="label" for="f-make">{C.make}</label>
                <select id="f-make" name="make" class="field">
                  <option value="">{C.any}</option>
                  {makes.map(([m, n]) => <option value={m}>{makeName(m, ctx.locale)} ({n})</option>)}
                </select>
              </div>
              <div>
                <label class="label" for="f-model">{C.model}</label>
                <select id="f-model" name="model" class="field">
                  <option value="">{C.any}</option>
                  {models.map(([mk, md]) => <option value={md} data-make={mk}>{modelName(md, ctx.locale)}</option>)}
                </select>
              </div>
              <fieldset class="grid grid-cols-2 gap-2">
                <legend class="label">{L.spec.year}</legend>
                <label class="sr-only" for="f-ymin">{C.yearFrom}</label>
                <select id="f-ymin" name="year_min" class="field">
                  <option value="">{C.yearFrom}</option>
                  {yearRange.map((y) => <option value={y}>{y}</option>)}
                </select>
                <label class="sr-only" for="f-ymax">{C.yearTo}</label>
                <select id="f-ymax" name="year_max" class="field">
                  <option value="">{C.yearTo}</option>
                  {yearRange.map((y) => <option value={y}>{y}</option>)}
                </select>
              </fieldset>
              <fieldset class="grid grid-cols-2 gap-2">
                <legend class="label">{L.spec.price} ({ar ? 'درهم' : 'AED'})</legend>
                <label class="sr-only" for="f-pmin">{C.priceMin}</label>
                <input id="f-pmin" name="price_min" inputmode="numeric" class="field num w-full" placeholder={C.priceMin} />
                <label class="sr-only" for="f-pmax">{C.priceMax}</label>
                <input id="f-pmax" name="price_max" inputmode="numeric" class="field num w-full" placeholder={C.priceMax} />
              </fieldset>
              <div>
                <label class="label" for="f-km">{C.mileageMax}</label>
                <select id="f-km" name="mileage_max" class="field">
                  <option value="">{C.any}</option>
                  {[0, 10000, 50000, 100000, 150000, 200000].map((k) => (
                    <option value={k}>{k === 0 ? (ar ? 'جديدة (صفر كم)' : 'New (0 km)') : `≤ ${formatNumber(k)}`}</option>
                  ))}
                </select>
              </div>
              <fieldset>
                <legend class="label">{C.condition}</legend>
                <div class="flex gap-2">
                  {(['', 'new', 'used'] as const).map((c) => (
                    <label class="flex-1 cursor-pointer">
                      <input type="radio" name="condition" value={c} checked={c === ''} class="peer sr-only" />
                      <span class="block rounded-lg border border-line bg-paper px-2 py-2 text-center text-sm font-semibold peer-checked:border-navy-900 peer-checked:bg-navy-900 peer-checked:text-paper peer-focus-visible:outline-2 peer-focus-visible:outline-gold">
                        {c ? L.enums.condition[c] : C.any}
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>
              <fieldset>
                <legend class="label">{C.transmission}</legend>
                <div class="space-y-1.5">
                  {TRANSMISSIONS.filter((tr) => cars.some((v) => v.transmission === tr)).map((tr) => (
                    <label class="flex items-center gap-2.5 text-sm">
                      <input type="checkbox" name="transmission" value={tr} class="h-4 w-4 accent-navy-900" />
                      {L.enums.transmission[tr]}
                    </label>
                  ))}
                </div>
              </fieldset>
              <fieldset>
                <legend class="label">{C.fuel}</legend>
                <div class="space-y-1.5">
                  {FUELS.filter((fu) => cars.some((v) => v.fuel === fu)).map((fu) => (
                    <label class="flex items-center gap-2.5 text-sm">
                      <input type="checkbox" name="fuel" value={fu} class="h-4 w-4 accent-navy-900" />
                      {L.enums.fuel[fu]}
                    </label>
                  ))}
                </div>
              </fieldset>
              <fieldset class="space-y-1.5 border-t border-line pt-4">
                <legend class="sr-only">{C.spec}</legend>
                <label class="flex items-center gap-2.5 text-sm">
                  <input type="checkbox" name="gcc" value="1" class="h-4 w-4 accent-navy-900" />
                  {C.gccOnly}
                </label>
                <label class="flex items-center gap-2.5 text-sm">
                  <input type="checkbox" name="hide_export" value="1" class="h-4 w-4 accent-navy-900" />
                  {C.hideExport}
                </label>
              </fieldset>
              <div class="flex gap-2 pt-1">
                <button type="submit" class="btn btn-primary flex-1 lg:hidden" data-filters-close>{C.apply}</button>
                <button type="reset" class="btn btn-ghost flex-1" data-filters-reset>{C.reset}</button>
              </div>
            </form>
          </div>
        </aside>

        <div>
          <div class="mb-5 flex flex-wrap items-center justify-between gap-3">
            <p class="font-semibold" role="status" data-count>{C.results(cars.length)}</p>
            <div class="flex flex-wrap items-center gap-2">
              <button type="button" class="btn btn-ghost btn-sm lg:hidden" data-filters-toggle aria-expanded="false">
                <IconFilter size={18} /> {C.showFilters}
                <span class="num hidden rounded-full bg-navy-900 px-2 text-xs text-paper" data-filter-count></span>
              </button>
              <label for="sort" class="sr-only text-sm text-muted sm:not-sr-only">{C.sort}</label>
              <select id="sort" name="sort" class="field w-auto py-2 text-sm" data-sort>
                {SORTS.map((s) => <option value={s}>{C.sortOptions[s]}</option>)}
              </select>
            </div>
          </div>

          <ul class="mb-5 flex flex-wrap gap-2 empty:hidden" aria-label={C.filters} data-chips></ul>

          <VehicleGrid items={cars} ctx={ctx} eagerCount={4} />

          <div hidden data-empty class="rounded-[var(--radius-card)] border border-dashed border-line bg-paper px-6 py-14 text-center">
            <h2 class="text-xl font-bold">{C.emptyTitle}</h2>
            <p class="mx-auto mt-3 max-w-[48ch] leading-7 text-navy-800">{C.emptyBody}</p>
            <div class="mt-6 flex flex-wrap justify-center gap-3">
              <button type="button" class="btn btn-ghost" data-filters-reset>{C.reset}</button>
              <a href={ask.url} class={`btn ${ask.external ? 'btn-wa' : 'btn-primary'}`} target={ask.external ? '_blank' : undefined} rel={ask.external ? 'noopener' : undefined} data-empty-ask>
                {ask.external ? <IconWhatsapp size={18} /> : null} {C.emptyWhatsapp}
              </a>
            </div>
          </div>
        </div>
      </div>

      <script type="application/json" id="inv-index">{json(cars.map(toIndex))}</script>
      <script type="application/json" id="inv-labels">{json(labels)}</script>
    </Layout>
  )
}
