import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Download, Phone, PhoneCall, PhoneOutgoing, Search, Target } from 'lucide-react'
import { useEmployeeWorkspace } from '../../hooks/useEmployeeWorkspace'
import { EmptyState, ErrorBanner, LoadingBlock, PageHeader } from '../../components/ui'
import { DataSourceBadge, Notice, OutcomeBadge, Panel, StatTile } from '../../components/employee/EmployeeUI'
import { useLeadActions } from '../../components/employee/LeadActions'
import { CALL_OUTCOMES, downloadCsv, fmtDate, fmtDateTime, fmtTime, isToday } from '../../lib/format'

export default function MyCalls() {
  const { data, source, loading, error, reload } = useEmployeeWorkspace()
  const [notice, setNotice] = useState('')
  const [actionError, setActionError] = useState('')
  const [outcome, setOutcome] = useState('')
  const [query, setQuery] = useState('')
  const actions = useLeadActions({ workspace: data, source, reload, onNotice: setNotice, onError: setActionError })

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase()
    return (data?.calls || []).filter((c) =>
      (!outcome || c.outcome === outcome) &&
      (!q || c.lead_name.toLowerCase().includes(q) || c.mobile.includes(q) || (c.notes || '').toLowerCase().includes(q)))
  }, [data, outcome, query])

  const grouped = useMemo(() => {
    const out = []
    rows.forEach((c) => {
      const day = fmtDate(c.initiated_at)
      if (!out.length || out[out.length - 1].day !== day) out.push({ day, calls: [] })
      out[out.length - 1].calls.push(c)
    })
    return out
  }, [rows])

  if (loading && !data) return <LoadingBlock label="Loading call history…" />
  if (error && !data) return <ErrorBanner message={error} />

  const { stats, performance } = data

  return (
    <div className="space-y-5">
      <PageHeader
        title="Call history"
        subtitle="Every call you logged, with outcome and notes. Results are employee-reported."
        actions={
          <>
            <DataSourceBadge source={source} />
            <button
              className="btn btn-secondary"
              disabled={!rows.length}
              onClick={() => downloadCsv('my-call-history.csv', rows.map((c) => ({
                date_time: fmtDateTime(c.initiated_at), customer: c.lead_name, phone: c.mobile, outcome: c.outcome, notes: c.notes || '',
              })))}
            >
              <Download size={16} /> Export CSV
            </button>
            <button className="btn btn-primary" onClick={() => actions.openCall()}><PhoneCall size={16} /> Log a call</button>
          </>
        }
      />
      <Notice notice={notice} onClose={() => setNotice('')} />
      <ErrorBanner message={actionError} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile icon={PhoneCall} tone="violet" label="Calls today" value={stats.calls_today} hint={`${stats.connected_today} connected`} />
        <StatTile icon={PhoneOutgoing} label="Calls this month" value={performance.summary.calls_this_month} />
        <StatTile icon={Target} tone="emerald" label="Connect rate" value={`${performance.summary.connect_rate}%`} hint="This month" />
        <StatTile icon={Phone} tone="amber" label="Leads never called" value={data.leads.filter((l) => !Number(l.call_count) && !Number(l.is_terminal)).length} hint="Open leads with 0 calls" />
      </div>

      <Panel
        title="Call log"
        icon={Phone}
        bodyClassName="p-0"
        action={
          <div className="flex flex-wrap gap-2">
            <label className="relative">
              <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-ink-soft)]" />
              <input className="input w-52 py-1.5 pl-8 text-sm" placeholder="Search customer or notes" value={query} onChange={(e) => setQuery(e.target.value)} />
            </label>
            <select className="select w-auto py-1.5 text-sm" value={outcome} onChange={(e) => setOutcome(e.target.value)}>
              <option value="">All outcomes</option>
              {CALL_OUTCOMES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
        }
      >
        {grouped.length === 0 ? (
          <div className="p-4"><EmptyState title="No calls match" subtitle="Log a call from the call queue or clear the filters." /></div>
        ) : (
          <div className="divide-y divide-[var(--color-line)]">
            {grouped.map((g) => (
              <div key={g.day}>
                <div className="sticky top-16 z-10 bg-[var(--color-surface)] px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--color-ink-soft)]">
                  {isToday(g.calls[0].initiated_at) ? 'Today' : g.day} · {g.calls.length} call{g.calls.length === 1 ? '' : 's'}
                </div>
                <ul>
                  {g.calls.map((c) => {
                    const lead = data.leads.find((l) => l.id === c.lead_id)
                    return (
                      <li key={c.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-start">
                        <div className="w-16 shrink-0 font-mono text-xs text-[var(--color-ink-soft)]">{fmtTime(c.initiated_at)}</div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <Link to={`/leads/${c.lead_id}`} className="font-semibold hover:text-[var(--color-brand)]">{c.lead_name}</Link>
                            <span className="font-mono text-xs text-[var(--color-ink-soft)]">{c.mobile}</span>
                            <OutcomeBadge outcome={c.outcome} />
                          </div>
                          <p className="mt-1 whitespace-pre-line text-sm text-[var(--color-ink-soft)]">{c.notes || <em>No notes recorded</em>}</p>
                          {c.next_follow_up_at ? <p className="mt-1 text-xs text-[var(--color-brand)]">Follow-up set for {fmtDateTime(c.next_follow_up_at)}</p> : null}
                        </div>
                        <div className="flex shrink-0 gap-1.5">
                          <a className="btn btn-secondary px-2 py-1 text-xs" href={`tel:${c.mobile}`} onClick={() => lead && actions.openCall(lead)}><Phone size={12} /> Call again</a>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              </div>
            ))}
          </div>
        )}
      </Panel>
      {actions.element}
    </div>
  )
}
