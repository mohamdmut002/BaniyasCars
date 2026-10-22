/**
 * Arabic display names for makes, models and colours stored in English.
 * Unknown values fall back to the stored text, so new makes added in the dashboard still display.
 */
const makes: Record<string, string> = {
  nissan: 'نيسان',
  toyota: 'تويوتا',
  lexus: 'لكزس',
  mg: 'إم جي',
  gmc: 'جي إم سي',
  jeep: 'جيب',
  renault: 'رينو',
  chevrolet: 'شيفروليه',
  mitsubishi: 'ميتسوبيشي',
  hyundai: 'هيونداي',
  kia: 'كيا',
  ford: 'فورد',
  honda: 'هوندا',
  mazda: 'مازدا',
  'land rover': 'لاند روفر',
  'mercedes-benz': 'مرسيدس بنز',
  bmw: 'بي إم دبليو',
}

const models: Record<string, string> = {
  patrol: 'باترول',
  'land cruiser': 'لاند كروزر',
  'land cruiser prado': 'لاند كروزر برادو',
  'land cruiser 70': 'لاند كروزر 70',
  camry: 'كامري',
  hilux: 'هايلكس',
  fortuner: 'فورتشنر',
  rav4: 'راف فور',
  'urban cruiser': 'أوربان كروزر',
  tundra: 'تندرا',
  'x-trail': 'إكس تريل',
  sunny: 'صني',
  magnite: 'ماجنايت',
  kicks: 'كيكس',
  altima: 'ألتيما',
  sierra: 'سييرا',
  captiva: 'كابتيفا',
  'grand cherokee': 'جراند شيروكي',
  arkana: 'أركانا',
  koleos: 'كوليوس',
  '3': '3',
  '5 (gt)': '5 GT',
  '8': '8',
  gt: 'GT',
}

const colors: Record<string, string> = {
  white: 'أبيض',
  black: 'أسود',
  grey: 'رمادي',
  gray: 'رمادي',
  silver: 'فضي',
  beige: 'بيج',
  tan: 'بيج فاتح',
  bronze: 'برونزي',
  red: 'أحمر',
  burgundy: 'عنابي',
  maroon: 'عنابي',
  brown: 'بني',
  orange: 'برتقالي',
  green: 'أخضر',
  blue: 'أزرق',
  gold: 'ذهبي',
  yellow: 'أصفر',
  pearl: 'لؤلؤي',
}

const key = (s: string) => s.trim().toLowerCase()

/** Normalises Arabic letter variants so "لاندكروزر", "لاند كروزر" and "لاندكروزر" match. */
export function normalizeArabic(s: string): string {
  return s
    .replace(/[إأآا]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/[ً-ْـ]/g, '')
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    .toLowerCase()
}

const reverse: [string, string][] = [...Object.entries(makes), ...Object.entries(models)]
  .filter(([en, ar]) => en !== ar)
  .map(([en, ar]) => [normalizeArabic(ar).replace(/\s+/g, ''), en] as [string, string])
  .sort((a, b) => b[0].length - a[0].length)

/**
 * Rewrites Arabic make/model words in a search query to their English stored names,
 * e.g. "باترول ٢٠٢٦" -> "patrol 2026", "لاند كروزر" -> "land cruiser".
 */
export function translateQuery(q: string): string {
  let s = normalizeArabic(q)
  for (const [ar, en] of reverse) {
    const spaced = ar.split('').join('\\s*')
    s = s.replace(new RegExp(spaced, 'g'), ` ${en} `)
  }
  return s.replace(/\s+/g, ' ').trim()
}

export function makeName(make: string, locale: 'ar' | 'en'): string {
  return locale === 'ar' ? (makes[key(make)] ?? make) : make
}

export function modelName(model: string, locale: 'ar' | 'en'): string {
  return locale === 'ar' ? (models[key(model)] ?? model) : model
}

export function colorName(color: string | null, locale: 'ar' | 'en'): string | null {
  if (!color) return null
  return locale === 'ar' ? (colors[key(color)] ?? color) : color
}

export function vehicleTitle(
  v: { make: string; model: string; trim: string | null; year: number },
  locale: 'ar' | 'en',
  opts: { withYear?: boolean; withTrim?: boolean } = {},
): string {
  const parts = [makeName(v.make, locale), modelName(v.model, locale)]
  if (opts.withTrim !== false && v.trim) parts.push(v.trim)
  if (opts.withYear !== false) parts.push(String(v.year))
  return parts.join(' ')
}
