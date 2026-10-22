// Admin enhancements: confirmation before destructive actions, and instant save for quick-change selects.

for (const form of document.querySelectorAll<HTMLFormElement>('form[data-confirm]')) {
  form.addEventListener('submit', (e) => {
    if (!window.confirm(form.dataset.confirm ?? 'متأكد؟')) e.preventDefault()
  })
}

for (const form of document.querySelectorAll<HTMLFormElement>('form[data-autosubmit]')) {
  form.addEventListener('change', (e) => {
    if ((e.target as Element).matches('select')) form.requestSubmit()
  })
}

// Warn before leaving the vehicle form with unsaved edits.
const vf = document.getElementById('vehicle-form') as HTMLFormElement | null
if (vf) {
  let dirty = false
  vf.addEventListener('input', () => (dirty = true))
  vf.addEventListener('submit', () => (dirty = false))
  window.addEventListener('beforeunload', (e) => {
    if (dirty) e.preventDefault()
  })
}

// Disable submit buttons while a form is sending, so uploads are not sent twice.
document.addEventListener('submit', (e) => {
  const form = e.target as HTMLFormElement
  if (e.defaultPrevented) return
  setTimeout(() => {
    for (const b of form.querySelectorAll<HTMLButtonElement>('button:not([type=button])')) {
      b.disabled = true
      b.setAttribute('aria-busy', 'true')
    }
  }, 0)
})

/*
 * Photo uploads: resize in the browser to WebP (1600 px + 640 px thumbnail) before sending.
 * Re-encoding through a canvas also drops EXIF data such as GPS location. Required on Cloudflare,
 * where the server has no image library; on Node the server re-processes the files anyway.
 */
async function encode(file: Blob, max: number, quality: number): Promise<Blob | null> {
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' } as ImageBitmapOptions)
    const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(bitmap.width * scale)
    canvas.height = Math.round(bitmap.height * scale)
    canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    bitmap.close()
    const toBlob = (type: string) => new Promise<Blob | null>((r) => canvas.toBlob(r, type, quality))
    const webp = await toBlob('image/webp')
    if (webp && webp.type === 'image/webp') return webp
    return await toBlob('image/jpeg') // older Safari cannot encode WebP
  } catch {
    return null // a format this browser cannot decode (e.g. HEIC outside Safari): send the original
  }
}

for (const form of document.querySelectorAll<HTMLFormElement>('form[data-resize-upload]')) {
  form.addEventListener('submit', async (e) => {
    const input = form.querySelector<HTMLInputElement>('input[type=file]')
    if (!input?.files?.length) return
    e.preventDefault()
    const button = form.querySelector<HTMLButtonElement>('button')
    const label = button?.textContent ?? ''
    const fd = new FormData()
    fd.set('_csrf', (form.querySelector<HTMLInputElement>('input[name=_csrf]')?.value) ?? '')
    const files = Array.from(input.files)
    for (const [i, file] of files.entries()) {
      if (button) button.textContent = `جارٍ تجهيز الصورة ${i + 1} من ${files.length}…`
      const large = await encode(file, 1600, 0.82)
      const small = large ? await encode(file, 640, 0.74) : null
      const ext = large?.type === 'image/webp' ? 'webp' : 'jpg'
      fd.append('photos', large ? new File([large], `photo-${i}.${ext}`, { type: large.type }) : file)
      fd.append('thumbs', small ? new File([small], `thumb-${i}.${ext}`, { type: small.type }) : new File([], ''))
    }
    if (button) button.textContent = 'جارٍ الرفع…'
    try {
      const res = await fetch(form.action, { method: 'POST', body: fd, credentials: 'same-origin' })
      window.location.assign(res.redirected ? res.url : form.action.replace(/\/images$/, '?m=' + (res.ok ? 'uploaded' : 'upload_error')))
    } catch {
      if (button) {
        button.textContent = label
        button.disabled = false
      }
      window.alert('تعذّر رفع الصور. تحقق من الاتصال وحاول مرة أخرى.')
    }
  })
}
