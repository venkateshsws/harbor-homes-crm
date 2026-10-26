
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  LayoutDashboard,
  Building2,
  Users,
  UserRound,
  ChartNoAxesCombined,
  Settings,
  Search,
  Bell,
  Menu,
  X,
  Plus,
  ArrowUpRight,
  ArrowDownRight,
  Eye,
  Power,
  Activity,
  ShieldCheck,
  TrendingUp,
  CalendarDays,
  LogOut,
  LoaderCircle,
  UserPlus,
  ArrowLeft,
  RefreshCw,
} from 'lucide-react'

import { useAuth } from '../auth/AuthContext'
import { api } from '../api/client'

const navigation = [
  { label: 'Overview', icon: LayoutDashboard },
  { label: 'Companies', icon: Building2 },
  { label: 'Company Admins', icon: Users },
  { label: 'Users', icon: UserRound },
  { label: 'Reports', icon: ChartNoAxesCombined },
  { label: 'Settings', icon: Settings },
]

const companyColors = [
  'bg-blue-100 text-blue-700',
  'bg-violet-100 text-violet-700',
  'bg-emerald-100 text-emerald-700',
  'bg-orange-100 text-orange-700',
]

function getErrorMessage(error) {
  return error?.message || 'Something went wrong. Please try again.'
}

function formatDate(value) {
  if (!value) return '—'

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) return String(value)

  return date.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

function normalizeCompany(company, index = 0) {
  return {
    id: String(company.id || company._id || ''),
    name: company.name || company.company_name || 'Unnamed company',
    code: company.code || company.company_code || '—',
    admin:
      company.admin_name ||
      company.admin ||
      company.company_admin ||
      'Not assigned',
    adminEmail: company.admin_email || company.email || '',
    employees: Number(company.employees ?? company.employee_count ?? 0),
    leads: Number(company.leads ?? company.lead_count ?? 0),
    status:
      company.status ||
      (company.is_active === false ? 'Inactive' : 'Active'),
    joined: formatDate(company.created_at || company.joined),
    color: companyColors[index % companyColors.length],
  }
}

function normalizeEmployee(employee) {
  return {
    id: String(employee.id || employee._id || ''),
    code: employee.employee_code || '—',
    name: employee.full_name || employee.name || 'Unnamed employee',
    email: employee.email || '—',
    phone: employee.phone || '—',
    role: employee.role_name || employee.role || 'employee',
    active: employee.is_active !== false,
  }
}

function StatCard({ title, value, change, icon: Icon, color, down }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-slate-500">{title}</p>
          <h3 className="mt-3 text-2xl font-bold tracking-tight text-slate-900">
            {Number(value || 0).toLocaleString('en-IN')}
          </h3>
        </div>

        <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${color}`}>
          <Icon size={21} />
        </div>
      </div>

      {change && (
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
      )}
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

function FormField({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
  required = true,
  autoComplete,
}) {
  return (
    <label className="block text-sm font-medium text-slate-700">
      {label}
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        required={required}
        autoComplete={autoComplete}
        className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2.5 font-normal outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
      />
    </label>
  )
}

export default function SuperAdminDashboard() {
  const navigate = useNavigate()
  const { logout } = useAuth()

  const [activeNav, setActiveNav] = useState('Overview')
  const [companies, setCompanies] = useState([])
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('All')
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const [showCompanyForm, setShowCompanyForm] = useState(false)
  const [companyName, setCompanyName] = useState('')
  const [companyAdmin, setCompanyAdmin] = useState('')
  const [companyEmail, setCompanyEmail] = useState('')

  const [selectedCompany, setSelectedCompany] = useState(null)
  const [employees, setEmployees] = useState([])
  const [employeesLoading, setEmployeesLoading] = useState(false)
  const [showEmployeeForm, setShowEmployeeForm] = useState(false)

  const [employeeCode, setEmployeeCode] = useState('')
  const [employeeName, setEmployeeName] = useState('')
  const [employeeEmail, setEmployeeEmail] = useState('')
  const [employeePhone, setEmployeePhone] = useState('')
  const [employeePassword, setEmployeePassword] = useState('')

  const handleLogout = async () => {
    try {
      await logout()
    } finally {
      navigate('/login', { replace: true })
    }
  }

  const loadCompanies = useCallback(async () => {
    setLoading(true)
    setError('')

    try {
      const response = await api('/api/companies')
      const records =
        response?.data?.companies ??
        response?.companies ??
        response?.data ??
        []

      if (!Array.isArray(records)) {
        throw new Error('The companies API returned an unexpected response.')
      }

      setCompanies(records.map(normalizeCompany))
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadCompanies()
  }, [loadCompanies])

  const loadEmployees = async (company) => {
    setSelectedCompany(company)
    setEmployees([])
    setEmployeesLoading(true)
    setShowEmployeeForm(false)
    setError('')
    setNotice('')

    try {
      const response = await api(
        `/api/users?company_id=${encodeURIComponent(company.id)}`,
      )

      const records =
        response?.data?.users ??
        response?.users ??
        response?.data ??
        []

      if (!Array.isArray(records)) {
        throw new Error('The employees API returned an unexpected response.')
      }

      setEmployees(records.map(normalizeEmployee))
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setEmployeesLoading(false)
    }
  }

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
    const query = search.trim().toLowerCase()

    return companies.filter((company) => {
      const matchesSearch =
        company.name.toLowerCase().includes(query) ||
        company.code.toLowerCase().includes(query) ||
        company.admin.toLowerCase().includes(query) ||
        company.adminEmail.toLowerCase().includes(query)

      const matchesStatus =
        statusFilter === 'All' || company.status === statusFilter

      return matchesSearch && matchesStatus
    })
  }, [companies, search, statusFilter])

  const addCompany = async (event) => {
    event.preventDefault()
    setSaving(true)
    setError('')
    setNotice('')

    try {
      await api('/api/companies', {
        method: 'POST',
        body: {
          name: companyName.trim(),
          admin_name: companyAdmin.trim(),
          admin_email: companyEmail.trim().toLowerCase(),
        },
      })

      setCompanyName('')
      setCompanyAdmin('')
      setCompanyEmail('')
      setShowCompanyForm(false)
      setActiveNav('Companies')
      setNotice('Company created successfully.')

      await loadCompanies()
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  const toggleCompanyStatus = async (company) => {
    const nextActive = company.status !== 'Active'
    const confirmed = window.confirm(
      `${nextActive ? 'Activate' : 'Deactivate'} ${company.name}?`,
    )

    if (!confirmed) return

    setError('')
    setNotice('')

    try {
      await api(`/api/companies/${company.id}/status`, {
        method: 'PATCH',
        body: { is_active: nextActive },
      })

      setNotice(
        `${company.name} ${nextActive ? 'activated' : 'deactivated'} successfully.`,
      )

      await loadCompanies()
    } catch (err) {
      setError(getErrorMessage(err))
    }
  }

  const addEmployee = async (event) => {
    event.preventDefault()

    if (!selectedCompany?.id) {
      setError('Select a company before creating an employee.')
      return
    }

    setSaving(true)
    setError('')
    setNotice('')

    try {
      await api('/api/users', {
        method: 'POST',
        body: {
          company_id: selectedCompany.id,
          employee_code: employeeCode.trim().toUpperCase(),
          full_name: employeeName.trim(),
          email: employeeEmail.trim().toLowerCase(),
          phone: employeePhone.trim(),
          password: employeePassword,
          role: 'employee',
        },
      })

      setEmployeeCode('')
      setEmployeeName('')
      setEmployeeEmail('')
      setEmployeePhone('')
      setEmployeePassword('')
      setShowEmployeeForm(false)
      setNotice(`Employee added to ${selectedCompany.name}.`)

      await loadEmployees(selectedCompany)
      await loadCompanies()
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  const selectNavigation = (label) => {
    setActiveNav(label)
    setSidebarOpen(false)
    setSelectedCompany(null)
    setShowEmployeeForm(false)
    setNotice('')
    setError('')
  }

  const pageTitle =
    selectedCompany && activeNav === 'Companies'
      ? selectedCompany.name
      : activeNav === 'Overview'
        ? 'Dashboard Overview'
        : activeNav

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

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex h-screen w-64 flex-col overflow-y-auto border-r border-slate-200 bg-white transition-transform duration-300 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } lg:translate-x-0`}
      >
        <div className="flex h-[84px] items-center justify-between border-b border-slate-100 px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm">
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
                    <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] text-slate-600">
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
              Manage companies and employees across your CRM platform.
            </p>
            <div className="mt-3 flex items-center gap-2 text-xs font-medium text-emerald-700">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              Backend connected
            </div>
          </div>

          <div className="mt-4 border-t border-slate-100 pt-4">
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

            <button
              type="button"
              onClick={handleLogout}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-600 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600"
            >
              <LogOut size={17} />
              Log out
            </button>
          </div>
        </div>
      </aside>

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
              {formatDate(new Date())}
            </div>

            <button
              type="button"
              aria-label="Refresh companies"
              onClick={loadCompanies}
              className="rounded-xl border border-slate-200 p-2.5 text-slate-500 transition hover:bg-slate-50 hover:text-blue-600"
            >
              <RefreshCw size={18} />
            </button>
          </div>
        </header>

        <main className="mx-auto max-w-[1600px] p-4 sm:p-6 lg:p-8">
          {error && (
            <div
              role="alert"
              className="mb-5 flex items-start justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
            >
              <span>{error}</span>
              <button
                type="button"
                onClick={() => setError('')}
                aria-label="Dismiss error"
              >
                <X size={16} />
              </button>
            </div>
          )}

          {notice && (
            <div
              role="status"
              className="mb-5 flex items-start justify-between gap-3 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-800"
            >
              <span>{notice}</span>
              <button
                type="button"
                onClick={() => setNotice('')}
                aria-label="Dismiss message"
              >
                <X size={16} />
              </button>
            </div>
          )}

          {loading && (
            <div className="mb-5 flex items-center gap-2 text-sm text-slate-500">
              <LoaderCircle className="animate-spin" size={18} />
              Loading company data...
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
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
                >
                  <Plus size={18} />
                  Add Company
                </button>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <StatCard
                  title="Total Companies"
                  value={companies.length}
                  icon={Building2}
                  color="bg-blue-50 text-blue-600"
                />
                <StatCard
                  title="Active Companies"
                  value={activeCompanies}
                  icon={Activity}
                  color="bg-emerald-50 text-emerald-600"
                />
                <StatCard
                  title="Total Employees"
                  value={totalEmployees}
                  icon={Users}
                  color="bg-violet-50 text-violet-600"
                />
                <StatCard
                  title="Total Leads"
                  value={totalLeads}
                  icon={TrendingUp}
                  color="bg-orange-50 text-orange-600"
                />
              </div>

              <CompanyTable
                companies={companies.slice(0, 5)}
                onView={loadEmployeesAndNavigate}
                onToggleStatus={toggleCompanyStatus}
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
              {selectedCompany ? (
                <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedCompany(null)
                      setEmployees([])
                      setShowEmployeeForm(false)
                      setError('')
                    }}
                    className="mb-5 inline-flex items-center gap-2 text-sm font-semibold text-blue-700 hover:text-blue-900"
                  >
                    <ArrowLeft size={17} />
                    Back to companies
                  </button>

                  <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                    <div>
                      <h3 className="text-xl font-bold text-slate-900">
                        {selectedCompany.name}
                      </h3>
                      <p className="mt-1 text-sm text-slate-500">
                        Company code: {selectedCompany.code}
                      </p>
                      <div className="mt-3">
                        <StatusBadge status={selectedCompany.status} />
                      </div>
                    </div>

                    <button
                      type="button"
                      disabled={selectedCompany.status !== 'Active'}
                      onClick={() => setShowEmployeeForm((open) => !open)}
                      className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <UserPlus size={18} />
                      Add Employee
                    </button>
                  </div>

                  {selectedCompany.status !== 'Active' && (
                    <p className="mt-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-800">
                      This company is inactive. Activate it before adding employees.
                    </p>
                  )}

                  {showEmployeeForm && (
                    <form
                      onSubmit={addEmployee}
                      className="mt-6 rounded-2xl border border-blue-100 bg-blue-50/40 p-5"
                    >
                      <h4 className="mb-4 font-bold text-slate-900">
                        Add employee to {selectedCompany.name}
                      </h4>

                      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                        <FormField
                          label="Employee Code"
                          value={employeeCode}
                          onChange={setEmployeeCode}
                          placeholder="EMP-001"
                        />
                        <FormField
                          label="Full Name"
                          value={employeeName}
                          onChange={setEmployeeName}
                          placeholder="Employee full name"
                          autoComplete="name"
                        />
                        <FormField
                          label="Email Address"
                          type="email"
                          value={employeeEmail}
                          onChange={setEmployeeEmail}
                          placeholder="employee@company.com"
                          autoComplete="email"
                        />
                        <FormField
                          label="Phone Number"
                          value={employeePhone}
                          onChange={setEmployeePhone}
                          placeholder="Phone number"
                          required={false}
                          autoComplete="tel"
                        />
                        <FormField
                          label="Temporary Password"
                          type="password"
                          value={employeePassword}
                          onChange={setEmployeePassword}
                          placeholder="Create a secure password"
                          autoComplete="new-password"
                        />
                      </div>

                      <p className="mt-3 text-xs text-slate-500">
                        The employee will be created with the Employee role and linked to this company.
                      </p>

                      <div className="mt-5 flex flex-wrap justify-end gap-3">
                        <button
                          type="button"
                          onClick={() => setShowEmployeeForm(false)}
                          className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={saving}
                          className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
                        >
                          {saving && <LoaderCircle className="animate-spin" size={16} />}
                          Save Employee
                        </button>
                      </div>
                    </form>
                  )}

                  <div className="mt-8">
                    <div className="mb-4 flex items-center justify-between gap-3">
                      <div>
                        <h4 className="font-bold text-slate-900">Company Employees</h4>
                        <p className="mt-1 text-xs text-slate-500">
                          {employees.length} employee records loaded
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => loadEmployees(selectedCompany)}
                        className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50"
                        aria-label="Refresh employees"
                      >
                        <RefreshCw size={16} />
                      </button>
                    </div>

                    {employeesLoading ? (
                      <div className="flex items-center gap-2 py-8 text-sm text-slate-500">
                        <LoaderCircle className="animate-spin" size={18} />
                        Loading employees...
                      </div>
                    ) : (
                      <EmployeeTable employees={employees} />
                    )}
                  </div>
                </section>
              ) : (
                <>
                  <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                    <p className="text-sm text-slate-500">
                      Register companies and manage their employees.
                    </p>

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
                        <FormField
                          label="Company Name"
                          value={companyName}
                          onChange={setCompanyName}
                          placeholder="Enter company name"
                        />
                        <FormField
                          label="Company Admin Name"
                          value={companyAdmin}
                          onChange={setCompanyAdmin}
                          placeholder="Admin full name"
                        />
                        <FormField
                          label="Company Admin Email"
                          type="email"
                          value={companyEmail}
                          onChange={setCompanyEmail}
                          placeholder="admin@company.com"
                        />
                      </div>

                      <p className="mt-3 text-xs text-slate-500">
                        This form stores company contact details. It does not create a login account for the company admin unless your backend implements that separately.
                      </p>

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
                          disabled={saving}
                          className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
                        >
                          {saving && <LoaderCircle className="animate-spin" size={16} />}
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
                    onView={loadEmployeesAndNavigate}
                    onToggleStatus={toggleCompanyStatus}
                    onAdd={() => setShowCompanyForm(true)}
                  />
                </>
              )}
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
                  This section has not been connected to its management API yet.
                  Company and employee management are available under Companies.
                </p>

                {activeNav === 'Users' && (
                  <button
                    type="button"
                    onClick={() => setActiveNav('Companies')}
                    className="mt-5 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
                  >
                    Manage Company Employees
                  </button>
                )}
              </div>
            </section>
          )}

          <footer className="mt-8 flex flex-col justify-between gap-2 border-t border-slate-200 py-5 text-xs text-slate-400 sm:flex-row">
            <p>© 2026 Yahoo CRM. All rights reserved.</p>
            <p>Super Admin Workspace</p>
          </footer>
        </main>
      </div>
    </div>
  )

  async function loadEmployeesAndNavigate(company) {
    setActiveNav('Companies')
    setSidebarOpen(false)
    await loadEmployees(company)
  }
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
          {!compact && (
            <>
              <div className="relative">
                <Search
                  size={17}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search companies..."
                  className="w-full rounded-xl border border-slate-200 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 sm:w-56"
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
            </>
          )}

          {compact && (
            <button
              type="button"
              onClick={onAdd}
              className="rounded-xl border border-blue-200 px-3 py-2.5 text-sm font-semibold text-blue-700 hover:bg-blue-50"
            >
              View all companies
            </button>
          )}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[800px] text-left">
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
              <tr key={company.id} className="transition hover:bg-blue-50/30">
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

                <td className="px-4 py-4">
                  <p className="text-sm text-slate-600">{company.admin}</p>
                  {company.adminEmail && (
                    <p className="mt-1 text-xs text-slate-400">
                      {company.adminEmail}
                    </p>
                  )}
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
                      title="View employees"
                      aria-label={`View employees for ${company.name}`}
                      onClick={() => onView(company)}
                      className="rounded-lg p-2 text-slate-400 transition hover:bg-blue-50 hover:text-blue-600"
                    >
                      <Eye size={17} />
                    </button>

                    <button
                      type="button"
                      title={company.status === 'Active' ? 'Deactivate company' : 'Activate company'}
                      aria-label={`${company.status === 'Active' ? 'Deactivate' : 'Activate'} ${company.name}`}
                      onClick={() => onToggleStatus(company)}
                      className="rounded-lg p-2 text-slate-400 transition hover:bg-blue-50 hover:text-blue-600"
                    >
                      <Power size={17} />
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
                    Add a company or change your search filters.
                  </p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between border-t border-slate-100 px-6 py-4">
        <p className="text-xs text-slate-500">
          Showing {companies.length} companies
        </p>
        <span className="text-xs text-slate-400">Yahoo CRM</span>
      </div>
    </section>
  )
}

function EmployeeTable({ employees }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200">
      <table className="w-full min-w-[700px] text-left">
        <thead className="bg-slate-50">
          <tr>
            <th className="px-4 py-3 text-xs font-semibold uppercase text-slate-500">
              Employee
            </th>
            <th className="px-4 py-3 text-xs font-semibold uppercase text-slate-500">
              Code
            </th>
            <th className="px-4 py-3 text-xs font-semibold uppercase text-slate-500">
              Phone
            </th>
            <th className="px-4 py-3 text-xs font-semibold uppercase text-slate-500">
              Role
            </th>
            <th className="px-4 py-3 text-xs font-semibold uppercase text-slate-500">
              Status
            </th>
          </tr>
        </thead>

        <tbody className="divide-y divide-slate-100 bg-white">
          {employees.map((employee) => (
            <tr key={employee.id} className="hover:bg-slate-50">
              <td className="px-4 py-4">
                <p className="text-sm font-semibold text-slate-800">
                  {employee.name}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {employee.email}
                </p>
              </td>
              <td className="px-4 py-4 text-sm text-slate-600">
                {employee.code}
              </td>
              <td className="px-4 py-4 text-sm text-slate-600">
                {employee.phone}
              </td>
              <td className="px-4 py-4 text-sm capitalize text-slate-600">
                {employee.role.replaceAll('_', ' ')}
              </td>
              <td className="px-4 py-4">
                <StatusBadge status={employee.active ? 'Active' : 'Inactive'} />
              </td>
            </tr>
          ))}

          {employees.length === 0 && (
            <tr>
              <td colSpan={5} className="px-4 py-10 text-center">
                <Users className="mx-auto text-slate-300" size={28} />
                <p className="mt-3 text-sm font-semibold text-slate-700">
                  No employees found
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Use Add Employee to create the first employee for this company.
                </p>
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
