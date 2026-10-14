import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { ErrorBanner } from '../components/ui'

export default function Login() {
  const { user, login, loading } = useAuth()
  const navigate = useNavigate()
  const [identifier, setIdentifier] = useState('admin@harborhomes.crm')
  const [password, setPassword] = useState('Password123!')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  if (!loading && user) return <Navigate to="/" replace />

  const onSubmit = async (e) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      await login(identifier, password)
      navigate('/')
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <section className="relative hidden overflow-hidden bg-[var(--color-brand-deep)] text-white lg:flex lg:flex-col lg:justify-between lg:p-12">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,.12),transparent_40%),radial-gradient(circle_at_80%_0%,rgba(196,92,38,.35),transparent_35%)]" />
        <div className="relative">
          <div className="font-display text-4xl">Harbor Homes</div>
          <p className="mt-3 max-w-md text-teal-50/85">
            Secure CRM for lead assignment, attendance, follow-ups, and campaign nurturing — built for shared hosting.
          </p>
        </div>
        <div className="relative space-y-3 text-sm text-teal-50/80">
          <div>Role-based access for Admin, Team Lead, and Employee</div>
          <div>Round-robin and priority lead distribution</div>
          <div>WhatsApp Cloud API ready (simulated until credentials are set)</div>
        </div>
      </section>

      <section className="flex items-center justify-center p-6">
        <form onSubmit={onSubmit} className="card-panel w-full max-w-md p-6 animate-fade-up">
          <div className="mb-6 lg:hidden">
            <div className="font-display text-3xl text-[var(--color-brand)]">Harbor Homes</div>
            <p className="text-sm text-[var(--color-ink-soft)]">Real Estate CRM sign-in</p>
          </div>
          <h1 className="font-display text-2xl">Welcome back</h1>
          <p className="mt-1 text-sm text-[var(--color-ink-soft)]">Use your email or employee ID.</p>
          <ErrorBanner message={error} />
          <label className="mt-5 block text-sm font-medium">Email or Employee ID</label>
          <input className="input mt-1" value={identifier} onChange={(e) => setIdentifier(e.target.value)} required />
          <label className="mt-4 block text-sm font-medium">Password</label>
          <input className="input mt-1" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          <button className="btn btn-primary mt-6 w-full" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
          <div className="mt-5 rounded-xl bg-[var(--color-brand-soft)] p-3 text-xs text-[var(--color-ink-soft)]">
            Demo: admin@harborhomes.crm / lead.north@harborhomes.crm / anita@harborhomes.crm — password <strong>Password123!</strong>
          </div>
        </form>
      </section>
    </div>
  )
}
