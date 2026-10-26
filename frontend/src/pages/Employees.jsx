
import { useEffect, useState } from 'react'
import {
  Users,
  Search,
  RefreshCw,
  Mail,
  Phone,
  UserRound,
  UserCheck,
  ShieldCheck,
  Building2,
  Sparkles,
  BriefcaseBusiness,
} from 'lucide-react'
import { api } from '../api/client'
import { LoadingBlock, ErrorBanner } from '../components/ui'

export default function Employees() {
  const [employees, setEmployees] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')

  async function loadEmployees() {
    setLoading(true)
    setError('')

    try {
      const response = await api('/api/users')
      const data = response?.data ?? response
      const list = Array.isArray(data)
        ? data
        : data?.users ?? data?.employees ?? []

      setEmployees(list)
    } catch (err) {
      setError(err?.message || 'Could not load employees.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadEmployees()
  }, [])

  const filteredEmployees = employees.filter((employee) => {
    const term = search.trim().toLowerCase()
    if (!term) return true

    return [
      employee.full_name,
      employee.employee_code,
      employee.email,
      employee.phone,
      employee.mobile,
      employee.role,
      employee.department,
      employee.team_name,
    ].some((value) => String(value || '').toLowerCase().includes(term))
  })

  const activeCount = employees.filter(
    (employee) => employee.is_active !== false,
  ).length

  const teamLeadCount = employees.filter(
    (employee) => ['hod', 'team_lead'].includes(employee.role),
  ).length

  const getInitials = (name = '') =>
    name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || 'U'

  const avatarColors = [
    'from-violet-500 to-indigo-600',
    'from-cyan-500 to-blue-600',
    'from-emerald-500 to-teal-600',
    'from-orange-400 to-pink-500',
    'from-fuchsia-500 to-purple-600',
  ]

  return (
    <div className="min-h-screen space-y-6 pb-8">
      {/* Colourful page header */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-blue-700 via-indigo-700 to-violet-800 p-6 text-white shadow-xl sm:p-8">
        <div className="absolute -right-12 -top-20 size-64 rounded-full bg-white/10 blur-2xl" />
        <div className="absolute -bottom-24 right-1/3 size-52 rounded-full bg-cyan-300/10 blur-2xl" />

        <div className="relative flex flex-col justify-between gap-5 sm:flex-row sm:items-center">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-semibold text-blue-50">
              <Sparkles size={14} />
              YAHOO CRM · PEOPLE MANAGEMENT
            </div>

            <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
              Employees
            </h1>

            <p className="mt-2 max-w-lg text-sm leading-6 text-blue-100 sm:text-base">
              Manage your workforce, explore employee profiles and keep your
              real-estate team organised in one place.
            </p>
          </div>

          <button
            onClick={loadEmployees}
            disabled={loading}
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/15 px-5 py-3 text-sm font-semibold text-white shadow-lg backdrop-blur transition hover:bg-white/25 disabled:opacity-60"
          >
            <RefreshCw size={17} className={loading ? 'animate-spin' : ''} />
            Refresh employees
          </button>
        </div>
      </section>

      {/* Statistics */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="group relative overflow-hidden rounded-2xl border border-blue-100 bg-gradient-to-br from-white to-blue-50 p-5 shadow-sm transition hover:-translate-y-1 hover:shadow-lg">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500">Total employees</p>
              <p className="mt-3 text-3xl font-extrabold text-slate-900">
                {employees.length}
              </p>
              <p className="mt-2 text-xs text-blue-700">Registered accounts</p>
            </div>
            <div className="rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 p-3 text-white shadow-lg shadow-blue-200">
              <Users size={23} />
            </div>
          </div>
          <div className="absolute -bottom-7 -right-5 size-24 rounded-full bg-blue-100/70 transition group-hover:scale-125" />
        </div>

        <div className="group relative overflow-hidden rounded-2xl border border-emerald-100 bg-gradient-to-br from-white to-emerald-50 p-5 shadow-sm transition hover:-translate-y-1 hover:shadow-lg">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500">Active accounts</p>
              <p className="mt-3 text-3xl font-extrabold text-slate-900">
                {activeCount}
              </p>
              <p className="mt-2 text-xs text-emerald-700">Available in the system</p>
            </div>
            <div className="rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 p-3 text-white shadow-lg shadow-emerald-200">
              <UserCheck size={23} />
            </div>
          </div>
          <div className="absolute -bottom-7 -right-5 size-24 rounded-full bg-emerald-100/70 transition group-hover:scale-125" />
        </div>

        <div className="group relative overflow-hidden rounded-2xl border border-violet-100 bg-gradient-to-br from-white to-violet-50 p-5 shadow-sm transition hover:-translate-y-1 hover:shadow-lg">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500">HOD / Team Leads</p>
              <p className="mt-3 text-3xl font-extrabold text-slate-900">
                {teamLeadCount}
              </p>
              <p className="mt-2 text-xs text-violet-700">Team leadership accounts</p>
            </div>
            <div className="rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 p-3 text-white shadow-lg shadow-violet-200">
              <ShieldCheck size={23} />
            </div>
          </div>
          <div className="absolute -bottom-7 -right-5 size-24 rounded-full bg-violet-100/70 transition group-hover:scale-125" />
        </div>
      </section>

      {/* Employee directory */}
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-4 border-b border-slate-100 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Employee directory</h2>
            <p className="mt-1 text-sm text-slate-500">
              Search and view your employee records.
            </p>
          </div>

          <div className="relative w-full sm:max-w-sm">
            <Search
              size={18}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search name, ID, email, role..."
              className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-4 text-sm outline-none transition placeholder:text-slate-400 focus:border-indigo-400 focus:bg-white focus:ring-4 focus:ring-indigo-50"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-50/80 px-5 py-3">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Employee records
          </span>
          <span className="rounded-full bg-indigo-100 px-3 py-1 text-xs font-bold text-indigo-700">
            {filteredEmployees.length} {filteredEmployees.length === 1 ? 'employee' : 'employees'}
          </span>
        </div>

        {loading ? (
          <div className="p-8">
            <LoadingBlock label="Loading employee accounts..." />
          </div>
        ) : error ? (
          <div className="space-y-3 p-6">
            <ErrorBanner message={error} />
            <button
              onClick={loadEmployees}
              className="rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700"
            >
              Try again
            </button>
          </div>
        ) : filteredEmployees.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <div className="mx-auto mb-4 grid size-16 place-items-center rounded-2xl bg-gradient-to-br from-blue-100 to-violet-100 text-indigo-600">
              <Users size={30} />
            </div>
            <h3 className="text-lg font-bold text-slate-800">
              {employees.length ? 'No matching employees' : 'No employee records found'}
            </h3>
            <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">
              {employees.length
                ? 'Try another search term to find an employee.'
                : 'No records were returned. Check that the employee-list API is connected to your database.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[850px] text-left text-sm">
              <thead>
                <tr className="bg-gradient-to-r from-slate-50 via-indigo-50/60 to-blue-50 text-xs uppercase tracking-wider text-slate-500">
                  <th className="px-5 py-4 font-bold">Employee</th>
                  <th className="px-5 py-4 font-bold">Employee ID</th>
                  <th className="px-5 py-4 font-bold">Contact details</th>
                  <th className="px-5 py-4 font-bold">Role</th>
                  <th className="px-5 py-4 font-bold">Team / Department</th>
                  <th className="px-5 py-4 font-bold">Status</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {filteredEmployees.map((employee, index) => {
                  const inactive = employee.is_active === false
                  const role = (employee.role || 'employee').replace('_', ' ')

                  return (
                    <tr
                      key={employee._id || employee.id || employee.employee_code || index}
                      className="group transition hover:bg-indigo-50/50"
                    >
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className={`grid size-11 shrink-0 place-items-center rounded-xl bg-gradient-to-br ${avatarColors[index % avatarColors.length]} text-sm font-extrabold text-white shadow-md`}>
                            {getInitials(employee.full_name)}
                          </div>
                          <div className="min-w-0">
                            <p className="font-bold text-slate-800 transition group-hover:text-indigo-700">
                              {employee.full_name || 'Unnamed employee'}
                            </p>
                            <p className="mt-0.5 text-xs text-slate-400">
                              Employee profile
                            </p>
                          </div>
                        </div>
                      </td>

                      <td className="px-5 py-4">
                        <span className="rounded-lg border border-blue-100 bg-blue-50 px-2.5 py-1.5 font-mono text-xs font-semibold text-blue-700">
                          {employee.employee_code || '—'}
                        </span>
                      </td>

                      <td className="px-5 py-4">
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 text-slate-600">
                            <span className="grid size-7 place-items-center rounded-lg bg-emerald-50 text-emerald-600">
                              <Phone size={13} />
                            </span>
                            <span>{employee.phone || employee.mobile || '—'}</span>
                          </div>
                          <div className="flex items-center gap-2 text-xs text-slate-500">
                            <Mail size={14} className="shrink-0 text-violet-500" />
                            <span>{employee.email || 'No email registered'}</span>
                          </div>
                        </div>
                      </td>

                      <td className="px-5 py-4">
                        <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold capitalize ${
                          ['admin'].includes(employee.role)
                            ? 'bg-rose-50 text-rose-700 ring-1 ring-rose-100'
                            : ['hod', 'team_lead'].includes(employee.role)
                              ? 'bg-violet-50 text-violet-700 ring-1 ring-violet-100'
                              : 'bg-sky-50 text-sky-700 ring-1 ring-sky-100'
                        }`}>
                          <BriefcaseBusiness size={13} />
                          {role}
                        </span>
                      </td>

                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2 text-slate-600">
                          <Building2 size={15} className="shrink-0 text-amber-500" />
                          {employee.team_name || employee.department || employee.team_id || '—'}
                        </div>
                      </td>

                      <td className="px-5 py-4">
                        <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold ${
                          inactive
                            ? 'bg-rose-50 text-rose-700 ring-1 ring-rose-100'
                            : 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100'
                        }`}>
                          <span className={`size-1.5 rounded-full ${inactive ? 'bg-rose-500' : 'bg-emerald-500'}`} />
                          {inactive ? 'Inactive' : 'Active'}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex items-center gap-2 border-t border-slate-100 bg-slate-50/70 px-5 py-3 text-xs text-slate-400">
          <UserRound size={14} />
          Employee details are loaded from the connected API.
        </div>
      </section>
    </div>
  )
}
