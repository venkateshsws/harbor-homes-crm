import { useState } from 'react'
import { CalendarCheck2, CalendarDays, ChevronLeft, ChevronRight, CircleAlert, Clock, Coffee, History, LogOut, Timer } from 'lucide-react'
import clsx from 'clsx'
import { useEmployeeWorkspace } from '../../hooks/useEmployeeWorkspace'
import { employeeService } from '../../services/employeeService'
import { ErrorBanner, LoadingBlock, PageHeader } from '../../components/ui'
import { DataSourceBadge, Notice, Panel, ShiftBar, StatTile } from '../../components/employee/EmployeeUI'
import { fmtDate, fmtDateTime, fmtDuration, fmtTime, humanize, isPast } from '../../lib/format'

const DAY_STYLE = {
  present: 'bg-emerald-50 border-emerald-200 text-emerald-900',
  late: 'bg-amber-50 border-amber-200 text-amber-900',
  in_progress: 'bg-sky-50 border-sky-300 text-sky-900',
  missing_logout: 'bg-orange-50 border-orange-200 text-orange-900',
  absent: 'bg-rose-50 border-rose-200 text-rose-900',
  leave: 'bg-violet-50 border-violet-200 text-violet-900',
  holiday: 'bg-slate-50 border-slate-200 text-slate-500',
  not_logged_in: 'bg-white border-dashed border-slate-300 text-slate-500',
  upcoming: 'bg-white border-[var(--color-line)] text-slate-400',
}
const LEGEND = ['present', 'late', 'in_progress', 'missing_logout', 'absent', 'leave', 'holiday']

function shiftMonth(month, delta) {
  const [y, m] = month.split('-').map(Number)
  const d = new Date(Date.UTC(y, m - 1 + delta, 1))
  return d.toISOString().slice(0, 7)
}

export default function MyAttendance() {
  const [current] = useState(() => new Date().toISOString().slice(0, 7))
  const [month, setMonth] = useState(current)
  const { data, source, loading, error, fetchedAt, reload } = useEmployeeWorkspace()
  const [monthData, setMonthData] = useState(null)
  const [monthLoading, setMonthLoading] = useState(false)
  const [notice, setNotice] = useState('')
  const [actionError, setActionError] = useState('')
  const [busy, setBusy] = useState(false)

  const changeMonth = (next) => {
    setMonth(next)
    if (next === current) return
    setMonthLoading(true)
    employeeService.getAttendance(next)
      .then(({ data: d }) => setMonthData(d))
      .catch((e) => setActionError(e.message))
      .finally(() => setMonthLoading(false))
  }

  if (loading && !data) return <LoadingBlock label="Loading attendance…" />
  if (error && !data) return <ErrorBanner message={error} />

  const att = month !== current && monthData?.month === month ? monthData : data.attendance
  const s = att.summary
  const firstWeekday = att.days[0]?.weekday ?? 0
  const monthLabel = new Date(`${att.from}T00:00:00Z`).toLocaleDateString([], { month: 'long', year: 'numeric', timeZone: 'UTC' })

  const breakAction = async (fn, msg) => {
    setBusy(true)
    try { await fn(source); setNotice(msg); await reload({ silent: true }) }
    catch (e) { setActionError(e.message) }
    finally { setBusy(false) }
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="My attendance"
        subtitle="Attendance starts automatically when you sign in and closes when you log out."
        actions={<DataSourceBadge source={source} />}
      />
      <Notice notice={notice} onClose={() => setNotice('')} />
      <ErrorBanner message={actionError} />

      <ShiftBar
        session={data.session}
        fetchedAt={fetchedAt}
        busy={busy}
        onStartBreak={() => breakAction(employeeService.startBreak, 'Break started.')}
        onEndBreak={() => breakAction(employeeService.endBreak, 'Break ended.')}
      />

      <div className="flex items-center justify-between">
        <h2 className="font-display text-2xl">{monthLabel}</h2>
        <div className="flex gap-2">
          <button className="btn btn-secondary px-2.5" aria-label="Previous month" onClick={() => changeMonth(shiftMonth(month, -1))}><ChevronLeft size={16} /></button>
          <button className="btn btn-secondary" disabled={month === current} onClick={() => changeMonth(current)}>This month</button>
          <button className="btn btn-secondary px-2.5" aria-label="Next month" disabled={month >= current} onClick={() => changeMonth(shiftMonth(month, 1))}><ChevronRight size={16} /></button>
        </div>
      </div>

      <div className={clsx('grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6', monthLoading && 'opacity-60')}>
        <StatTile icon={CalendarCheck2} tone="emerald" label="Present days" value={`${s.present}/${s.working_days}`} hint={`${s.attendance_rate}% attendance`} />
        <StatTile icon={CircleAlert} tone="rose" label="Absent" value={s.absent} hint={`${s.leave} on approved leave`} />
        <StatTile icon={Clock} tone="amber" label="Late logins" value={s.late} hint={`${s.early_logout} early logouts`} />
        <StatTile icon={Timer} label="Working hours" value={fmtDuration(s.working_seconds)} hint="Total this month" />
        <StatTile icon={CalendarDays} tone="sky" label="Avg per day" value={fmtDuration(s.avg_working_seconds)} />
        <StatTile icon={Coffee} tone="slate" label="Breaks" value={fmtDuration(s.break_seconds)} hint={`${s.missing_logout} missing logout`} />
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        <Panel title="Monthly calendar" icon={CalendarDays}>
          <div className="grid grid-cols-7 gap-1.5 text-center text-[11px] font-semibold uppercase tracking-wide text-[var(--color-ink-soft)]">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => <div key={d}>{d}</div>)}
          </div>
          <div className="mt-1.5 grid grid-cols-7 gap-1.5">
            {Array.from({ length: firstWeekday }).map((_, i) => <div key={`pad-${i}`} />)}
            {att.days.map((d) => (
              <div
                key={d.date}
                title={`${fmtDate(d.date)} — ${humanize(d.status)}${d.login_at ? ` · in ${fmtTime(d.login_at)}` : ''}${d.logout_at ? ` · out ${fmtTime(d.logout_at)}` : ''}`}
                className={clsx('flex min-h-16 flex-col rounded-lg border p-1.5 text-left', DAY_STYLE[d.status])}
              >
                <span className="text-xs font-bold">{Number(d.date.slice(8))}</span>
                {d.working_seconds ? <span className="mt-auto text-[10px] font-medium">{fmtDuration(d.working_seconds)}</span> : null}
                {['absent', 'leave', 'holiday'].includes(d.status) ? <span className="mt-auto text-[10px] capitalize">{d.status}</span> : null}
              </div>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap gap-3 text-xs">
            {LEGEND.map((k) => (
              <span key={k} className="flex items-center gap-1.5"><span className={clsx('size-3 rounded border', DAY_STYLE[k])} />{humanize(k)}</span>
            ))}
          </div>
          <p className="mt-3 text-xs text-[var(--color-ink-soft)]">{att.note}</p>
        </Panel>

        <Panel title="Daily log" icon={Clock} bodyClassName="p-0">
          <div className="table-wrap max-h-[480px]">
            <table className="data">
              <thead className="sticky top-0 bg-white"><tr><th>Date</th><th>Login</th><th>Logout</th><th>Working</th><th>Break</th><th>Status</th></tr></thead>
              <tbody>
                {att.days.filter((d) => d.login_at || ['absent', 'leave'].includes(d.status)).reverse().map((d) => (
                  <tr key={d.date}>
                    <td>{new Date(`${d.date}T00:00:00Z`).toLocaleDateString([], { weekday: 'short', day: '2-digit', month: 'short', timeZone: 'UTC' })}</td>
                    <td>{d.login_at ? fmtTime(d.login_at) : '—'}</td>
                    <td>{d.logout_at ? fmtTime(d.logout_at) : d.status === 'in_progress' ? 'On shift' : '—'}</td>
                    <td>{d.working_seconds ? fmtDuration(d.working_seconds) : '—'}</td>
                    <td>{d.break_seconds ? fmtDuration(d.break_seconds) : '—'}</td>
                    <td><span className={clsx('badge border', DAY_STYLE[d.status])}>{humanize(d.status)}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>

      <Panel title="Login / logout sessions" icon={History} bodyClassName="p-0">
        <div className="table-wrap">
          <table className="data">
            <thead><tr><th>Signed in</th><th>Signed out</th><th>Last activity</th><th>IP address</th></tr></thead>
            <tbody>
              {data.session.recent.map((r, i) => (
                <tr key={`${r.login_at}-${i}`}>
                  <td>{fmtDateTime(r.login_at)}</td>
                  <td>{r.logout_at ? <span className="flex items-center gap-1"><LogOut size={12} /> {fmtDateTime(r.logout_at)}</span> : isPast(r.expires_at) ? <span className="badge bg-slate-100 text-slate-700">Expired without logout</span> : <span className="badge bg-emerald-50 text-emerald-800">Active</span>}</td>
                  <td>{fmtDateTime(r.last_seen_at)}</td>
                  <td className="font-mono text-xs">{r.ip_address || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  )
}
