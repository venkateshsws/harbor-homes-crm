import clsx from 'clsx'

export function KpiCard({ label, value, hint }) {
  return (
    <div className="card-panel p-4 animate-fade-up">
      <div className="text-xs uppercase tracking-wide text-[var(--color-ink-soft)]">{label}</div>
      <div className="mt-2 text-2xl font-semibold text-[var(--color-ink)]">{value ?? '—'}</div>
      {hint ? <div className="mt-1 text-xs text-[var(--color-ink-soft)]">{hint}</div> : null}
    </div>
  )
}

export function StatusBadge({ status }) {
  const s = String(status || '').toLowerCase()
  const tone =
    s.includes('convert') || s === 'completed' || s === 'active' || s === 'answered' || s === 'interested'
      ? 'bg-emerald-50 text-emerald-800'
      : s.includes('overdue') || s.includes('lost') || s === 'failed' || s === 'cancelled'
        ? 'bg-red-50 text-red-800'
        : s.includes('high') || s === 'urgent' || s.includes('pending')
          ? 'bg-amber-50 text-amber-900'
          : 'bg-slate-100 text-slate-700'
  return <span className={clsx('badge', tone)}>{status}</span>
}

export function PriorityBadge({ priority }) {
  const map = {
    urgent: 'bg-red-100 text-red-800',
    high: 'bg-orange-100 text-orange-800',
    medium: 'bg-sky-100 text-sky-800',
    low: 'bg-slate-100 text-slate-700',
  }
  return <span className={clsx('badge', map[priority] || map.medium)}>{priority}</span>
}

export function EmptyState({ title, subtitle }) {
  return (
    <div className="rounded-xl border border-dashed border-[var(--color-line)] bg-white/60 p-10 text-center">
      <div className="font-medium">{title}</div>
      {subtitle ? <p className="mt-1 text-sm text-[var(--color-ink-soft)]">{subtitle}</p> : null}
    </div>
  )
}

export function LoadingBlock({ label = 'Loading…' }) {
  return <div className="loading-pulse rounded-xl bg-white/70 p-8 text-center text-[var(--color-ink-soft)]">{label}</div>
}

export function ErrorBanner({ message }) {
  if (!message) return null
  return <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{message}</div>
}

export function PageHeader({ title, subtitle, actions }) {
  return (
    <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="font-display text-3xl text-[var(--color-ink)]">{title}</h1>
        {subtitle ? <p className="mt-1 text-sm text-[var(--color-ink-soft)]">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  )
}

export function Modal({ open, title, onClose, children, wide }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4" onClick={onClose}>
      <div
        className={clsx('card-panel max-h-[90vh] w-full overflow-auto p-5', wide ? 'max-w-3xl' : 'max-w-lg')}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="font-display text-xl">{title}</h2>
          <button className="btn btn-secondary" onClick={onClose}>Close</button>
        </div>
        {children}
      </div>
    </div>
  )
}
