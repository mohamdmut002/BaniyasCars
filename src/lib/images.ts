import { randomBytes } from 'node:crypto'
import { getStorage } from './storage.js'
import { isWorkers } from '../config/runtime.js'

const MAX_PIXELS = 60_000_000
const ALLOWED = new Set(['jpeg', 'png', 'webp', 'heif', 'avif', 'gif', 'tiff'])

export class ImageError extends Error {}

const thumbKey = (key: string) => key.replace(/(\.\w+)$/, '-640$1')

/**
 * Stores an uploaded photo as a large and a small version.
 *
 * On Node, sharp decodes the file (extension and MIME type are not trusted), fixes rotation,
 * strips metadata such as GPS location and writes WebP 1600 px + 640 px.
 * On Cloudflare there is no sharp: the dashboard resizes photos to WebP in the browser before
 * uploading (src/client/admin.ts), and the server checks the file signature and size, removes
 * JPEG metadata, and stores what it received.
 */
export async function processAndStore(input: Buffer, vehicleSlug: string, thumb?: Buffer | null) {
  const id = `${Date.now().toString(36)}-${randomBytes(4).toString('hex')}`
  const base = `vehicles/${vehicleSlug.slice(0, 60)}/${id}`
  if (!isWorkers) return processWithSharp(input, base)

  const info = sniff(input)
  if (!info) throw new ImageError('نوع الصورة غير مدعوم. استخدم JPG أو PNG أو WebP.')
  if (info.width < 300 || info.height < 300) throw new ImageError('الصورة صغيرة جداً. الحد الأدنى 300 بكسل.')
  if (info.width * info.height > MAX_PIXELS) throw new ImageError('أبعاد الصورة كبيرة جداً.')
  const body = info.type === 'jpeg' ? stripJpegMetadata(input) : input
  const ext = info.type === 'jpeg' ? 'jpg' : info.type
  const key = `${base}.${ext}`
  const storage = getStorage()
  const url = await storage.put(key, body, `image/${info.type}`)
  const small = thumb && sniff(thumb)?.type === info.type ? thumb : body
  await storage.put(thumbKey(key), small, `image/${info.type}`)
  return { url, storage_key: key, width: info.width, height: info.height }
}

async function processWithSharp(input: Buffer, base: string) {
  const sharp = (await import('sharp')).default
  let meta: { format?: string; width?: number; height?: number }
  try {
    meta = await sharp(input, { limitInputPixels: MAX_PIXELS }).metadata()
  } catch {
    throw new ImageError('الملف ليس صورة صالحة.')
  }
  if (!meta.format || !ALLOWED.has(meta.format)) throw new ImageError('نوع الصورة غير مدعوم. استخدم JPG أو PNG أو WebP أو HEIC.')
  if ((meta.width ?? 0) < 300 || (meta.height ?? 0) < 300) throw new ImageError('الصورة صغيرة جداً. الحد الأدنى 300 بكسل.')
  const pipeline = sharp(input, { limitInputPixels: MAX_PIXELS }).rotate()
  const large = await pipeline.clone().resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true }).webp({ quality: 80 }).toBuffer({ resolveWithObject: true })
  const small = await pipeline.clone().resize({ width: 640, height: 640, fit: 'inside', withoutEnlargement: true }).webp({ quality: 74 }).toBuffer()
  const key = `${base}.webp`
  const storage = getStorage()
  const url = await storage.put(key, large.data, 'image/webp')
  await storage.put(thumbKey(key), small, 'image/webp')
  return { url, storage_key: key, width: large.info.width, height: large.info.height }
}

export async function deleteStored(key: string) {
  const storage = getStorage()
  await storage.delete(key)
  await storage.delete(thumbKey(key))
}

/** URL of the small variant for cards; remote source photos are used as-is. */
export function thumbUrl(img: { url: string; storage_key: string | null }) {
  return img.storage_key ? img.url.replace(/(\.\w+)$/, '-640$1') : img.url
}

/* ---------- signature and dimension checks without native libraries (exported for tests) ---------- */

export function sniff(b: Buffer): { type: 'jpeg' | 'png' | 'webp'; width: number; height: number } | null {
  if (b.length < 32) return null
  // PNG: signature + IHDR
  if (b.readUInt32BE(0) === 0x89504e47 && b.readUInt32BE(4) === 0x0d0a1a0a && b.toString('latin1', 12, 16) === 'IHDR') {
    return { type: 'png', width: b.readUInt32BE(16), height: b.readUInt32BE(20) }
  }
  // WebP: RIFF....WEBP + VP8 / VP8L / VP8X chunk
  if (b.toString('latin1', 0, 4) === 'RIFF' && b.toString('latin1', 8, 12) === 'WEBP') {
    const chunk = b.toString('latin1', 12, 16)
    if (chunk === 'VP8 ' && b.length >= 30) return { type: 'webp', width: b.readUInt16LE(26) & 0x3fff, height: b.readUInt16LE(28) & 0x3fff }
    if (chunk === 'VP8L' && b.length >= 25) {
      const bits = b.readUInt32LE(21)
      return { type: 'webp', width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 }
    }
    if (chunk === 'VP8X' && b.length >= 30) return { type: 'webp', width: b.readUIntLE(24, 3) + 1, height: b.readUIntLE(27, 3) + 1 }
    return null
  }
  // JPEG: walk segments to the first SOF marker
  if (b[0] === 0xff && b[1] === 0xd8) {
    let i = 2
    while (i + 9 < b.length) {
      if (b[i] !== 0xff) return null
      const marker = b[i + 1]!
      if (marker === 0xd8 || (marker >= 0xd0 && marker <= 0xd7) || marker === 0x01) {
        i += 2
        continue
      }
      const len = b.readUInt16BE(i + 2)
      if ((marker >= 0xc0 && marker <= 0xcf) && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
        return { type: 'jpeg', height: b.readUInt16BE(i + 5), width: b.readUInt16BE(i + 7) }
      }
      i += 2 + len
    }
  }
  return null
}

/** Removes APP1–APP15 and COM segments (EXIF, GPS, XMP, comments) from a JPEG, keeping image data. */
export function stripJpegMetadata(b: Buffer): Buffer {
  const out: Buffer[] = [b.subarray(0, 2)]
  let i = 2
  while (i + 4 <= b.length && b[i] === 0xff) {
    const marker = b[i + 1]!
    if (marker === 0xda) break // start of scan: the rest is image data
    const len = b.readUInt16BE(i + 2)
    const isMeta = (marker >= 0xe1 && marker <= 0xef) || marker === 0xfe
    if (!isMeta) out.push(b.subarray(i, i + 2 + len))
    i += 2 + len
  }
  out.push(b.subarray(i))
  return Buffer.concat(out)
}
