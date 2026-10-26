
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import {
  LayoutDashboard, Users, Building2, Phone, CalendarCheck2, ClipboardList,
  Home, Megaphone, Sprout, Bell, Settings, FileBarChart2, Shield, LogOut, Menu, X,
  PhoneCall, CalendarClock, MapPin, IdCard,
} from 'lucide-react'
import { useAuth } from "../../auth/AuthContext";
import { api } from "../../api/client";
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
  const [loggingOut, setLoggingOut] = useState(false)

  const items = navByRole[user?.role] || navByRole.employee
  const isCompanyAdmin = user?.role === 'admin'
  const isEmployee = user?.role === 'employee'

  useEffect(() => {
    api('/api/notifications')
      .then((res) => setUnread(res.meta?.unread || 0))
      .catch(() => {})

    api('/api/health')
      .then((res) => setLocalDemo(res.data?.mode === 'local-demo'))
      .catch(() => {})
  }, [])

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
    <div
      className={clsx(
        'min-h-screen lg:grid lg:grid-cols-[260px_1fr]',
        isCompanyAdmin && 'company-admin-layout bg-slate-50',
        isEmployee && 'employee-layout',
      )}
    >
      <aside
        className={clsx(
          'fixed inset-y-0 left-0 z-40 w-[260px] border-r transition-transform xl:static xl:translate-x-0',
          isEmployee
            ? 'employee-sidebar border-slate-200 bg-white text-slate-800'
            : isCompanyAdmin
              ? 'border-blue-100 bg-white text-slate-800'
              : 'border-[var(--color-line)] bg-[var(--color-brand-deep)] text-white',
          open ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div
          className={clsx(
            'flex h-16 items-center justify-between px-5',
            (isCompanyAdmin || isEmployee) && 'border-b border-slate-100',
          )}
        >
          <div>
            <div
              className={clsx(
                'font-display text-xl tracking-tight',
                isCompanyAdmin
                  ? 'text-blue-700'
                  : isEmployee
                    ? 'font-bold text-blue-950'
                    : 'text-white',
              )}
            >
              Yahoo CRM
            </div>
            <div
              className={clsx(
                'text-xs',
                isCompanyAdmin || isEmployee
                  ? 'text-slate-500'
                  : 'text-teal-100/80',
              )}
            >
              Real Estate CRM
            </div>
          </div>

          <button
            type="button"
            className={clsx(
              'rounded-lg p-1 xl:hidden',
              isCompanyAdmin || isEmployee
                ? 'text-slate-600 hover:bg-slate-100'
                : 'text-white hover:bg-white/10',
            )}
            onClick={() => setOpen(false)}
            aria-label="Close navigation"
          >
            <X size={18} />
          </button>
        </div>

        <nav className="space-y-1 px-3 pb-8">
          {items.map(({ to, label, icon: Icon, section }, index) =>
            section ? (
              <div
                key={`${section}-${index}`}
                className={clsx(
                  'px-3 pb-1 pt-4 text-[10px] font-semibold uppercase tracking-[0.14em] first:pt-1',
                  isCompanyAdmin || isEmployee
                    ? 'text-slate-400'
                    : 'text-teal-100/50',
                )}
              >
                {section}
              </div>
            ) : (
              <NavLink
                key={to}
                to={to}
                end={to === '/'}
                onClick={() => setOpen(false)}
                className={({ isActive }) =>
                  clsx(
                    'flex items-center gap-2 rounded-xl px-3 py-2 text-sm transition',
                    isEmployee
                      ? isActive
                        ? 'bg-blue-50 font-semibold text-blue-700'
                        : 'text-slate-600 hover:bg-slate-50 hover:text-blue-700'
                      : isCompanyAdmin
                        ? isActive
                          ? 'bg-blue-600 text-white shadow-sm'
                          : 'text-slate-600 hover:bg-blue-50 hover:text-blue-700'
                        : isActive
                          ? 'bg-white/15 text-white'
                          : 'text-teal-50/80 hover:bg-white/10 hover:text-white',
                  )
                }
              >
                <Icon size={16} />
                <span className="flex-1">{label}</span>

                {label === 'Notifications' && unread > 0 ? (
                  <span
                    className={clsx(
                      'rounded-full px-1.5 text-[10px] font-bold',
                      isCompanyAdmin || isEmployee
                        ? 'bg-blue-100 text-blue-700'
                        : 'bg-[var(--color-accent)] text-white',
                    )}
                  >
                    {unread}
                  </span>
                ) : null}
              </NavLink>
            ),
          )}
        </nav>

        {isEmployee ? (
          <NavLink
            to="/profile"
            onClick={() => setOpen(false)}
            className={({ isActive }) =>
              clsx(
                'mx-3 mb-6 flex items-center gap-3 rounded-xl px-3 py-2.5 transition',
                isActive
                  ? 'bg-blue-50'
                  : 'bg-slate-50 hover:bg-blue-50',
              )
            }
          >
            <span className="grid size-9 place-items-center rounded-full bg-blue-600 text-xs font-bold text-white">
              {String(user.full_name || '?')
                .split(' ')
                .map((p) => p[0])
                .slice(0, 2)
                .join('')}
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold text-slate-800">
                {user.full_name}
              </span>
              <span className="block truncate text-xs text-slate-500">
                {user.employee_code} · Employee
              </span>
            </span>
          </NavLink>
        ) : null}
      </aside>

      <div
        className={clsx(
          'min-w-0',
          isCompanyAdmin && 'min-h-screen bg-slate-50',
          isEmployee && 'employee-main',
        )}
      >
        <header
          className={clsx(
            'sticky top-0 z-30 flex h-16 items-center justify-between border-b px-4 backdrop-blur',
            isCompanyAdmin
              ? 'border-blue-100 bg-white'
              : isEmployee
                ? 'border-slate-200 bg-white'
                : 'border-[var(--color-line)] bg-white/80',
          )}
        >
          <button
            type="button"
            className="btn btn-secondary xl:hidden"
            onClick={() => setOpen(true)}
            aria-label="Open navigation menu"
          >
            <Menu size={16} /> Menu
          </button>

          <div
            className={clsx(
              'hidden text-sm xl:block',
              isCompanyAdmin || isEmployee
                ? 'text-slate-500'
                : 'text-[var(--color-ink-soft)]',
            )}
          >
            Signed in as{' '}
            <span
              className={clsx(
                'font-semibold',
                isCompanyAdmin
                  ? 'text-blue-900'
                  : isEmployee
                    ? 'text-slate-900'
                    : 'text-[var(--color-ink)]',
              )}
            >
              {user?.full_name}
            </span>
            <span className="mx-2">·</span>
            <span className="capitalize">
              {user?.role?.replace('_', ' ')}
            </span>
          </div>

          <button
            type="button"
            className="btn btn-secondary"
            aria-label="Log out"
            disabled={loggingOut}
            onClick={onLogout}
          >
            <LogOut size={16} />
            {loggingOut ? 'Logging out…' : 'Logout'}
          </button>
        </header>

        <main
          className={clsx(
            'p-4 sm:p-6',
            isCompanyAdmin && 'min-h-[calc(100vh-4rem)] bg-slate-50',
            isEmployee && 'employee-content',
          )}
        >
          {localDemo ? (
            <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
              Frontend only. These screens use saved demo data in the dev
              server. Nothing is stored in a database.
            </div>
          ) : null}

          <Outlet />
        </main>
      </div>
    </div>
  )
}
