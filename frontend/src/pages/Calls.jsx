import { useEffect, useState } from 'react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { api } from '../api/client'
import { EmptyState, ErrorBanner, LoadingBlock, PageHeader, StatusBadge } from '../components/ui'

export default function Calls() {
  const [rows, setRows] = useState([])
  const [analytics, setAnalytics] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([api('/api/calls'), api('/api/calls/analytics')])
      .then(([list, a]) => { setRows(list.data); setAnalytics(a.data) })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div>
      <PageHeader title="Call activity" subtitle="Logged outcomes are employee-reported unless a telephony provider is integrated." />
      <ErrorBanner message={error} />
      {loading ? <LoadingBlock /> : (
        <>
          <div className="mb-4 grid gap-4 xl:grid-cols-2">
            <div className="card-panel p-4">
              <h2 className="mb-3 font-semibold">Outcomes</h2>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={analytics?.by_outcome || []}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#d7e0da" />
                    <XAxis dataKey="outcome" />
                    <YAxis allowDecimals={false} />
                    <Tooltip />
                    <Bar dataKey="cnt" fill="#c45c26" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <p className="mt-2 text-xs text-[var(--color-ink-soft)]">{analytics?.note}</p>
            </div>
            <div className="card-panel p-4">
              <h2 className="mb-3 font-semibold">By employee</h2>
              {(analytics?.by_employee || []).length ? (
                <table className="data">
                  <thead><tr><th>Employee</th><th>Calls logged</th></tr></thead>
                  <tbody>
                    {analytics.by_employee.map((r) => (
                      <tr key={r.id}><td>{r.full_name}</td><td>{r.calls_logged}</td></tr>
                    ))}
                  </tbody>
                </table>
              ) : <EmptyState title="No calls in range" />}
            </div>
          </div>
          <div className="card-panel table-wrap p-2">
            <table className="data">
              <thead><tr><th>When</th><th>Lead</th><th>Employee</th><th>Outcome</th><th>Notes</th></tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td>{r.initiated_at}</td>
                    <td>{r.lead_name}<div className="text-xs"><a href={`tel:${r.mobile}`}>{r.mobile}</a></div></td>
                    <td>{r.employee_name}</td>
                    <td><StatusBadge status={r.outcome} /></td>
                    <td>{r.notes || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
