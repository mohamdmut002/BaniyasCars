/** RFC 4180 CSV helpers. The writer prefixes a UTF-8 BOM so Excel opens Arabic text correctly. */

export function toCsv(rows: Record<string, unknown>[], columns: string[]): string {
  const esc = (v: unknown): string => {
    if (v == null) return ''
    let s = Array.isArray(v) ? v.join(' | ') : v instanceof Date ? v.toISOString() : String(v)
    // Neutralise spreadsheet formula injection.
    if (/^[=+\-@\t\r]/.test(s) && !/^-?\d/.test(s)) s = `'${s}`
    return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const lines = [columns.join(','), ...rows.map((r) => columns.map((c) => esc(r[c])).join(','))]
  return '﻿' + lines.join('\r\n') + '\r\n'
}

export function parseCsv(text: string): { header: string[]; rows: Record<string, string>[] } {
  const src = text.replace(/^﻿/, '')
  const records: string[][] = []
  let field = ''
  let record: string[] = []
  let inQuotes = false
  for (let i = 0; i < src.length; i++) {
    const ch = src[i]!
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"'
          i++
        } else inQuotes = false
      } else field += ch
      continue
    }
    if (ch === '"' && field === '') inQuotes = true
    else if (ch === ',') {
      record.push(field)
      field = ''
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++
      record.push(field)
      field = ''
      if (record.some((f) => f !== '')) records.push(record)
      record = []
    } else field += ch
  }
  if (inQuotes) throw new Error('CSV has an unclosed quote')
  if (field !== '' || record.length) {
    record.push(field)
    if (record.some((f) => f !== '')) records.push(record)
  }
  const header = (records.shift() ?? []).map((h) => h.trim())
  const rows = records.map((r) => Object.fromEntries(header.map((h, i) => [h, (r[i] ?? '').trim()])))
  return { header, rows }
}
