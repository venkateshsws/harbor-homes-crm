import { useEffect, useState } from 'react'
import { api } from '../api/client'
import { useAuth } from '../auth/AuthContext'
import { EmptyState, ErrorBanner, LoadingBlock, Modal, PageHeader, StatusBadge } from '../components/ui'

export default function Employees() {
  const { isAdmin } = useAuth()
  const [rows, setRows] = useState([])
  const [teams, setTeams] = useState([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({
    employee_code: '', email: '', full_name: '', phone: '', role: 'employee', team_id: '', assignment_weight: 1, max_open_leads: 25, password: 'Password123!',
  })

  const load = async () => {
    setLoading(true)
    try {
      const [users, teamRes] = await Promise.all([api('/api/users'), isAdmin ? api('/api/teams') : Promise.resolve({ data: [] })])
      setRows(users.data)
      setTeams(teamRes.data || [])
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const create = async (e) => {
    e.preventDefault()
    try {
      await api('/api/users', {
        method: 'POST',
        body: { ...form, team_id: form.team_id ? Number(form.team_id) : null, assignment_weight: Number(form.assignment_weight), max_open_leads: Number(form.max_open_leads) },
      })
      setOpen(false)
      await load()
    } catch (err) { setError(err.message) }
  }

  const toggleActive = async (row) => {
    if (!isAdmin) return
    try {
      await api(`/api/users/${row.id}`, { method: 'PUT', body: { is_active: row.is_active ? 0 : 1, role: row.role } })
      await load()
    } catch (e) { setError(e.message) }
  }

  return (
    <div>
      <PageHeader title="Employees" subtitle="Manage accounts, eligibility, and assignment weights."
        actions={isAdmin ? <button className="btn btn-primary" onClick={() => setOpen(true)}>Add employee</button> : null} />
      <ErrorBanner message={error} />
      {loading ? <LoadingBlock /> : rows.length === 0 ? <EmptyState title="No employees" /> : (
        <div className="card-panel table-wrap p-2">
          <table className="data">
            <thead><tr><th>Code</th><th>Name</th><th>Email</th><th>Role</th><th>Team</th><th>Weight</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>{r.employee_code}</td><td>{r.full_name}</td><td>{r.email}</td>
                  <td className="capitalize">{r.role?.replace('_', ' ')}</td>
                  <td>{r.team_name || '—'}</td><td>{r.assignment_weight}</td>
                  <td><StatusBadge status={r.is_active ? 'active' : 'inactive'} /></td>
                  <td>{isAdmin ? <button className="btn btn-secondary" onClick={() => toggleActive(r)}>{r.is_active ? 'Deactivate' : 'Activate'}</button> : null}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Modal open={open} title="Add employee" onClose={() => setOpen(false)}>
        <form className="grid gap-3" onSubmit={create}>
          {['employee_code', 'full_name', 'email', 'phone', 'password'].map((k) => (
            <label key={k} className="text-sm capitalize">{k.replace('_', ' ')}
              <input className="input mt-1" type={k === 'password' ? 'password' : 'text'} value={form[k]} onChange={(e) => setForm({ ...form, [k]: e.target.value })} required={k !== 'phone'} />
            </label>
          ))}
          <label className="text-sm">Role
            <select className="select mt-1" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
              <option value="employee">Employee</option>
              <option value="team_lead">Team Lead</option>
              <option value="admin">Admin</option>
            </select>
          </label>
          <label className="text-sm">Team
            <select className="select mt-1" value={form.team_id} onChange={(e) => setForm({ ...form, team_id: e.target.value })}>
              <option value="">None</option>
              {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </label>
          <button className="btn btn-primary">Create</button>
        </form>
      </Modal>
    </div>
  )
}
