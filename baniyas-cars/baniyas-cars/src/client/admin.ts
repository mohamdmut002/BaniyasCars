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
