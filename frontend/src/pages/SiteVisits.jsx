import { useEffect, useState } from 'react'
import { api } from '../api/client'
import { EmptyState, ErrorBanner, LoadingBlock, PageHeader, StatusBadge } from '../components/ui'

export default function SiteVisits() {
  const [rows, setRows] = useState([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  const load = async () => {
    setLoading(true)
    try {
      const res = await api('/api/site-visits')
      setRows(res.data)
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const complete = async (id) => {
    try {
      await api(`/api/site-visits/${id}`, {
        method: 'PUT',
        body: { status: 'completed', feedback: 'Visit completed' },
      })
      await load()
    } catch (e) { setError(e.message) }
  }

  return (
    <div>
      <PageHeader title="Site visits" subtitle="Scheduled property visits linked to leads." />
      <ErrorBanner message={error} />
      {loading ? <LoadingBlock /> : rows.length === 0 ? <EmptyState title="No site visits" /> : (
        <div className="card-panel table-wrap p-2">
          <table className="data">
            <thead><tr><th>When</th><th>Lead</th><th>Property</th><th>Owner</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>{r.scheduled_at}</td>
                  <td>{r.lead_name}</td>
                  <td>{r.property_name || '—'}</td>
                  <td>{r.owner_name}</td>
                  <td><StatusBadge status={r.status} /></td>
                  <td>{r.status === 'scheduled' ? <button className="btn btn-primary" onClick={() => complete(r.id)}>Complete</button> : null}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
