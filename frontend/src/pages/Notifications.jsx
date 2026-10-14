import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api/client'
import { EmptyState, ErrorBanner, LoadingBlock, PageHeader } from '../components/ui'

export default function Notifications() {
  const [rows, setRows] = useState([])
  const [unread, setUnread] = useState(0)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  const load = async () => {
    setLoading(true)
    try {
      const res = await api('/api/notifications')
      setRows(res.data)
      setUnread(res.meta?.unread || 0)
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const mark = async (id) => {
    await api(`/api/notifications/${id}/read`, { method: 'POST' })
    await load()
  }

  const markAll = async () => {
    await api('/api/notifications/read-all', { method: 'POST' })
    await load()
  }

  return (
    <div>
      <PageHeader title="Notifications" subtitle={`${unread} unread`}
        actions={<button className="btn btn-secondary" onClick={markAll}>Mark all read</button>} />
      <ErrorBanner message={error} />
      {loading ? <LoadingBlock /> : rows.length === 0 ? <EmptyState title="No notifications" /> : (
        <ul className="space-y-2">
          {rows.map((n) => (
            <li key={n.id} className={`card-panel flex items-start justify-between gap-3 p-4 ${n.is_read ? 'opacity-70' : ''}`}>
              <div>
                <div className="font-semibold">{n.title}</div>
                <div className="text-sm">{n.body}</div>
                <div className="mt-1 text-xs text-[var(--color-ink-soft)]">{n.created_at}</div>
                {n.link_path ? <Link className="text-sm text-[var(--color-brand)]" to={n.link_path}>Open</Link> : null}
              </div>
              {!n.is_read ? <button className="btn btn-secondary" onClick={() => mark(n.id)}>Mark read</button> : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
