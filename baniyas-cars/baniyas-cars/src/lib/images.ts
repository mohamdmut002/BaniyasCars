import sharp from 'sharp'
import { randomBytes } from 'node:crypto'
import { storage } from './storage.js'

const MAX_PIXELS = 60_000_000
const ALLOWED = new Set(['jpeg', 'png', 'webp', 'heif', 'avif', 'gif', 'tiff'])

export class ImageError extends Error {}

/**
 * Validates an uploaded photo by decoding it (the file extension and MIME type are not trusted),
 * fixes its rotation, strips metadata such as GPS location, and stores a large and a small WebP.
 */
export async function processAndStore(input: Buffer, vehicleSlug: string) {
  let meta: Awaited<ReturnType<ReturnType<typeof sharp>["metadata"]>>
  try {
    meta = await sharp(input, { limitInputPixels: MAX_PIXELS }).metadata()
  } catch {
    throw new ImageError('الملف ليس صورة صالحة.')
  }
  if (!meta.format || !ALLOWED.has(meta.format)) throw new ImageError('نوع الصورة غير مدعوم. استخدم JPG أو PNG أو WebP أو HEIC.')
  if ((meta.width ?? 0) < 300 || (meta.height ?? 0) < 300) throw new ImageError('الصورة صغيرة جداً. الحد الأدنى 300 بكسل.')

  const base = sharp(input, { limitInputPixels: MAX_PIXELS }).rotate()
  const large = await base.clone().resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true }).webp({ quality: 80 }).toBuffer({ resolveWithObject: true })
  const small = await base.clone().resize({ width: 640, height: 640, fit: 'inside', withoutEnlargement: true }).webp({ quality: 74 }).toBuffer()

  const id = `${Date.now().toString(36)}-${randomBytes(4).toString('hex')}`
  const key = `vehicles/${vehicleSlug.slice(0, 60)}/${id}.webp`
  const url = await storage.put(key, large.data, 'image/webp')
  await storage.put(key.replace(/\.webp$/, '-640.webp'), small, 'image/webp')
  return { url, storage_key: key, width: large.info.width, height: large.info.height }
}

export async function deleteStored(key: string) {
  await storage.delete(key)
  await storage.delete(key.replace(/\.webp$/, '-640.webp'))
}

/** URL of the small variant for cards; remote source photos are used as-is. */
export function thumbUrl(img: { url: string; storage_key: string | null }) {
  return img.storage_key ? img.url.replace(/\.webp$/, '-640.webp') : img.url
}
