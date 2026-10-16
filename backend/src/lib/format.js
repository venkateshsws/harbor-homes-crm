// The frontend expects timestamps as UTC "YYYY-MM-DD HH:MM:SS" strings (see frontend/src/lib/format.js).
export function toUtcSql(date) {
  if (!date) return null
  const d = date instanceof Date ? date : new Date(date)
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 19).replace('T', ' ')
}
