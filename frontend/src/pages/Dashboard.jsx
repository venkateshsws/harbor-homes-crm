import { useEffect, useState } from 'react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { api } from '../api/client'
import { useAuth } from '../auth/AuthContext'
import EmployeeDashboard from './employee/EmployeeDashboard'
import { EmptyState, ErrorBanner, KpiCard, LoadingBlock, PageHeader, StatusBadge } from '../components/ui'

export default function Dashboard() {
  const { user } = useAuth()
  return user?.role === 'employee' ? <EmployeeDashboard /> : <RoleDashboard />
}

function RoleDashboard() {
  const { user } = useAuth()
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api('/api/dashboard')
      .then((res) => setData(res.data))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <LoadingBlock />
  if (error) return <ErrorBanner message={error} />
  if (!data) return <EmptyState title="No dashboard data" />

  return (
    <div className={data.role === 'admin' ? 'company-admin-theme' : undefined}>
      <PageHeader
        title={`${user?.full_name?.split(' ')[0] || 'Team'}, here's today`}
        subtitle="Demo CRM metrics for your role. Saved with the frontend, not in a database."
      />

      {data.role === 'admin' && (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <KpiCard label="Active employees" value={data.kpis.active_employees} />
            <KpiCard label="Attendance today" value={data.kpis.attendance_today} hint="Login sessions, not productive time" />
            <KpiCard label="Leads today" value={data.kpis.leads_today} />
            <KpiCard label="Unassigned" value={data.kpis.unassigned_leads} />
            <KpiCard label="Overdue follow-ups" value={data.kpis.overdue_followups} />
          </div>
          <div className="mt-4 grid gap-4 xl:grid-cols-2">
            <div className="card-panel p-4">
              <h2 className="mb-3 font-semibold">Leads by status</h2>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.leads_by_status}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#dbeafe" />
                    <XAxis dataKey="name" hide />
                    <YAxis allowDecimals={false} />
                    <Tooltip />
                    <Bar dataKey="cnt" fill="#2563eb" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="card-panel p-4">
              <h2 className="mb-3 font-semibold">Team conversion</h2>
              <div className="table-wrap">
                <table className="data">
                  <thead><tr><th>Team</th><th>Leads</th><th>Converted</th><th>Rate</th></tr></thead>
                  <tbody>
                    {data.team_conversion.map((row) => (
                      <tr key={row.name}>
                        <td>{row.name}</td>
                        <td>{row.total_leads}</td>
                        <td>{row.conversions}</td>
                        <td>{row.conversion_rate ?? 0}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-3 text-xs text-[var(--color-ink-soft)]">{data.metrics_definitions?.conversion_rate}</p>
            </div>
          </div>
        </>
      )}

      {data.role === 'team_lead' && (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <KpiCard label="Team attendance today" value={data.kpis.attendance_today} />
            <KpiCard label="Overdue follow-ups" value={data.kpis.overdue_followups} />
            <KpiCard label="Unassigned team leads" value={data.kpis.unassigned_team_leads} />
          </div>
          <div className="mt-4 grid gap-4 xl:grid-cols-2">
            <div className="card-panel p-4">
              <h2 className="mb-3 font-semibold">Workload</h2>
              <table className="data">
                <thead><tr><th>Employee</th><th>Open leads</th><th>Overdue</th></tr></thead>
                <tbody>
                  {data.workload.map((w) => (
                    <tr key={w.full_name}><td>{w.full_name}</td><td>{w.open_leads}</td><td>{w.overdue_tasks}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="card-panel p-4">
              <h2 className="mb-3 font-semibold">Members</h2>
              <ul className="space-y-2">
                {data.members.map((m) => (
                  <li key={m.id} className="flex items-center justify-between rounded-lg bg-white/70 px-3 py-2">
                    <span>{m.full_name}</span>
                    <StatusBadge status={m.is_active ? 'active' : 'inactive'} />
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </>
      )}

    </div>
  )
}
