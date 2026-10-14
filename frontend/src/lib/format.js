// The API stores and returns timestamps as UTC "YYYY-MM-DD HH:MM:SS" strings.
export function parseUtc(value) {
  if (!value) return null
  if (value instanceof Date) return value
  const s = String(value)
  const iso = s.length === 10 ? `${s}T00:00:00Z` : `${s.replace(' ', 'T')}${/Z|[+-]\d\d:?\d\d$/.test(s) ? '' : 'Z'}`
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? null : d
}

export function toUtcSql(date) {
  const d = date instanceof Date ? date : new Date(date)
  return d.toISOString().slice(0, 19).replace('T', ' ')
}

export function localInputValue(date) {
  const d = date instanceof Date ? date : new Date(date)
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function fmtTime(value) {
  const d = parseUtc(value)
  return d ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'
}

export function fmtDate(value) {
  const d = parseUtc(value)
  return d ? d.toLocaleDateString([], { day: '2-digit', month: 'short', year: 'numeric' }) : '—'
}

export function fmtDateTime(value) {
  const d = parseUtc(value)
  if (!d) return '—'
  return `${d.toLocaleDateString([], { day: '2-digit', month: 'short' })}, ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
}

export function fmtRelative(value, now = new Date()) {
  const d = parseUtc(value)
  if (!d) return '—'
  const diff = Math.round((d.getTime() - now.getTime()) / 60000)
  const abs = Math.abs(diff)
  const unit = abs < 60 ? `${abs}m` : abs < 1440 ? `${Math.round(abs / 60)}h` : `${Math.round(abs / 1440)}d`
  if (abs < 1) return 'now'
  return diff < 0 ? `${unit} ago` : `in ${unit}`
}

export function isToday(value, now = new Date()) {
  const d = parseUtc(value)
  return !!d && d.toDateString() === now.toDateString()
}

export function isPast(value, now = new Date()) {
  const d = parseUtc(value)
  return !!d && d.getTime() < now.getTime()
}

export function fmtDuration(seconds) {
  const s = Math.max(0, Math.floor(Number(seconds) || 0))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  return `${h}h ${String(m).padStart(2, '0')}m`
}

export function fmtClock(seconds) {
  const s = Math.max(0, Math.floor(Number(seconds) || 0))
  const pad = (n) => String(n).padStart(2, '0')
  return `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`
}

export function fmtMoney(value) {
  const n = Number(value)
  if (!n) return null
  if (n >= 10000000) return `₹${(n / 10000000).toFixed(n % 10000000 ? 2 : 0)} Cr`
  if (n >= 100000) return `₹${(n / 100000).toFixed(0)} L`
  return `₹${n.toLocaleString('en-IN')}`
}

export function humanize(value) {
  return String(value || '').replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase())
}

export const CALL_OUTCOMES = [
  { value: 'answered', label: 'Answered' },
  { value: 'interested', label: 'Interested' },
  { value: 'callback_requested', label: 'Callback requested' },
  { value: 'no_answer', label: 'No answer' },
  { value: 'busy', label: 'Busy' },
  { value: 'switched_off', label: 'Switched off' },
  { value: 'not_interested', label: 'Not interested' },
  { value: 'invalid_number', label: 'Invalid number' },
  { value: 'other', label: 'Other' },
]

export function downloadCsv(filename, rows) {
  if (!rows.length) return
  const headers = Object.keys(rows[0])
  const escape = (v) => {
    const s = v === null || v === undefined ? '' : String(v)
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const csv = [headers.join(','), ...rows.map((r) => headers.map((h) => escape(r[h])).join(','))].join('\n')
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
