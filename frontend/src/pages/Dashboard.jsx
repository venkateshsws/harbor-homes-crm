
import { useEffect, useState } from 'react'
import { api } from '../api/client'
import { useAuth } from '../auth/AuthContext'
import EmployeeDashboard from './employee/EmployeeDashboard'
import {
  EmptyState,
  ErrorBanner,
  LoadingBlock,
  StatusBadge,
} from '../components/ui'
import {
  GradientKpis,
  PipelineDonut,
  TeamPerformanceChart,
  TrendAreaChart,
} from '../components/DashboardAnalytics'

const DEMO_TREND = [
  { label: 'Mon', leads: 18, visits: 5, conversions: 2 },
  { label: 'Tue', leads: 25, visits: 8, conversions: 4 },
  { label: 'Wed', leads: 21, visits: 7, conversions: 3 },
  { label: 'Thu', leads: 32, visits: 12, conversions: 6 },
  { label: 'Fri', leads: 29, visits: 10, conversions: 5 },
  { label: 'Sat', leads: 38, visits: 15, conversions: 8 },
  { label: 'Sun', leads: 34, visits: 13, conversions: 7 },
]

export default function Dashboard() {
  const { user } = useAuth()

  if (user?.role === 'employee') {
    return <EmployeeDashboard />
  }

  return <RoleDashboard />
}

function RoleDashboard() {
  const { user } = useAuth()
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    api('/api/dashboard')
      .then((res) => {
        if (!cancelled) {
          setData(res.data)
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e.message || 'Unable to load dashboard.')
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [])

  if (loading) return <LoadingBlock />
  if (error) return <ErrorBanner message={error} />
  if (!data) return <EmptyState title="No dashboard data" />

  const role = data.role || user?.role
  const isTeamLead = role === 'team_lead'

  const pipeline = (data.leads_by_status || []).map((item) => ({
    name: item.name,
    value: Number(item.cnt || 0),
  }))

  const adminKpis = [
    {
      label: 'Active employees',
      value: data.kpis?.active_employees,
      caption: 'Team workforce',
      icon: '👥',
    },
    {
      label: 'Attendance today',
      value: data.kpis?.attendance_today,
      caption: 'Present today',
      icon: '🟢',
    },
    {
      label: 'Leads today',
      value: data.kpis?.leads_today,
      caption: 'Lead activity',
      icon: '🎯',
    },
    {
      label: 'Unassigned leads',
      value: data.kpis?.unassigned_leads,
      caption: 'Need assignment',
      icon: '📥',
    },
    {
      label: 'Overdue follow-ups',
      value: data.kpis?.overdue_followups,
      caption: 'Need attention',
      icon: '⏰',
    },
  ]

  const teamLeadKpis = [
    {
      label: 'Team attendance',
      value: data.kpis?.attendance_today,
      caption: 'Team members present',
      icon: '👥',
    },
    {
      label: 'Overdue follow-ups',
      value: data.kpis?.overdue_followups,
      caption: 'Tasks to review',
      icon: '⏰',
    },
    {
      label: 'Unassigned leads',
      value: data.kpis?.unassigned_team_leads,
      caption: 'Available for assignment',
      icon: '📥',
    },
  ]

  return (
    <div className="space-y-6 pb-6">
      {/* Dashboard welcome banner */}
      <div className="overflow-hidden rounded-3xl bg-gradient-to-r from-violet-700 via-indigo-600 to-cyan-500 p-6 text-white shadow-lg sm:p-8">
        <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-center">
          <div>
            <p className="text-sm font-medium text-white/80">
              YAHOO CRM · ANALYTICS OVERVIEW
            </p>

            <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
              Welcome back, {user?.full_name?.split(' ')[0] || 'Team'}!
            </h1>

            <p className="mt-2 max-w-xl text-sm text-white/80">
              {isTeamLead
                ? 'Review your team workload, lead pipeline and daily activity.'
                : 'Track lead generation, team activity and conversion performance.'}
            </p>
          </div>

          <div className="w-fit rounded-2xl border border-white/20 bg-white/15 px-4 py-3 backdrop-blur">
            <p className="text-xs text-white/75">Dashboard role</p>

            <p className="mt-1 text-lg font-semibold">
              {isTeamLead
                ? 'Team Lead'
                : role === 'super_admin'
                  ? 'Super Admin'
                  : 'Admin'}
            </p>
          </div>
        </div>
      </div>

      {/* KPI cards */}
      <GradientKpis items={isTeamLead ? teamLeadKpis : adminKpis} />

      {/* Admin and Super Admin analytics */}
      {!isTeamLead && (
        <div className="grid gap-5 xl:grid-cols-2">
          <TrendAreaChart
            title="Lead activity trend"
            subtitle="Illustrative seven-day trend · demo values"
            data={DEMO_TREND}
            series={[
              {
                key: 'leads',
                name: 'New leads',
                color: '#8b5cf6',
              },
              {
                key: 'visits',
                name: 'Site visits',
                color: '#06b6d4',
              },
              {
                key: 'conversions',
                name: 'Conversions',
                color: '#f59e0b',
              },
            ]}
          />

          <PipelineDonut data={pipeline} />
        </div>
      )}

      {/* Team Lead workload and team members */}
      {isTeamLead && (
        <div className="grid gap-5 xl:grid-cols-2">
          <TeamPerformanceChart
            data={data.workload || []}
            primaryKey="open_leads"
            primaryName="Open leads"
            secondaryKey="overdue_tasks"
            secondaryName="Overdue tasks"
          />

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="font-semibold text-slate-800">
              Team members
            </h2>

            <p className="mt-1 text-xs text-slate-500">
              Members returned by your current demo data
            </p>

            <div className="mt-4 space-y-3">
              {(data.members || []).map((member) => (
                <div
                  key={member.id}
                  className="flex items-center justify-between gap-3 rounded-xl bg-gradient-to-r from-violet-50 to-cyan-50 p-3"
                >
                  <div>
                    <p className="font-medium text-slate-800">
                      {member.full_name}
                    </p>

                    <p className="text-xs text-slate-500">
                      Team member
                    </p>
                  </div>

                  <StatusBadge
                    status={member.is_active ? 'active' : 'inactive'}
                  />
                </div>
              ))}

              {(data.members || []).length === 0 && (
                <p className="py-4 text-sm text-slate-500">
                  No team members available.
                </p>
              )}
            </div>
          </section>
        </div>
      )}

      {/* Admin team conversion analytics */}
      {!isTeamLead && (
        <div className="grid gap-5 xl:grid-cols-2">
          <TeamPerformanceChart
            data={data.team_conversion || []}
            primaryKey="total_leads"
            primaryName="Leads"
            secondaryKey="conversions"
            secondaryName="Conversions"
          />

          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4">
              <h2 className="font-semibold text-slate-800">
                Team conversion summary
              </h2>

              <p className="mt-1 text-xs text-slate-500">
                Conversion rates returned by the current dashboard data
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-500">
                    <th className="py-3 pr-3">Team</th>
                    <th className="py-3 pr-3">Leads</th>
                    <th className="py-3 pr-3">Converted</th>
                    <th className="py-3">Rate</th>
                  </tr>
                </thead>

                <tbody>
                  {(data.team_conversion || []).map((row) => (
                    <tr
                      key={row.name}
                      className="border-b border-slate-50 last:border-0"
                    >
                      <td className="py-3 pr-3 font-medium text-slate-700">
                        {row.name}
                      </td>

                      <td className="py-3 pr-3 text-slate-600">
                        {row.total_leads ?? 0}
                      </td>

                      <td className="py-3 pr-3 text-slate-600">
                        {row.conversions ?? 0}
                      </td>

                      <td className="py-3 font-semibold text-violet-700">
                        {row.conversion_rate ?? 0}%
                      </td>
                    </tr>
                  ))}

                  {(data.team_conversion || []).length === 0 && (
                    <tr>
                      <td
                        colSpan={4}
                        className="py-6 text-center text-slate-500"
                      >
                        No team conversion data available.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <p className="mt-3 text-xs text-slate-400">
              {data.metrics_definitions?.conversion_rate}
            </p>
          </section>
        </div>
      )}
    </div>
  )
}
