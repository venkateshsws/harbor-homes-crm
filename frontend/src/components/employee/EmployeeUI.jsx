import clsx from 'clsx'
import { Link } from 'react-router-dom'
import { Coffee, Database, LogIn, Play, ShieldCheck, Timer, WifiOff } from 'lucide-react'
import { useNow } from '../../hooks/useEmployeeWorkspace'
import { fmtClock, fmtDuration, fmtTime, humanize, parseUtc } from '../../lib/format'

const TONES = {
  brand: 'bg-[var(--color-brand-soft)] text-[var(--color-brand)]',
  sky: 'bg-sky-50 text-sky-700',
  violet: 'bg-violet-50 text-violet-700',
  amber: 'bg-amber-50 text-amber-700',
  emerald: 'bg-emerald-50 text-emerald-700',
  rose: 'bg-rose-50 text-rose-700',
  slate: 'bg-slate-100 text-slate-700',
  orange: 'bg-orange-50 text-[var(--color-accent)]',
}

export function StatTile({ icon: Icon, label, value, hint, tone = 'brand', to }) {
  const body = (
    <div className="card-panel h-full p-4 transition hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-center gap-2">
        <span className={clsx('grid size-8 shrink-0 place-items-center rounded-lg', TONES[tone])}>
          <Icon size={16} />
        </span>
        <div className="text-[11px] font-semibold uppercase leading-tight tracking-wide text-[var(--color-ink-soft)]">{label}</div>
      </div>
      <div className="mt-2 text-2xl font-semibold leading-tight text-[var(--color-ink)]">{value ?? '—'}</div>
      {hint ? <div className="mt-0.5 text-xs text-[var(--color-ink-soft)]">{hint}</div> : null}
    </div>
  )
  return to ? <Link to={to} className="block">{body}</Link> : body
}

export function Panel({ title, icon: Icon, action, children, className, bodyClassName }) {
  return (
    <section className={clsx('card-panel flex min-w-0 flex-col', className)}>
      <header className="flex items-center justify-between gap-3 border-b border-[var(--color-line)] px-4 py-3">
        <h2 className="flex items-center gap-2 font-semibold">
          {Icon ? <Icon size={16} className="text-[var(--color-brand)]" /> : null}
          {title}
        </h2>
        {action}
      </header>
      <div className={clsx('min-w-0 flex-1 p-4', bodyClassName)}>{children}</div>
    </section>
  )
}

export function DataSourceBadge({ source }) {
  if (!source) return null
  return source === 'api' ? (
    <span className="badge gap-1 bg-amber-50 text-amber-900" title="Saved demo records in the frontend. There is no database.">
      <Database size={12} /> Demo data
    </span>
  ) : (
    <span className="badge gap-1 bg-amber-50 text-amber-900" title="API unreachable — showing in-memory demo data. Changes reset on reload.">
      <WifiOff size={12} /> Demo data (offline)
    </span>
  )
}

export function Notice({ notice, onClose }) {
  if (!notice) return null
  return (
    <div className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 animate-fade-up">
      <span>{notice}</span>
      <button className="text-xs font-semibold" onClick={onClose}>Dismiss</button>
    </div>
  )
}

export function Tabs({ tabs, value, onChange }) {
  return (
    <div className="flex flex-wrap gap-1 rounded-xl bg-[var(--color-brand-soft)] p-1">
      {tabs.map((t) => (
        <button
          key={t.value}
          type="button"
          onClick={() => onChange(t.value)}
          className={clsx(
            'rounded-lg px-3 py-1.5 text-xs font-semibold transition',
            value === t.value ? 'bg-white text-[var(--color-brand-deep)] shadow-sm' : 'text-[var(--color-ink-soft)] hover:text-[var(--color-ink)]',
          )}
        >
          {t.label}
          {t.count !== undefined ? <span className="ml-1.5 rounded-full bg-black/5 px-1.5">{t.count}</span> : null}
        </button>
      ))}
    </div>
  )
}

const OUTCOME_TONE = {
  answered: 'bg-emerald-50 text-emerald-800',
  interested: 'bg-teal-50 text-teal-800',
  callback_requested: 'bg-sky-50 text-sky-800',
  no_answer: 'bg-slate-100 text-slate-700',
  busy: 'bg-amber-50 text-amber-900',
  switched_off: 'bg-slate-100 text-slate-700',
  not_interested: 'bg-rose-50 text-rose-800',
  invalid_number: 'bg-red-50 text-red-800',
  other: 'bg-slate-100 text-slate-700',
}

export function OutcomeBadge({ outcome }) {
  return <span className={clsx('badge', OUTCOME_TONE[outcome] || OUTCOME_TONE.other)}>{humanize(outcome)}</span>
}

export function Avatar({ name, size = 'md' }) {
  const initials = String(name || '?').split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase()
  return (
    <span className={clsx(
      'grid shrink-0 place-items-center rounded-full bg-gradient-to-br from-[var(--color-brand)] to-[var(--color-brand-deep)] font-semibold text-white',
      size === 'lg' ? 'size-16 text-xl' : size === 'sm' ? 'size-8 text-xs' : 'size-10 text-sm',
    )}>
      {initials}
    </span>
  )
}

export function liveWorkingSeconds(today, fetchedAt, now) {
  if (!today) return 0
  const elapsed = today.is_open && !today.on_break_since ? Math.max(0, (now - fetchedAt) / 1000) : 0
  return today.working_seconds + elapsed
}

export function liveBreakSeconds(today, fetchedAt, now) {
  if (!today) return 0
  const elapsed = today.on_break_since ? Math.max(0, (now - fetchedAt) / 1000) : 0
  return today.break_seconds + elapsed
}

export function ShiftBar({ session, fetchedAt, onStartBreak, onEndBreak, busy }) {
  const now = useNow(1000)
  const today = session?.today
  const current = session?.current
  const onBreak = !!today?.on_break_since
  const status = !today?.is_open ? 'Logged out' : onBreak ? 'On break' : 'On shift'
  const working = liveWorkingSeconds(today, fetchedAt, now)
  const breaks = liveBreakSeconds(today, fetchedAt, now)
  const expires = parseUtc(current?.expires_at)

  return (
    <section className="relative overflow-hidden rounded-2xl bg-[var(--color-brand-deep)] p-4 text-white shadow-lg sm:p-5">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_85%_-20%,rgba(196,92,38,.45),transparent_45%),radial-gradient(circle_at_0%_120%,rgba(255,255,255,.12),transparent_40%)]" />
      <div className="relative grid gap-4 lg:grid-cols-[1fr_auto] lg:items-center">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div>
            <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-teal-100/80">
              <span className={clsx('size-2 rounded-full', !today?.is_open ? 'bg-slate-400' : onBreak ? 'bg-amber-400' : 'bg-emerald-400 animate-pulse')} />
              {status}
            </div>
            <div className="mt-1 flex items-center gap-1.5 text-lg font-semibold">
              <LogIn size={16} className="text-teal-100/80" />
              {fmtTime(today?.first_login_at || current?.login_at)}
            </div>
            <div className="text-xs text-teal-100/70">
              First login today{today?.is_late ? ' · marked late' : ''}
            </div>
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-wide text-teal-100/80">Working hours</div>
            <div className="mt-1 flex items-center gap-1.5 font-mono text-lg font-semibold tabular-nums">
              <Timer size={16} className="text-teal-100/80" />
              {fmtClock(working)}
            </div>
            <div className="text-xs text-teal-100/70">Login time minus breaks</div>
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-wide text-teal-100/80">Breaks</div>
            <div className="mt-1 flex items-center gap-1.5 text-lg font-semibold">
              <Coffee size={16} className="text-teal-100/80" />
              {fmtDuration(breaks)}
            </div>
            <div className="text-xs text-teal-100/70">{onBreak ? `Since ${fmtTime(today.on_break_since)}` : 'No break running'}</div>
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-wide text-teal-100/80">Session</div>
            <div className="mt-1 flex items-center gap-1.5 text-lg font-semibold">
              <ShieldCheck size={16} className="text-teal-100/80" />
              {session?.office_hours ? `${session.office_hours.start}–${session.office_hours.end}` : '—'}
            </div>
            <div className="truncate text-xs text-teal-100/70">
              Office hours (IST){expires ? ` · expires ${fmtTime(current.expires_at)}` : ''}
            </div>
          </div>
        </div>
        {today?.is_open ? (
          <div className="flex gap-2">
            {onBreak ? (
              <button className="btn bg-emerald-500 text-white hover:bg-emerald-600" disabled={busy} onClick={onEndBreak}>
                <Play size={16} /> Resume work
              </button>
            ) : (
              <button className="btn border-white/25 bg-white/10 text-white hover:bg-white/20" disabled={busy} onClick={onStartBreak}>
                <Coffee size={16} /> Start break
              </button>
            )}
          </div>
        ) : null}
      </div>
    </section>
  )
}
