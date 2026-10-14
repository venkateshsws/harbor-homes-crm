import { useEffect, useState } from 'react'
import { api } from '../api/client'
import { ErrorBanner, LoadingBlock, PageHeader } from '../components/ui'

export default function Reports() {
  const [perf, setPerf] = useState([])
  const [conversion, setConversion] = useState([])
  const [assignments, setAssignments] = useState([])
  const [defs, setDefs] = useState({})
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      api('/api/reports/performance'),
      api('/api/reports/lead-conversion'),
      api('/api/reports/assignments').catch(() => ({ data: [] })),
    ]).then(([p, c, a]) => {
      setPerf(p.data)
      setDefs(p.meta?.definitions || {})
      setConversion(c.data)
      setAssignments(a.data || [])
    }).catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div>
      <PageHeader title="Reports" subtitle="Exportable CRM metrics with explicit definitions." />
      <ErrorBanner message={error} />
      {loading ? <LoadingBlock /> : (
        <div className="space-y-4">
          <div className="card-panel table-wrap p-2">
            <h2 className="px-3 pt-3 font-semibold">Employee performance</h2>
            <table className="data">
              <thead>
                <tr>
                  <th>Employee</th><th>Team</th><th>Leads</th><th>Conversions</th><th>Rate</th>
                  <th>Calls logged</th><th>Follow-ups done</th><th>Overdue</th>
                </tr>
              </thead>
              <tbody>
                {perf.map((r) => (
                  <tr key={r.id}>
                    <td>{r.full_name}</td><td>{r.team_name || '—'}</td><td>{r.leads_owned}</td>
                    <td>{r.conversions}</td><td>{r.conversion_rate || 0}%</td>
                    <td>{r.calls_logged}</td><td>{r.followups_completed}</td><td>{r.overdue_followups}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <ul className="space-y-1 px-3 pb-3 text-xs text-[var(--color-ink-soft)]">
              {Object.entries(defs).map(([k, v]) => <li key={k}><strong>{k}:</strong> {v}</li>)}
            </ul>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="card-panel table-wrap p-2">
              <h2 className="px-3 pt-3 font-semibold">Lead conversion by day</h2>
              <table className="data">
                <thead><tr><th>Day</th><th>Leads</th><th>Conversions</th></tr></thead>
                <tbody>
                  {conversion.map((r) => <tr key={r.day}><td>{r.day}</td><td>{r.leads}</td><td>{r.conversions}</td></tr>)}
                </tbody>
              </table>
            </div>
            <div className="card-panel table-wrap p-2">
              <h2 className="px-3 pt-3 font-semibold">Assignments by method</h2>
              <table className="data">
                <thead><tr><th>Method</th><th>Count</th></tr></thead>
                <tbody>
                  {assignments.map((r) => <tr key={r.method}><td>{r.method}</td><td>{r.cnt}</td></tr>)}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
