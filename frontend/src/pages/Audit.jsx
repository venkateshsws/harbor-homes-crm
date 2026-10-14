import { useEffect, useState } from 'react'
import { api } from '../api/client'
import { EmptyState, ErrorBanner, LoadingBlock, PageHeader } from '../components/ui'

export default function Audit() {
  const [rows, setRows] = useState([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api('/api/audit-logs')
      .then((res) => setRows(res.data))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div>
      <PageHeader title="Audit logs" subtitle="Sensitive create/update/assign actions." />
      <ErrorBanner message={error} />
      {loading ? <LoadingBlock /> : rows.length === 0 ? <EmptyState title="No audit events yet" /> : (
        <div className="card-panel table-wrap p-2">
          <table className="data">
            <thead><tr><th>When</th><th>Actor</th><th>Action</th><th>Entity</th><th>ID</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>{r.created_at}</td>
                  <td>{r.actor_name || 'System'}</td>
                  <td>{r.action}</td>
                  <td>{r.entity_type}</td>
                  <td>{r.entity_id}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
