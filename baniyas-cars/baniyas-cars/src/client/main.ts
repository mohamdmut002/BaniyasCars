// Progressive enhancement for the public site. Every feature here has a no-JS fallback in the HTML.

const $$ = <T extends Element>(sel: string, root: ParentNode = document) => Array.from(root.querySelectorAll<T>(sel))
const isRtl = document.documentElement.dir === 'rtl'
const announce = (text: string) => {
  const live = document.getElementById('live-region')
  if (live) live.textContent = text
}

/* Auto-submit filter and sort forms when a select or checkbox changes (desktop sidebar and sort only). */
for (const form of $$<HTMLFormElement>('form[data-autosubmit]')) {
  const inMobileSheet = !!form.closest('details[data-filters]')
  form.addEventListener('change', (e) => {
    const el = e.target as HTMLInputElement
    if (inMobileSheet) return // On phones people pick several filters, then press "Apply".
    if (el.matches('select, input[type=checkbox], input[type=radio]')) form.requestSubmit()
  })
  // Drop empty fields so URLs stay short and shareable.
  form.addEventListener('submit', () => {
    for (const el of $$<HTMLInputElement | HTMLSelectElement>('input[name], select[name]', form)) {
      if (el.value === '' && !(el instanceof HTMLInputElement && (el.type === 'checkbox' || el.type === 'radio'))) el.disabled = true
      if (el instanceof HTMLInputElement && el.type === 'radio' && el.checked && el.value === '') el.disabled = true
    }
  })
}

/* Close buttons inside <details> sheets, and click-outside for the header menu. */
document.addEventListener('click', (e) => {
  const target = e.target as Element
  const closer = target.closest('[data-close-details]')
  if (closer) closer.closest('details')?.removeAttribute('open')
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
    track.scrollTo({ left: slide.offsetLeft - track.offsetLeft, behavior: smooth ? 'smooth' : 'auto' })
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
