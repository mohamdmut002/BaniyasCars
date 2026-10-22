type P = { class?: string; size?: number }

const svg = (d: any, { class: c = '', size = 20 }: P, fill = false) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    width={size}
    height={size}
    class={c}
    fill={fill ? 'currentColor' : 'none'}
    stroke={fill ? 'none' : 'currentColor'}
    stroke-width="1.8"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
    focusable="false"
  >
    {d}
  </svg>
)

export const IconWhatsapp = (p: P) =>
  svg(
    <path d="M12.04 2a9.9 9.9 0 0 0-8.5 15l-1.4 5 5.1-1.3A9.9 9.9 0 1 0 12.04 2Zm0 18.1a8.2 8.2 0 0 1-4.2-1.15l-.3-.18-3.03.8.8-2.95-.2-.3a8.2 8.2 0 1 1 6.93 3.78Zm4.5-6.14c-.25-.12-1.46-.72-1.69-.8-.23-.08-.39-.12-.55.12-.16.25-.63.8-.78.96-.14.17-.29.19-.53.06a6.7 6.7 0 0 1-3.34-2.92c-.25-.43.25-.4.72-1.34.08-.16.04-.3-.02-.43-.06-.12-.55-1.33-.76-1.82-.2-.48-.4-.41-.55-.42h-.47a.9.9 0 0 0-.65.3 2.74 2.74 0 0 0-.86 2.04 4.76 4.76 0 0 0 1 2.53 10.9 10.9 0 0 0 4.17 3.68c1.55.67 2.16.73 2.94.61.47-.07 1.46-.6 1.66-1.17.2-.58.2-1.07.15-1.17-.06-.1-.22-.17-.47-.29Z" />,
    p,
    true,
  )
export const IconPhone = (p: P) =>
  svg(<path d="M5 4h3.5l1.7 4.2-2.2 1.4a11 11 0 0 0 6.4 6.4l1.4-2.2L20 15.5V19a1.8 1.8 0 0 1-2 1.8A16.5 16.5 0 0 1 3.2 6 1.8 1.8 0 0 1 5 4Z" />, p)
export const IconSearch = (p: P) => svg(<><circle cx="11" cy="11" r="6.5" /><path d="m20 20-4.2-4.2" /></>, p)
export const IconShare = (p: P) => svg(<><circle cx="18" cy="5.5" r="2.5" /><circle cx="6" cy="12" r="2.5" /><circle cx="18" cy="18.5" r="2.5" /><path d="m8.2 10.8 7.6-4.1M8.2 13.2l7.6 4.1" /></>, p)
export const IconChevron = (p: P & { dir?: 'start' | 'end' }) =>
  svg(<path d={p.dir === 'start' ? 'm15 6-6 6 6 6' : 'm9 6 6 6-6 6'} />, p)
export const IconFilter = (p: P) => svg(<path d="M4 6h16M7 12h10M10 18h4" />, p)
export const IconMap = (p: P) => svg(<><path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0C18.5 15.4 12 21 12 21Z" /><circle cx="12" cy="10" r="2.3" /></>, p)
export const IconMenu = (p: P) => svg(<path d="M4 7h16M4 12h16M4 17h16" />, p)
export const IconClose = (p: P) => svg(<path d="M6 6l12 12M18 6 6 18" />, p)
export const IconAlert = (p: P) => svg(<><path d="M12 4 2.8 19.5h18.4L12 4Z" /><path d="M12 10v4M12 17v.01" /></>, p)
export const IconLink = (p: P) => svg(<><path d="M10 14a4 4 0 0 0 5.66 0l3-3a4 4 0 0 0-5.66-5.66l-1 1" /><path d="M14 10a4 4 0 0 0-5.66 0l-3 3A4 4 0 0 0 11 18.66l1-1" /></>, p)
export const IconClock = (p: P) => svg(<><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></>, p)
export const IconMail = (p: P) => svg(<><rect x="3.5" y="5.5" width="17" height="13" rx="2" /><path d="m4 7 8 6 8-6" /></>, p)
export const IconPhoto = (p: P) => svg(<><rect x="3.5" y="4.5" width="17" height="15" rx="2" /><circle cx="9" cy="10" r="1.8" /><path d="m20 16-5-5-8 8" /></>, p)
export const IconInstagram = (p: P) => svg(<><rect x="3.5" y="3.5" width="17" height="17" rx="5" /><circle cx="12" cy="12" r="4" /><path d="M17.3 6.7v.01" /></>, p)
export const IconFacebook = (p: P) => svg(<path d="M14 21v-7.5h2.6l.4-3H14V8.6c0-.9.3-1.5 1.6-1.5H17V4.4A20 20 0 0 0 14.8 4.3c-2.3 0-3.8 1.4-3.8 3.9v2.3H8.5v3H11V21" />, p)
export const IconThreads = (p: P) =>
  svg(<path d="M16.6 11.2c-.2-2.6-1.8-3.9-4.3-3.9-1.6 0-2.9.7-3.6 1.9M7.4 15.6c.6 2.7 2.6 4.4 5.2 4.4 3.3 0 5.6-2.2 5.6-5.4 0-2.4-1.5-3.8-4.4-4.1-2.7-.3-4.3.8-4.3 2.5 0 1.4 1.2 2.4 2.9 2.4 2.4 0 3.6-1.8 3.5-5.3C15.8 5.7 14.1 4 11.6 4 8.1 4 5.8 6.9 5.8 12" />, p)
