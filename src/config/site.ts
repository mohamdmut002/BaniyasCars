/**
 * Site-wide settings. Every contact detail below comes from the dealership's own public pages
 * (checked 22 October 2026). Set any value to null to hide it; nothing else needs changing.
 */
import type { BranchId } from '../data/types.js'

export interface Branch {
  id: BranchId
  name_ar: string
  name_en: string
  address_ar: string | null
  address_en: string | null
  phone: string | null
  whatsapp: string | null
  maps_url: string | null
}

export const site = {
  /**
   * Public address of the deployed site, without a trailing slash (e.g. "https://baniyascars.ae").
   * Used for canonical links, Open Graph and sitemap.xml. Can also be set at build time: SITE_URL=https://… npm run build
   * Leave empty until the domain is known: those tags and the sitemap are then left out.
   */
  url: '',

  /**
   * Sales WhatsApp in international format. Source: every car post caption on
   * https://www.instagram.com/baniyascars/ ("او الواتس اب 00971504422050").
   * Set to null to hide WhatsApp buttons; they are replaced by a link to the contact page.
   */
  whatsapp: '+971504422050' as string | null,

  /** Main phone. Source: Facebook page "About" (https://www.facebook.com/bce1981/about). */
  phone: '+971508001443' as string | null,
  email: 'info@baniyascars.com' as string | null,

  /** Shown with a "confirm before visiting" note: published on auto.ae, not on the dealer's own pages. */
  hours_ar: '9:00 صباحاً – 9:00 مساءً' as string | null,
  hours_en: '9:00 AM – 9:00 PM' as string | null,

  instagram: 'https://www.instagram.com/baniyascars/',
  facebook: 'https://www.facebook.com/bce1981/',
  threads: 'https://www.threads.com/@baniyascars' as string | null,
  /** From the Instagram bio. */
  maps_url: 'https://maps.app.goo.gl/BWHbL7VTG3TRc3g68' as string | null,

  branches: [
    {
      id: 'abu-dhabi',
      name_ar: 'فرع أبوظبي — مدينة رحايل للسيارات',
      name_en: 'Abu Dhabi — Rahayel Cars City',
      address_ar: 'آيكاد 5 (مدينة أبوظبي الصناعية)، مدينة رحايل للسيارات، أبوظبي — ص.ب 55805',
      address_en: 'ICAD V (Abu Dhabi Industrial City), Rahayel Cars City, Abu Dhabi — P.O. Box 55805',
      phone: '+971508001443',
      whatsapp: '+971504422050',
      maps_url: null,
    },
    {
      id: 'dubai',
      name_ar: 'فرع دبي — رأس الخور',
      name_en: 'Dubai — Ras Al Khor',
      address_ar: 'منطقة رأس الخور الصناعية 3، دبي',
      address_en: 'Ras Al Khor Industrial Area 3, Dubai',
      phone: '+971508131408',
      whatsapp: null,
      maps_url: null,
    },
    {
      id: 'al-ain',
      name_ar: 'فرع العين',
      name_en: 'Al Ain',
      address_ar: null,
      address_en: null,
      phone: '+971564404320',
      whatsapp: null,
      maps_url: null,
    },
  ] as Branch[],

  /** Departments listed in the dealership's Instagram captions. */
  departments: [
    { name_ar: 'السيارات المستعملة — بيع وشراء', name_en: 'Used cars — buy and sell', phone: '+971506812224' },
    { name_ar: 'قسم التصدير', name_en: 'Export department', phone: '+971506131744' },
  ],
}

export const siteUrl = (process.env.SITE_URL ?? site.url).replace(/\/+$/, '')
