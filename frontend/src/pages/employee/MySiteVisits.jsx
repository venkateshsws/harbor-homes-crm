import { useState } from 'react'
import { CalendarPlus, MapPin, Phone } from 'lucide-react'
import { useEmployeeWorkspace } from '../../hooks/useEmployeeWorkspace'
import { employeeService } from '../../services/employeeService'
import { EmptyState, ErrorBanner, LoadingBlock, Modal, PageHeader, StatusBadge } from '../../components/ui'
import { DataSourceBadge, Notice, Panel } from '../../components/employee/EmployeeUI'
import { useLeadActions } from '../../components/employee/LeadActions'
import { fmtDateTime, fmtRelative, fmtTime, humanize, parseUtc } from '../../lib/format'

export default function MySiteVisits() {
  const { data, source, loading, error, reload } = useEmployeeWorkspace()
  const [notice, setNotice] = useState('')
  const [actionError, setActionError] = useState('')
  const [closing, setClosing] = useState(null)
  const [outcome, setOutcome] = useState('completed')
  const [feedback, setFeedback] = useState('')
  const actions = useLeadActions({ workspace: data, source, reload, onNotice: setNotice, onError: setActionError })

  if (loading && !data) return <LoadingBlock label="Loading site visits…" />
  if (error && !data) return <ErrorBanner message={error} />

  const upcoming = data.site_visits.filter((v) => v.status === 'scheduled')
  const past = data.site_visits.filter((v) => v.status !== 'scheduled')

  return (
    <div className="space-y-5">
      <PageHeader
        title="Site visits"
        subtitle="Schedule property visits for your leads and record customer feedback."
        actions={
          <>
            <DataSourceBadge source={source} />
            <button className="btn btn-primary" onClick={() => actions.openSiteVisit()}><CalendarPlus size={16} /> Schedule visit</button>
          </>
        }
      />
      <Notice notice={notice} onClose={() => setNotice('')} />
      <ErrorBanner message={actionError} />

      <Panel title={`Upcoming (${upcoming.length})`} icon={MapPin}>
        {upcoming.length === 0 ? <EmptyState title="No visits scheduled" subtitle="Interested leads are good candidates for a site visit." /> : (
          <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {upcoming.map((v) => {
              const d = parseUtc(v.scheduled_at)
              return (
                <li key={v.id} className="flex gap-3 rounded-xl border border-[var(--color-line)] bg-white p-4">
                  <div className="grid h-16 w-14 shrink-0 place-items-center rounded-xl bg-[var(--color-brand-deep)] text-center leading-tight text-white">
                    <div>
                      <div className="text-[10px] uppercase tracking-wide text-teal-100">{d.toLocaleDateString([], { weekday: 'short' })}</div>
                      <div className="text-xl font-bold">{d.getDate()}</div>
                      <div className="text-[10px] uppercase text-teal-100">{d.toLocaleDateString([], { month: 'short' })}</div>
                    </div>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold">{v.lead_name}</div>
                    <div className="text-sm text-[var(--color-ink-soft)]">{v.property_name || 'Property to be decided'}</div>
                    <div className="mt-1 text-xs text-[var(--color-ink-soft)]">{fmtTime(v.scheduled_at)} · {fmtRelative(v.scheduled_at)}</div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <a className="btn btn-secondary px-2.5 py-1 text-xs" href={`tel:${v.mobile}`}><Phone size={12} /> Confirm</a>
                      <button className="btn btn-primary px-2.5 py-1 text-xs" onClick={() => { setClosing(v); setOutcome('completed'); setFeedback('') }}>Record outcome</button>
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </Panel>

      <Panel title="Visit history" icon={MapPin} bodyClassName="p-0">
        {past.length === 0 ? <div className="p-4"><EmptyState title="No completed visits yet" /></div> : (
          <div className="table-wrap">
            <table className="data">
              <thead><tr><th>When</th><th>Customer</th><th>Property</th><th>Status</th><th>Feedback</th></tr></thead>
              <tbody>
                {past.map((v) => (
                  <tr key={v.id}>
                    <td>{fmtDateTime(v.scheduled_at)}</td>
                    <td className="font-semibold">{v.lead_name}</td>
                    <td>{v.property_name || '—'}</td>
                    <td><StatusBadge status={humanize(v.status)} /></td>
                    <td className="max-w-md whitespace-normal text-sm text-[var(--color-ink-soft)]">{v.feedback || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <Modal open={!!closing} title="Record visit outcome" onClose={() => setClosing(null)}>
        {closing ? (
          <form className="grid gap-3" onSubmit={(e) => {
            e.preventDefault()
            actions.run(() => employeeService.updateSiteVisit(source, closing.id, { status: outcome, feedback: feedback.trim() || null }), 'Site visit updated.')
            setClosing(null)
          }}>
            <div className="text-sm"><strong>{closing.lead_name}</strong> · {closing.property_name || 'Property TBD'} · {fmtDateTime(closing.scheduled_at)}</div>
            <label className="text-sm">
              Outcome
              <select className="select mt-1" value={outcome} onChange={(e) => setOutcome(e.target.value)}>
                <option value="completed">Visit completed</option>
                <option value="no_show">Customer did not show up</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </label>
            <label className="text-sm">
              Customer feedback
              <textarea className="textarea mt-1 min-h-24" value={feedback} onChange={(e) => setFeedback(e.target.value)} placeholder="What did they like? Objections? Next step?" required={outcome === 'completed'} />
            </label>
            <button className="btn btn-primary">Save</button>
          </form>
        ) : null}
      </Modal>
      {actions.element}
    </div>
  )
}
