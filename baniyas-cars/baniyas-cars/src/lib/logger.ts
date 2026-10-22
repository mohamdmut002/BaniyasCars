/** Structured JSON logger. One line per event so hosting log viewers can filter by level and message. */
type Level = 'debug' | 'info' | 'warn' | 'error'
const order: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 }
const threshold = order[(process.env.LOG_LEVEL as Level) ?? 'info'] ?? 20

function write(level: Level, msg: string, data?: Record<string, unknown>) {
  if (order[level] < threshold || process.env.NODE_ENV === 'test') return
  const line = JSON.stringify({ t: new Date().toISOString(), level, msg, ...data })
  if (level === 'error' || level === 'warn') process.stderr.write(line + '\n')
  else process.stdout.write(line + '\n')
}

export const log = {
  debug: (m: string, d?: Record<string, unknown>) => write('debug', m, d),
  info: (m: string, d?: Record<string, unknown>) => write('info', m, d),
  warn: (m: string, d?: Record<string, unknown>) => write('warn', m, d),
  error: (m: string, d?: Record<string, unknown>) => write('error', m, d),
}

export function errorDetails(e: unknown): Record<string, unknown> {
  if (e instanceof Error) return { error: e.message, stack: e.stack?.split('\n').slice(0, 6).join('\n') }
  return { error: String(e) }
}
