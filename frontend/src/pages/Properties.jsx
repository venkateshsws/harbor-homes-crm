import { useEffect, useState } from 'react'
import { api } from '../api/client'
import { useAuth } from '../auth/AuthContext'
import { EmptyState, ErrorBanner, LoadingBlock, Modal, PageHeader, StatusBadge } from '../components/ui'

export default function Properties() {
  const { isAdmin } = useAuth()
  const [rows, setRows] = useState([])
  const [matches, setMatches] = useState([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({
    name: '', property_type: 'apartment', city: '', location: '', price_min: '', price_max: '', configuration: '2 BHK',
  })

  const load = async () => {
    setLoading(true)
    try {
      const res = await api('/api/properties')
      setRows(res.data)
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const create = async (e) => {
    e.preventDefault()
    try {
      await api('/api/properties', {
        method: 'POST',
        body: { ...form, price_min: Number(form.price_min || 0), price_max: Number(form.price_max || 0) },
      })
      setOpen(false)
      await load()
    } catch (err) { setError(err.message) }
  }

  const showMatches = async (id) => {
    const res = await api(`/api/properties/${id}/matches`)
    setMatches(res.data)
  }

  return (
    <div>
      <PageHeader title="Properties" subtitle="Inventory and lead matching by city, budget, and type."
        actions={isAdmin ? <button className="btn btn-primary" onClick={() => setOpen(true)}>Add property</button> : null} />
      <ErrorBanner message={error} />
      {loading ? <LoadingBlock /> : rows.length === 0 ? <EmptyState title="No properties" /> : (
        <div className="grid gap-4 xl:grid-cols-[1.5fr_1fr]">
          <div className="card-panel table-wrap p-2">
            <table className="data">
              <thead><tr><th>Code</th><th>Name</th><th>Type</th><th>City</th><th>Price</th><th>Status</th><th></th></tr></thead>
              <tbody>
                {rows.map((p) => (
                  <tr key={p.id}>
                    <td>{p.property_code}</td>
                    <td>{p.name}</td>
                    <td>{p.property_type}</td>
                    <td>{p.city}</td>
                    <td>{p.price_min} – {p.price_max}</td>
                    <td><StatusBadge status={p.availability_status} /></td>
                    <td><button className="btn btn-secondary" onClick={() => showMatches(p.id)}>Match leads</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="card-panel p-4">
            <h2 className="mb-3 font-semibold">Matched leads</h2>
            {matches.length === 0 ? <EmptyState title="No matches yet" /> : (
              <ul className="space-y-2 text-sm">
                {matches.map((m) => (
                  <li key={m.id} className="rounded-lg bg-white/70 px-3 py-2">
                    <div className="font-medium">{m.full_name}</div>
                    <div>{m.city} · {m.preferred_configuration} · {m.status_name}</div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
      <Modal open={open} title="Add property" onClose={() => setOpen(false)}>
        <form className="grid gap-3" onSubmit={create}>
          {['name', 'city', 'location', 'configuration', 'price_min', 'price_max'].map((k) => (
            <input key={k} className="input" placeholder={k} value={form[k]} onChange={(e) => setForm({ ...form, [k]: e.target.value })} required={k === 'name'} />
          ))}
          <select className="select" value={form.property_type} onChange={(e) => setForm({ ...form, property_type: e.target.value })}>
            {['apartment', 'villa', 'plot', 'commercial', 'other'].map((t) => <option key={t}>{t}</option>)}
          </select>
          <button className="btn btn-primary">Save</button>
        </form>
      </Modal>
    </div>
  )
}
