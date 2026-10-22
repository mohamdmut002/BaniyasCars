/** True when running inside Cloudflare Workers / Pages Functions (workerd), false on Node.js. */
export const isWorkers = typeof navigator !== 'undefined' && (navigator as { userAgent?: string }).userAgent === 'Cloudflare-Workers'

/** Minimal R2 bucket surface used by the app (matches the Workers R2Bucket binding). */
export interface R2Like {
  put(key: string, value: ArrayBuffer | Uint8Array, options?: { httpMetadata?: { contentType?: string; cacheControl?: string } }): Promise<unknown>
  get(key: string): Promise<{ body: ReadableStream; httpMetadata?: { contentType?: string }; httpEtag?: string } | null>
  delete(key: string): Promise<void>
}

/** Bindings that only exist per-request on Workers, set by src/worker.ts. */
export const runtime: { r2: R2Like | null } = { r2: null }
