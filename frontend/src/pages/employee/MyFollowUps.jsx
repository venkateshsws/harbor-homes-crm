import { useMemo, useState } from 'react'
import { CalendarClock, CalendarPlus, CheckCircle2, Phone } from 'lucide-react'
import clsx from 'clsx'
import { useEmployeeWorkspace } from '../../hooks/useEmployeeWorkspace'
import { employeeService } from '../../services/employeeService'
import { EmptyState, ErrorBanner, LoadingBlock, Modal, PageHeader, PriorityBadge, StatusBadge } from '../../components/ui'
import { DataSourceBadge, Notice, Panel, Tabs } from '../../components/employee/EmployeeUI'
import { useLeadActions } from '../../components/employee/LeadActions'
import { fmtDateTime, fmtRelative, isPast, isToday, localInputValue, parseUtc, toUtcSql } from '../../lib/format'

const open = (f) => ['pending', 'overdue'].includes(f.status)
const TABS = [
  { value: 'overdue', label: 'Overdue', test: (f) => open(f) && isPast(f.due_at) },
  { value: 'today', label: 'Today', test: (f) => open(f) && isToday(f.due_at) && !isPast(f.due_at) },
  { value: 'upcoming', label: 'Upcoming', test: (f) => open(f) && !isToday(f.due_at) && !isPast(f.due_at) },
  { value: 'completed', label: 'Completed', test: (f) => f.status === 'completed' },
  { value: 'all', label: 'All', test: () => true },
]

export default function MyFollowUps() {
  const { data, source, loading, error, reload } = useEmployeeWorkspace()
  const [notice, setNotice] = useState('')
  const [actionError, setActionError] = useState('')
  const [tab, setTab] = useState('today')
  const [reschedule, setReschedule] = useState(null)
  const [newDue, setNewDue] = useState('')
  const actions = useLeadActions({ workspace: data, source, reload, onNotice: setNotice, onError: setActionError })

  const rows = useMemo(() => (data?.follow_ups || []).filter(TABS.find((t) => t.value === tab).test), [data, tab])

  if (loading && !data) return <LoadingBlock label="Loading follow-ups…" />
  if (error && !data) return <ErrorBanner message={error} />

  const update = (id, patch, msg) => actions.run(() => employeeService.updateFollowUp(source, id, patch), msg)

  return (
    <div className="space-y-5">
      <PageHeader
        title="Follow-ups"
        subtitle="Your scheduled callbacks, WhatsApp messages and meetings."
        actions={
          <>
            <DataSourceBadge source={source} />
            <button className="btn btn-primary" onClick={() => actions.openFollowUp()}><CalendarPlus size={16} /> Schedule follow-up</button>
          </>
        }
      />
      <Notice notice={notice} onClose={() => setNotice('')} />
      <ErrorBanner message={actionError} />

      <Panel
        title="Follow-up planner"
        icon={CalendarClock}
        action={<Tabs value={tab} onChange={setTab} tabs={TABS.map((t) => ({ value: t.value, label: t.label, count: data.follow_ups.filter(t.test).length }))} />}
      >
        {rows.length === 0 ? (
          <EmptyState title={tab === 'overdue' ? 'No overdue follow-ups' : 'Nothing here'} subtitle="Schedule a follow-up from a lead in your call queue." />
        ) : (
          <ul className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
            {rows.map((f) => {
              const overdue = open(f) && isPast(f.due_at)
              return (
                <li key={f.id} className={clsx('rounded-xl border bg-white p-4', overdue ? 'border-red-200' : 'border-[var(--color-line)]')}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-semibold">{f.title}</div>
                      <div className="text-sm text-[var(--color-ink-soft)]">{f.lead_name} · <span className="font-mono text-xs">{f.mobile}</span></div>
                    </div>
                    <PriorityBadge priority={f.priority} />
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                    <StatusBadge status={overdue ? 'overdue' : f.status} />
                    <span className="badge bg-slate-100 capitalize text-slate-700">{f.task_type.replace('_', ' ')}</span>
                    <span className={clsx(overdue && 'font-semibold text-[var(--color-danger)]')}>
                      {f.status === 'completed' ? `Done ${fmtDateTime(f.completed_at)}` : `${fmtDateTime(f.due_at)} (${fmtRelative(f.due_at)})`}
                    </span>
                  </div>
                  {f.notes ? <p className="mt-2 text-sm text-[var(--color-ink-soft)]">{f.notes}</p> : null}
                  {open(f) ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      <a className="btn btn-secondary px-2.5 py-1 text-xs" href={`tel:${f.mobile}`}
                        onClick={() => { const lead = data.leads.find((l) => l.id === f.lead_id); if (lead) actions.openCall(lead) }}>
                        <Phone size={12} /> Call
                      </a>
                      <button className="btn btn-primary px-2.5 py-1 text-xs" disabled={actions.busy} onClick={() => update(f.id, { status: 'completed' }, 'Follow-up completed.')}>
                        <CheckCircle2 size={12} /> Complete
                      </button>
                      <button className="btn btn-secondary px-2.5 py-1 text-xs" onClick={() => {
                        const base = parseUtc(f.due_at)
                        setNewDue(localInputValue(base && base > new Date() ? base : new Date(Date.now() + 3600 * 1000)))
                        setReschedule(f)
                      }}>Reschedule</button>
                      <button className="btn btn-secondary px-2.5 py-1 text-xs" disabled={actions.busy} onClick={() => update(f.id, { status: 'cancelled' }, 'Follow-up cancelled.')}>Cancel</button>
                    </div>
                  ) : null}
                </li>
              )
            })}
          </ul>
        )}
      </Panel>

      <Modal open={!!reschedule} title="Reschedule follow-up" onClose={() => setReschedule(null)}>
        {reschedule ? (
          <form className="grid gap-3" onSubmit={(e) => {
            e.preventDefault()
            update(reschedule.id, { status: 'rescheduled', due_at: toUtcSql(new Date(newDue)) }, 'Follow-up rescheduled.')
            setReschedule(null)
          }}>
            <div className="text-sm"><strong>{reschedule.title}</strong> · {reschedule.lead_name}</div>
            <input className="input" type="datetime-local" value={newDue} onChange={(e) => setNewDue(e.target.value)} required />
            <button className="btn btn-primary">Save new time</button>
          </form>
        ) : null}
      </Modal>
      {actions.element}
    </div>
  )
}
