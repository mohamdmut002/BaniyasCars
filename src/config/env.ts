import { existsSync } from 'node:fs'
import { z } from 'zod'

// Load .env for local runs. Hosting platforms inject real environment variables instead.
if (existsSync('.env') && typeof process.loadEnvFile === 'function') process.loadEnvFile('.env')

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
  /** Where uploaded photos go: "local" (disk, for a VPS) or "s3" (Supabase Storage, Cloudflare R2, AWS S3). */
  STORAGE_DRIVER: z.enum(['local', 's3']).default('local'),
  LOCAL_STORAGE_DIR: z.string().default('./storage/uploads'),
  S3_ENDPOINT: z.string().url().optional(),
  S3_REGION: z.string().default('auto'),
  S3_BUCKET: z.string().optional(),
  S3_ACCESS_KEY_ID: z.string().optional(),
  S3_SECRET_ACCESS_KEY: z.string().optional(),
  /** Public base URL for files in the bucket, e.g. https://<project>.supabase.co/storage/v1/object/public/vehicles */
  S3_PUBLIC_BASE_URL: z.string().url().optional(),
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
