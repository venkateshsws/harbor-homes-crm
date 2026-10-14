import { useState } from 'react'
import { Briefcase, Building2, CalendarDays, IdCard, Mail, Phone, UserRound } from 'lucide-react'
import { api } from '../api/client'
import { useAuth } from '../auth/AuthContext'
import { ErrorBanner, PageHeader } from '../components/ui'
import { Avatar, DataSourceBadge } from '../components/employee/EmployeeUI'
import { useEmployeeWorkspace } from '../hooks/useEmployeeWorkspace'
import { fmtDate, fmtDateTime, humanize } from '../lib/format'

function Field({ icon: Icon, label, children }) {
  return (
    <div className="flex items-start gap-3 rounded-xl bg-white px-3 py-2.5">
      <Icon size={16} className="mt-0.5 shrink-0 text-[var(--color-brand)]" />
      <div className="min-w-0">
        <div className="text-[11px] font-semibold uppercase tracking-wide text-[var(--color-ink-soft)]">{label}</div>
        <div className="truncate text-sm font-medium">{children || '—'}</div>
      </div>
    </div>
  )
}

export default function Profile() {
  const { user, refresh } = useAuth()
  const { data, source } = useEmployeeWorkspace()
  const [phone, setPhone] = useState(user?.phone || '')
  const [fullName, setFullName] = useState(user?.full_name || '')
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const profile = data?.profile

  const saveProfile = async (e) => {
    e.preventDefault()
    setError('')
    try {
      await api(`/api/users/${user.id}`, { method: 'PUT', body: { phone, full_name: fullName } })
      await refresh()
      setMessage('Profile updated')
    } catch (err) { setError(err.message) }
  }

  const changePassword = async (e) => {
    e.preventDefault()
    setError('')
    try {
      await api('/api/auth/change-password', {
        method: 'POST',
        body: { current_password: currentPassword, new_password: newPassword },
      })
      setMessage('Password updated')
      setCurrentPassword('')
      setNewPassword('')
    } catch (err) { setError(err.message) }
  }

  return (
    <div>
      <PageHeader title="My profile" subtitle={`${user?.employee_code} · ${user?.email}`} actions={<DataSourceBadge source={source} />} />
      <ErrorBanner message={error} />
      {message ? <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{message}</div> : null}

      <section className="card-panel mb-4 p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <Avatar name={profile?.full_name || user?.full_name} size="lg" />
          <div className="min-w-0 flex-1">
            <h2 className="font-display text-2xl">{profile?.full_name || user?.full_name}</h2>
            <p className="text-sm text-[var(--color-ink-soft)]">
              {profile?.role_name || humanize(user?.role)} · {profile?.department || '—'}
            </p>
          </div>
          <span className="badge self-start bg-[var(--color-brand-soft)] font-mono text-sm text-[var(--color-brand-deep)] sm:self-center">
            {profile?.employee_code || user?.employee_code}
          </span>
        </div>
        <div className="mt-5 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          <Field icon={IdCard} label="Employee ID">{profile?.employee_code || user?.employee_code}</Field>
          <Field icon={Building2} label="Department">{profile?.department}</Field>
          <Field icon={UserRound} label="Reporting manager">
            {profile?.manager_name ? `${profile.manager_name}` : 'Not assigned'}
          </Field>
          <Field icon={Briefcase} label="Team · specialization">
            {[profile?.team_name, profile?.specialization && humanize(profile.specialization)].filter(Boolean).join(' · ')}
          </Field>
          <Field icon={Mail} label="Work email">{profile?.email || user?.email}</Field>
          <Field icon={Phone} label="Phone">{profile?.phone || user?.phone}</Field>
          <Field icon={CalendarDays} label="Date of joining">{profile?.date_of_joining ? fmtDate(profile.date_of_joining) : null}</Field>
          <Field icon={CalendarDays} label="Last login">{fmtDateTime(profile?.last_login_at || user?.last_login_at)}</Field>
        </div>
        {profile?.manager_email ? (
          <p className="mt-3 text-xs text-[var(--color-ink-soft)]">
            Manager contact: <a className="text-[var(--color-brand)]" href={`mailto:${profile.manager_email}`}>{profile.manager_email}</a>
            {profile.manager_phone ? <> · <a className="text-[var(--color-brand)]" href={`tel:${profile.manager_phone}`}>{profile.manager_phone}</a></> : null}
          </p>
        ) : null}
        <p className="mt-1 text-xs text-[var(--color-ink-soft)]">Employee ID, department and manager are maintained by your admin.</p>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <form className="card-panel grid gap-3 p-4" onSubmit={saveProfile}>
          <h2 className="font-semibold">Permitted profile fields</h2>
          <label className="text-sm">Full name<input className="input mt-1" value={fullName} onChange={(e) => setFullName(e.target.value)} /></label>
          <label className="text-sm">Phone<input className="input mt-1" value={phone} onChange={(e) => setPhone(e.target.value)} /></label>
          <button className="btn btn-primary">Save profile</button>
        </form>
        <form className="card-panel grid gap-3 p-4" onSubmit={changePassword}>
          <h2 className="font-semibold">Change password</h2>
          <label className="text-sm">Current<input className="input mt-1" type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required /></label>
          <label className="text-sm">New<input className="input mt-1" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required minLength={8} /></label>
          <button className="btn btn-primary">Update password</button>
        </form>
      </div>
    </div>
  )
}
