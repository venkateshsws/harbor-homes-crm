import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import {
  LayoutDashboard, Users, Building2, Phone, CalendarCheck2, ClipboardList,
  Home, Megaphone, Sprout, Bell, Settings, FileBarChart2, Shield, LogOut, Menu, X,
  PhoneCall, CalendarClock, MapPin, IdCard,
} from 'lucide-react'
import { useAuth } from '../auth/AuthContext'
import { api } from '../api/client'
import clsx from 'clsx'

const navByRole = {
  admin: [
    { to: '/', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/leads', label: 'Leads', icon: ClipboardList },
    { to: '/assignment', label: 'Lead Assignment', icon: Users },
    { to: '/employees', label: 'Employees', icon: Users },
    { to: '/teams', label: 'Teams', icon: Building2 },
    { to: '/attendance', label: 'Attendance', icon: CalendarCheck2 },
    { to: '/calls', label: 'Calls', icon: Phone },
    { to: '/follow-ups', label: 'Follow-ups', icon: CalendarCheck2 },
    { to: '/properties', label: 'Properties', icon: Home },
    { to: '/campaigns', label: 'Campaigns', icon: Megaphone },
    { to: '/nurturing', label: 'Lead Nurturing', icon: Sprout },
    { to: '/reports', label: 'Reports', icon: FileBarChart2 },
    { to: '/notifications', label: 'Notifications', icon: Bell },
    { to: '/settings', label: 'Settings', icon: Settings },
    { to: '/audit', label: 'Audit Logs', icon: Shield },
  ],
  team_lead: [
    { to: '/', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/leads', label: 'Team Leads', icon: ClipboardList },
    { to: '/employees', label: 'Employees', icon: Users },
    { to: '/attendance', label: 'Attendance', icon: CalendarCheck2 },
    { to: '/calls', label: 'Calls', icon: Phone },
    { to: '/follow-ups', label: 'Follow-ups', icon: CalendarCheck2 },
    { to: '/site-visits', label: 'Site Visits', icon: Home },
    { to: '/reports', label: 'Reports', icon: FileBarChart2 },
    { to: '/notifications', label: 'Notifications', icon: Bell },
  ],
  employee: [
    { section: 'Workspace' },
    { to: '/', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/leads', label: 'My Leads', icon: ClipboardList },
    { to: '/calls', label: 'Call History', icon: PhoneCall },
    { to: '/follow-ups', label: 'Follow-ups', icon: CalendarClock },
    { to: '/site-visits', label: 'Site Visits', icon: MapPin },
    { section: 'Me' },
    { to: '/attendance', label: 'My Attendance', icon: CalendarCheck2 },
    { to: '/performance', label: 'Performance & Reports', icon: FileBarChart2 },
    { to: '/notifications', label: 'Notifications', icon: Bell },
    { to: '/profile', label: 'My Profile', icon: IdCard },
  ],
}

export default function Layout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [unread, setUnread] = useState(0)
  const [localDemo, setLocalDemo] = useState(false)
  const items = navByRole[user?.role] || navByRole.employee

  useEffect(() => {
    api('/api/notifications')
      .then((res) => setUnread(res.meta?.unread || 0))
      .catch(() => {})
    api('/api/health')
      .then((res) => setLocalDemo(res.data?.mode === 'local-demo'))
      .catch(() => {})
  }, [])

  const [loggingOut, setLoggingOut] = useState(false)

  const onLogout = async () => {
    if (loggingOut) return
    setLoggingOut(true)
    try {
      await logout()
    } finally {
      navigate('/login', { replace: true })
      setLoggingOut(false)
    }
  }

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[260px_1fr]">
      <aside className={clsx(
        'fixed inset-y-0 left-0 z-40 w-[260px] border-r border-[var(--color-line)] bg-[var(--color-brand-deep)] text-white transition-transform lg:static lg:translate-x-0',
        open ? 'translate-x-0' : '-translate-x-full',
      )}>
        <div className="flex h-16 items-center justify-between px-5">
          <div>
            <div className="font-display text-xl tracking-tight">Harbor Homes</div>
            <div className="text-xs text-teal-100/80">Real Estate CRM</div>
          </div>
          <button className="lg:hidden" onClick={() => setOpen(false)}><X size={18} /></button>
        </div>
        <nav className="space-y-1 px-3 pb-8">
          {items.map(({ to, label, icon: Icon, section }) => section ? (
            <div key={section} className="px-3 pb-1 pt-4 text-[10px] font-semibold uppercase tracking-[0.14em] text-teal-100/50 first:pt-1">
              {section}
            </div>
          ) : (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              onClick={() => setOpen(false)}
              className={({ isActive }) => clsx(
                'flex items-center gap-2 rounded-xl px-3 py-2 text-sm transition',
                isActive ? 'bg-white/15 text-white' : 'text-teal-50/80 hover:bg-white/10 hover:text-white',
              )}
            >
              <Icon size={16} />
              <span className="flex-1">{label}</span>
              {label === 'Notifications' && unread > 0 ? (
                <span className="rounded-full bg-[var(--color-accent)] px-1.5 text-[10px] font-bold">{unread}</span>
              ) : null}
            </NavLink>
          ))}
        </nav>
        {user?.role === 'employee' ? (
          <NavLink
            to="/profile"
            onClick={() => setOpen(false)}
            className="mx-3 mb-6 flex items-center gap-3 rounded-xl bg-white/10 px-3 py-2.5 transition hover:bg-white/15"
          >
            <span className="grid size-9 place-items-center rounded-full bg-[var(--color-accent)] text-xs font-bold">
              {String(user.full_name || '?').split(' ').map((p) => p[0]).slice(0, 2).join('')}
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold">{user.full_name}</span>
              <span className="block truncate text-xs text-teal-100/70">{user.employee_code} · Employee</span>
            </span>
          </NavLink>
        ) : null}
      </aside>

      <div className="min-w-0">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-[var(--color-line)] bg-white/80 px-4 backdrop-blur">
          <button className="btn btn-secondary lg:hidden" onClick={() => setOpen(true)}><Menu size={16} /> Menu</button>
          <div className="hidden text-sm text-[var(--color-ink-soft)] lg:block">
            Signed in as <span className="font-semibold text-[var(--color-ink)]">{user?.full_name}</span>
            <span className="mx-2">·</span>
            <span className="capitalize">{user?.role?.replace('_', ' ')}</span>
          </div>
          <button
            type="button"
            className="btn btn-secondary"
            aria-label="Log out"
            disabled={loggingOut}
            onClick={onLogout}
          >
            <LogOut size={16} /> {loggingOut ? 'Logging out…' : 'Logout'}
          </button>
        </header>
        <main className="p-4 sm:p-6">
          {localDemo ? (
            <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
              Frontend only. These screens use saved demo data in the dev server. Nothing is stored in a database.
            </div>
          ) : null}
          <Outlet />
        </main>
      </div>
    </div>
  )
}
