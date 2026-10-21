
import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { ErrorBanner } from '../components/ui'

export default function Login() {
  const { user, login, loading } = useAuth()
  const navigate = useNavigate()
  const [identifier, setIdentifier] = useState('admin@harborhomes.crm')
  const [password, setPassword] = useState('Password123!')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  if (!loading && user) return <Navigate to="/" replace />

  async function onSubmit(event) {
    event.preventDefault()
    setBusy(true)
    setError('')

try {
  const user = await login(identifier, password)

  if (user.role === 'super_admin') {
    navigate('/super-admin')
  } else {
    navigate('/')
  }
} catch (error) {
      setError(err.message || 'Unable to sign in. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="min-h-screen bg-[#f5f8ff] lg:grid lg:grid-cols-2">
      {/* Left panel with real-estate background */}
      <section
        className="relative hidden min-h-screen overflow-hidden bg-cover bg-center lg:flex lg:flex-col lg:justify-between lg:p-10 xl:p-14"
        style={{ backgroundImage: "url('/real-estate-bg.png')" }}
      >
        <div className="absolute inset-0 bg-gradient-to-br from-[#06152f]/95 via-[#071a3b]/75 to-[#071a3b]/55" />


            <div className="relative z-10">
              {/* Yahoo CRM logo */}
              <div className="inline-flex rounded-xl bg-white p-2 shadow-lg">
                <img
                  src="/yahoo-crm-logo.png"
                  alt="Yahoo CRM"
                  className="h-auto w-52 object-contain"
                />
              </div>

              {/* Platform badge below the logo */}
              <div className="mt-6">
                <div className="inline-flex max-w-full items-center gap-2 rounded-full border border-cyan-300/40 bg-[#071a3b]/60 px-4 py-2 text-xs font-semibold tracking-wide text-cyan-100 backdrop-blur-sm">
                  <span className="h-2 w-2 shrink-0 rounded-full bg-cyan-300" />
                  <span>REAL ESTATE MANAGEMENT PLATFORM</span>
                </div>
              </div>

              <h1 className="mt-7 max-w-xl text-4xl font-bold leading-tight text-white xl:text-5xl">
                Every lead.
                <br />
                Every property.
                <br />
                <span className="bg-gradient-to-r from-cyan-300 via-sky-400 to-violet-400 bg-clip-text text-transparent">
                  One smarter workspace.
                </span>
              </h1>

              <p className="mt-6 max-w-lg text-base leading-7 text-slate-200">
                Manage your sales pipeline, coordinate your team, track follow-ups,
                and turn property enquiries into opportunities.
              </p>
            </div>


        <div className="relative z-10 grid grid-cols-3 gap-3">
          {[
            ['01', 'Lead management'],
            ['02', 'Team collaboration'],
            ['03', 'Performance insights'],
          ].map(([number, label]) => (
            <div
              key={number}
              className="rounded-xl border border-white/20 bg-[#071a3b]/65 p-4 backdrop-blur-md"
            >
              <div className="text-sm font-bold text-cyan-300">{number}</div>
              <div className="mt-2 text-sm text-white">{label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Right login panel */}
      <section className="relative flex min-h-screen items-center justify-center overflow-hidden px-5 py-10 sm:px-8">
        <div className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-cyan-300/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -left-24 h-64 w-64 rounded-full bg-violet-300/20 blur-3xl" />

        <div className="relative w-full max-w-md">
          <div className="mb-7 text-center lg:hidden">
            <div className="inline-flex rounded-xl bg-white p-3 shadow-sm">
              <img
                src="/yahoo-crm-logo.png"
                alt="Yahoo CRM"
                className="h-auto w-56 object-contain"
              />
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-[0_24px_80px_rgba(17,45,91,0.12)] sm:p-9">
            <div className="mb-8">
              <div className="mb-3 inline-flex rounded-full bg-[#e8f8ff] px-3 py-1.5 text-xs font-semibold text-[#087ea4]">
                Welcome to Yahoo CRM
              </div>
              <h2 className="text-3xl font-bold tracking-tight text-[#10264e]">
                Sign in to your account
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                Enter your work credentials to access your workspace.
              </p>
            </div>

            <form onSubmit={onSubmit}>
              <ErrorBanner message={error} />

              <label htmlFor="identifier" className="mb-2 mt-5 block text-sm font-semibold text-slate-700">
                Email or Employee ID
              </label>
              <input
                id="identifier"
                type="text"
                autoComplete="username"
                placeholder="Enter your email or employee ID"
                value={identifier}
                onChange={(event) => setIdentifier(event.target.value)}
                required
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-sm text-slate-900 outline-none transition focus:border-cyan-500 focus:bg-white focus:ring-4 focus:ring-cyan-100"
              />

              <label htmlFor="password" className="mb-2 mt-5 block text-sm font-semibold text-slate-700">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3.5 pr-20 text-sm text-slate-900 outline-none transition focus:border-cyan-500 focus:bg-white focus:ring-4 focus:ring-cyan-100"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  className="absolute inset-y-0 right-3 my-auto h-9 rounded-lg px-2 text-xs font-semibold text-[#126a9b] hover:bg-cyan-50"
                >
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>

              <button
                type="submit"
                disabled={busy}
                className="mt-7 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#087fe8] via-[#087fdb] to-[#5125ed] px-4 py-3.5 text-sm font-bold text-white shadow-lg shadow-blue-900/20 transition hover:-translate-y-0.5 hover:shadow-xl focus:outline-none focus:ring-4 focus:ring-blue-200 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {busy ? 'Signing in...' : 'Sign in to Yahoo CRM'}
                {!busy && <span aria-hidden="true">→</span>}
              </button>
            </form>

            <div className="mt-6 rounded-xl border border-cyan-100 bg-gradient-to-r from-[#f0fbff] to-[#f6f2ff] p-4">
              <div className="text-xs font-bold uppercase tracking-wider text-[#17618e]">
                Development demo access
              </div>
              <p className="mt-2 break-all text-sm text-slate-600">
                admin@harborhomes.crm
              </p>
              <p className="mt-1 text-sm text-slate-600">
                Password: <span className="font-semibold">Password123!</span>
              </p>
              <p className="mt-2 text-xs leading-5 text-slate-500">
                Local development only. Real authentication requires the backend.
              </p>
            </div>
          </div>

          <p className="mt-6 text-center text-xs text-slate-400">
            © {new Date().getFullYear()} Yahoo CRM · Real Estate Management
          </p>
        </div>
      </section>
    </main>
  )
}
