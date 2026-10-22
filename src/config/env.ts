import { z } from 'zod'
import { isWorkers } from './runtime.js'

// Load .env for local Node runs. Hosting platforms (and Cloudflare bindings) provide real variables instead.
if (!isWorkers && typeof process.loadEnvFile === 'function') {
  try {
    process.loadEnvFile('.env')
  } catch {
    /* no .env file */
  }
}

const bool = z
  .enum(['true', 'false', '1', '0'])
  .optional()
  .transform((v) => v === 'true' || v === '1')

const schema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  /** Public origin of the site, used for canonical URLs, sitemap and Open Graph. No trailing slash. */
  SITE_URL: z.string().url().default('http://localhost:3000').transform((s) => s.replace(/\/+$/, '')),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  /** Set to "require" for hosted Postgres (Supabase, Neon). */
  DATABASE_SSL: z.enum(['disable', 'require']).default('disable'),
  /** Secret used to sign cookies and hash inquiry IPs. At least 32 random characters. */
  SESSION_SECRET: z.string().min(32, 'SESSION_SECRET must be at least 32 characters'),
  /** Where uploaded photos go: "local" (disk, for a VPS), "s3" (Supabase Storage, R2 or AWS via S3 API) or "r2" (R2 binding on Cloudflare Pages). */
  STORAGE_DRIVER: z.enum(['local', 's3', 'r2']).default('local'),
  LOCAL_STORAGE_DIR: z.string().default('./storage/uploads'),
  S3_ENDPOINT: z.string().url().optional(),
  S3_REGION: z.string().default('auto'),
  S3_BUCKET: z.string().optional(),
  S3_ACCESS_KEY_ID: z.string().optional(),
  S3_SECRET_ACCESS_KEY: z.string().optional(),
  /** Public base URL for files in the bucket, e.g. https://<project>.supabase.co/storage/v1/object/public/vehicles */
  // A full URL, or "/uploads" when the files live in the R2 bucket that the Cloudflare site serves itself.
  S3_PUBLIC_BASE_URL: z
    .string()
    .refine((v) => v.startsWith('/') || /^https?:\/\//.test(v), 'must be a full URL or a path such as /uploads')
    .optional(),
  S3_FORCE_PATH_STYLE: bool,
  MAX_UPLOAD_MB: z.coerce.number().positive().max(25).default(10),
  /** Trust X-Forwarded-* headers from the hosting proxy (Render, Railway, Fly, Vercel). */
  TRUST_PROXY: bool,
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
})

export type Env = z.infer<typeof schema>

function load(): Env {
  const parsed = schema.safeParse(process.env)
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n')
    throw new Error(`Invalid environment configuration:\n${issues}\nSee .env.example for every variable.`)
  }
  const env = parsed.data
  if (env.STORAGE_DRIVER === 's3') {
    const missing = (['S3_ENDPOINT', 'S3_BUCKET', 'S3_ACCESS_KEY_ID', 'S3_SECRET_ACCESS_KEY', 'S3_PUBLIC_BASE_URL'] as const).filter(
      (k) => !env[k],
    )
    if (missing.length) throw new Error(`STORAGE_DRIVER=s3 needs: ${missing.join(', ')}`)
  }
  return env
}

export const env = load()
export const isProd = env.NODE_ENV === 'production'
