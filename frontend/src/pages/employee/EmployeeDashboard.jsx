import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import {
  BadgeCheck, CalendarClock, CalendarDays, ClipboardList, Flame, Hourglass, MapPin, Phone, PhoneCall,
  Search, Sparkles, StickyNote, UserPlus,
} from 'lucide-react'
import clsx from 'clsx'
import { useAuth } from '../../auth/AuthContext'
import { useEmployeeWorkspace } from '../../hooks/useEmployeeWorkspace'
import { employeeService } from '../../services/employeeService'
import { EmptyState, ErrorBanner, LoadingBlock, PriorityBadge, StatusBadge } from '../../components/ui'
import { DataSourceBadge, Notice, OutcomeBadge, Panel, ShiftBar, StatTile, Tabs } from '../../components/employee/EmployeeUI'
import { useLeadActions } from '../../components/employee/LeadActions'
import { fmtDateTime, fmtDuration, fmtRelative, fmtTime, isPast, isToday, parseUtc } from '../../lib/format'

function greeting() {
  const h = new Date().getHours()
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'
}

const QUEUE_TABS = [
  { value: 'open', label: 'Open', test: (l) => !Number(l.is_terminal) },
  { value: 'new', label: 'New', test: (l) => [1, 2, 3].includes(Number(l.status_id)) },
  { value: 'due', label: 'Due today', test: (l) => !Number(l.is_terminal) && l.next_follow_up_at && (isToday(l.next_follow_up_at) || isPast(l.next_follow_up_at)) },
  { value: 'interested', label: 'Interested', test: (l) => Number(l.status_id) === 5 },
  { value: 'converted', label: 'Converted', test: (l) => Number(l.status_id) === 11 },
  { value: 'all', label: 'All', test: () => true },
]

export default function EmployeeDashboard() {
  const { user } = useAuth()
  const { data, source, loading, error, fetchedAt, reload } = useEmployeeWorkspace()
  const [notice, setNotice] = useState('')
  const [actionError, setActionError] = useState('')
  const [tab, setTab] = useState('open')
  const [query, setQuery] = useState('')
  const actions = useLeadActions({ workspace: data, source, reload, onNotice: setNotice, onError: setActionError })

  const queue = useMemo(() => {
    const t = QUEUE_TABS.find((x) => x.value === tab)
    const q = query.trim().toLowerCase()
    return (data?.leads || []).filter(t.test).filter((l) =>
      !q || l.full_name.toLowerCase().includes(q) || l.mobile.includes(q) || (l.lead_code || '').toLowerCase().includes(q))
  }, [data, tab, query])

  if (loading && !data) return <LoadingBlock label="Loading your workspace…" />
  if (error && !data) return <ErrorBanner message={error} />
  if (!data) return <EmptyState title="Workspace unavailable" />

  const { stats, profile, session, follow_ups: followUps, site_visits: visits, calls, attendance, performance } = data
  const todaysTasks = followUps.filter((f) => ['pending', 'overdue'].includes(f.status) && (isToday(f.due_at) || isPast(f.due_at)))
  const upcomingVisits = visits.filter((v) => v.status === 'scheduled').slice(0, 4)
  const chart = performance.daily.map((d) => ({ ...d, label: parseUtc(d.date).toLocaleDateString([], { day: '2-digit', month: 'short' }) }))

  const breakAction = (fn, msg) => actions.run(() => fn(source), msg)
  const completeTask = (id) => actions.run(() => employeeService.updateFollowUp(source, id, { status: 'completed' }), 'Follow-up marked complete.')

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-display text-3xl text-[var(--color-ink)]">{greeting()}, {(profile.full_name || user?.full_name || '').split(' ')[0]}</h1>
            <DataSourceBadge source={source} />
          </div>
          <p className="mt-1 text-sm text-[var(--color-ink-soft)]">
            {profile.employee_code} · {profile.department}{profile.manager_name ? ` · Reports to ${profile.manager_name}` : ''}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="btn btn-secondary" onClick={() => actions.openFollowUp()}><CalendarClock size={16} /> Schedule follow-up</button>
          <button className="btn btn-primary" onClick={() => actions.openCall()}><PhoneCall size={16} /> Log a call</button>
        </div>
      </div>

      <Notice notice={notice} onClose={() => setNotice('')} />
      <ErrorBanner message={actionError} />

      <ShiftBar
        session={session}
        fetchedAt={fetchedAt}
        busy={actions.busy}
        onStartBreak={() => breakAction(employeeService.startBreak, 'Break started. Enjoy your break!')}
        onEndBreak={() => breakAction(employeeService.endBreak, 'Welcome back — break ended.')}
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-7">
        <StatTile icon={ClipboardList} label="Assigned leads" value={stats.assigned_leads} hint={`${stats.open_leads} open`} to="/leads" />
        <StatTile icon={UserPlus} tone="sky" label="New leads" value={stats.new_leads} hint="Not yet contacted" />
        <StatTile icon={PhoneCall} tone="violet" label="Calls today" value={stats.calls_today} hint={`${stats.connected_today} connected`} to="/calls" />
        <StatTile icon={CalendarClock} tone="amber" label="Follow-ups" value={stats.follow_ups_today} hint={stats.overdue_follow_ups ? `${stats.overdue_follow_ups} overdue` : 'Due today'} to="/follow-ups" />
        <StatTile icon={Flame} tone="orange" label="Interested" value={stats.interested} hint="Hot prospects" />
        <StatTile icon={BadgeCheck} tone="emerald" label="Converted" value={stats.converted} hint={`${performance.summary.conversion_rate}% of leads`} to="/performance" />
        <StatTile icon={Hourglass} tone="rose" label="Pending" value={stats.pending} hint="Open follow-up tasks" to="/follow-ups" />
      </div>

      <div className="grid gap-5 2xl:grid-cols-[minmax(0,1fr)_340px]">
        <Panel
          title="Call queue"
          icon={Phone}
          bodyClassName="p-0"
          action={<span className="text-xs text-[var(--color-ink-soft)]">{queue.length} lead{queue.length === 1 ? '' : 's'}</span>}
        >
          <div className="flex flex-col gap-3 border-b border-[var(--color-line)] p-3 lg:flex-row lg:items-center lg:justify-between">
            <Tabs
              value={tab}
              onChange={setTab}
              tabs={QUEUE_TABS.map((t) => ({ value: t.value, label: t.label, count: data.leads.filter(t.test).length }))}
            />
            <label className="relative block lg:w-60">
              <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-ink-soft)]" />
              <input className="input py-2 pl-8 text-sm" placeholder="Search name, phone, code" value={query} onChange={(e) => setQuery(e.target.value)} />
            </label>
          </div>
          {queue.length === 0 ? (
            <div className="p-4"><EmptyState title="Nothing in this queue" subtitle="Try another tab or clear the search." /></div>
          ) : (
            <div className="table-wrap max-h-[560px]">
              <table className="data">
                <thead className="sticky top-0 z-10 bg-white">
                  <tr><th>Customer</th><th>Phone</th><th>Status</th><th>Priority</th><th>Last contact</th><th>Next follow-up</th><th className="text-right">Actions</th></tr>
                </thead>
                <tbody>
                  {queue.map((l) => {
                    const overdue = l.next_follow_up_at && isPast(l.next_follow_up_at) && !Number(l.is_terminal)
                    return (
                      <tr key={l.id} className="hover:bg-slate-50">
                        <td>
                          <Link to={`/leads/${l.id}`} className="font-semibold hover:text-[var(--color-brand)]">{l.full_name}</Link>
                          <div className="text-xs text-[var(--color-ink-soft)]">{l.lead_code} · {l.preferred_configuration || '—'} · {l.call_count} call{Number(l.call_count) === 1 ? '' : 's'}</div>
                        </td>
                        <td className="font-mono text-xs">{l.mobile}</td>
                        <td><StatusBadge status={l.status_name} /></td>
                        <td><PriorityBadge priority={l.priority} /></td>
                        <td className="text-xs">{l.last_contact_at ? <span title={fmtDateTime(l.last_contact_at)}>{fmtRelative(l.last_contact_at)}</span> : <span className="text-[var(--color-ink-soft)]">Never</span>}</td>
                        <td className={clsx('text-xs', overdue && 'font-semibold text-[var(--color-danger)]')}>
                          {l.next_follow_up_at ? <span title={fmtDateTime(l.next_follow_up_at)}>{fmtDateTime(l.next_follow_up_at)}{overdue ? ' · overdue' : ''}</span> : '—'}
                        </td>
                        <td>
                          <div className="flex justify-end gap-1.5">
                            <a
                              href={`tel:${l.mobile}`}
                              onClick={() => actions.openCall(l)}
                              className="btn btn-primary px-3 py-1.5 text-xs"
                              title={`Call ${l.mobile} and log the outcome`}
                            >
                              <Phone size={13} /> Call
                            </a>
                            <button className="btn btn-secondary px-2 py-1.5" title="Log call notes" onClick={() => actions.openCall(l)}><StickyNote size={14} /></button>
                            <button className="btn btn-secondary px-2 py-1.5" title="Schedule follow-up" onClick={() => actions.openFollowUp(l)}><CalendarClock size={14} /></button>
                            <button className="btn btn-secondary px-2 py-1.5" title="Schedule site visit" onClick={() => actions.openSiteVisit(l)}><MapPin size={14} /></button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Panel>

        <div className="grid content-start gap-5 lg:grid-cols-3 2xl:grid-cols-1">
          <Panel title="Today's follow-ups" icon={CalendarClock} action={<Link className="text-xs font-semibold text-[var(--color-brand)]" to="/follow-ups">View all</Link>}>
            {todaysTasks.length === 0 ? (
              <p className="text-sm text-[var(--color-ink-soft)]">You're all caught up for today.</p>
            ) : (
              <ul className="space-y-2">
                {todaysTasks.slice(0, 6).map((f) => (
                  <li key={f.id} className={clsx('rounded-xl border px-3 py-2', f.status === 'overdue' ? 'border-red-200 bg-red-50/60' : 'border-[var(--color-line)] bg-white')}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold">{f.title}</div>
                        <div className="text-xs text-[var(--color-ink-soft)]">{f.lead_name} · {fmtTime(f.due_at)} · {f.task_type}</div>
                      </div>
                      <PriorityBadge priority={f.priority} />
                    </div>
                    <div className="mt-2 flex gap-2">
                      <a className="btn btn-secondary px-2 py-1 text-xs" href={`tel:${f.mobile}`}><Phone size={12} /> Call</a>
                      <button className="btn btn-secondary px-2 py-1 text-xs" disabled={actions.busy} onClick={() => completeTask(f.id)}>Mark done</button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel title="Upcoming site visits" icon={MapPin} action={<Link className="text-xs font-semibold text-[var(--color-brand)]" to="/site-visits">Manage</Link>}>
            {upcomingVisits.length === 0 ? (
              <p className="text-sm text-[var(--color-ink-soft)]">No visits scheduled.</p>
            ) : (
              <ul className="space-y-2">
                {upcomingVisits.map((v) => (
                  <li key={v.id} className="flex items-center gap-3 rounded-xl border border-[var(--color-line)] bg-white px-3 py-2">
                    <div className="grid size-11 shrink-0 place-items-center rounded-lg bg-[var(--color-brand-soft)] text-center leading-tight text-[var(--color-brand-deep)]">
                      <div className="text-[10px] uppercase">{parseUtc(v.scheduled_at).toLocaleDateString([], { month: 'short' })}</div>
                      <div className="text-base font-bold">{parseUtc(v.scheduled_at).getDate()}</div>
                    </div>
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold">{v.lead_name}</div>
                      <div className="truncate text-xs text-[var(--color-ink-soft)]">{v.property_name || 'Property TBD'} · {fmtTime(v.scheduled_at)}</div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel title="This month's attendance" icon={CalendarDays} action={<Link className="text-xs font-semibold text-[var(--color-brand)]" to="/attendance">Details</Link>}>
            <div className="grid grid-cols-3 gap-2 text-center">
              {[
                ['Present', attendance.summary.present, 'text-emerald-700'],
                ['Absent', attendance.summary.absent, 'text-rose-700'],
                ['Late', attendance.summary.late, 'text-amber-700'],
              ].map(([label, value, tone]) => (
                <div key={label} className="rounded-xl bg-white px-2 py-2">
                  <div className={clsx('text-xl font-semibold', tone)}>{value}</div>
                  <div className="text-[11px] uppercase tracking-wide text-[var(--color-ink-soft)]">{label}</div>
                </div>
              ))}
            </div>
            <div className="mt-3 flex justify-between text-xs text-[var(--color-ink-soft)]">
              <span>Avg working day: <strong className="text-[var(--color-ink)]">{fmtDuration(attendance.summary.avg_working_seconds)}</strong></span>
              <span>Rate: <strong className="text-[var(--color-ink)]">{attendance.summary.attendance_rate}%</strong></span>
            </div>
          </Panel>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <Panel title="Calls — last 14 days" icon={Sparkles} action={<Link className="text-xs font-semibold text-[var(--color-brand)]" to="/performance">Full report</Link>}>
          <div className="h-60">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chart} margin={{ left: -20, right: 8, top: 8 }}>
                <defs>
                  <linearGradient id="callsFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#0f5c56" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#0f5c56" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#d7e0da" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Area isAnimationActive={false} type="monotone" dataKey="calls" name="Calls" stroke="#0f5c56" fill="url(#callsFill)" strokeWidth={2} />
                <Area isAnimationActive={false} type="monotone" dataKey="connected" name="Connected" stroke="#c45c26" fill="transparent" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel title="Recent calls & notes" icon={StickyNote} action={<Link className="text-xs font-semibold text-[var(--color-brand)]" to="/calls">Call history</Link>}>
          {calls.length === 0 ? <p className="text-sm text-[var(--color-ink-soft)]">No calls logged yet.</p> : (
            <ul className="max-h-60 space-y-3 overflow-auto pr-1">
              {calls.slice(0, 8).map((c) => (
                <li key={c.id} className="flex gap-3">
                  <span className="mt-1 grid size-7 shrink-0 place-items-center rounded-full bg-[var(--color-brand-soft)] text-[var(--color-brand)]"><Phone size={13} /></span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      <span className="font-semibold">{c.lead_name}</span>
                      <OutcomeBadge outcome={c.outcome} />
                      <span className="text-xs text-[var(--color-ink-soft)]">{fmtDateTime(c.initiated_at)}</span>
                    </div>
                    <p className="text-sm text-[var(--color-ink-soft)]">{c.notes || 'No notes'}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      {actions.element}
    </div>
  )
}
