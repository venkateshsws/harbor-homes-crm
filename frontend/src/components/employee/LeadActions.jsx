import { useState } from 'react'
import { Phone } from 'lucide-react'
import { Modal } from '../ui'
import { employeeService } from '../../services/employeeService'
import { CALL_OUTCOMES, localInputValue, toUtcSql } from '../../lib/format'

const inHours = (h) => localInputValue(new Date(Date.now() + h * 3600 * 1000))

function LeadPicker({ leads, value, onChange }) {
  return (
    <label className="text-sm">
      Customer
      <select className="select mt-1" value={value} onChange={(e) => onChange(e.target.value)} required>
        <option value="">Select a lead…</option>
        {leads.map((l) => (
          <option key={l.id} value={l.id}>{l.full_name} · {l.mobile} · {l.status_name}</option>
        ))}
      </select>
    </label>
  )
}

function CallForm({ lead, leads, statuses, onSubmit, busy }) {
  const [leadId, setLeadId] = useState(lead?.id ? String(lead.id) : '')
  const [outcome, setOutcome] = useState('answered')
  const [notes, setNotes] = useState('')
  const [statusId, setStatusId] = useState('')
  const [withFollowUp, setWithFollowUp] = useState(false)
  const [followUpAt, setFollowUpAt] = useState(inHours(24))
  const selected = leads.find((l) => String(l.id) === leadId)

  return (
    <form
      className="grid gap-3"
      onSubmit={(e) => {
        e.preventDefault()
        onSubmit({ leadId: Number(leadId), outcome, notes: notes.trim(), statusId, followUpAt: withFollowUp ? followUpAt : null, lead: selected })
      }}
    >
      {lead ? (
        <div className="flex items-center justify-between rounded-xl bg-[var(--color-brand-soft)] px-3 py-2 text-sm">
          <div>
            <div className="font-semibold">{lead.full_name}</div>
            <div className="text-xs text-[var(--color-ink-soft)]">{lead.lead_code} · {lead.status_name}</div>
          </div>
          <a className="btn btn-primary" href={`tel:${lead.mobile}`}><Phone size={14} /> {lead.mobile}</a>
        </div>
      ) : (
        <LeadPicker leads={leads} value={leadId} onChange={setLeadId} />
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm">
          Call outcome
          <select className="select mt-1" value={outcome} onChange={(e) => setOutcome(e.target.value)}>
            {CALL_OUTCOMES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </label>
        <label className="text-sm">
          Update lead status <span className="text-[var(--color-ink-soft)]">(optional)</span>
          <select className="select mt-1" value={statusId} onChange={(e) => setStatusId(e.target.value)}>
            <option value="">Keep current</option>
            {statuses.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </label>
      </div>
      <label className="text-sm">
        Call notes
        <textarea
          className="textarea mt-1 min-h-24"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="What did the customer say? Budget, timeline, objections, next step…"
        />
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={withFollowUp} onChange={(e) => setWithFollowUp(e.target.checked)} />
        Schedule a follow-up call
      </label>
      {withFollowUp ? (
        <input className="input" type="datetime-local" value={followUpAt} onChange={(e) => setFollowUpAt(e.target.value)} required />
      ) : null}
      <p className="text-xs text-[var(--color-ink-soft)]">Call results are employee-reported; duration is not tracked without a telephony integration.</p>
      <button className="btn btn-primary" disabled={busy || !leadId}>{busy ? 'Saving…' : 'Save call log'}</button>
    </form>
  )
}

function FollowUpForm({ lead, leads, onSubmit, busy }) {
  const [leadId, setLeadId] = useState(lead?.id ? String(lead.id) : '')
  const [title, setTitle] = useState(lead ? `Follow up with ${lead.full_name.split(' ')[0]}` : '')
  const [taskType, setTaskType] = useState('call')
  const [priority, setPriority] = useState(lead?.priority || 'medium')
  const [dueAt, setDueAt] = useState(inHours(2))
  const [notes, setNotes] = useState('')

  return (
    <form
      className="grid gap-3"
      onSubmit={(e) => {
        e.preventDefault()
        onSubmit({ lead_id: Number(leadId), title: title.trim(), task_type: taskType, priority, due_at: toUtcSql(new Date(dueAt)), notes: notes.trim() || null })
      }}
    >
      {lead ? <div className="rounded-xl bg-[var(--color-brand-soft)] px-3 py-2 text-sm font-semibold">{lead.full_name} · {lead.mobile}</div> : <LeadPicker leads={leads} value={leadId} onChange={setLeadId} />}
      <label className="text-sm">Title<input className="input mt-1" value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={160} /></label>
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="text-sm">
          Type
          <select className="select mt-1" value={taskType} onChange={(e) => setTaskType(e.target.value)}>
            {['call', 'whatsapp', 'email', 'meeting', 'site_visit', 'other'].map((t) => <option key={t} value={t}>{t.replace('_', ' ')}</option>)}
          </select>
        </label>
        <label className="text-sm">
          Priority
          <select className="select mt-1" value={priority} onChange={(e) => setPriority(e.target.value)}>
            {['low', 'medium', 'high', 'urgent'].map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </label>
        <label className="text-sm">Due<input className="input mt-1" type="datetime-local" value={dueAt} onChange={(e) => setDueAt(e.target.value)} required /></label>
      </div>
      <div className="flex flex-wrap gap-2 text-xs">
        {[['In 1 hour', 1], ['This evening', 'evening'], ['Tomorrow 11 AM', 'tomorrow'], ['In 3 days', 72]].map(([label, v]) => (
          <button
            key={label}
            type="button"
            className="rounded-full border border-[var(--color-line)] bg-white px-3 py-1 hover:border-[var(--color-brand)]"
            onClick={() => {
              const d = new Date()
              if (v === 'evening') d.setHours(18, 0, 0, 0)
              else if (v === 'tomorrow') { d.setDate(d.getDate() + 1); d.setHours(11, 0, 0, 0) }
              else d.setTime(d.getTime() + v * 3600 * 1000)
              setDueAt(localInputValue(d))
            }}
          >
            {label}
          </button>
        ))}
      </div>
      <label className="text-sm">Notes<textarea className="textarea mt-1" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Agenda for the follow-up" /></label>
      <button className="btn btn-primary" disabled={busy || !leadId}>{busy ? 'Scheduling…' : 'Schedule follow-up'}</button>
    </form>
  )
}

function SiteVisitForm({ lead, leads, properties, onSubmit, busy }) {
  const [leadId, setLeadId] = useState(lead?.id ? String(lead.id) : '')
  const [propertyId, setPropertyId] = useState(properties[0]?.id ? String(properties[0].id) : '')
  const [when, setWhen] = useState(() => {
    const d = new Date()
    d.setDate(d.getDate() + 2)
    d.setHours(11, 0, 0, 0)
    return localInputValue(d)
  })

  return (
    <form
      className="grid gap-3"
      onSubmit={(e) => {
        e.preventDefault()
        onSubmit({ lead_id: Number(leadId), property_id: propertyId ? Number(propertyId) : null, scheduled_at: toUtcSql(new Date(when)) })
      }}
    >
      {lead ? <div className="rounded-xl bg-[var(--color-brand-soft)] px-3 py-2 text-sm font-semibold">{lead.full_name} · {lead.preferred_configuration || 'Any configuration'}</div> : <LeadPicker leads={leads} value={leadId} onChange={setLeadId} />}
      <label className="text-sm">
        Property
        <select className="select mt-1" value={propertyId} onChange={(e) => setPropertyId(e.target.value)}>
          <option value="">To be decided</option>
          {properties.map((p) => <option key={p.id} value={p.id}>{p.name}{p.city ? ` · ${p.city}` : ''}</option>)}
        </select>
      </label>
      <label className="text-sm">Visit date &amp; time<input className="input mt-1" type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} required /></label>
      <p className="text-xs text-[var(--color-ink-soft)]">The lead moves to “Site Visit Scheduled”.</p>
      <button className="btn btn-primary" disabled={busy || !leadId}>{busy ? 'Scheduling…' : 'Schedule site visit'}</button>
    </form>
  )
}

/**
 * Shared call / follow-up / site-visit dialogs for employee pages.
 * Returns opener functions plus the dialog element to render once per page.
 */
export function useLeadActions({ workspace, source, reload, onNotice, onError }) {
  const [dialog, setDialog] = useState(null)
  const [busy, setBusy] = useState(false)
  const leads = (workspace?.leads || []).filter((l) => !l.do_not_contact)
  const close = () => setDialog(null)

  const run = async (fn, message) => {
    setBusy(true)
    try {
      await fn()
      close()
      onNotice?.(message)
      await reload({ silent: true })
    } catch (e) {
      onError?.(e.message)
    } finally {
      setBusy(false)
    }
  }

  const submitCall = ({ leadId, outcome, notes, statusId, followUpAt, lead }) => run(async () => {
    const nextAt = followUpAt ? toUtcSql(new Date(followUpAt)) : null
    await employeeService.logCall(source, { lead_id: leadId, outcome, notes: notes || null, next_follow_up_at: nextAt })
    if (statusId) await employeeService.updateLeadStatus(source, leadId, statusId, `Call outcome: ${outcome}`)
    if (nextAt) {
      await employeeService.scheduleFollowUp(source, {
        lead_id: leadId, title: `Call back ${lead?.full_name?.split(' ')[0] || 'customer'}`, task_type: 'call',
        priority: lead?.priority || 'medium', due_at: nextAt, notes: notes || null,
      })
    }
  }, 'Call logged.')

  const element = (
    <>
      <Modal open={dialog?.type === 'call'} title="Log call" onClose={close}>
        {dialog?.type === 'call' ? <CallForm key={dialog.lead?.id || 'new'} lead={dialog.lead} leads={leads} statuses={workspace?.statuses || []} busy={busy} onSubmit={submitCall} /> : null}
      </Modal>
      <Modal open={dialog?.type === 'follow_up'} title="Schedule follow-up" onClose={close}>
        {dialog?.type === 'follow_up' ? (
          <FollowUpForm key={dialog.lead?.id || 'new'} lead={dialog.lead} leads={leads} busy={busy}
            onSubmit={(p) => run(() => employeeService.scheduleFollowUp(source, p), 'Follow-up scheduled.')} />
        ) : null}
      </Modal>
      <Modal open={dialog?.type === 'site_visit'} title="Schedule site visit" onClose={close}>
        {dialog?.type === 'site_visit' ? (
          <SiteVisitForm key={dialog.lead?.id || 'new'} lead={dialog.lead} leads={leads} properties={workspace?.properties || []} busy={busy}
            onSubmit={(p) => run(() => employeeService.scheduleSiteVisit(source, p), 'Site visit scheduled.')} />
        ) : null}
      </Modal>
    </>
  )

  return {
    openCall: (lead = null) => setDialog({ type: 'call', lead }),
    openFollowUp: (lead = null) => setDialog({ type: 'follow_up', lead }),
    openSiteVisit: (lead = null) => setDialog({ type: 'site_visit', lead }),
    run,
    busy,
    element,
  }
}
