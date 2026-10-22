import { createHash, createHmac } from 'node:crypto'
import { env } from '../config/env.js'
import { runtime, type R2Like } from '../config/runtime.js'

export interface Storage {
  /** Stores a file and returns its public URL. */
  put(key: string, body: Buffer, contentType: string): Promise<string>
  delete(key: string): Promise<void>
}

const safeKey = (key: string) => {
  if (!/^[a-z0-9][a-z0-9/_.-]{0,200}$/.test(key) || key.includes('..')) throw new Error('invalid storage key')
  return key
}

// Node-only modules are imported lazily so the Cloudflare bundle never loads them.
class LocalStorage implements Storage {
  constructor(private root: string) {}
  async put(key: string, body: Buffer) {
    const [{ mkdir, writeFile }, path] = await Promise.all([import('node:fs/promises'), import('node:path')])
    const file = path.join(path.resolve(this.root), safeKey(key))
    await mkdir(path.dirname(file), { recursive: true })
    await writeFile(file, body)
    return `/uploads/${key}`
  }
  async delete(key: string) {
    const [{ unlink }, path] = await Promise.all([import('node:fs/promises'), import('node:path')])
    await unlink(path.join(path.resolve(this.root), safeKey(key))).catch(() => {})
  }
}

/** Cloudflare R2 through the Pages/Workers binding. Files are served by the app at /uploads/<key>. */
export class R2Storage implements Storage {
  constructor(private bucket: () => R2Like) {}
  async put(key: string, body: Buffer, contentType: string) {
    await this.bucket().put(safeKey(key), new Uint8Array(body), {
      httpMetadata: { contentType, cacheControl: 'public, max-age=31536000, immutable' },
    })
    return `/uploads/${key}`
  }
  async delete(key: string) {
    await this.bucket().delete(safeKey(key))
  }
  async get(key: string) {
    return this.bucket().get(safeKey(key))
  }
}

/** Minimal S3 client (AWS Signature V4) for Supabase Storage, Cloudflare R2, AWS S3 or MinIO. */
export class S3Storage implements Storage {
  constructor(
    private o: { endpoint: string; region: string; bucket: string; accessKeyId: string; secretAccessKey: string; publicBaseUrl: string; pathStyle: boolean },
  ) {}

  private url(key: string) {
    const ep = new URL(this.o.endpoint)
    const basePath = ep.pathname.replace(/\/+$/, '')
    const encodedKey = key.split('/').map(encodeURIComponent).join('/')
    if (this.o.pathStyle) return new URL(`${ep.origin}${basePath}/${this.o.bucket}/${encodedKey}`)
    return new URL(`${ep.protocol}//${this.o.bucket}.${ep.host}${basePath}/${encodedKey}`)
  }

  async put(key: string, body: Buffer, contentType: string) {
    const url = this.url(safeKey(key))
    const res = await fetch(url, {
      method: 'PUT',
      headers: signV4({
        method: 'PUT',
        url,
        region: this.o.region,
        accessKeyId: this.o.accessKeyId,
        secretAccessKey: this.o.secretAccessKey,
        body,
        headers: { 'content-type': contentType, 'cache-control': 'public, max-age=31536000, immutable' },
      }),
      body: new Uint8Array(body),
    })
    if (!res.ok) throw new Error(`S3 upload failed: ${res.status} ${await res.text().catch(() => '')}`.slice(0, 300))
    return `${this.o.publicBaseUrl.replace(/\/+$/, '')}/${key}`
  }

  async delete(key: string) {
    const url = this.url(safeKey(key))
    const res = await fetch(url, {
      method: 'DELETE',
      headers: signV4({ method: 'DELETE', url, region: this.o.region, accessKeyId: this.o.accessKeyId, secretAccessKey: this.o.secretAccessKey, body: Buffer.alloc(0), headers: {} }),
    })
    if (!res.ok && res.status !== 404) throw new Error(`S3 delete failed: ${res.status}`)
  }
}

const sha256hex = (b: Buffer | string) => createHash('sha256').update(b).digest('hex')
const hmacRaw = (k: Buffer | string, s: string) => createHmac('sha256', k).update(s).digest()

/** AWS Signature Version 4 for a single request. Exported for unit tests. */
export function signV4(p: {
  method: string
  url: URL
  region: string
  accessKeyId: string
  secretAccessKey: string
  body: Buffer
  headers: Record<string, string>
  service?: string
  now?: Date
}): Record<string, string> {
  const service = p.service ?? 's3'
  const now = p.now ?? new Date()
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '')
  const date = amzDate.slice(0, 8)
  const payloadHash = sha256hex(p.body)
  const headers: Record<string, string> = {
    ...Object.fromEntries(Object.entries(p.headers).map(([k, v]) => [k.toLowerCase(), v.trim()])),
    host: p.url.host,
    'x-amz-content-sha256': payloadHash,
    'x-amz-date': amzDate,
  }
  const names = Object.keys(headers).sort()
  const canonicalQuery = [...p.url.searchParams.entries()]
    .map(([k, v]) => [encodeRfc3986(k), encodeRfc3986(v)])
    .sort(([a], [b]) => (a! < b! ? -1 : a! > b! ? 1 : 0))
    .map(([k, v]) => `${k}=${v}`)
    .join('&')
  const canonical = [
    p.method,
    p.url.pathname,
    canonicalQuery,
    names.map((n) => `${n}:${headers[n]}\n`).join(''),
    names.join(';'),
    payloadHash,
  ].join('\n')
  const scope = `${date}/${p.region}/${service}/aws4_request`
  const toSign = ['AWS4-HMAC-SHA256', amzDate, scope, sha256hex(canonical)].join('\n')
  const kDate = hmacRaw('AWS4' + p.secretAccessKey, date)
  const kSigning = hmacRaw(hmacRaw(hmacRaw(kDate, p.region), service), 'aws4_request')
  const signature = createHmac('sha256', kSigning).update(toSign).digest('hex')
  const { host: _host, ...rest } = headers
  return {
    ...rest,
    authorization: `AWS4-HMAC-SHA256 Credential=${p.accessKeyId}/${scope}, SignedHeaders=${names.join(';')}, Signature=${signature}`,
  }
}

const encodeRfc3986 = (s: string) => encodeURIComponent(s).replace(/[!'()*]/g, (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase())

let instance: Storage | null = null

/** The configured storage driver, created on first use (Workers bindings exist only once a request arrives). */
export function getStorage(): Storage {
  if (instance) return instance
  instance =
    env.STORAGE_DRIVER === 'r2'
      ? new R2Storage(() => {
          if (!runtime.r2) throw new Error('STORAGE_DRIVER=r2 but no UPLOADS R2 binding is configured')
          return runtime.r2
        })
      : env.STORAGE_DRIVER === 's3'
    ? new S3Storage({
        endpoint: env.S3_ENDPOINT!,
        region: env.S3_REGION,
        bucket: env.S3_BUCKET!,
        accessKeyId: env.S3_ACCESS_KEY_ID!,
        secretAccessKey: env.S3_SECRET_ACCESS_KEY!,
        publicBaseUrl: env.S3_PUBLIC_BASE_URL!,
        pathStyle: env.S3_FORCE_PATH_STYLE,
      })
    : new LocalStorage(env.LOCAL_STORAGE_DIR)
  return instance
}
