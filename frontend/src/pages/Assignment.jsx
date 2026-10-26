
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Users, Search, RefreshCw, UserRound, MapPin,
  ArrowRight, CheckCircle2, Clock3, AlertTriangle,
  Shuffle, Scale, Zap, UserCheck, X, Filter
} from 'lucide-react'
import { api } from '../api/client'
import {
  EmptyState, ErrorBanner, LoadingBlock, PageHeader, PriorityBadge
} from '../components/ui'

const unwrap = (res) => res?.data?.data ?? res?.data ?? res

const getList = (res, keys = []) => {
  const data = unwrap(res)
  if (Array.isArray(data)) return data
  for (const key of keys) {
    if (Array.isArray(data?.[key])) return data[key]
  }
  return []
}

const getId = (item) => item?.id ?? item?._id ?? ''
const getName = (item) =>
  item?.full_name || item?.name || item?.username || item?.email || 'Unknown'

const methods = [
  {
    id: 'round_robin',
    title: 'Round Robin',
    description: 'Distribute leads in rotation',
    icon: Shuffle,
    color: 'bg-violet-100 text-violet-700',
  },
  {
    id: 'workload',
    title: 'Workload Balance',
    description: 'Prefer employees with fewer leads',
    icon: Scale,
    color: 'bg-blue-100 text-blue-700',
  },
  {
    id: 'priority',
    title: 'Priority Based',
    description: 'Use your configured priority rules',
    icon: Zap,
    color: 'bg-amber-100 text-amber-700',
  },
]

export default function Assignment() {
  const [unassigned, setUnassigned] = useState([])
  const [rules, setRules] = useState([])
  const [employees, setEmployees] = useState([])
  const [search, setSearch] = useState('')
  const [priorityFilter, setPriorityFilter] = useState('all')
  const [selected, setSelected] = useState([])
  const [employeeId, setEmployeeId] = useState('')
  const [method, setMethod] = useState('round_robin')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')

    try {
      const results = await Promise.allSettled([
        api('/api/leads?unassigned=1'),
        api('/api/settings/assignment-rules'),
        api('/api/users'),
      ])

      if (results[0].status === 'rejected') {
        throw results[0].reason
      }

      setUnassigned(
        getList(results[0].value, ['leads', 'items'])
      )

      setRules(
        results[1].status === 'fulfilled'
          ? getList(results[1].value, ['rules', 'items'])
          : []
      )

      setEmployees(
        results[2].status === 'fulfilled'
          ? getList(results[2].value, ['users', 'employees', 'items'])
              .filter((user) =>
                user.is_active !== false &&
                user.active !== false &&
                ['employee', 'team_lead', 'hod'].includes(
                  String(user.role || '').toLowerCase()
                )
              )
          : []
      )
    } catch (e) {
      setError(e?.message || 'Unable to load assignment data.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const filteredLeads = useMemo(() => {
    const term = search.trim().toLowerCase()

    return unassigned.filter((lead) => {
      const matchesSearch = !term || [
        lead.full_name,
        lead.email,
        lead.phone,
        lead.city,
        lead.source,
      ].some((value) => String(value || '').toLowerCase().includes(term))

      const priority = String(lead.priority || 'normal').toLowerCase()
      const matchesPriority =
        priorityFilter === 'all' || priority === priorityFilter

      return matchesSearch && matchesPriority
    })
  }, [unassigned, search, priorityFilter])

  const highPriorityCount = unassigned.filter((lead) =>
    ['high', 'urgent', 'critical'].includes(
      String(lead.priority || '').toLowerCase()
    )
  ).length

  const selectedVisible = filteredLeads.length > 0 &&
    filteredLeads.every((lead) => selected.includes(String(getId(lead))))

  const toggleLead = (id) => {
    const key = String(id)
    setSelected((current) =>
      current.includes(key)
        ? current.filter((item) => item !== key)
        : [...current, key]
    )
  }

  const toggleVisible = () => {
    const visibleIds = filteredLeads.map((lead) => String(getId(lead)))
    setSelected((current) =>
      selectedVisible
        ? current.filter((id) => !visibleIds.includes(id))
        : [...new Set([...current, ...visibleIds])]
    )
  }

  const assignOne = async (id, assignmentMethod = method, targetEmployee = '') => {
    setBusy(true)
    setError('')
    setNotice('')

    try {
      const body = { method: assignmentMethod }

      if (targetEmployee) {
        body.employee_id = targetEmployee
      }

      await api(`/api/leads/${id}/assign`, {
        method: 'POST',
        body,
      })

      setSelected((current) => current.filter((item) => item !== String(id)))
      setNotice('Lead assigned successfully.')
      await load()
    } catch (e) {
      setError(e?.message || 'Assignment failed. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  const assignSelected = async () => {
    if (!selected.length) {
      setError('Select at least one lead first.')
      return
    }

    if (method === 'manual' && !employeeId) {
      setError('Choose an employee for manual assignment.')
      return
    }

    setBusy(true)
    setError('')
    setNotice('')
    let succeeded = 0
    const failed = []

    try {
      for (const id of selected) {
        try {
          const body = { method }
          if (method === 'manual') body.employee_id = employeeId

          await api(`/api/leads/${id}/assign`, {
            method: 'POST',
            body,
          })
          succeeded++
        } catch {
          failed.push(id)
        }
      }

      setSelected(failed)
      setNotice(`${succeeded} lead(s) assigned successfully.`)
      if (failed.length) {
        setError(`${failed.length} lead(s) could not be assigned. Check backend permissions and assignment rules.`)
      }

      await load()
    } catch (e) {
      setError(e?.message || 'Unable to complete assignment.')
    } finally {
      setBusy(false)
    }
  }

  const stats = [
    {
      label: 'Unassigned Leads',
      value: unassigned.length,
      icon: Clock3,
      color: 'bg-blue-50 text-blue-700',
    },
    {
      label: 'High Priority',
      value: highPriorityCount,
      icon: AlertTriangle,
      color: 'bg-rose-50 text-rose-700',
    },
    {
      label: 'Active Employees',
      value: employees.length,
      icon: Users,
      color: 'bg-emerald-50 text-emerald-700',
    },
    {
      label: 'Active Rules',
      value: rules.filter((rule) => rule.is_active).length,
      icon: CheckCircle2,
      color: 'bg-violet-50 text-violet-700',
    },
  ]

  return (
    <div className="space-y-6 pb-8">
      <div className="overflow-hidden rounded-2xl bg-gradient-to-r from-slate-950 via-indigo-950 to-violet-900 p-6 text-white shadow-lg sm:p-8">
        <div className="flex flex-col justify-between gap-5 md:flex-row md:items-center">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-medium">
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
              LEAD DISTRIBUTION CENTER
            </div>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
              Lead Assignment
            </h1>
            <p className="mt-2 max-w-xl text-sm text-indigo-100 sm:text-base">
              Assign leads to the right employees, balance workloads, and manage your queue.
            </p>
          </div>

          <button
            onClick={load}
            disabled={loading || busy}
            className="inline-flex items-center justify-center gap-2 self-start rounded-xl border border-white/20 bg-white/10 px-4 py-2.5 text-sm font-semibold transition hover:bg-white/20 disabled:opacity-50 md:self-center"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            Refresh data
          </button>
        </div>

        <div className="mt-6 flex flex-wrap gap-3 text-sm text-indigo-100">
          <span className="inline-flex items-center gap-2 rounded-lg bg-white/10 px-3 py-2">
            <Users size={16} /> {employees.length} eligible employees
          </span>
          <span className="inline-flex items-center gap-2 rounded-lg bg-white/10 px-3 py-2">
            <Clock3 size={16} /> {unassigned.length} awaiting assignment
          </span>
        </div>
      </div>

      <ErrorBanner message={error} />

      {notice && (
        <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
          <CheckCircle2 size={19} />
          <span className="flex-1">{notice}</span>
          <button onClick={() => setNotice('')} aria-label="Dismiss">
            <X size={17} />
          </button>
        </div>
      )}

      {loading ? <LoadingBlock /> : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {stats.map((stat) => {
              const Icon = stat.icon
              return (
                <div key={stat.label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
                  <div className="flex items-center justify-between">
                    <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${stat.color}`}>
                      <Icon size={21} />
                    </div>
                    <ArrowRight size={17} className="text-slate-300" />
                  </div>
                  <p className="mt-4 text-sm font-medium text-slate-500">{stat.label}</p>
                  <p className="mt-1 text-3xl font-bold tracking-tight text-slate-900">{stat.value}</p>
                </div>
              )
            })}
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm xl:col-span-2">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-100 text-indigo-700">
                  <UserCheck size={21} />
                </div>
                <div>
                  <h2 className="font-bold text-slate-900">Quick assignment</h2>
                  <p className="text-sm text-slate-500">Choose a method and apply it to selected leads.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                {methods.map((item) => {
                  const Icon = item.icon
                  const active = method === item.id
                  return (
                    <button
                      key={item.id}
                      onClick={() => setMethod(item.id)}
                      className={`rounded-xl border p-4 text-left transition ${
                        active
                          ? 'border-indigo-500 bg-indigo-50 ring-2 ring-indigo-100'
                          : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      <div className={`mb-3 flex h-9 w-9 items-center justify-center rounded-lg ${item.color}`}>
                        <Icon size={19} />
                      </div>
                      <p className="font-semibold text-slate-900">{item.title}</p>
                      <p className="mt-1 text-xs leading-5 text-slate-500">{item.description}</p>
                    </button>
                  )
                })}
              </div>

              <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                <select
                  value={method === 'manual' ? employeeId : method}
                  onChange={(e) => {
                    const value = e.target.value
                    if (value === 'manual') setMethod('manual')
                    else if (['round_robin', 'workload', 'priority'].includes(value)) setMethod(value)
                    else {
                      setMethod('manual')
                      setEmployeeId(value)
                    }
                  }}
                  className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                >
                  <option value="round_robin">Method: Round Robin</option>
                  <option value="workload">Method: Workload Balance</option>
                  <option value="priority">Method: Priority Based</option>
                  <option value="manual">Manual assignment</option>
                  {employees.map((employee) => (
                    <option key={getId(employee)} value={getId(employee)}>
                      Employee: {getName(employee)}
                    </option>
                  ))}
                </select>

                <button
                  onClick={assignSelected}
                  disabled={busy || selected.length === 0}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {busy ? <RefreshCw size={17} className="animate-spin" /> : <Zap size={17} />}
                  Assign {selected.length || ''} selected
                </button>
              </div>

              {method === 'manual' && (
                <div className="mt-3">
                  <label className="mb-1 block text-sm font-medium text-slate-700">Select employee</label>
                  <select
                    value={employeeId}
                    onChange={(e) => setEmployeeId(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm focus:border-indigo-500 focus:outline-none"
                  >
                    <option value="">Choose an employee...</option>
                    {employees.map((employee) => (
                      <option key={getId(employee)} value={getId(employee)}>
                        {getName(employee)} {employee.employee_code ? `(${employee.employee_code})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <p className="mt-3 text-xs text-slate-500">
                Automatic methods are processed by your backend. Manual assignment requires backend support for the selected employee ID.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-100 text-violet-700">
                  <Zap size={21} />
                </div>
                <div>
                  <h2 className="font-bold text-slate-900">Assignment rules</h2>
                  <p className="text-sm text-slate-500">Configured in your CRM</p>
                </div>
              </div>

              {rules.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-300 p-5 text-center">
                  <Filter size={25} className="mx-auto text-slate-400" />
                  <p className="mt-2 text-sm font-semibold text-slate-700">No rules found</p>
                  <p className="mt-1 text-xs text-slate-500">Check your assignment rules API.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {rules.map((rule) => (
                    <div key={getId(rule) || rule.name} className="flex items-start gap-3 rounded-xl bg-slate-50 p-3">
                      <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${rule.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-500'}`}>
                        <CheckCircle2 size={17} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-slate-800">{rule.name || rule.method}</p>
                        <p className="mt-1 text-xs text-slate-500">
                          {rule.method} · Order {rule.sort_order ?? '—'}
                        </p>
                      </div>
                      <span className={`rounded-full px-2 py-1 text-xs font-medium ${rule.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'}`}>
                        {rule.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-col justify-between gap-4 border-b border-slate-100 p-5 lg:flex-row lg:items-center">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Unassigned lead queue</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Select one or more leads to assign them together.
                </p>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row">
                <div className="relative">
                  <Search size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search name, phone, city..."
                    className="w-full rounded-xl border border-slate-200 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-indigo-500 sm:w-64"
                  />
                </div>
                <select
                  value={priorityFilter}
                  onChange={(e) => setPriorityFilter(e.target.value)}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-indigo-500"
                >
                  <option value="all">All priorities</option>
                  <option value="urgent">Urgent</option>
                  <option value="critical">Critical</option>
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="normal">Normal</option>
                  <option value="low">Low</option>
                </select>
              </div>
            </div>

            {selected.length > 0 && (
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-indigo-100 bg-indigo-50 px-5 py-3">
                <span className="text-sm font-semibold text-indigo-800">
                  {selected.length} lead(s) selected
                </span>
                <button onClick={() => setSelected([])} className="text-sm font-medium text-indigo-700 hover:underline">
                  Clear selection
                </button>
              </div>
            )}

            {filteredLeads.length === 0 ? (
              <div className="p-10 text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
                  <CheckCircle2 size={28} />
                </div>
                <div className="mt-3">
                  <EmptyState title={unassigned.length ? 'No leads match your filters' : 'Queue clear'} />
                </div>
                <p className="mt-2 text-sm text-slate-500">
                  {unassigned.length ? 'Try changing the search or priority filter.' : 'All leads in this queue have been assigned.'}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-left">
                  <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
                    <tr>
                      <th className="px-5 py-3">
                        <input type="checkbox" checked={selectedVisible} onChange={toggleVisible} aria-label="Select visible leads" />
                      </th>
                      <th className="px-4 py-3 font-semibold">Lead details</th>
                      <th className="px-4 py-3 font-semibold">Priority</th>
                      <th className="px-4 py-3 font-semibold">Location</th>
                      <th className="px-4 py-3 font-semibold">Assignment</th>
                      <th className="px-5 py-3 text-right font-semibold">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredLeads.map((lead) => {
                      const id = String(getId(lead))
                      const isSelected = selected.includes(id)

                      return (
                        <tr key={id} className={`transition hover:bg-slate-50 ${isSelected ? 'bg-indigo-50/60' : ''}`}>
                          <td className="px-5 py-4">
                            <input type="checkbox" checked={isSelected} onChange={() => toggleLead(id)} aria-label={`Select ${lead.full_name || 'lead'}`} />
                          </td>
                          <td className="px-4 py-4">
                            <div className="flex items-center gap-3">
                              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-100 to-violet-100 font-bold text-indigo-700">
                                {String(lead.full_name || 'L').trim().charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <Link to={`/leads/${id}`} className="font-semibold text-slate-900 hover:text-indigo-700">
                                  {lead.full_name || 'Unnamed lead'}
                                </Link>
                                <p className="mt-0.5 text-xs text-slate-500">{lead.phone || lead.email || 'No contact details'}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-4">
                            <PriorityBadge priority={lead.priority || 'normal'} />
                          </td>
                          <td className="px-4 py-4">
                            <span className="inline-flex items-center gap-1.5 text-sm text-slate-600">
                              <MapPin size={14} className="text-slate-400" />
                              {lead.city || 'Not provided'}
                            </span>
                          </td>
                          <td className="px-4 py-4">
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700">
                              <Clock3 size={13} /> Unassigned
                            </span>
                          </td>
                          <td className="px-5 py-4 text-right">
                            <button
                              onClick={() => assignOne(id, method, method === 'manual' ? employeeId : '')}
                              disabled={busy || (method === 'manual' && !employeeId)}
                              className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-50"
                            >
                              <UserRound size={14} /> Assign
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}

            <div className="flex flex-col justify-between gap-2 border-t border-slate-100 bg-slate-50 px-5 py-3 text-xs text-slate-500 sm:flex-row sm:items-center">
              <span>Showing {filteredLeads.length} of {unassigned.length} unassigned leads</span>
              <span>Assignment permissions are enforced by the backend.</span>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
