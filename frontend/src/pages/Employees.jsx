
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  BadgeCheck,
  CalendarClock,
  CalendarDays,
  ClipboardList,
  Flame,
  Hourglass,
  MapPin,
  Phone,
  PhoneCall,
  Search,
  StickyNote,
  UserPlus,
} from 'lucide-react'
import clsx from 'clsx'

import { useAuth } from '../auth/AuthContext'
import { useEmployeeWorkspace } from '../hooks/useEmployeeWorkspace'
import { employeeService } from '../services/employeeService'
import {
  EmptyState,
  ErrorBanner,
  LoadingBlock,
  PriorityBadge,
  StatusBadge,
} from '../components/ui'
import {
  DataSourceBadge,
  Notice,
  OutcomeBadge,
  Panel,
  ShiftBar,
  StatTile,
  Tabs,
} from '../components/employee/EmployeeUI'
import { useLeadActions } from '../components/employee/LeadActions'
import {
  PipelineDonut,
  TrendAreaChart,
} from '../components/DashboardAnalytics'
import {
  fmtDateTime,
  fmtDuration,
  fmtRelative,
  fmtTime,
  isPast,
  isToday,
  parseUtc,
} from '../lib/format'

function greeting() {
  const hour = new Date().getHours()

  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

const QUEUE_TABS = [
  {
    value: 'open',
    label: 'Open',
    test: (lead) => !Number(lead.is_terminal),
  },
  {
    value: 'new',
    label: 'New',
    test: (lead) => [1, 2, 3].includes(Number(lead.status_id)),
  },
  {
    value: 'due',
    label: 'Due today',
    test: (lead) =>
      !Number(lead.is_terminal) &&
      lead.next_follow_up_at &&
      (isToday(lead.next_follow_up_at) ||
        isPast(lead.next_follow_up_at)),
  },
  {
    value: 'interested',
    label: 'Interested',
    test: (lead) => Number(lead.status_id) === 5,
  },
  {
    value: 'converted',
    label: 'Converted',
    test: (lead) => Number(lead.status_id) === 11,
  },
  {
    value: 'all',
    label: 'All',
    test: () => true,
  },
]

export default function EmployeeDashboard() {
  const { user } = useAuth()

  const {
    data,
    source,
    loading,
    error,
    fetchedAt,
    reload,
  } = useEmployeeWorkspace()

  const [notice, setNotice] = useState('')
  const [actionError, setActionError] = useState('')
  const [tab, setTab] = useState('open')
  const [query, setQuery] = useState('')

  const actions = useLeadActions({
    workspace: data,
    source,
    reload,
    onNotice: setNotice,
    onError: setActionError,
  })

  const queue = useMemo(() => {
    const selectedTab = QUEUE_TABS.find(
      (item) => item.value === tab,
    )

    const search = query.trim().toLowerCase()

    return (data?.leads || [])
      .filter(selectedTab.test)
      .filter(
        (lead) =>
          !search ||
          (lead.full_name || '').toLowerCase().includes(search) ||
          (lead.mobile || '').includes(search) ||
          (lead.lead_code || '').toLowerCase().includes(search),
      )
  }, [data, tab, query])

  if (loading && !data) {
    return <LoadingBlock label="Loading your workspace…" />
  }

  if (error && !data) {
    return <ErrorBanner message={error} />
  }

  if (!data) {
    return <EmptyState title="Workspace unavailable" />
  }

  const {
    stats,
    profile,
    session,
    follow_ups: followUps,
    site_visits: visits,
    calls,
    attendance,
    performance,
  } = data

  const todaysTasks = followUps.filter(
    (task) =>
      ['pending', 'overdue'].includes(task.status) &&
      (isToday(task.due_at) || isPast(task.due_at)),
  )

  const upcomingVisits = visits
    .filter((visit) => visit.status === 'scheduled')
    .slice(0, 4)

  const dailyPerformance = performance.daily || []
  const pipeline = performance.pipeline || []

  const chart = dailyPerformance.map((day) => ({
    ...day,
    label: parseUtc(day.date).toLocaleDateString([], {
      day: '2-digit',
      month: 'short',
    }),
  }))

  const breakAction = (fn, message) =>
    actions.run(() => fn(source), message)

  const completeTask = (id) =>
    actions.run(
      () =>
        employeeService.updateFollowUp(source, id, {
          status: 'completed',
        }),
      'Follow-up marked complete.',
    )

  return (
    <div className="space-y-5">
      {/* Dashboard heading */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-display text-3xl text-[var(--color-ink)]">
              {greeting()},{' '}
              {(profile.full_name || user?.full_name || '').split(' ')[0]}
            </h1>

            <DataSourceBadge source={source} />
          </div>

          <p className="mt-1 text-sm text-[var(--color-ink-soft)]">
            {profile.employee_code} · {profile.department}
            {profile.manager_name
              ? ` · Reports to ${profile.manager_name}`
              : ''}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            className="btn btn-secondary"
            onClick={() => actions.openFollowUp()}
          >
            <CalendarClock size={16} />
            Schedule follow-up
          </button>

          <button
            className="btn btn-primary"
            onClick={() => actions.openCall()}
          >
            <PhoneCall size={16} />
            Log a call
          </button>
        </div>
      </div>

      <Notice
        notice={notice}
        onClose={() => setNotice('')}
      />

      <ErrorBanner message={actionError} />

      {/* Attendance and break controls */}
      <ShiftBar
        session={session}
        fetchedAt={fetchedAt}
        busy={actions.busy}
        onStartBreak={() =>
          breakAction(
            employeeService.startBreak,
            'Break started. Enjoy your break!',
          )
        }
        onEndBreak={() =>
          breakAction(
            employeeService.endBreak,
            'Welcome back — break ended.',
          )
        }
      />

      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-7">
        <StatTile
          icon={ClipboardList}
          label="Assigned leads"
          value={stats.assigned_leads}
          hint={`${stats.open_leads} open`}
          to="/leads"
        />

        <StatTile
          icon={UserPlus}
          tone="sky"
          label="New leads"
          value={stats.new_leads}
          hint="Not yet contacted"
        />

        <StatTile
          icon={PhoneCall}
          tone="violet"
          label="Calls today"
          value={stats.calls_today}
          hint={`${stats.connected_today} connected`}
          to="/calls"
        />

        <StatTile
          icon={CalendarClock}
          tone="amber"
          label="Follow-ups"
          value={stats.follow_ups_today}
          hint={
            stats.overdue_follow_ups
              ? `${stats.overdue_follow_ups} overdue`
              : 'Due today'
          }
          to="/follow-ups"
        />

        <StatTile
          icon={Flame}
          tone="orange"
          label="Interested"
          value={stats.interested}
          hint="Hot prospects"
        />

        <StatTile
          icon={BadgeCheck}
          tone="emerald"
          label="Converted"
          value={stats.converted}
          hint={`${performance.summary.conversion_rate}% of leads`}
          to="/performance"
        />

        <StatTile
          icon={Hourglass}
          tone="rose"
          label="Pending"
          value={stats.pending}
          hint="Open follow-up tasks"
          to="/follow-ups"
        />
      </div>

      {/* Lead queue and employee tasks */}
      <div className="grid gap-5 2xl:grid-cols-[minmax(0,1fr)_340px]">
        <Panel
          title="Call queue"
          icon={Phone}
          bodyClassName="p-0"
          action={
            <span className="text-xs text-[var(--color-ink-soft)]">
              {queue.length} lead{queue.length === 1 ? '' : 's'}
            </span>
          }
        >
          <div className="flex flex-col gap-3 border-b border-[var(--color-line)] p-3 lg:flex-row lg:items-center lg:justify-between">
            <Tabs
              value={tab}
              onChange={setTab}
              tabs={QUEUE_TABS.map((item) => ({
                value: item.value,
                label: item.label,
                count: data.leads.filter(item.test).length,
              }))}
            />

            <label className="relative block lg:w-60">
              <Search
                size={14}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-ink-soft)]"
              />

              <input
                className="input py-2 pl-8 text-sm"
                placeholder="Search name, phone, code"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </label>
          </div>

          {queue.length === 0 ? (
            <div className="p-4">
              <EmptyState
                title="Nothing in this queue"
                subtitle="Try another tab or clear the search."
              />
            </div>
          ) : (
            <div className="table-wrap max-h-[560px]">
              <table className="data">
                <thead className="sticky top-0 z-10 bg-white">
                  <tr>
                    <th>Customer</th>
                    <th>Phone</th>
                    <th>Status</th>
                    <th>Priority</th>
                    <th>Last contact</th>
                    <th>Next follow-up</th>
                    <th className="text-right">Actions</th>
                  </tr>
                </thead>

                <tbody>
                  {queue.map((lead) => {
                    const overdue =
                      lead.next_follow_up_at &&
                      isPast(lead.next_follow_up_at) &&
                      !Number(lead.is_terminal)

                    return (
                      <tr
                        key={lead.id}
                        className="hover:bg-slate-50"
                      >
                        <td>
                          <Link
                            to={`/leads/${lead.id}`}
                            className="font-semibold hover:text-[var(--color-brand)]"
                          >
                            {lead.full_name}
                          </Link>

                          <div className="text-xs text-[var(--color-ink-soft)]">
                            {lead.lead_code} ·{' '}
                            {lead.preferred_configuration || '—'} ·{' '}
                            {lead.call_count} call
                            {Number(lead.call_count) === 1 ? '' : 's'}
                          </div>
                        </td>

                        <td className="font-mono text-xs">
                          {lead.mobile}
                        </td>

                        <td>
                          <StatusBadge status={lead.status_name} />
                        </td>

                        <td>
                          <PriorityBadge priority={lead.priority} />
                        </td>

                        <td className="text-xs">
                          {lead.last_contact_at ? (
                            <span title={fmtDateTime(lead.last_contact_at)}>
                              {fmtRelative(lead.last_contact_at)}
                            </span>
                          ) : (
                            <span className="text-[var(--color-ink-soft)]">
                              Never
                            </span>
                          )}
                        </td>

                        <td
                          className={clsx(
                            'text-xs',
                            overdue &&
                              'font-semibold text-[var(--color-danger)]',
                          )}
                        >
                          {lead.next_follow_up_at ? (
                            <span title={fmtDateTime(lead.next_follow_up_at)}>
                              {fmtDateTime(lead.next_follow_up_at)}
                              {overdue ? ' · overdue' : ''}
                            </span>
                          ) : (
                            '—'
                          )}
                        </td>

                        <td>
                          <div className="flex justify-end gap-1.5">
                            <a
                              href={`tel:${lead.mobile}`}
                              onClick={() => actions.openCall(lead)}
                              className="btn btn-primary px-3 py-1.5 text-xs"
                              title={`Call ${lead.mobile} and log the outcome`}
                            >
                              <Phone size={13} />
                              Call
                            </a>

                            <button
                              className="btn btn-secondary px-2 py-1.5"
                              title="Log call notes"
                              onClick={() => actions.openCall(lead)}
                            >
                              <StickyNote size={14} />
                            </button>

                            <button
                              className="btn btn-secondary px-2 py-1.5"
                              title="Schedule follow-up"
                              onClick={() => actions.openFollowUp(lead)}
                            >
                              <CalendarClock size={14} />
                            </button>

                            <button
                              className="btn btn-secondary px-2 py-1.5"
                              title="Schedule site visit"
                              onClick={() => actions.openSiteVisit(lead)}
                            >
                              <MapPin size={14} />
                            </button>
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

        {/* Follow-ups, site visits and attendance */}
        <div className="grid content-start gap-5 lg:grid-cols-3 2xl:grid-cols-1">
          <Panel
            title="Today's follow-ups"
            icon={CalendarClock}
            action={
              <Link
                className="text-xs font-semibold text-[var(--color-brand)]"
                to="/follow-ups"
              >
                View all
              </Link>
            }
          >
            {todaysTasks.length === 0 ? (
              <p className="text-sm text-[var(--color-ink-soft)]">
                You're all caught up for today.
              </p>
            ) : (
              <ul className="space-y-2">
                {todaysTasks.slice(0, 6).map((task) => (
                  <li
                    key={task.id}
                    className={clsx(
                      'rounded-xl border px-3 py-2',
                      task.status === 'overdue'
                        ? 'border-red-200 bg-red-50/60'
                        : 'border-[var(--color-line)] bg-white',
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold">
                          {task.title}
                        </div>

                        <div className="text-xs text-[var(--color-ink-soft)]">
                          {task.lead_name} · {fmtTime(task.due_at)} ·{' '}
                          {task.task_type}
                        </div>
                      </div>

                      <PriorityBadge priority={task.priority} />
                    </div>

                    <div className="mt-2 flex gap-2">
                      <a
                        className="btn btn-secondary px-2 py-1 text-xs"
                        href={`tel:${task.mobile}`}
                      >
                        <Phone size={12} />
                        Call
                      </a>

                      <button
                        className="btn btn-secondary px-2 py-1 text-xs"
                        disabled={actions.busy}
                        onClick={() => completeTask(task.id)}
                      >
                        Mark done
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel
            title="Upcoming site visits"
            icon={MapPin}
            action={
              <Link
                className="text-xs font-semibold text-[var(--color-brand)]"
                to="/site-visits"
              >
                Manage
              </Link>
            }
          >
            {upcomingVisits.length === 0 ? (
              <p className="text-sm text-[var(--color-ink-soft)]">
                No visits scheduled.
              </p>
            ) : (
              <ul className="space-y-2">
                {upcomingVisits.map((visit) => (
                  <li
                    key={visit.id}
                    className="flex items-center gap-3 rounded-xl border border-[var(--color-line)] bg-white px-3 py-2"
                  >
                    <div className="grid size-11 shrink-0 place-items-center rounded-lg bg-[var(--color-brand-soft)] text-center leading-tight text-[var(--color-brand-deep)]">
                      <div className="text-[10px] uppercase">
                        {parseUtc(visit.scheduled_at).toLocaleDateString([], {
                          month: 'short',
                        })}
                      </div>

                      <div className="text-base font-bold">
                        {parseUtc(visit.scheduled_at).getDate()}
                      </div>
                    </div>

                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold">
                        {visit.lead_name}
                      </div>

                      <div className="truncate text-xs text-[var(--color-ink-soft)]">
                        {visit.property_name || 'Property TBD'} ·{' '}
                        {fmtTime(visit.scheduled_at)}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel
            title="This month's attendance"
            icon={CalendarDays}
            action={
              <Link
                className="text-xs font-semibold text-[var(--color-brand)]"
                to="/attendance"
              >
                Details
              </Link>
            }
          >
            <div className="grid grid-cols-3 gap-2 text-center">
              {[
                ['Present', attendance.summary.present, 'text-emerald-700'],
                ['Absent', attendance.summary.absent, 'text-rose-700'],
                ['Late', attendance.summary.late, 'text-amber-700'],
              ].map(([label, value, tone]) => (
                <div
                  key={label}
                  className="rounded-xl bg-white px-2 py-2"
                >
                  <div className={clsx('text-xl font-semibold', tone)}>
                    {value}
                  </div>

                  <div className="text-[11px] uppercase tracking-wide text-[var(--color-ink-soft)]">
                    {label}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-3 flex justify-between text-xs text-[var(--color-ink-soft)]">
              <span>
                Avg working day:{' '}
                <strong className="text-[var(--color-ink)]">
                  {fmtDuration(attendance.summary.avg_working_seconds)}
                </strong>
              </span>

              <span>
                Rate:{' '}
                <strong className="text-[var(--color-ink)]">
                  {attendance.summary.attendance_rate}%
                </strong>
              </span>
            </div>
          </Panel>
        </div>
      </div>

      {/* Gradient activity chart and recent calls */}
      <div className="grid gap-5 xl:grid-cols-2">
        <div className="min-w-0">
          <TrendAreaChart
            title="My activity"
            subtitle="Calls and connected calls over the last 14 days"
            data={chart}
            series={[
              { key: 'calls', name: 'Calls', color: '#8b5cf6' },
              { key: 'connected', name: 'Connected', color: '#06b6d4' },
            ]}
          />

          <div className="mt-3 flex justify-end">
            <Link
              className="text-xs font-semibold text-[var(--color-brand)]"
              to="/performance"
            >
              View full performance report →
            </Link>
          </div>
        </div>

        <Panel
          title="Recent calls & notes"
          icon={StickyNote}
          action={
            <Link
              className="text-xs font-semibold text-[var(--color-brand)]"
              to="/calls"
            >
              Call history
            </Link>
          }
        >
          {calls.length === 0 ? (
            <p className="text-sm text-[var(--color-ink-soft)]">
              No calls logged yet.
            </p>
          ) : (
            <ul className="max-h-60 space-y-3 overflow-auto pr-1">
              {calls.slice(0, 8).map((call) => (
                <li key={call.id} className="flex gap-3">
                  <span className="mt-1 grid size-7 shrink-0 place-items-center rounded-full bg-[var(--color-brand-soft)] text-[var(--color-brand)]">
                    <Phone size={13} />
                  </span>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      <span className="font-semibold">
                        {call.lead_name}
                      </span>

                      <OutcomeBadge outcome={call.outcome} />

                      <span className="text-xs text-[var(--color-ink-soft)]">
                        {fmtDateTime(call.initiated_at)}
                      </span>
                    </div>

                    <p className="text-sm text-[var(--color-ink-soft)]">
                      {call.notes || 'No notes'}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      {/* Lead pipeline and daily performance trend */}
      <div className="grid gap-5 xl:grid-cols-2">
        <PipelineDonut
          data={pipeline.map((row) => ({
            name: row.name,
            value: Number(row.cnt || 0),
          }))}
        />

        <TrendAreaChart
          title="Performance trend"
          subtitle="Daily calls and conversions"
          data={dailyPerformance.map((row) => ({
            ...row,
            label: parseUtc(row.date).toLocaleDateString([], {
              day: '2-digit',
              month: 'short',
            }),
          }))}
          series={[
            { key: 'calls', name: 'Calls', color: '#8b5cf6' },
            {
              key: 'conversions',
              name: 'Conversions',
              color: '#f59e0b',
            },
          ]}
        />
      </div>

      {/* Preserve existing call/follow-up modal actions */}
      {actions.element}
    </div>
  )
}
