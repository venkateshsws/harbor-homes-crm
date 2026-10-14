import {
  Bar, BarChart, CartesianGrid, Cell, ComposedChart, Legend, Line, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import { BadgeCheck, ChartColumn, ChartLine, ChartPie, Download, ListChecks, MapPin, PhoneCall, Target, Trophy } from 'lucide-react'
import { useAuth } from '../auth/AuthContext'
import { useEmployeeWorkspace } from '../hooks/useEmployeeWorkspace'
import { ErrorBanner, LoadingBlock, PageHeader } from '../components/ui'
import { DataSourceBadge, Panel, StatTile } from '../components/employee/EmployeeUI'
import { downloadCsv, fmtDateTime, humanize, parseUtc } from '../lib/format'

const PALETTE = ['#0f5c56', '#c45c26', '#2f7fb5', '#7c5cc4', '#d4a017', '#16794c', '#b42318', '#64748b', '#0ea5a4']

const monthLabel = (m) => new Date(`${m}-01T00:00:00Z`).toLocaleDateString([], { month: 'short', year: '2-digit', timeZone: 'UTC' })

export default function Performance() {
  const { user } = useAuth()
  const { data, source, loading, error } = useEmployeeWorkspace()

  if (loading && !data) return <LoadingBlock label="Building your performance report…" />
  if (error && !data) return <ErrorBanner message={error} />

  const p = data.performance
  const s = p.summary
  const daily = p.daily.map((d) => ({ ...d, label: parseUtc(d.date).toLocaleDateString([], { day: '2-digit', month: 'short' }) }))
  const monthly = p.monthly.map((m) => ({ ...m, label: monthLabel(m.month) }))
  const outcomes = p.outcomes_this_month.map((o) => ({ name: humanize(o.outcome), value: Number(o.cnt) }))
  const pipeline = p.pipeline.map((r) => ({ name: r.name, cnt: Number(r.cnt) }))

  const exportMonthly = () => downloadCsv(`performance-${data.profile.employee_code || 'me'}.csv`, monthly.map((m) => ({
    month: m.month, calls_logged: m.calls, conversions: m.conversions, site_visits_completed: m.site_visits,
  })))
  const exportLeads = () => downloadCsv(`my-leads-${new Date().toISOString().slice(0, 10)}.csv`, data.leads.map((l) => ({
    lead_code: l.lead_code, customer: l.full_name, phone: l.mobile, status: l.status_name, priority: l.priority,
    last_contact: fmtDateTime(l.last_contact_at), next_follow_up: fmtDateTime(l.next_follow_up_at), calls: l.call_count,
  })))

  return (
    <div className="space-y-5">
      <PageHeader
        title="Performance & reports"
        subtitle={`${data.profile.full_name || user?.full_name} · ${data.profile.employee_code || ''} · personal metrics only`}
        actions={
          <>
            <DataSourceBadge source={source} />
            <button className="btn btn-secondary" onClick={exportLeads}><Download size={16} /> Leads report</button>
            <button className="btn btn-primary" onClick={exportMonthly}><Download size={16} /> Monthly report</button>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <StatTile icon={PhoneCall} tone="violet" label="Calls this month" value={s.calls_this_month} />
        <StatTile icon={Target} label="Connect rate" value={`${s.connect_rate}%`} hint="Conversations ÷ calls" />
        <StatTile icon={BadgeCheck} tone="emerald" label="Conversion rate" value={`${s.conversion_rate}%`} hint={`${s.conversions_this_month} this month`} />
        <StatTile icon={ListChecks} tone="amber" label="Follow-up completion" value={`${s.follow_up_completion}%`} hint="Due this month" />
        <StatTile icon={MapPin} tone="sky" label="Site visits done" value={s.site_visits_this_month} hint="This month" />
        <StatTile icon={Trophy} tone="orange" label="Team rank" value={s.team_rank ? `#${s.team_rank}` : '—'} hint={s.team_size ? `of ${s.team_size} by calls` : 'No team'} />
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <Panel title="Daily calls — last 14 days" icon={ChartColumn}>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={daily} margin={{ left: -20, right: 8, top: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#d7e0da" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="calls" name="Calls logged" fill="#0f5c56" radius={[5, 5, 0, 0]} />
                <Bar dataKey="connected" name="Connected" fill="#c45c26" radius={[5, 5, 0, 0]} />
                <Bar dataKey="follow_ups_done" name="Follow-ups done" fill="#2f7fb5" radius={[5, 5, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel title="Monthly trend" icon={ChartLine}>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={monthly} margin={{ left: -20, right: 8, top: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#d7e0da" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis yAxisId="calls" allowDecimals={false} tick={{ fontSize: 11 }} />
                <YAxis yAxisId="small" orientation="right" allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar yAxisId="calls" dataKey="calls" name="Calls" fill="#9cc9bf" radius={[5, 5, 0, 0]} />
                <Line yAxisId="small" type="monotone" dataKey="conversions" name="Conversions" stroke="#16794c" strokeWidth={2.5} dot />
                <Line yAxisId="small" type="monotone" dataKey="site_visits" name="Site visits" stroke="#c45c26" strokeWidth={2.5} dot />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel title="Call outcomes this month" icon={ChartPie}>
          {outcomes.length === 0 ? <p className="text-sm text-[var(--color-ink-soft)]">No calls logged this month yet.</p> : (
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={outcomes} dataKey="value" nameKey="name" innerRadius={60} outerRadius={100} paddingAngle={2}>
                    {outcomes.map((o, i) => <Cell key={o.name} fill={PALETTE[i % PALETTE.length]} />)}
                  </Pie>
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </Panel>

        <Panel title="My pipeline by status" icon={ChartColumn}>
          {pipeline.length === 0 ? <p className="text-sm text-[var(--color-ink-soft)]">No leads assigned yet.</p> : (
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={pipeline} layout="vertical" margin={{ left: 40, right: 16 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#d7e0da" />
                  <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="name" width={130} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="cnt" name="Leads" fill="#0f5c56" radius={[0, 5, 5, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Panel>
      </div>

      <Panel title="Monthly report" icon={ListChecks} bodyClassName="p-0">
        <div className="table-wrap">
          <table className="data">
            <thead><tr><th>Month</th><th>Calls logged</th><th>Conversions</th><th>Site visits completed</th></tr></thead>
            <tbody>
              {[...monthly].reverse().map((m) => (
                <tr key={m.month}><td>{m.label}</td><td>{m.calls}</td><td>{m.conversions}</td><td>{m.site_visits}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
        <dl className="grid gap-2 border-t border-[var(--color-line)] p-4 text-xs text-[var(--color-ink-soft)] sm:grid-cols-2">
          {Object.entries(p.definitions || {}).map(([k, v]) => (
            <div key={k}><dt className="inline font-semibold text-[var(--color-ink)]">{humanize(k)}:</dt> <dd className="inline">{v}</dd></div>
          ))}
        </dl>
      </Panel>
    </div>
  )
}
