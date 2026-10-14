import { useEffect, useState } from 'react'
import { api } from '../api/client'
import { useAuth } from '../auth/AuthContext'
import { EmptyState, ErrorBanner, LoadingBlock, PageHeader, PriorityBadge, StatusBadge } from '../components/ui'

export default function FollowUps() {
  const { isAdmin, isLead } = useAuth()
  const [rows, setRows] = useState([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState('')

  const load = async () => {
    setLoading(true)
    try {
      const params = status ? `?status=${status}` : ''
      const res = await api(`/api/follow-ups${params}`)
      setRows(res.data)
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [status])

  const complete = async (id) => {
    try {
      await api(`/api/follow-ups/${id}`, { method: 'PUT', body: { status: 'completed' } })
      await load()
    } catch (e) { setError(e.message) }
  }

  const escalate = async () => {
    try {
      const res = await api('/api/follow-ups/escalate', { method: 'POST' })
      alert(`Escalated ${res.data.escalated} tasks`)
      await load()
    } catch (e) { setError(e.message) }
  }

  return (
    <div>
      <PageHeader
        title="Follow-ups"
        subtitle="Tasks stay with the lead history even when ownership changes."
        actions={
          <>
            <select className="select w-auto" value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">All</option>
              <option value="pending">Pending</option>
              <option value="overdue">Overdue</option>
              <option value="completed">Completed</option>
            </select>
            {(isAdmin || isLead) && <button className="btn btn-secondary" onClick={escalate}>Escalate overdue</button>}
          </>
        }
      />
      <ErrorBanner message={error} />
      {loading ? <LoadingBlock /> : rows.length === 0 ? <EmptyState title="No follow-ups" /> : (
        <div className="card-panel table-wrap p-2">
          <table className="data">
            <thead><tr><th>Due</th><th>Title</th><th>Lead</th><th>Owner</th><th>Type</th><th>Priority</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>{r.due_at}</td>
                  <td>{r.title}</td>
                  <td>{r.lead_name}</td>
                  <td>{r.owner_name}</td>
                  <td>{r.task_type}</td>
                  <td><PriorityBadge priority={r.priority} /></td>
                  <td><StatusBadge status={r.status} /></td>
                  <td>{r.status !== 'completed' ? <button className="btn btn-primary" onClick={() => complete(r.id)}>Complete</button> : null}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
