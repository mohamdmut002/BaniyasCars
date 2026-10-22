/** Latin, lowercase, hyphenated slug. Vehicle slugs end with a short unique suffix so two identical cars never collide. */
export function slugify(input: string): string {
  return input
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\+/g, ' plus ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
}

export function vehicleSlug(v: { make: string; model: string; trim?: string | null; year: number }, suffix: string): string {
  const base = slugify([v.make, v.model, v.trim ?? '', String(v.year)].join(' '))
  const tail = slugify(suffix).slice(0, 12)
  return `${base}-${tail}`.replace(/-+/g, '-')
}
