import { useEffect, useState } from 'react'
import { api } from '../api/client'
import { useAuth } from '../auth/AuthContext'
import { ErrorBanner, LoadingBlock, Modal, PageHeader, StatusBadge } from '../components/ui'

export default function Teams() {
  const { isAdmin } = useAuth()
  const [rows, setRows] = useState([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ name: '', description: '' })
  const [members, setMembers] = useState([])
  const [selected, setSelected] = useState(null)

  const load = async () => {
    setLoading(true)
    try {
      const res = await api('/api/teams')
      setRows(res.data)
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const create = async (e) => {
    e.preventDefault()
    try {
      await api('/api/teams', { method: 'POST', body: form })
      setOpen(false)
      setForm({ name: '', description: '' })
      await load()
    } catch (err) { setError(err.message) }
  }

  const viewMembers = async (team) => {
    setSelected(team)
    const res = await api(`/api/teams/${team.id}/members`)
    setMembers(res.data)
  }

  return (
    <div>
      <PageHeader title="Teams" subtitle="Teams and assigned leads."
        actions={isAdmin ? <button className="btn btn-primary" onClick={() => setOpen(true)}>Create team</button> : null} />
      <ErrorBanner message={error} />
      {loading ? <LoadingBlock /> : (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="card-panel table-wrap p-2">
            <table className="data">
              <thead><tr><th>Name</th><th>Lead</th><th>Members</th><th>Status</th><th></th></tr></thead>
              <tbody>
                {rows.map((t) => (
                  <tr key={t.id}>
                    <td>{t.name}</td>
                    <td>{t.team_lead_name || '—'}</td>
                    <td>{t.member_count}</td>
                    <td><StatusBadge status={t.is_active ? 'active' : 'inactive'} /></td>
                    <td><button className="btn btn-secondary" onClick={() => viewMembers(t)}>Members</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="card-panel p-4">
            <h2 className="mb-3 font-semibold">{selected ? `${selected.name} members` : 'Select a team'}</h2>
            <ul className="space-y-2">
              {members.map((m) => (
                <li key={m.id} className="flex justify-between rounded-lg bg-white/70 px-3 py-2 text-sm">
                  <span>{m.full_name}</span>
                  <span className="capitalize text-[var(--color-ink-soft)]">{m.role.replace('_', ' ')}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
      <Modal open={open} title="Create team" onClose={() => setOpen(false)}>
        <form className="grid gap-3" onSubmit={create}>
          <input className="input" placeholder="Team name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          <textarea className="textarea" placeholder="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <button className="btn btn-primary">Create</button>
        </form>
      </Modal>
    </div>
  )
}
