import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto'
import { sql } from '../db/client.js'
import { env } from '../config/env.js'

/*
 * Passwords use PBKDF2-SHA256 through Web Crypto, which is available on both Node and Cloudflare Workers.
 * 100,000 iterations is the most Workers allows. Older scrypt hashes (created before the Cloudflare
 * version) are still accepted on Node and re-hashed on the next successful login.
 */
const ITERATIONS = 100_000
const KEYLEN = 32

async function pbkdf2(password: string, salt: Uint8Array<ArrayBuffer>, iterations: number, length: number): Promise<Buffer> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password.normalize('NFKC')), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, key, length * 8)
  return Buffer.from(bits)
}

/** Password hash in the form pbkdf2-sha256$iterations$salt$hash (base64). */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16)
  const key = await pbkdf2(password, new Uint8Array(salt), ITERATIONS, KEYLEN)
  return ['pbkdf2-sha256', ITERATIONS, salt.toString('base64'), key.toString('base64')].join('$')
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split('$')
  if (parts[0] === 'pbkdf2-sha256' && parts.length === 4) {
    const expected = Buffer.from(parts[3]!, 'base64')
    const key = await pbkdf2(password, new Uint8Array(Buffer.from(parts[2]!, 'base64')), Number(parts[1]), expected.length)
    return key.length === expected.length && timingSafeEqual(key, expected)
  }
  if (parts[0] === 'scrypt' && parts.length === 6) {
    try {
      const { scrypt } = await import('node:crypto')
      const expected = Buffer.from(parts[5]!, 'base64')
      const key = await new Promise<Buffer>((resolve, reject) =>
        scrypt(password.normalize('NFKC'), Buffer.from(parts[4]!, 'base64'), expected.length, { N: Number(parts[1]), r: Number(parts[2]), p: Number(parts[3]), maxmem: 64 * 1024 * 1024 }, (e, k) => (e ? reject(e) : resolve(k))),
      )
      return key.length === expected.length && timingSafeEqual(key, expected)
    } catch {
      return false
    }
  }
  return false
}

/** Minimum policy: 10+ characters with letters and digits. */
export function passwordProblem(pw: string): string | null {
  if (pw.length < 10) return 'كلمة المرور يجب أن تكون 10 أحرف على الأقل.'
  if (!/[A-Za-z؀-ۿ]/.test(pw) || !/\d/.test(pw)) return 'كلمة المرور يجب أن تحتوي على حروف وأرقام.'
  return null
}

export const SESSION_COOKIE = 'bc_session'
export const SESSION_DAYS = 7
const MAX_FAILED = 5
const LOCK_MINUTES = 15

export const sha256 = (s: string) => createHash('sha256').update(s).digest('hex')
export const hmac = (s: string) => createHmac('sha256', env.SESSION_SECRET).update(s).digest('hex')

export interface AdminUser {
  id: string
  email: string
  name: string
  role: 'owner' | 'staff'
  active: boolean
}
export interface Session {
  user: AdminUser
  csrf: string
  tokenHash: string
}

export type LoginResult = { ok: true; token: string } | { ok: false; reason: 'invalid' | 'locked' }

export async function login(emailRaw: string, password: string, userAgent: string | null): Promise<LoginResult> {
  const email = emailRaw.trim().toLowerCase()
  const [user] = await sql<(AdminUser & { password_hash: string; failed_logins: number; locked_until: Date | null })[]>`
    select * from admin_users where email = ${email}`
  // Always run a hash to keep timing similar for unknown emails.
  const valid = user ? await verifyPassword(password, user.password_hash) : (await hashPassword(password), false)
  if (!user || !user.active) return { ok: false, reason: 'invalid' }
  if (user.locked_until && user.locked_until > new Date()) return { ok: false, reason: 'locked' }
  if (!valid) {
    await sql`
      update admin_users set
        failed_logins = failed_logins + 1,
        locked_until = case when failed_logins + 1 >= ${MAX_FAILED} then now() + make_interval(mins => ${LOCK_MINUTES}) else locked_until end
      where id = ${user.id}`
    return { ok: false, reason: user.failed_logins + 1 >= MAX_FAILED ? 'locked' : 'invalid' }
  }
  const token = randomBytes(32).toString('base64url')
  await sql.begin(async (tx) => {
    await tx`update admin_users set failed_logins = 0, locked_until = null, last_login_at = now() where id = ${user.id}`
    if (!user.password_hash.startsWith('pbkdf2-sha256$')) {
      await tx`update admin_users set password_hash = ${await hashPassword(password)} where id = ${user.id}`
    }
    await tx`delete from admin_sessions where user_id = ${user.id} and expires_at < now()`
    await tx`
      insert into admin_sessions (token_hash, user_id, csrf_token, expires_at, user_agent)
      values (${sha256(token)}, ${user.id}, ${randomBytes(24).toString('base64url')},
              now() + make_interval(days => ${SESSION_DAYS}), ${userAgent?.slice(0, 300) ?? null})`
  })
  return { ok: true, token }
}

export async function getSession(token: string | undefined): Promise<Session | null> {
  if (!token || token.length > 100) return null
  const tokenHash = sha256(token)
  const [row] = await sql<(AdminUser & { csrf_token: string })[]>`
    select u.id, u.email, u.name, u.role, u.active, s.csrf_token
    from admin_sessions s join admin_users u on u.id = s.user_id
    where s.token_hash = ${tokenHash} and s.expires_at > now() and u.active`
  if (!row) return null
  const { csrf_token, ...user } = row
  return { user, csrf: csrf_token, tokenHash }
}

export async function logout(tokenHash: string) {
  await sql`delete from admin_sessions where token_hash = ${tokenHash}`
}

export async function revokeUserSessions(userId: string, exceptTokenHash?: string) {
  await sql`delete from admin_sessions where user_id = ${userId} and token_hash <> ${exceptTokenHash ?? ''}`
}

export function safeEqual(a: string, b: string) {
  const ab = Buffer.from(a)
  const bb = Buffer.from(b)
  return ab.length === bb.length && timingSafeEqual(ab, bb)
}

export async function createAdmin(email: string, name: string, password: string, role: 'owner' | 'staff') {
  const problem = passwordProblem(password)
  if (problem) throw new Error(problem)
  const hash = await hashPassword(password)
  const [row] = await sql<{ id: string }[]>`
    insert into admin_users (email, name, password_hash, role) values (${email.trim().toLowerCase()}, ${name.trim()}, ${hash}, ${role})
    on conflict (email) do update set name = excluded.name, password_hash = excluded.password_hash, role = excluded.role, active = true,
      failed_logins = 0, locked_until = null
    returning id`
  return row!.id
}

export async function listAdmins() {
  return sql<(AdminUser & { last_login_at: Date | null })[]>`
    select id, email, name, role, active, last_login_at from admin_users order by created_at`
}

export async function changePassword(userId: string, password: string) {
  const problem = passwordProblem(password)
  if (problem) throw new Error(problem)
  await sql`update admin_users set password_hash = ${await hashPassword(password)} where id = ${userId}`
}

export async function setAdminActive(userId: string, active: boolean) {
  await sql`update admin_users set active = ${active} where id = ${userId}`
  if (!active) await sql`delete from admin_sessions where user_id = ${userId}`
}
