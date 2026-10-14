import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api/client'
import { EmptyState, ErrorBanner, LoadingBlock, PageHeader, PriorityBadge } from '../components/ui'

export default function Assignment() {
  const [unassigned, setUnassigned] = useState([])
  const [rules, setRules] = useState([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  const load = async () => {
    setLoading(true)
    try {
      const [leads, ruleRes] = await Promise.all([
        api('/api/leads?unassigned=1'),
        api('/api/settings/assignment-rules'),
      ])
      setUnassigned(leads.data)
      setRules(ruleRes.data)
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const autoAssign = async (id, method = 'auto') => {
    try {
      await api(`/api/leads/${id}/assign`, { method: 'POST', body: { method } })
      await load()
    } catch (e) { setError(e.message) }
  }

  return (
    <div>
      <PageHeader title="Lead assignment" subtitle="Round-robin, weighted, workload, and priority rules run server-side with queue locking." />
      <ErrorBanner message={error} />
      {loading ? <LoadingBlock /> : (
        <div className="grid gap-4 xl:grid-cols-2">
          <div className="card-panel table-wrap p-2">
            <h2 className="px-3 pt-3 font-semibold">Unassigned leads</h2>
            {unassigned.length === 0 ? <div className="p-4"><EmptyState title="Queue clear" /></div> : (
              <table className="data">
                <thead><tr><th>Lead</th><th>Priority</th><th>City</th><th></th></tr></thead>
                <tbody>
                  {unassigned.map((l) => (
                    <tr key={l.id}>
                      <td><Link to={`/leads/${l.id}`} className="text-[var(--color-brand)]">{l.full_name}</Link></td>
                      <td><PriorityBadge priority={l.priority} /></td>
                      <td>{l.city || '—'}</td>
                      <td className="space-x-1">
                        <button className="btn btn-primary" onClick={() => autoAssign(l.id, 'round_robin')}>RR</button>
                        <button className="btn btn-secondary" onClick={() => autoAssign(l.id, 'workload')}>Workload</button>
                        <button className="btn btn-secondary" onClick={() => autoAssign(l.id, 'priority')}>Priority</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          <div className="card-panel p-4">
            <h2 className="mb-3 font-semibold">Active rules</h2>
            <ul className="space-y-2 text-sm">
              {rules.map((r) => (
                <li key={r.id} className="rounded-lg bg-white/70 px-3 py-2">
                  <div className="font-medium">{r.name}</div>
                  <div className="text-[var(--color-ink-soft)]">{r.method} · order {r.sort_order} · {r.is_active ? 'active' : 'inactive'}</div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  )
}
