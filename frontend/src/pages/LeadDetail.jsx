import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../api/client'
import { useAuth } from '../auth/AuthContext'
import { ErrorBanner, LoadingBlock, PageHeader, PriorityBadge, StatusBadge } from '../components/ui'

export default function LeadDetail() {
  const { id } = useParams()
  const { isAdmin, isLead, user } = useAuth()
  const [data, setData] = useState(null)
  const [statuses, setStatuses] = useState([])
  const [employees, setEmployees] = useState([])
  const [error, setError] = useState('')
  const [note, setNote] = useState('')
  const [callOutcome, setCallOutcome] = useState('answered')
  const [callNotes, setCallNotes] = useState('')
  const [assignUser, setAssignUser] = useState('')
  const [busy, setBusy] = useState(false)

  const load = async () => {
    try {
      const [detail, meta, users] = await Promise.all([
        api(`/api/leads/${id}`),
        api('/api/leads/meta'),
        (isAdmin || isLead) ? api('/api/users') : Promise.resolve({ data: [] }),
      ])
      setData(detail.data)
      setStatuses(meta.data.statuses)
      setEmployees(users.data || [])
    } catch (e) {
      setError(e.message)
    }
  }

  useEffect(() => { load() }, [id])

  if (!data && !error) return <LoadingBlock />
  if (error && !data) return <ErrorBanner message={error} />

  const lead = data.lead

  const updateStatus = async (status_id) => {
    setBusy(true)
    try {
      await api(`/api/leads/${id}`, { method: 'PUT', body: { status_id: Number(status_id) } })
      await load()
    } catch (e) { setError(e.message) }
    finally { setBusy(false) }
  }

  const addNote = async (e) => {
    e.preventDefault()
    setBusy(true)
    try {
      await api(`/api/leads/${id}/notes`, { method: 'POST', body: { note } })
      setNote('')
      await load()
    } catch (e) { setError(e.message) }
    finally { setBusy(false) }
  }

  const logCall = async (e) => {
    e.preventDefault()
    setBusy(true)
    try {
      await api('/api/calls', {
        method: 'POST',
        body: { lead_id: Number(id), outcome: callOutcome, notes: callNotes },
      })
      setCallNotes('')
      await load()
    } catch (e) { setError(e.message) }
    finally { setBusy(false) }
  }

  const assign = async (method) => {
    setBusy(true)
    try {
      await api(`/api/leads/${id}/assign`, {
        method: 'POST',
        body: method === 'manual'
          ? { method: 'manual', to_user_id: Number(assignUser), reason: 'Manual reassignment' }
          : { method, reason: `Auto ${method}` },
      })
      await load()
    } catch (e) { setError(e.message) }
    finally { setBusy(false) }
  }

  const sendWa = async () => {
    setBusy(true)
    try {
      const res = await api('/api/whatsapp/send', { method: 'POST', body: { lead_id: Number(id), template_id: 1 } })
      alert(res.data.is_simulated ? 'Simulated WhatsApp message stored (provider not configured).' : `WhatsApp status: ${res.data.status}`)
      await load()
    } catch (e) { setError(e.message) }
    finally { setBusy(false) }
  }

  return (
    <div>
      <PageHeader
        title={lead.full_name}
        subtitle={`${lead.lead_code} · ${lead.city || 'No city'} · Owner: ${lead.owner_name || 'Unassigned'}`}
        actions={
          <>
            <a className="btn btn-primary" href={`tel:${lead.mobile}`}>Tap to call</a>
            <Link className="btn btn-secondary" to="/leads">Back</Link>
          </>
        }
      />
      <ErrorBanner message={error} />

      <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
        <div className="space-y-4">
          <div className="card-panel grid gap-3 p-4 sm:grid-cols-2">
            <div><div className="text-xs text-[var(--color-ink-soft)]">Mobile</div><div>{lead.mobile}</div></div>
            <div><div className="text-xs text-[var(--color-ink-soft)]">Email</div><div>{lead.email || '—'}</div></div>
            <div><div className="text-xs text-[var(--color-ink-soft)]">Priority</div><PriorityBadge priority={lead.priority} /></div>
            <div><div className="text-xs text-[var(--color-ink-soft)]">Status</div><StatusBadge status={lead.status_name} /></div>
            <div><div className="text-xs text-[var(--color-ink-soft)]">Budget</div><div>{lead.budget_min || 0} – {lead.budget_max || '—'}</div></div>
            <div><div className="text-xs text-[var(--color-ink-soft)]">Source</div><div>{lead.source_name || '—'}</div></div>
            <div className="sm:col-span-2"><div className="text-xs text-[var(--color-ink-soft)]">Requirements</div><div>{lead.requirements || '—'}</div></div>
          </div>

          <div className="card-panel p-4">
            <h2 className="mb-3 font-semibold">Update status</h2>
            <div className="flex flex-wrap gap-2">
              {statuses.map((s) => (
                <button key={s.id} className="btn btn-secondary" disabled={busy} onClick={() => updateStatus(s.id)}>{s.name}</button>
              ))}
            </div>
          </div>

          <div className="card-panel p-4">
            <h2 className="mb-3 font-semibold">Log call (employee-reported)</h2>
            <p className="mb-3 text-xs text-[var(--color-ink-soft)]">Browser tel: links cannot verify duration or connection. Record the outcome after the call.</p>
            <form className="grid gap-3 md:grid-cols-[1fr_2fr_auto]" onSubmit={logCall}>
              <select className="select" value={callOutcome} onChange={(e) => setCallOutcome(e.target.value)}>
                {['answered','no_answer','busy','switched_off','invalid_number','callback_requested','interested','not_interested','other'].map((o) => <option key={o}>{o}</option>)}
              </select>
              <input className="input" placeholder="Call notes" value={callNotes} onChange={(e) => setCallNotes(e.target.value)} />
              <button className="btn btn-primary" disabled={busy}>Save call</button>
            </form>
          </div>

          <div className="card-panel p-4">
            <h2 className="mb-3 font-semibold">Notes</h2>
            <form className="mb-4 flex gap-2" onSubmit={addNote}>
              <input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Add a note" required />
              <button className="btn btn-primary" disabled={busy}>Add</button>
            </form>
            <ul className="space-y-2">
              {data.notes.map((n) => (
                <li key={n.id} className="rounded-lg bg-white/70 px-3 py-2 text-sm">
                  <div className="font-medium">{n.author_name}</div>
                  <div>{n.note}</div>
                  <div className="text-xs text-[var(--color-ink-soft)]">{n.created_at}</div>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="space-y-4">
          {(isAdmin || isLead) && (
            <div className="card-panel p-4">
              <h2 className="mb-3 font-semibold">Assignment</h2>
              <div className="mb-3 flex gap-2">
                <select className="select" value={assignUser} onChange={(e) => setAssignUser(e.target.value)}>
                  <option value="">Select employee</option>
                  {employees.filter((e) => !isLead || e.team_id === user.team_id).map((e) => (
                    <option key={e.id} value={e.id}>{e.full_name}</option>
                  ))}
                </select>
                <button className="btn btn-primary" disabled={!assignUser || busy} onClick={() => assign('manual')}>Assign</button>
              </div>
              {isAdmin && (
                <div className="flex flex-wrap gap-2">
                  {['round_robin', 'weighted_round_robin', 'workload', 'priority', 'auto'].map((m) => (
                    <button key={m} className="btn btn-secondary" disabled={busy} onClick={() => assign(m)}>{m}</button>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="card-panel p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-semibold">WhatsApp</h2>
              <button className="btn btn-secondary" disabled={busy || !lead.consent_whatsapp} onClick={sendWa}>Send template</button>
            </div>
            <p className="text-xs text-[var(--color-ink-soft)]">
              Consent: {lead.consent_whatsapp ? 'Yes' : 'No'}. Without Meta credentials, sends are simulated and labeled in message logs.
            </p>
          </div>

          <div className="card-panel p-4">
            <h2 className="mb-3 font-semibold">Assignment history</h2>
            <ul className="space-y-2 text-sm">
              {data.assignments.map((a) => (
                <li key={a.id} className="rounded-lg bg-white/70 px-3 py-2">
                  {a.from_name || 'Unassigned'} → {a.to_name} · {a.method}
                  <div className="text-xs text-[var(--color-ink-soft)]">{a.created_at}</div>
                </li>
              ))}
            </ul>
          </div>

          <div className="card-panel p-4">
            <h2 className="mb-3 font-semibold">Call history</h2>
            <ul className="space-y-2 text-sm">
              {data.calls.map((c) => (
                <li key={c.id} className="rounded-lg bg-white/70 px-3 py-2">
                  <StatusBadge status={c.outcome} /> · {c.employee_name}
                  <div>{c.notes}</div>
                  <div className="text-xs text-[var(--color-ink-soft)]">{c.initiated_at} · employee-reported</div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
