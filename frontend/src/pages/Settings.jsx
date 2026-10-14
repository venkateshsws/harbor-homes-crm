import { useEffect, useState } from 'react'
import { api } from '../api/client'
import { ErrorBanner, LoadingBlock, PageHeader, StatusBadge } from '../components/ui'

export default function Settings() {
  const [settings, setSettings] = useState(null)
  const [rules, setRules] = useState([])
  const [queues, setQueues] = useState([])
  const [wa, setWa] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  const load = async () => {
    setLoading(true)
    try {
      const [s, r, q, w] = await Promise.all([
        api('/api/settings'),
        api('/api/settings/assignment-rules'),
        api('/api/settings/queues'),
        api('/api/whatsapp/status'),
      ])
      setSettings(s.data)
      setRules(r.data)
      setQueues(q.data)
      setWa(w.data)
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const saveOffice = async (e) => {
    e.preventDefault()
    const fd = new FormData(e.target)
    try {
      await api('/api/settings', {
        method: 'POST',
        body: {
          key: 'office_hours',
          value: {
            start: fd.get('start'),
            end: fd.get('end'),
            grace_minutes: Number(fd.get('grace_minutes')),
            weekly_holidays: [0],
          },
        },
      })
      await load()
    } catch (err) { setError(err.message) }
  }

  return (
    <div>
      <PageHeader title="Settings" subtitle="Company policies, assignment queues, and integration status." />
      <ErrorBanner message={error} />
      {loading ? <LoadingBlock /> : (
        <div className="grid gap-4 xl:grid-cols-2">
          <div className="card-panel p-4">
            <h2 className="mb-3 font-semibold">Office hours</h2>
            <form className="grid gap-3 sm:grid-cols-3" onSubmit={saveOffice}>
              <label className="text-sm">Start<input className="input mt-1" name="start" defaultValue={settings?.office_hours?.start || '09:30'} /></label>
              <label className="text-sm">End<input className="input mt-1" name="end" defaultValue={settings?.office_hours?.end || '18:30'} /></label>
              <label className="text-sm">Grace (min)<input className="input mt-1" name="grace_minutes" type="number" defaultValue={settings?.office_hours?.grace_minutes || 15} /></label>
              <button className="btn btn-primary sm:col-span-3">Save office hours</button>
            </form>
          </div>
          <div className="card-panel p-4">
            <h2 className="mb-3 font-semibold">WhatsApp integration</h2>
            <div className="space-y-2 text-sm">
              <div>Mode: <StatusBadge status={wa?.mode} /></div>
              <div>Live: {wa?.live ? 'Yes' : 'No'}</div>
              <p className="text-xs text-[var(--color-ink-soft)]">{wa?.dependency}</p>
            </div>
          </div>
          <div className="card-panel table-wrap p-2 xl:col-span-2">
            <h2 className="px-3 pt-3 font-semibold">Assignment rules</h2>
            <table className="data">
              <thead><tr><th>Name</th><th>Method</th><th>Team</th><th>Active</th><th>Order</th></tr></thead>
              <tbody>
                {rules.map((r) => (
                  <tr key={r.id}>
                    <td>{r.name}</td><td>{r.method}</td><td>{r.team_id}</td>
                    <td><StatusBadge status={r.is_active ? 'active' : 'inactive'} /></td>
                    <td>{r.sort_order}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="card-panel table-wrap p-2 xl:col-span-2">
            <h2 className="px-3 pt-3 font-semibold">Assignment queues</h2>
            <table className="data">
              <thead><tr><th>Queue</th><th>Method</th><th>Last user</th><th>Paused</th><th></th></tr></thead>
              <tbody>
                {queues.map((q) => (
                  <tr key={q.id}>
                    <td>{q.queue_key}</td><td>{q.method}</td><td>{q.last_user_id || '—'}</td>
                    <td>{q.is_paused ? 'Yes' : 'No'}</td>
                    <td className="space-x-2">
                      <button className="btn btn-secondary" onClick={() => api('/api/settings/queues/pause', { method: 'POST', body: { queue_key: q.queue_key, is_paused: q.is_paused ? 0 : 1 } }).then(load)}>
                        {q.is_paused ? 'Resume' : 'Pause'}
                      </button>
                      <button className="btn btn-secondary" onClick={() => api('/api/settings/queues/reset', { method: 'POST', body: { queue_key: q.queue_key } }).then(load)}>Reset</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
