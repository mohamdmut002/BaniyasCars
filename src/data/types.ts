export type Transmission = 'automatic' | 'cvt' | 'manual' | 'amt' | 'dct'
export type Fuel = 'petrol' | 'diesel' | 'hybrid' | 'plugin_hybrid' | 'electric'
export type Drivetrain = 'fwd' | 'rwd' | 'awd' | '4wd'
export type BodyType = 'sedan' | 'suv' | 'pickup' | 'hatchback' | 'coupe' | 'van' | 'other'
export type Condition = 'new' | 'used'
export type RegionalSpec = 'gcc' | 'american' | 'japanese' | 'european' | 'korean' | 'chinese' | 'other'
export type Status = 'available' | 'reserved' | 'sold'
/**
 * confirmed          – taken from an official dealership listing
 * needs_confirmation – real listing, but old or with a detail to check (shows a notice on the site)
 * sample             – NOT a real car; only for layout testing. Shown with a clear "sample" label.
 */
export type Verification = 'confirmed' | 'needs_confirmation' | 'sample'
export type BranchId = 'abu-dhabi' | 'dubai' | 'al-ain'

export const TRANSMISSIONS: Transmission[] = ['automatic', 'cvt', 'manual', 'amt', 'dct']
export const FUELS: Fuel[] = ['petrol', 'diesel', 'hybrid', 'plugin_hybrid', 'electric']

export interface Vehicle {
  /** Used in the page address: /cars/<slug>. Latin letters, digits and dashes; must be unique. */
  slug: string
  make: string
  model: string
  trim: string | null
  year: number
  /** Asking price in AED. null shows «يرجى التواصل للاستفسار». */
  price_aed: number | null
  price_includes_vat: boolean | null
  mileage_km: number | null
  condition: Condition | null
  transmission: Transmission | null
  gears: number | null
  fuel: Fuel | null
  engine_l: number | null
  horsepower: number | null
  torque_nm: number | null
  drivetrain: Drivetrain | null
  body_type: BodyType | null
  exterior_color: string | null
  interior_color: string | null
  regional_spec: RegionalSpec | null
  export_only: boolean
  warranty_ar: string | null
  warranty_en: string | null
  features_ar: string[]
  features_en: string[]
  /** Optional custom text. When empty, the site writes a description from the specs above. */
  description_ar: string | null
  description_en: string | null
  status: Status
  verification: Verification
  /** Internal note on what still needs checking (shown in the source box, not as a claim). */
  verification_note: string | null
  /** Shown in «سيارات مختارة» on the home page (only if it has photos). */
  featured: boolean
  branch: BranchId | null
  /** ISO date the dealer published the listing. */
  listed_at: string | null
  /** ISO date someone last checked the listing. */
  last_verified_at: string | null
  source_url: string | null
  source_label: string | null
  secondary_source_urls: string[]
  /** Photo URLs, first one is the cover. Local files go in public/photos/ and are written as "/photos/name.jpg". */
  images: string[]
}

/** Required fields when adding a car; everything else defaults to "unknown" (null / empty). */
export type VehicleEntry = Pick<Vehicle, 'slug' | 'make' | 'model' | 'year'> & Partial<Vehicle>

export function defineVehicle(e: VehicleEntry): Vehicle {
  return {
    trim: null,
    price_aed: null,
    price_includes_vat: null,
    mileage_km: null,
    condition: null,
    transmission: null,
    gears: null,
    fuel: null,
    engine_l: null,
    horsepower: null,
    torque_nm: null,
    drivetrain: null,
    body_type: null,
    exterior_color: null,
    interior_color: null,
    regional_spec: null,
    export_only: false,
    warranty_ar: null,
    warranty_en: null,
    features_ar: [],
    features_en: [],
    description_ar: null,
    description_en: null,
    status: 'available',
    verification: 'confirmed',
    verification_note: null,
    featured: false,
    branch: null,
    listed_at: null,
    last_verified_at: null,
    source_url: null,
    source_label: null,
    secondary_source_urls: [],
    images: [],
    ...e,
  }
}
