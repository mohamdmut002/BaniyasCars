// Browser script for the public site: inventory filtering, gallery, menus and share.
import { applyFilters, emptyFilters, parseFilters, toParams, type CarIndex, type Filters } from '../lib/filter.js'

const $$ = <T extends Element>(sel: string, root: ParentNode = document) => Array.from(root.querySelectorAll<T>(sel))
const isRtl = document.documentElement.dir === 'rtl'
const announce = (text: string) => {
  const live = document.getElementById('live-region')
  if (live) live.textContent = text
}

/* Inventory: search, filters and sorting run here, on the index the build embedded in the page. */
initInventory()

function initInventory() {
  const indexEl = document.getElementById('inv-index')
  const form = document.querySelector<HTMLFormElement>('[data-filters-form]')
  const grid = document.querySelector<HTMLUListElement>('[data-grid]')
  if (!indexEl || !form || !grid) return
  const index = JSON.parse(indexEl.textContent || '[]') as CarIndex[]
  const labels = JSON.parse(document.getElementById('inv-labels')?.textContent || '{}')
  const ar = document.documentElement.lang === 'ar'
  const items = new Map($$<HTMLLIElement>('li[data-slug]', grid).map((li) => [li.dataset.slug!, li]))
  const searchForm = document.querySelector<HTMLFormElement>('[data-search-form]')!
  const searchInput = searchForm.querySelector<HTMLInputElement>('input[name=q]')!
  const sortSelect = document.querySelector<HTMLSelectElement>('[data-sort]')!
  const modelSelect = form.querySelector<HTMLSelectElement>('select[name=model]')!
  const makeSelect = form.querySelector<HTMLSelectElement>('select[name=make]')!
  const panel = document.querySelector<HTMLElement>('[data-filters-panel]')!
  const toggle = document.querySelector<HTMLButtonElement>('[data-filters-toggle]')!
  const countEl = document.querySelector<HTMLElement>('[data-count]')!
  const chipsEl = document.querySelector<HTMLUListElement>('[data-chips]')!
  const emptyEl = document.querySelector<HTMLElement>('[data-empty]')!
  const filterCount = document.querySelector<HTMLElement>('[data-filter-count]')!
  const askLink = document.querySelector<HTMLAnchorElement>('[data-empty-ask]')

  let state: Filters = parseFilters(new URLSearchParams(location.search))

  const results = (n: number) =>
    ar ? (n === 0 ? 'لا توجد نتائج' : n === 1 ? 'سيارة واحدة' : n === 2 ? 'سيارتان' : n <= 10 ? `${n} سيارات` : `${n} سيارة`) : n === 1 ? '1 car' : `${n} cars`
  const fmt = (n: number) => n.toLocaleString('en-US')

  /** Show only the models of the selected make. */
  function syncModels() {
    const make = makeSelect.value
    for (const opt of Array.from(modelSelect.options)) {
      if (!opt.value) continue
      opt.hidden = !!make && opt.dataset.make !== make
    }
    if (modelSelect.selectedOptions[0]?.hidden) modelSelect.value = ''
  }

  /** Put the state into the form controls (on load and after removing a chip). */
  function writeForm() {
    makeSelect.value = state.make
    syncModels()
    modelSelect.value = state.model
    ;(form!.elements.namedItem('year_min') as HTMLSelectElement).value = state.yearMin != null ? String(state.yearMin) : ''
    ;(form!.elements.namedItem('year_max') as HTMLSelectElement).value = state.yearMax != null ? String(state.yearMax) : ''
    ;(form!.elements.namedItem('price_min') as HTMLInputElement).value = state.priceMin != null ? String(state.priceMin) : ''
    ;(form!.elements.namedItem('price_max') as HTMLInputElement).value = state.priceMax != null ? String(state.priceMax) : ''
    ;(form!.elements.namedItem('mileage_max') as HTMLSelectElement).value = state.mileageMax != null ? String(state.mileageMax) : ''
    for (const r of $$<HTMLInputElement>('input[name=condition]', form!)) r.checked = r.value === state.condition
    for (const c of $$<HTMLInputElement>('input[name=transmission]', form!)) c.checked = state.transmission.includes(c.value)
    for (const c of $$<HTMLInputElement>('input[name=fuel]', form!)) c.checked = state.fuel.includes(c.value)
    ;(form!.elements.namedItem('gcc') as HTMLInputElement).checked = state.gcc
    ;(form!.elements.namedItem('hide_export') as HTMLInputElement).checked = state.hideExport
    searchInput.value = state.q
    sortSelect.value = state.sort
  }

  /** Read the form controls into the state. */
  function readForm() {
    const params = new URLSearchParams(new FormData(form!) as unknown as Record<string, string>)
    if (state.q) params.set('q', state.q)
    params.set('sort', sortSelect.value)
    state = parseFilters(params)
  }

  function chips() {
    const list: { label: string; clear: () => void }[] = []
    const s = state
    if (s.q) list.push({ label: `“${s.q}”`, clear: () => (state.q = '') })
    if (s.make) list.push({ label: labels.make[s.make] ?? s.make, clear: () => ((state.make = ''), (state.model = '')) })
    if (s.model) list.push({ label: labels.model[s.model] ?? s.model, clear: () => (state.model = '') })
    if (s.yearMin != null) list.push({ label: `${labels.yearFrom} ${s.yearMin}`, clear: () => (state.yearMin = null) })
    if (s.yearMax != null) list.push({ label: `${labels.yearTo} ${s.yearMax}`, clear: () => (state.yearMax = null) })
    if (s.priceMin != null) list.push({ label: `${labels.priceMin}: ${fmt(s.priceMin)}`, clear: () => (state.priceMin = null) })
    if (s.priceMax != null) list.push({ label: `${labels.priceMax}: ${fmt(s.priceMax)}`, clear: () => (state.priceMax = null) })
    if (s.mileageMax != null) list.push({ label: `≤ ${fmt(s.mileageMax)} ${labels.km}`, clear: () => (state.mileageMax = null) })
    for (const t of s.transmission) list.push({ label: labels.transmission[t] ?? t, clear: () => (state.transmission = state.transmission.filter((x) => x !== t)) })
    for (const f of s.fuel) list.push({ label: labels.fuel[f] ?? f, clear: () => (state.fuel = state.fuel.filter((x) => x !== f)) })
    if (s.condition) list.push({ label: labels.condition[s.condition], clear: () => (state.condition = '') })
    if (s.gcc) list.push({ label: labels.gcc, clear: () => (state.gcc = false) })
    if (s.hideExport) list.push({ label: labels.hideExport, clear: () => (state.hideExport = false) })
    return list
  }

  let lastKey: string | null = null
  function render({ push = false } = {}) {
    // Skip identical renders (e.g. a "change" event fired by blurring an input), so the chip being
    // clicked is not replaced under the pointer.
    const key = toParams(state).toString()
    if (key === lastKey) return
    lastKey = key
    const shown = applyFilters(index, state)
    const visible = new Set(shown.map((c) => c.s))
    // Reorder the existing cards (keeps images already loaded) and hide the rest.
    for (const c of shown) grid!.appendChild(items.get(c.s)!)
    for (const [slug, li] of items) {
      li.hidden = !visible.has(slug)
      li.classList.remove('hidden') // drop the build-time "first cards only on phones" limit
    }
    grid!.hidden = shown.length === 0
    emptyEl.hidden = shown.length > 0
    countEl.textContent = results(shown.length)

    const active = chips()
    chipsEl.replaceChildren(
      ...active.map((chip) => {
        const li = document.createElement('li')
        const b = document.createElement('button')
        b.type = 'button'
        b.className = 'inline-flex items-center gap-1.5 rounded-full bg-navy-100 px-3 py-1.5 text-sm font-semibold hover:bg-stone-2'
        b.textContent = chip.label + ' ×'
        b.setAttribute('aria-label', `${labels.remove}: ${chip.label}`)
        b.addEventListener('click', () => {
          chip.clear()
          writeForm()
          render({ push: true })
        })
        li.append(b)
        return li
      }),
    )
    filterCount.textContent = active.length ? String(active.length) : ''
    filterCount.classList.toggle('hidden', !active.length)
    if (askLink && askLink.href.includes('wa.me') && state.q) {
      const u = new URL(askLink.href)
      u.searchParams.set('text', (ar ? 'السلام عليكم، أبحث عن سيارة غير معروضة على الموقع: ' : 'Hello, I am looking for a car that is not listed on the website: ') + state.q)
      askLink.href = u.toString()
    }

    const qs = key
    const url = `${location.pathname}${qs ? `?${qs}` : ''}`
    if (url !== location.pathname + location.search) history[push ? 'pushState' : 'replaceState'](null, '', url)
    // Keep the language switch on the same filters.
    for (const a of $$<HTMLAnchorElement>('[data-lang-switch]')) a.search = qs ? `?${qs}` : ''
    announce(results(shown.length))
  }

  let typing: number | undefined
  form.addEventListener('change', () => {
    readForm()
    if (form!.contains(document.activeElement) && document.activeElement?.matches('select[name=make]')) syncModels()
    render()
  })
  form.addEventListener('input', (e) => {
    if (!(e.target as Element).matches('input[name^=price]')) return
    clearTimeout(typing)
    typing = window.setTimeout(() => {
      readForm()
      render()
    }, 350)
  })
  makeSelect.addEventListener('change', () => {
    syncModels()
    readForm()
    render()
  })
  form.addEventListener('submit', (e) => {
    e.preventDefault()
    readForm()
    render({ push: true })
    closePanel()
  })
  for (const b of $$<HTMLElement>('[data-filters-reset]')) {
    b.addEventListener('click', (e) => {
      e.preventDefault()
      state = { ...emptyFilters(), sort: state.sort }
      writeForm()
      render({ push: true })
    })
  }
  sortSelect.addEventListener('change', () => {
    state.sort = sortSelect.value as Filters['sort']
    render()
  })
  searchForm.addEventListener('submit', (e) => {
    e.preventDefault()
    state.q = searchInput.value.trim().slice(0, 80)
    render({ push: true })
  })
  searchInput.addEventListener('search', () => {
    if (!searchInput.value && state.q) {
      state.q = ''
      render()
    }
  })

  function openPanel() {
    panel!.dataset.open = 'true'
    toggle!.setAttribute('aria-expanded', 'true')
    document.body.style.overflow = 'hidden'
  }
  function closePanel() {
    delete panel!.dataset.open
    toggle!.setAttribute('aria-expanded', 'false')
    document.body.style.overflow = ''
  }
  toggle.addEventListener('click', openPanel)
  for (const b of $$<HTMLElement>('[data-filters-close]')) b.addEventListener('click', (e) => {
    if ((b as HTMLButtonElement).type !== 'submit') e.preventDefault()
    closePanel()
  })
  document.addEventListener('keydown', (e) => e.key === 'Escape' && panel!.dataset.open && closePanel())

  window.addEventListener('popstate', () => {
    state = parseFilters(new URLSearchParams(location.search))
    writeForm()
    render()
  })

  writeForm()
  render()
}

/* Close buttons inside <details> sheets, and click-outside for the header menu. */
document.addEventListener('click', (e) => {
  const target = e.target as Element
  for (const d of $$<HTMLDetailsElement>('details[data-menu][open]')) if (!d.contains(target)) d.removeAttribute('open')
})
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') for (const d of $$<HTMLDetailsElement>('details[open]')) d.removeAttribute('open')
})

/* Vehicle gallery: scroll-snap track with buttons, thumbnails, keyboard, counter and a lightbox. */
for (const g of $$<HTMLElement>('[data-gallery]')) {
  const track = g.querySelector<HTMLElement>('[data-track-list]')!
  const slides = $$<HTMLElement>('li', track)
  const thumbs = $$<HTMLButtonElement>('[data-thumb]', g)
  const counter = g.querySelector<HTMLElement>('[data-counter]')
  let index = 0
  const go = (i: number, smooth = true) => {
    index = (i + slides.length) % slides.length
    const slide = slides[index]!
    // Measure on screen so it works the same in RTL and LTR (browsers disagree on RTL scrollLeft).
    const delta = slide.getBoundingClientRect().left - track.getBoundingClientRect().left
    track.scrollBy({ left: delta, behavior: smooth ? 'smooth' : 'auto' })
  }
  const sync = () => {
    // In RTL, scrollLeft is negative or reversed depending on the browser; use the slide closest to the viewport centre.
    const mid = track.getBoundingClientRect().left + track.clientWidth / 2
    let best = 0
    let bestDist = Infinity
    slides.forEach((s, i) => {
      const r = s.getBoundingClientRect()
      const d = Math.abs(r.left + r.width / 2 - mid)
      if (d < bestDist) {
        bestDist = d
        best = i
      }
    })
    index = best
    if (counter) counter.textContent = `${index + 1} / ${slides.length}`
    thumbs.forEach((t, i) => t.setAttribute('aria-current', i === index ? 'true' : 'false'))
    thumbs[index]?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  }
  let raf = 0
  track.addEventListener('scroll', () => {
    cancelAnimationFrame(raf)
    raf = requestAnimationFrame(sync)
  })
  g.querySelector('[data-prev]')?.addEventListener('click', () => go(index - 1))
  g.querySelector('[data-next]')?.addEventListener('click', () => go(index + 1))
  thumbs.forEach((t, i) => t.addEventListener('click', () => go(i)))
  track.addEventListener('keydown', (e) => {
    const fwd = isRtl ? 'ArrowLeft' : 'ArrowRight'
    const back = isRtl ? 'ArrowRight' : 'ArrowLeft'
    if (e.key === fwd) (e.preventDefault(), go(index + 1))
    if (e.key === back) (e.preventDefault(), go(index - 1))
  })

  const dialog = g.querySelector<HTMLDialogElement>('[data-lightbox]')
  const big = g.querySelector<HTMLImageElement>('[data-lightbox-img]')
  if (dialog && big && typeof dialog.showModal === 'function') {
    for (const b of $$<HTMLButtonElement>('[data-open]', g)) {
      b.addEventListener('click', () => {
        const img = b.querySelector('img')!
        big.src = img.currentSrc || img.src
        big.alt = img.alt
        dialog.showModal()
      })
    }
    dialog.querySelector('[data-close]')?.addEventListener('click', () => dialog.close())
    dialog.addEventListener('click', (e) => {
      if (e.target === dialog || e.target === big) dialog.close()
    })
  }
}

/* Share: native sheet on phones, copy link elsewhere. */
for (const b of $$<HTMLButtonElement>('[data-share]')) {
  b.addEventListener('click', async () => {
    const url = b.dataset.url ?? location.href
    const title = b.dataset.title ?? document.title
    if (navigator.share) {
      try {
        await navigator.share({ title, url })
      } catch {
        /* dismissed */
      }
      return
    }
    try {
      await navigator.clipboard.writeText(url)
      const original = b.innerHTML
      b.textContent = b.dataset.copied ?? 'Copied'
      announce(b.dataset.copied ?? 'Copied')
      setTimeout(() => (b.innerHTML = original), 2000)
    } catch {
      window.prompt('', url)
    }
  })
}
