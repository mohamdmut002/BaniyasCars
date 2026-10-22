import type { Vehicle } from '../data/types.js'
import { colorName, vehicleTitle } from '../domain/names.js'
import { formatNumber } from './format.js'

type Facts = Pick<
  Vehicle,
  | 'make' | 'model' | 'trim' | 'year' | 'price_aed' | 'price_includes_vat' | 'mileage_km' | 'condition' | 'transmission'
  | 'gears' | 'fuel' | 'engine_l' | 'horsepower' | 'drivetrain' | 'body_type' | 'exterior_color' | 'regional_spec'
  | 'export_only' | 'warranty_ar' | 'warranty_en'
>

/**
 * Writes a short, plain-language description from verified fields only.
 * It explains what technical terms mean, and never claims condition, history or extras that are not in the data.
 */
export function describeAr(v: Facts): string {
  const name = vehicleTitle(v, 'ar', { withYear: false })
  const s: string[] = []

  let first = `${name} موديل ${v.year}`
  const color = colorName(v.exterior_color, 'ar')
  if (v.condition === 'new' && v.mileage_km === 0) first += '، سيارة جديدة بممشى صفر كيلومتر'
  else if (v.condition === 'new') first += '، سيارة جديدة'
  else if (v.condition === 'used' && v.mileage_km != null) first += `، مستعملة بممشى ${formatNumber(v.mileage_km)} كيلومتر`
  else if (v.condition === 'used') first += '، مستعملة'
  if (v.price_aed != null) first += `، معروضة بسعر ${formatNumber(v.price_aed)} درهم${v.price_includes_vat ? ' شامل الضريبة' : ''}`
  s.push(first + '.')
  if (color) s.push(`لونها الخارجي ${color}.`)

  const engine: string[] = []
  if (v.engine_l) engine.push(`محرك ${fuelAr(v.fuel) ?? ''} سعة ${Number(v.engine_l)} لتر`.replace('  ', ' '))
  else if (v.fuel) engine.push(`محرك ${fuelAr(v.fuel)}`)
  if (v.horsepower) engine.push(`بقوة ${v.horsepower} حصاناً`)
  if (engine.length) s.push(`تعمل السيارة ب${engine.join(' ')}.`)

  if (v.transmission) s.push(transmissionAr(v.transmission, v.gears))
  if (v.drivetrain) s.push(drivetrainAr(v.drivetrain))
  if (v.fuel === 'hybrid') s.push('نظام الهايبرد يجمع بين محرك البنزين ومحرك كهربائي يساعده، فيقل استهلاك الوقود خاصة داخل المدينة.')
  if (v.fuel === 'plugin_hybrid') s.push('هذه السيارة هايبرد قابلة للشحن: يمكن شحن بطاريتها من الكهرباء والقيادة بها لمسافات قصيرة دون استهلاك البنزين.')
  if (v.fuel === 'diesel') s.push('محركات الديزل تعطي عزماً عالياً عند السرعات المنخفضة، وهذا مفيد عند حمل الأوزان أو القطر.')
  if (v.condition === 'used') s.push('بما أن السيارة مستعملة، ننصح بطلب سجل الصيانة وفحص السيارة قبل الشراء.')
  if (v.regional_spec === 'gcc') s.push('المواصفات خليجية، أي أنها مجهزة لأسواق ومناخ دول الخليج.')
  if (v.warranty_ar) s.push(`الضمان حسب الإعلان: ${v.warranty_ar}.`)
  if (v.export_only) s.push('ملاحظة: الإعلان الأصلي يعرض هذه السيارة للتصدير فقط.')
  return s.join(' ')
}

export function describeEn(v: Facts): string {
  const name = vehicleTitle(v, 'en', { withYear: false })
  const s: string[] = []
  const color = v.exterior_color ? `${v.exterior_color.toLowerCase()} ` : ''
  let first = `This is a ${color}${v.year} ${name}`
  if (v.condition === 'new' && v.mileage_km === 0) first += ', brand new with zero kilometres'
  else if (v.condition === 'new') first += ', brand new'
  else if (v.condition === 'used' && v.mileage_km != null) first += `, used, with ${formatNumber(v.mileage_km)} km on the odometer`
  else if (v.condition === 'used') first += ', used'
  if (v.price_aed != null) first += `, listed at AED ${formatNumber(v.price_aed)}${v.price_includes_vat ? ' including VAT' : ''}`
  s.push(first + '.')

  const engine: string[] = []
  if (v.engine_l) engine.push(`a ${Number(v.engine_l)}-litre ${v.fuel ? fuelEn(v.fuel) + ' ' : ''}engine`)
  else if (v.fuel) engine.push(`a ${fuelEn(v.fuel)} engine`)
  if (engine.length) s.push(`It has ${engine[0]}${v.horsepower ? ` producing ${v.horsepower} hp` : ''}.`)
  if (v.transmission) s.push(transmissionEn(v.transmission, v.gears))
  if (v.drivetrain) s.push(drivetrainEn(v.drivetrain))
  if (v.fuel === 'hybrid') s.push('The hybrid system pairs the petrol engine with an electric motor, which lowers fuel use, especially in city traffic.')
  if (v.fuel === 'plugin_hybrid') s.push('As a plug-in hybrid, its battery can be charged from the mains and used for short trips without burning petrol.')
  if (v.fuel === 'diesel') s.push('Diesel engines deliver strong pulling power at low speeds, which helps when carrying loads or towing.')
  if (v.condition === 'used') s.push('As this is a used car, we recommend asking for the service history and an inspection before buying.')
  if (v.regional_spec === 'gcc') s.push('It is a GCC-spec car, built for Gulf markets and climate.')
  if (v.warranty_en) s.push(`Warranty stated in the listing: ${v.warranty_en}.`)
  if (v.export_only) s.push('Note: the original listing offers this car for export only.')
  return s.join(' ')
}

function fuelAr(f: Facts['fuel']): string | null {
  return f === 'petrol' ? 'بنزين' : f === 'diesel' ? 'ديزل' : f === 'hybrid' ? 'هايبرد' : f === 'plugin_hybrid' ? 'هايبرد' : f === 'electric' ? 'كهربائي' : null
}
function fuelEn(f: NonNullable<Facts['fuel']>): string {
  return f === 'plugin_hybrid' ? 'plug-in hybrid' : f
}

function transmissionAr(tr: NonNullable<Facts['transmission']>, gears: number | null): string {
  const g = gears ? ` بـ${gears} سرعات` : ''
  switch (tr) {
    case 'automatic':
      return `ناقل الحركة أوتوماتيكي${g}، فلا حاجة لتبديل السرعات يدوياً.`
    case 'cvt':
      return 'ناقل الحركة أوتوماتيكي من نوع CVT، يغيّر نسب السرعة بشكل متواصل فتكون القيادة سلسة بلا نقلات محسوسة.'
    case 'amt':
      return 'ناقل الحركة من نوع AMT، وهو قير عادي يُبدَّل آلياً، فلا توجد دواسة كلتش.'
    case 'dct':
      return `ناقل الحركة أوتوماتيكي مزدوج القابض (DCT)${g}، ويتميز بنقلات سريعة.`
    case 'manual':
      return `ناقل الحركة يدوي (عادي)${g}، ويحتاج السائق إلى استخدام دواسة الكلتش.`
  }
}
function transmissionEn(tr: NonNullable<Facts['transmission']>, gears: number | null): string {
  const g = gears ? `${gears}-speed ` : ''
  switch (tr) {
    case 'automatic':
      return `It has a ${g}automatic gearbox, so there is no shifting to do.`
    case 'cvt':
      return 'It uses a CVT automatic, which changes ratios continuously for smooth driving without noticeable gear shifts.'
    case 'amt':
      return 'It uses an AMT gearbox: a manual gearbox shifted automatically, so there is no clutch pedal.'
    case 'dct':
      return `It has a ${g}dual-clutch automatic (DCT) known for quick shifts.`
    case 'manual':
      return `It has a ${g}manual gearbox with a clutch pedal.`
  }
}

function drivetrainAr(d: NonNullable<Facts['drivetrain']>): string {
  switch (d) {
    case 'fwd':
      return 'الدفع أمامي، أي أن المحرك يحرك العجلتين الأماميتين، وهو الأنسب للاستخدام اليومي في المدينة.'
    case 'rwd':
      return 'الدفع خلفي، أي أن المحرك يحرك العجلتين الخلفيتين.'
    case 'awd':
    case '4wd':
      return 'نظام الدفع رباعي، أي أن قوة المحرك تصل إلى العجلات الأربع، ما يساعد على الثبات في الرمل والطرق غير الممهدة.'
  }
}
function drivetrainEn(d: NonNullable<Facts['drivetrain']>): string {
  switch (d) {
    case 'fwd':
      return 'Power goes to the front wheels, a practical layout for everyday city driving.'
    case 'rwd':
      return 'Power goes to the rear wheels.'
    case 'awd':
    case '4wd':
      return 'Power goes to all four wheels, which helps grip on sand and unpaved roads.'
  }
}
