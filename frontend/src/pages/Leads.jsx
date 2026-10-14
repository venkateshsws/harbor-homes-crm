import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api/client'
import { useAuth } from '../auth/AuthContext'
import { EmptyState, ErrorBanner, LoadingBlock, Modal, PageHeader, PriorityBadge, StatusBadge } from '../components/ui'

const emptyForm = {
  full_name: '', mobile: '', email: '', city: '', location: '', property_type: 'apartment',
  budget_min: '', budget_max: '', preferred_configuration: '2 BHK', source_id: '1',
  priority: 'medium', requirements: '', consent_whatsapp: 1, auto_assign: true,
}

export default function Leads() {
  const { isAdmin, isLead } = useAuth()
  const [rows, setRows] = useState([])
  const [meta, setMeta] = useState({ total: 0 })
  const [statuses, setStatuses] = useState([])
  const [sources, setSources] = useState([])
  const [q, setQ] = useState('')
  const [statusId, setStatusId] = useState('')
  const [priority, setPriority] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams()
      if (q) params.set('q', q)
      if (statusId) params.set('status_id', statusId)
      if (priority) params.set('priority', priority)
      const [list, leadMeta] = await Promise.all([
        api(`/api/leads?${params}`),
        api('/api/leads/meta'),
      ])
      setRows(list.data)
      setMeta(list.meta || {})
      setStatuses(leadMeta.data.statuses)
      setSources(leadMeta.data.sources)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const createLead = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      await api('/api/leads', {
        method: 'POST',
        body: {
          ...form,
          budget_min: form.budget_min || null,
          budget_max: form.budget_max || null,
          source_id: Number(form.source_id),
          consent_whatsapp: Number(form.consent_whatsapp),
          auto_assign: isAdmin ? !!form.auto_assign : false,
          assign_method: 'round_robin',
        },
      })
      setOpen(false)
      setForm(emptyForm)
      await load()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <PageHeader
        title={isAdmin ? 'Leads' : isLead ? 'Team leads' : 'My leads'}
        subtitle="Search, filter, and manage enquiries with full ownership history."
        actions={
          <>
            {(isAdmin || isLead) && (
              <button className="btn btn-secondary" onClick={() => api('/api/leads/export').then((r) => {
                const blob = new Blob([r.data.csv], { type: 'text/csv' })
                const url = URL.createObjectURL(blob)
                const a = document.createElement('a')
                a.href = url; a.download = 'leads.csv'; a.click()
              })}>Export CSV</button>
            )}
            <button className="btn btn-primary" onClick={() => setOpen(true)}>New lead</button>
          </>
        }
      />
      <ErrorBanner message={error} />
      <div className="card-panel mb-4 grid gap-3 p-4 md:grid-cols-4">
        <input className="input" placeholder="Search name, mobile, ID, city" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="select" value={statusId} onChange={(e) => setStatusId(e.target.value)}>
          <option value="">All statuses</option>
          {statuses.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <select className="select" value={priority} onChange={(e) => setPriority(e.target.value)}>
          <option value="">All priorities</option>
          {['urgent', 'high', 'medium', 'low'].map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
        <button className="btn btn-primary" onClick={load}>Apply filters</button>
      </div>

      {loading ? <LoadingBlock /> : rows.length === 0 ? (
        <EmptyState title="No leads found" subtitle="Try clearing filters or create a new enquiry." />
      ) : (
        <div className="card-panel table-wrap p-2">
          <table className="data">
            <thead>
              <tr>
                <th>Code</th><th>Customer</th><th>Mobile</th><th>City</th><th>Priority</th>
                <th>Status</th><th>Owner</th><th>Next follow-up</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((l) => (
                <tr key={l.id}>
                  <td><Link className="text-[var(--color-brand)] font-medium" to={`/leads/${l.id}`}>{l.lead_code}</Link></td>
                  <td>{l.full_name}</td>
                  <td><a className="text-[var(--color-brand)]" href={`tel:${l.mobile}`}>{l.mobile}</a></td>
                  <td>{l.city || '—'}</td>
                  <td><PriorityBadge priority={l.priority} /></td>
                  <td><StatusBadge status={l.status_name} /></td>
                  <td>{l.owner_name || 'Unassigned'}</td>
                  <td>{l.next_follow_up_at || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="px-3 py-2 text-xs text-[var(--color-ink-soft)]">{meta.total || rows.length} total</div>
        </div>
      )}

      <Modal open={open} title="Create lead" onClose={() => setOpen(false)} wide>
        <form className="grid gap-3 md:grid-cols-2" onSubmit={createLead}>
          {[['full_name', 'Full name'], ['mobile', 'Mobile'], ['email', 'Email'], ['city', 'City'], ['location', 'Location']].map(([k, label]) => (
            <label key={k} className="text-sm">{label}
              <input className="input mt-1" value={form[k]} onChange={(e) => setForm({ ...form, [k]: e.target.value })} required={k === 'full_name' || k === 'mobile'} />
            </label>
          ))}
          <label className="text-sm">Property type
            <select className="select mt-1" value={form.property_type} onChange={(e) => setForm({ ...form, property_type: e.target.value })}>
              {['apartment', 'villa', 'plot', 'commercial', 'other'].map((t) => <option key={t}>{t}</option>)}
            </select>
          </label>
          <label className="text-sm">Configuration
            <input className="input mt-1" value={form.preferred_configuration} onChange={(e) => setForm({ ...form, preferred_configuration: e.target.value })} />
          </label>
          <label className="text-sm">Budget min
            <input className="input mt-1" type="number" value={form.budget_min} onChange={(e) => setForm({ ...form, budget_min: e.target.value })} />
          </label>
          <label className="text-sm">Budget max
            <input className="input mt-1" type="number" value={form.budget_max} onChange={(e) => setForm({ ...form, budget_max: e.target.value })} />
          </label>
          <label className="text-sm">Source
            <select className="select mt-1" value={form.source_id} onChange={(e) => setForm({ ...form, source_id: e.target.value })}>
              {sources.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </label>
          <label className="text-sm">Priority
            <select className="select mt-1" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
              {['urgent', 'high', 'medium', 'low'].map((p) => <option key={p}>{p}</option>)}
            </select>
          </label>
          <label className="md:col-span-2 text-sm">Requirements
            <textarea className="textarea mt-1" rows={3} value={form.requirements} onChange={(e) => setForm({ ...form, requirements: e.target.value })} />
          </label>
          {isAdmin && (
            <label className="flex items-center gap-2 text-sm md:col-span-2">
              <input type="checkbox" checked={!!form.auto_assign} onChange={(e) => setForm({ ...form, auto_assign: e.target.checked })} />
              Auto-assign using round-robin / priority rules
            </label>
          )}
          <div className="md:col-span-2">
            <button className="btn btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Create lead'}</button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
