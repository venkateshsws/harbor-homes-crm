import { useEffect, useState } from 'react'
import { api } from '../api/client'
import { useAuth } from '../auth/AuthContext'
import { EmptyState, ErrorBanner, LoadingBlock, PageHeader, StatusBadge } from '../components/ui'

export default function Nurturing() {
  const { isAdmin } = useAuth()
  const [rows, setRows] = useState([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  const load = async () => {
    setLoading(true)
    try {
      const res = await api('/api/nurturing')
      setRows(res.data)
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const toggle = async (id, is_active) => {
    try {
      await api(`/api/nurturing/${id}/toggle`, { method: 'POST', body: { is_active: is_active ? 0 : 1 } })
      await load()
    } catch (e) { setError(e.message) }
  }

  return (
    <div>
      <PageHeader title="Lead nurturing" subtitle="Sequences pause on do-not-contact and respect consent for message steps." />
      <ErrorBanner message={error} />
      {loading ? <LoadingBlock /> : rows.length === 0 ? <EmptyState title="No sequences" /> : (
        <div className="grid gap-4">
          {rows.map((seq) => (
            <div key={seq.id} className="card-panel p-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="font-semibold">{seq.name}</h2>
                  <p className="text-sm text-[var(--color-ink-soft)]">{seq.objective}</p>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge status={seq.is_active ? 'active' : 'inactive'} />
                  {isAdmin && <button className="btn btn-secondary" onClick={() => toggle(seq.id, seq.is_active)}>Toggle</button>}
                </div>
              </div>
              <ol className="space-y-2 text-sm">
                {seq.steps.map((s) => (
                  <li key={s.id} className="rounded-lg bg-white/70 px-3 py-2">
                    Step {s.step_order}: {s.action_type} after {s.delay_hours}h
                    {s.task_title ? ` · ${s.task_title}` : ''}
                  </li>
                ))}
              </ol>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
