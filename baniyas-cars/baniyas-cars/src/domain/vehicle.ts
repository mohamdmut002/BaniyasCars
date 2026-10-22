import { z } from 'zod'

export const TRANSMISSIONS = ['automatic', 'cvt', 'manual', 'amt', 'dct'] as const
export const FUELS = ['petrol', 'diesel', 'hybrid', 'plugin_hybrid', 'electric'] as const
export const DRIVETRAINS = ['fwd', 'rwd', 'awd', '4wd'] as const
export const BODY_TYPES = ['sedan', 'suv', 'pickup', 'hatchback', 'coupe', 'van', 'other'] as const
export const CONDITIONS = ['new', 'used'] as const
export const REGIONAL_SPECS = ['gcc', 'american', 'japanese', 'european', 'korean', 'chinese', 'other'] as const
export const STATUSES = ['available', 'reserved', 'sold', 'hidden'] as const
export const VERIFICATIONS = ['confirmed', 'needs_confirmation', 'historical'] as const

export type Transmission = (typeof TRANSMISSIONS)[number]
export type Fuel = (typeof FUELS)[number]
export type Drivetrain = (typeof DRIVETRAINS)[number]
export type BodyType = (typeof BODY_TYPES)[number]
export type Condition = (typeof CONDITIONS)[number]
export type RegionalSpec = (typeof REGIONAL_SPECS)[number]
export type Status = (typeof STATUSES)[number]
export type Verification = (typeof VERIFICATIONS)[number]

export interface VehicleImage {
  id: string
  url: string
  storage_key: string | null
  width: number | null
  height: number | null
  alt_ar: string | null
  alt_en: string | null
  position: number
  source: 'upload' | 'remote'
}

export interface Branch {
  id: string
  slug: string
  name_ar: string
  name_en: string
  address_ar: string | null
  address_en: string | null
  phone: string | null
  whatsapp: string | null
  maps_url: string | null
  position: number
}

export interface Vehicle {
  id: string
  slug: string
  source_key: string | null
  make: string
  model: string
  trim: string | null
  generation: string | null
  year: number
  price_aed: number | null
  price_includes_vat: boolean | null
  mileage_km: number | null
  condition: Condition | null
  transmission: Transmission | null
  gears: number | null
  fuel: Fuel | null
  engine_l: string | null
  horsepower: number | null
  torque_nm: number | null
  drivetrain: Drivetrain | null
  body_type: BodyType | null
  body_detail: string | null
  exterior_color: string | null
  interior_color: string | null
  regional_spec: RegionalSpec | null
  export_only: boolean
  warranty_ar: string | null
  warranty_en: string | null
  features_ar: string[]
  features_en: string[]
  description_ar: string | null
  description_en: string | null
  status: Status
  verification: Verification
  verification_note: string | null
  featured: boolean
  featured_rank: number | null
  branch_id: string | null
  listed_at: Date | null
  last_verified_at: Date | null
  source_url: string | null
  source_label: string | null
  secondary_source_urls: string[]
  created_at: Date
  updated_at: Date
}

export interface VehicleWithImages extends Vehicle {
  images: VehicleImage[]
  branch: Branch | null
}

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v ? v : null))

const optionalInt = (min: number, max: number) =>
  z
    .union([z.string(), z.number()])
    .optional()
    .transform((v, ctx) => {
      if (v === undefined || v === null || v === '') return null
      const n = typeof v === 'number' ? v : Number(String(v).replace(/[,\s٬]/g, ''))
      if (!Number.isInteger(n) || n < min || n > max) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: `must be a whole number between ${min} and ${max}` })
        return z.NEVER
      }
      return n
    })

const optionalEnum = <T extends readonly [string, ...string[]]>(values: T) =>
  z
    .union([z.enum(values), z.literal('')])
    .optional()
    .transform((v) => (v ? (v as T[number]) : null))

const checkbox = z
  .union([z.literal('on'), z.literal('true'), z.literal('1'), z.boolean(), z.literal(''), z.literal('false'), z.literal('0')])
  .optional()
  .transform((v) => v === 'on' || v === 'true' || v === '1' || v === true)

const triState = z
  .union([z.literal('yes'), z.literal('no'), z.literal(''), z.literal('true'), z.literal('false')])
  .optional()
  .transform((v) => (v === 'yes' || v === 'true' ? true : v === 'no' || v === 'false' ? false : null))

const lines = z
  .string()
  .optional()
  .transform((v) =>
    (v ?? '')
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 60),
  )

const url = z
  .string()
  .trim()
  .max(1000)
  .optional()
  .transform((v, ctx) => {
    if (!v) return null
    try {
      const u = new URL(v)
      if (u.protocol !== 'https:' && u.protocol !== 'http:') throw new Error()
      return u.toString()
    } catch {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'must be a valid http(s) link' })
      return z.NEVER
    }
  })

/** Validates the admin vehicle form (and CSV rows). Every optional field becomes null when empty. */
export const vehicleInput = z.object({
  make: z.string().trim().min(1).max(60),
  model: z.string().trim().min(1).max(80),
  trim: optionalText(80),
  generation: optionalText(80),
  year: z.coerce.number().int().min(1950).max(new Date().getFullYear() + 2),
  price_aed: optionalInt(1, 100_000_000),
  price_includes_vat: triState,
  mileage_km: optionalInt(0, 3_000_000),
  condition: optionalEnum(CONDITIONS),
  transmission: optionalEnum(TRANSMISSIONS),
  gears: optionalInt(1, 12),
  fuel: optionalEnum(FUELS),
  engine_l: z
    .union([z.string(), z.number()])
    .optional()
    .transform((v, ctx) => {
      if (v === undefined || v === '') return null
      const n = Number(v)
      if (!Number.isFinite(n) || n < 0.5 || n > 9.9) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'engine size must be between 0.5 and 9.9 litres' })
        return z.NEVER
      }
      return n.toFixed(1)
    }),
  horsepower: optionalInt(30, 2000),
  torque_nm: optionalInt(30, 3000),
  drivetrain: optionalEnum(DRIVETRAINS),
  body_type: optionalEnum(BODY_TYPES),
  body_detail: optionalText(80),
  exterior_color: optionalText(40),
  interior_color: optionalText(40),
  regional_spec: optionalEnum(REGIONAL_SPECS),
  export_only: checkbox,
  warranty_ar: optionalText(300),
  warranty_en: optionalText(300),
  features_ar: lines,
  features_en: lines,
  description_ar: optionalText(4000),
  description_en: optionalText(4000),
  status: z.enum(STATUSES).default('available'),
  verification: z.enum(VERIFICATIONS).default('confirmed'),
  verification_note: optionalText(1000),
  featured: checkbox,
  featured_rank: optionalInt(0, 999),
  branch_id: z
    .string()
    .optional()
    .transform((v) => (v && /^[0-9a-f-]{36}$/.test(v) ? v : null)),
  listed_at: z
    .string()
    .optional()
    .transform((v, ctx) => {
      if (!v) return null
      const d = new Date(v)
      if (Number.isNaN(d.getTime())) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'invalid date' })
        return z.NEVER
      }
      return d
    }),
  source_url: url,
  source_label: optionalText(80),
})

export type VehicleInput = z.infer<typeof vehicleInput>
