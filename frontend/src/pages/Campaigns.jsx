import { useEffect, useState } from 'react'
import { api } from '../api/client'
import { useAuth } from '../auth/AuthContext'
import { EmptyState, ErrorBanner, LoadingBlock, PageHeader, StatusBadge } from '../components/ui'

export default function Campaigns() {
  const { isAdmin } = useAuth()
  const [rows, setRows] = useState([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [meta, setMeta] = useState(null)

  const load = async () => {
    setLoading(true)
    try {
      const res = await api('/api/campaigns')
      setRows(res.data)
      setMeta(res.meta)
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const setStatus = async (id, status) => {
    try {
      await api(`/api/campaigns/${id}/status`, { method: 'POST', body: { status } })
      await load()
    } catch (e) { setError(e.message) }
  }

  const enroll = async (id) => {
    try {
      const res = await api(`/api/campaigns/${id}/enroll`, { method: 'POST' })
      alert(`Enrolled ${res.data.enrolled} leads`)
      await load()
    } catch (e) { setError(e.message) }
  }

  const processNow = async () => {
    try {
      const res = await api('/api/campaigns/process', { method: 'POST' })
      alert(JSON.stringify(res.data))
      await load()
    } catch (e) { setError(e.message) }
  }

  return (
    <div>
      <PageHeader
        title="Drip campaigns"
        subtitle="Queued messages are never counted as delivered. Simulated sends appear when WhatsApp is not live."
        actions={isAdmin ? <button className="btn btn-primary" onClick={processNow}>Process due steps</button> : null}
      />
      <ErrorBanner message={error} />
      {meta?.note ? <p className="mb-3 text-xs text-[var(--color-ink-soft)]">{meta.note}</p> : null}
      {loading ? <LoadingBlock /> : rows.length === 0 ? <EmptyState title="No campaigns" /> : (
        <div className="card-panel table-wrap p-2">
          <table className="data">
            <thead>
              <tr>
                <th>Name</th><th>Type</th><th>Channel</th><th>Status</th>
                <th>Enrolled</th><th>Queued</th><th>Sent/Simulated</th><th>Failed</th><th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c.id}>
                  <td>{c.name}</td>
                  <td>{c.campaign_type}</td>
                  <td>{c.channel}</td>
                  <td><StatusBadge status={c.status} /></td>
                  <td>{c.enrolled}</td>
                  <td>{c.messages_queued}</td>
                  <td>{c.messages_sent}</td>
                  <td>{c.messages_failed}</td>
                  <td className="space-x-2">
                    {isAdmin && (
                      <>
                        <button className="btn btn-secondary" onClick={() => enroll(c.id)}>Enroll</button>
                        <button className="btn btn-secondary" onClick={() => setStatus(c.id, c.status === 'active' ? 'paused' : 'active')}>
                          {c.status === 'active' ? 'Pause' : 'Activate'}
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
