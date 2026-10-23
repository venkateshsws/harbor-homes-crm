
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { LogOut } from 'lucide-react'
import { useMemo, useState } from 'react'
import {
  LayoutDashboard,
  Building2,
  Users,
  UserRound,
  ChartNoAxesCombined,
  Settings,
  Search,
  Bell,
  ChevronDown,
  Menu,
  X,
  Plus,
  ArrowUpRight,
  ArrowDownRight,
  MoreHorizontal,
  Eye,
  Pencil,
  Power,
  Activity,
  ShieldCheck,
  TrendingUp,
  CalendarDays,
} from 'lucide-react'

const initialCompanies = [
  {
    id: 1,
    name: 'Sun Website Solutions',
    code: 'YCR-001',
    admin: 'Ravi Kumar',
    employees: 28,
    leads: 524,
    status: 'Active',
    joined: '12 Oct 2026',
    color: 'bg-blue-100 text-blue-700',
  },
  {
    id: 2,
    name: 'Vibrant Propmart',
    code: 'YCR-002',
    admin: 'Priya Sharma',
    employees: 16,
    leads: 312,
    status: 'Active',
    joined: '08 Oct 2026',
    color: 'bg-violet-100 text-violet-700',
  },
  {
    id: 3,
    name: 'Prime Properties',
    code: 'YCR-003',
    admin: 'Arjun Reddy',
    employees: 12,
    leads: 245,
    status: 'Active',
    joined: '02 Oct 2026',
    color: 'bg-emerald-100 text-emerald-700',
  },
  {
    id: 4,
    name: 'Urban Estates',
    code: 'YCR-004',
    admin: 'Sneha Rao',
    employees: 0,
    leads: 0,
    status: 'Inactive',
    joined: '25 Sep 2026',
    color: 'bg-orange-100 text-orange-700',
  },
]

const navigation = [
  { label: 'Overview', icon: LayoutDashboard },
  { label: 'Companies', icon: Building2 },
  { label: 'Company Admins', icon: Users },
  { label: 'Users', icon: UserRound },
  { label: 'Reports', icon: ChartNoAxesCombined },
  { label: 'Settings', icon: Settings },
]

const monthlyGrowth = [
  { month: 'May', value: 36 },
  { month: 'Jun', value: 52 },
  { month: 'Jul', value: 44 },
  { month: 'Aug', value: 69 },
  { month: 'Sep', value: 58 },
  { month: 'Oct', value: 88 },
]

function StatCard({ title, value, change, icon: Icon, color, down }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-slate-500">{title}</p>
          <h3 className="mt-3 text-2xl font-bold tracking-tight text-slate-900">
            {value}
          </h3>
        </div>
        <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${color}`}>
          <Icon size={21} />
        </div>
      </div>

      <div className="mt-4 flex items-center gap-1.5 text-xs">
        {down ? (
          <ArrowDownRight size={15} className="text-red-500" />
        ) : (
          <ArrowUpRight size={15} className="text-emerald-600" />
        )}
        <span className={down ? 'font-semibold text-red-600' : 'font-semibold text-emerald-600'}>
          {change}
        </span>
        <span className="text-slate-400">vs last month</span>
      </div>
    </div>
  )
}

function StatusBadge({ status }) {
  const active = status === 'Active'

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${
        active
          ? 'bg-emerald-50 text-emerald-700'
          : 'bg-slate-100 text-slate-600'
      }`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${
          active ? 'bg-emerald-500' : 'bg-slate-400'
        }`}
      />
      {status}
    </span>
  )
}

export default function SuperAdminDashboard() {
  const navigate = useNavigate()
  const { logout } = useAuth()

  const handleLogout = async () => {
    await logout()
    navigate('/login', { replace: true })
    }
  const [activeNav, setActiveNav] = useState('Overview')
  const [companies, setCompanies] = useState(initialCompanies)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('All')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [showCompanyForm, setShowCompanyForm] = useState(false)
  const [companyName, setCompanyName] = useState('')
  const [companyAdmin, setCompanyAdmin] = useState('')
  const [companyEmail, setCompanyEmail] = useState('')
  const [notice, setNotice] = useState('')

  const activeCompanies = companies.filter(
    (company) => company.status === 'Active',
  ).length

  const totalEmployees = companies.reduce(
    (sum, company) => sum + company.employees,
    0,
  )

  const totalLeads = companies.reduce(
    (sum, company) => sum + company.leads,
    0,
  )

  const filteredCompanies = useMemo(() => {
    return companies.filter((company) => {
      const query = search.toLowerCase()

      const matchesSearch =
        company.name.toLowerCase().includes(query) ||
        company.code.toLowerCase().includes(query) ||
        company.admin.toLowerCase().includes(query)

      const matchesStatus =
        statusFilter === 'All' || company.status === statusFilter

      return matchesSearch && matchesStatus
    })
  }, [companies, search, statusFilter])

  const addCompany = (event) => {
    event.preventDefault()

    if (!companyName.trim() || !companyAdmin.trim() || !companyEmail.trim()) {
      setNotice('Please complete all company fields.')
      return
    }

    const newCompany = {
      id: Date.now(),
      name: companyName.trim(),
      code: `YCR-${String(companies.length + 1).padStart(3, '0')}`,
      admin: companyAdmin.trim(),
      employees: 0,
      leads: 0,
      status: 'Active',
      joined: new Date().toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      }),
      color: 'bg-blue-100 text-blue-700',
      email: companyEmail.trim(),
    }

    setCompanies((previous) => [newCompany, ...previous])
    setCompanyName('')
    setCompanyAdmin('')
    setCompanyEmail('')
    setShowCompanyForm(false)
    setActiveNav('Companies')
    setNotice('Company added to local demo data.')
  }

  const toggleCompanyStatus = (id) => {
    setCompanies((previous) =>
      previous.map((company) =>
        company.id === id
          ? {
              ...company,
              status: company.status === 'Active' ? 'Inactive' : 'Active',
            }
          : company,
      ),
    )
    setNotice('Company status updated in local demo data.')
  }

  const selectNavigation = (label) => {
    setActiveNav(label)
    setSidebarOpen(false)
    setNotice('')
  }

  const pageTitle =
    activeNav === 'Overview' ? 'Dashboard Overview' : activeNav

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800">
      {sidebarOpen && (
        <button
          type="button"
          aria-label="Close navigation"
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 z-40 bg-slate-950/30 lg:hidden"
        />
      )}

      {/* CLEAN WHITE AND BLUE SIDEBAR */}
      
        <aside
        className={`fixed inset-y-0 left-0 z-50 flex h-screen w-64 flex-col overflow-y-auto overscroll-contain border-r border-slate-200 bg-white transition-transform duration-300 ${
            sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } lg:translate-x-0`}
        >

        <div className="flex h-[84px] items-center justify-between border-b border-slate-100 px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm shadow-blue-200">
              <Building2 size={23} />
            </div>
            <div>
              <h1 className="text-lg font-extrabold tracking-tight text-blue-950">
                YAHOO CRM
              </h1>
              <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                Super Admin
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setSidebarOpen(false)}
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 lg:hidden"
            aria-label="Close sidebar"
          >
            <X size={19} />
          </button>
        </div>

        <div className="px-4 pt-7">
          <p className="mb-3 px-3 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">
            Workspace
          </p>

          <nav className="space-y-1">
            {navigation.map(({ label, icon: Icon }) => {
              const active = activeNav === label

              return (
                <button
                  key={label}
                  type="button"
                  onClick={() => selectNavigation(label)}
                  className={`group flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm transition-colors ${
                    active
                      ? 'bg-blue-50 font-semibold text-blue-700'
                      : 'font-medium text-slate-600 hover:bg-slate-50 hover:text-blue-700'
                  }`}
                >
                  <Icon
                    size={19}
                    className={
                      active
                        ? 'text-blue-600'
                        : 'text-slate-400 group-hover:text-blue-600'
                    }
                  />
                  <span className="flex-1">{label}</span>

                  {label === 'Companies' && (
                    <span
                      className={`rounded-md px-2 py-0.5 text-[10px] ${
                        active
                          ? 'bg-blue-100 text-blue-700'
                          : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      {companies.length}
                    </span>
                  )}
                </button>
              )
            })}
          </nav>
        </div>

        <div className="mt-auto p-4">
        
          <div className="rounded-2xl border border-blue-100 bg-blue-50/70 p-4">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-blue-600 shadow-sm">
              <ShieldCheck size={20} />
            </div>
            <p className="mt-3 text-sm font-semibold text-slate-800">
              Platform Control
            </p>
            <p className="mt-1 text-xs leading-5 text-slate-500">
              Manage companies and monitor your CRM platform.
            </p>
            <div className="mt-3 flex items-center gap-2 text-xs font-medium text-emerald-700">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              Demo environment
            </div>
          </div>

            <div className="mt-4 border-t border-slate-100 pt-4">
            {/* Super Admin Profile */}
            <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 text-sm font-bold text-blue-700">
                SA
                </div>

                <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-slate-800">
                    Super Admin
                </p>
                <p className="truncate text-xs text-slate-500">
                    Platform Administrator
                </p>
                </div>

                <ShieldCheck size={17} className="text-blue-600" />
            </div>

            {/* Logout Button Below Profile */}
            
            {/* Logout Button Below Profile */}
            <button
              type="button"
              onClick={handleLogout}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-600 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600"
            >
              <LogOut size={17} />
              <span>Log out</span>
            </button>
          </div>
        </div>
        
      </aside>

      {/* MAIN CONTENT */}
      <div className="min-h-screen lg:pl-64">
        <header className="sticky top-0 z-30 flex h-[76px] items-center justify-between border-b border-slate-200 bg-white/95 px-4 backdrop-blur-sm sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="rounded-xl border border-slate-200 p-2 text-slate-600 hover:bg-slate-50 lg:hidden"
              aria-label="Open navigation"
            >
              <Menu size={20} />
            </button>
        

            <div className="min-w-0">
              <p className="hidden text-xs text-slate-400 sm:block">
                Yahoo CRM / {activeNav}
              </p>
              <h2 className="truncate text-lg font-bold tracking-tight text-slate-900 sm:mt-1 sm:text-xl">
                {pageTitle}
              </h2>
            </div>
          </div>

          <div className="ml-3 flex items-center gap-2 sm:gap-4">
            <div className="hidden items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-500 sm:flex">
              <CalendarDays size={15} />
              {new Date().toLocaleDateString('en-IN', {
                day: '2-digit',
                month: 'short',
                year: 'numeric',
              })}
            </div>

            <button
              type="button"
              aria-label="Notifications"
              onClick={() => setNotice('You are viewing the demo notification area.')}
              className="relative rounded-xl border border-slate-200 p-2.5 text-slate-500 transition hover:bg-slate-50 hover:text-blue-600"
            >
              <Bell size={19} />
              <span className="absolute right-2 top-2 h-2 w-2 rounded-full border-2 border-white bg-blue-600" />
            </button>

            <div className="hidden items-center gap-2 sm:flex">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-700">
                SA
              </div>
              <div className="hidden xl:block">
                <p className="text-xs font-semibold text-slate-800">
                  Super Admin
                </p>
                <p className="text-[10px] text-slate-500">Administrator</p>
              </div>
              <ChevronDown size={15} className="text-slate-400" />
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-[1600px] p-4 sm:p-6 lg:p-8">
          {notice && (
            <div
              role="status"
              className="mb-5 flex items-center justify-between gap-3 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-800"
            >
              <span>{notice}</span>
              <button
                type="button"
                onClick={() => setNotice('')}
                aria-label="Dismiss message"
                className="rounded p-1 hover:bg-blue-100"
              >
                <X size={16} />
              </button>
            </div>
          )}

          {activeNav === 'Overview' && (
            <>
              <div className="mb-7 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                <div>
                  <p className="text-sm text-slate-500">
                    Here is what is happening across your platform.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setActiveNav('Companies')
                    setShowCompanyForm(true)
                  }}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-blue-200 transition hover:bg-blue-700"
                >
                  <Plus size={18} />
                  Add Company
                </button>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <StatCard
                  title="Total Companies"
                  value={companies.length.toLocaleString('en-IN')}
                  change="+12.5%"
                  icon={Building2}
                  color="bg-blue-50 text-blue-600"
                />
                <StatCard
                  title="Active Companies"
                  value={activeCompanies.toLocaleString('en-IN')}
                  change="+8.2%"
                  icon={Activity}
                  color="bg-emerald-50 text-emerald-600"
                />
                <StatCard
                  title="Total Employees"
                  value={totalEmployees.toLocaleString('en-IN')}
                  change="+16.4%"
                  icon={Users}
                  color="bg-violet-50 text-violet-600"
                />
                <StatCard
                  title="Total Leads"
                  value={totalLeads.toLocaleString('en-IN')}
                  change="+21.7%"
                  icon={TrendingUp}
                  color="bg-orange-50 text-orange-600"
                />
              </div>

              <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-3">
                <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6 xl:col-span-2">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="font-bold text-slate-900">
                        Platform Growth
                      </h3>
                      <p className="mt-1 text-xs text-slate-500">
                        Monthly company growth overview
                      </p>
                    </div>
                    <span className="rounded-lg bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700">
                      Last 6 months
                    </span>
                  </div>

                  <div className="mt-8 flex h-52 items-end justify-around gap-3 border-b border-slate-100 pb-2">
                    {monthlyGrowth.map((item) => (
                      <div
                        key={item.month}
                        className="flex h-full flex-1 flex-col items-center justify-end gap-3"
                      >
                        <div className="flex h-full w-full max-w-12 items-end">
                          <div
                            title={`${item.value}% relative growth`}
                            className="w-full rounded-t-lg bg-blue-500 transition hover:bg-blue-700"
                            style={{ height: `${item.value}%` }}
                          />
                        </div>
                        <span className="text-xs font-medium text-slate-500">
                          {item.month}
                        </span>
                      </div>
                    ))}
                  </div>
                  <p className="mt-4 text-xs text-slate-400">
                    Illustrative demo chart. Connect platform data for actual
                    growth figures.
                  </p>
                </section>

                <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                  <h3 className="font-bold text-slate-900">
                    Company Status
                  </h3>
                  <p className="mt-1 text-xs text-slate-500">
                    Current company distribution
                  </p>

                  <div className="flex flex-col items-center justify-center py-6">
                    <div
                      className="relative flex h-40 w-40 items-center justify-center rounded-full"
                      style={{
                        background: `conic-gradient(#2563eb 0deg ${
                          companies.length
                            ? (activeCompanies / companies.length) * 360
                            : 0
                        }deg, #e2e8f0 ${
                          companies.length
                            ? (activeCompanies / companies.length) * 360
                            : 0
                        }deg 360deg)`,
                      }}
                    >
                      <div className="flex h-28 w-28 flex-col items-center justify-center rounded-full bg-white">
                        <span className="text-3xl font-bold text-slate-900">
                          {companies.length}
                        </span>
                        <span className="text-xs text-slate-500">
                          Companies
                        </span>
                      </div>
                    </div>

                    <div className="mt-6 flex w-full justify-center gap-5">
                      <div className="flex items-center gap-2 text-xs text-slate-600">
                        <span className="h-2.5 w-2.5 rounded-full bg-blue-600" />
                        Active ({activeCompanies})
                      </div>
                      <div className="flex items-center gap-2 text-xs text-slate-600">
                        <span className="h-2.5 w-2.5 rounded-full bg-slate-200" />
                        Inactive ({companies.length - activeCompanies})
                      </div>
                    </div>
                  </div>
                </section>
              </div>

              <CompanyTable
                companies={companies.slice(0, 4)}
                search={search}
                setSearch={setSearch}
                statusFilter={statusFilter}
                setStatusFilter={setStatusFilter}
                onToggleStatus={toggleCompanyStatus}
                onView={(company) => {
                  setSearch(company.name)
                  setActiveNav('Companies')
                }}
                onAdd={() => {
                  setActiveNav('Companies')
                  setShowCompanyForm(true)
                }}
                compact
              />
            </>
          )}

          {activeNav === 'Companies' && (
            <>
              <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                <div>
                  <p className="text-sm text-slate-500">
                    Register and manage companies on your platform.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowCompanyForm((open) => !open)}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
                >
                  <Plus size={18} />
                  Add Company
                </button>
              </div>

              {showCompanyForm && (
                <form
                  onSubmit={addCompany}
                  className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"
                >
                  <h3 className="mb-5 font-bold text-slate-900">
                    Register New Company
                  </h3>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                    <label className="text-sm font-medium text-slate-700">
                      Company Name
                      <input
                        required
                        value={companyName}
                        onChange={(event) => setCompanyName(event.target.value)}
                        placeholder="Enter company name"
                        className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2.5 font-normal outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                      />
                    </label>
                    <label className="text-sm font-medium text-slate-700">
                      Company Admin
                      <input
                        required
                        value={companyAdmin}
                        onChange={(event) => setCompanyAdmin(event.target.value)}
                        placeholder="Admin full name"
                        className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2.5 font-normal outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                      />
                    </label>
                    <label className="text-sm font-medium text-slate-700">
                      Admin Email
                      <input
                        required
                        type="email"
                        value={companyEmail}
                        onChange={(event) => setCompanyEmail(event.target.value)}
                        placeholder="admin@company.com"
                        className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2.5 font-normal outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                      />
                    </label>
                  </div>
                  <div className="mt-5 flex flex-wrap justify-end gap-3">
                    <button
                      type="button"
                      onClick={() => setShowCompanyForm(false)}
                      className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
                    >
                      Save Company
                    </button>
                  </div>
                </form>
              )}

              <CompanyTable
                companies={filteredCompanies}
                search={search}
                setSearch={setSearch}
                statusFilter={statusFilter}
                setStatusFilter={setStatusFilter}
                onToggleStatus={toggleCompanyStatus}
                onView={(company) =>
                  setNotice(
                    `${company.name}: ${company.employees} employees and ${company.leads} leads. Demo data only.`,
                  )
                }
                onAdd={() => setShowCompanyForm(true)}
              />
            </>
          )}

          {activeNav !== 'Overview' && activeNav !== 'Companies' && (
            <section className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm sm:p-12">
              <div className="mx-auto flex max-w-md flex-col items-center text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
                  {activeNav === 'Company Admins' ? (
                    <Users size={30} />
                  ) : activeNav === 'Users' ? (
                    <UserRound size={30} />
                  ) : activeNav === 'Reports' ? (
                    <ChartNoAxesCombined size={30} />
                  ) : (
                    <Settings size={30} />
                  )}
                </div>
                <h3 className="mt-5 text-xl font-bold text-slate-900">
                  {activeNav}
                </h3>
                <p className="mt-2 text-sm leading-6 text-slate-500">
                  This section is ready for the next development step. Its
                  real data and management actions need to be connected to
                  your backend.
                </p>
                {activeNav === 'Company Admins' && (
                  <button
                    type="button"
                    onClick={() => setActiveNav('Companies')}
                    className="mt-5 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
                  >
                    Manage Companies
                  </button>
                )}
              </div>
            </section>
          )}

          <footer className="mt-8 flex flex-col justify-between gap-2 border-t border-slate-200 py-5 text-xs text-slate-400 sm:flex-row">
            <p>© 2026 Yahoo CRM. All rights reserved.</p>
            <p>Super Admin Workspace · Demo Version</p>
          </footer>
        </main>
      </div>
    </div>
  )
}

function CompanyTable({
  companies,
  search,
  setSearch,
  statusFilter,
  setStatusFilter,
  onToggleStatus,
  onView,
  onAdd,
  compact = false,
}) {
  return (
    <section className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col justify-between gap-4 border-b border-slate-100 p-5 sm:flex-row sm:items-center sm:px-6">
        <div>
          <h3 className="font-bold text-slate-900">
            {compact ? 'Company Overview' : 'Company Management'}
          </h3>
          <p className="mt-1 text-xs text-slate-500">
            {companies.length} companies displayed
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="relative">
            <Search
              size={17}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search companies..."
              className="w-full rounded-xl border border-slate-200 py-2.5 pl-9 pr-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 sm:w-56"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            aria-label="Filter companies by status"
            className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-600 outline-none focus:border-blue-500"
          >
            <option value="All">All statuses</option>
            <option value="Active">Active</option>
            <option value="Inactive">Inactive</option>
          </select>

          {compact && (
            <button
              type="button"
              onClick={onAdd}
              className="rounded-xl border border-blue-200 px-3 py-2.5 text-sm font-semibold text-blue-700 hover:bg-blue-50"
            >
              View all
            </button>
          )}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-left">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/70">
              <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-500">
                Company
              </th>
              <th className="px-4 py-4 text-xs font-semibold uppercase tracking-wider text-slate-500">
                Company Admin
              </th>
              <th className="px-4 py-4 text-xs font-semibold uppercase tracking-wider text-slate-500">
                Employees
              </th>
              <th className="px-4 py-4 text-xs font-semibold uppercase tracking-wider text-slate-500">
                Leads
              </th>
              <th className="px-4 py-4 text-xs font-semibold uppercase tracking-wider text-slate-500">
                Status
              </th>
              <th className="px-4 py-4 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">
                Actions
              </th>
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-100">
            {companies.map((company) => (
              <tr
                key={company.id}
                className="transition hover:bg-blue-50/30"
              >
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${company.color}`}
                    >
                      <Building2 size={19} />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-800">
                        {company.name}
                      </p>
                      <p className="mt-1 text-xs text-slate-400">
                        {company.code}
                      </p>
                    </div>
                  </div>
                </td>

                <td className="px-4 py-4 text-sm text-slate-600">
                  {company.admin}
                </td>
                <td className="px-4 py-4 text-sm font-medium text-slate-700">
                  {company.employees.toLocaleString('en-IN')}
                </td>
                <td className="px-4 py-4 text-sm font-medium text-slate-700">
                  {company.leads.toLocaleString('en-IN')}
                </td>
                <td className="px-4 py-4">
                  <StatusBadge status={company.status} />
                </td>
                <td className="px-4 py-4">
                  <div className="flex items-center justify-end gap-1">
                    <button
                      type="button"
                      title="View company"
                      aria-label={`View ${company.name}`}
                      onClick={() => onView(company)}
                      className="rounded-lg p-2 text-slate-400 transition hover:bg-blue-50 hover:text-blue-600"
                    >
                      <Eye size={17} />
                    </button>
                    <button
                      type="button"
                      title={company.status === 'Active' ? 'Deactivate company' : 'Activate company'}
                      aria-label={`${company.status === 'Active' ? 'Deactivate' : 'Activate'} ${company.name}`}
                      onClick={() => onToggleStatus(company.id)}
                      className="rounded-lg p-2 text-slate-400 transition hover:bg-blue-50 hover:text-blue-600"
                    >
                      <Power size={17} />
                    </button>
                    <button
                      type="button"
                      title="More actions"
                      aria-label={`More actions for ${company.name}`}
                      onClick={() => onView(company)}
                      className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                    >
                      <MoreHorizontal size={18} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}

            {companies.length === 0 && (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center">
                  <Search className="mx-auto text-slate-300" size={28} />
                  <p className="mt-3 text-sm font-semibold text-slate-700">
                    No companies found
                  </p>
                  <p className="mt-1 text-xs text-slate-400">
                    Try changing your search or status filter.
                  </p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {!compact && (
        <div className="flex items-center justify-between border-t border-slate-100 px-6 py-4">
          <p className="text-xs text-slate-500">
            Showing {companies.length} companies
          </p>
          <span className="text-xs text-slate-400">
            Local demo data
          </span>
        </div>
      )}
    </section>
  )
}
