
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

const COLORS = ['#7c3aed', '#ec4899', '#f59e0b', '#06b6d4', '#10b981']

const number = (value) => Number(value || 0)

function ChartCard({ title, subtitle, children, className = '' }) {
  return (
    <section className={`overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm sm:p-5 ${className}`}>
      <div className="mb-4">
        <h2 className="font-semibold text-slate-800">{title}</h2>
        {subtitle && <p className="mt-1 text-xs text-slate-500">{subtitle}</p>}
      </div>
      {children}
    </section>
  )
}

function GradientStat({ label, value, caption, gradient, icon }) {
  return (
    <div className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${gradient} p-4 text-white shadow-lg`}>
      <div className="absolute -right-5 -top-6 size-24 rounded-full bg-white/15" />
      <div className="relative flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-medium text-white/85">{label}</p>
          <p className="mt-3 text-3xl font-bold tracking-tight">{number(value).toLocaleString()}</p>
          <p className="mt-2 text-xs text-white/80">{caption}</p>
        </div>
        <span className="grid size-10 place-items-center rounded-xl bg-white/20 text-xl">
          {icon}
        </span>
      </div>
    </div>
  )
}

export function GradientKpis({ items }) {
  const gradients = [
    'from-violet-600 to-indigo-500',
    'from-cyan-500 to-blue-600',
    'from-fuchsia-500 to-pink-600',
    'from-amber-400 to-orange-600',
    'from-emerald-500 to-teal-600',
  ]

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
      {items.map((item, index) => (
        <GradientStat
          key={item.label}
          {...item}
          gradient={gradients[index % gradients.length]}
        />
      ))}
    </div>
  )
}

export function PipelineDonut({ data = [] }) {
  const rows = data.map((row, index) => ({
    name: row.name || `Status ${index + 1}`,
    value: number(row.value ?? row.cnt),
    color: COLORS[index % COLORS.length],
  }))

  const total = rows.reduce((sum, row) => sum + row.value, 0)

  return (
    <ChartCard title="Lead pipeline" subtitle="Distribution across current lead statuses">
      <div className="grid grid-cols-1 items-center gap-3 sm:grid-cols-2">
        <div className="relative h-56 min-w-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={rows}
                dataKey="value"
                nameKey="name"
                innerRadius={62}
                outerRadius={88}
                paddingAngle={4}
                stroke="none"
              >
                {rows.map((row) => (
                  <Cell key={row.name} fill={row.color} />
                ))}
              </Pie>
              <Tooltip formatter={(value, name) => [value, name]} />
            </PieChart>
          </ResponsiveContainer>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-xs text-slate-500">Total leads</span>
            <span className="text-3xl font-bold text-slate-800">{total}</span>
          </div>
        </div>
        <div className="space-y-3">
          {rows.map((row) => (
            <div key={row.name} className="flex items-center justify-between gap-3 text-sm">
              <div className="flex min-w-0 items-center gap-2">
                <span className="size-2.5 shrink-0 rounded-full" style={{ background: row.color }} />
                <span className="truncate text-slate-600">{row.name}</span>
              </div>
              <span className="font-semibold text-slate-800">{row.value}</span>
            </div>
          ))}
        </div>
      </div>
    </ChartCard>
  )
}

export function TrendAreaChart({
  data = [],
  xKey = 'label',
  series = [{ key: 'calls', name: 'Calls', color: '#8b5cf6' }],
  title = 'Activity trend',
  subtitle = 'Activity over time',
}) {
  return (
    <ChartCard title={title} subtitle={subtitle}>
      <div className="h-72 min-w-0">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
            <defs>
              {series.map((item, index) => (
                <linearGradient key={item.key} id={`trend-fill-${index}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={item.color} stopOpacity={0.35} />
                  <stop offset="95%" stopColor={item.color} stopOpacity={0.02} />
                </linearGradient>
              ))}
            </defs>
            <CartesianGrid stroke="#e9edf5" strokeDasharray="4 4" vertical={false} />
            <XAxis dataKey={xKey} tick={{ fill: '#64748b', fontSize: 11 }} tickLine={false} axisLine={false} />
            <YAxis allowDecimals={false} tick={{ fill: '#64748b', fontSize: 11 }} tickLine={false} axisLine={false} />
            <Tooltip
              contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', boxShadow: '0 8px 25px #0f172a12' }}
            />
            {series.map((item, index) => (
              <Area
                key={item.key}
                type="monotone"
                dataKey={item.key}
                name={item.name}
                stroke={item.color}
                strokeWidth={3}
                fill={`url(#trend-fill-${index})`}
                activeDot={{ r: 5, strokeWidth: 0 }}
              />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-2 flex flex-wrap gap-4">
        {series.map((item) => (
          <div key={item.key} className="flex items-center gap-2 text-xs text-slate-500">
            <span className="h-1 w-5 rounded-full" style={{ background: item.color }} />
            {item.name}
          </div>
        ))}
      </div>
    </ChartCard>
  )
}


export function TeamPerformanceChart({
  data = [],
  primaryKey = 'total_leads',
  primaryName = 'Leads',
  secondaryKey = 'conversions',
  secondaryName = 'Conversions',
}) {
  const rows = data.map((row) => ({
    name: row.name || row.full_name || 'Team',
    primary: number(row[primaryKey]),
    secondary: number(row[secondaryKey]),
  }))

  return (
    <ChartCard
      title="Team performance"
      subtitle={`${primaryName} compared with ${secondaryName}`}
    >
      <div className="h-72 min-w-0">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={rows}
            layout="vertical"
            margin={{ top: 4, right: 12, left: 8, bottom: 4 }}
            barGap={5}
          >
            <defs>
              <linearGradient
                id="team-primary-gradient"
                x1="0"
                y1="0"
                x2="1"
                y2="0"
              >
                <stop offset="0%" stopColor="#06b6d4" />
                <stop offset="100%" stopColor="#6366f1" />
              </linearGradient>

              <linearGradient
                id="team-secondary-gradient"
                x1="0"
                y1="0"
                x2="1"
                y2="0"
              >
                <stop offset="0%" stopColor="#f472b6" />
                <stop offset="100%" stopColor="#8b5cf6" />
              </linearGradient>
            </defs>

            <CartesianGrid
              stroke="#e9edf5"
              strokeDasharray="4 4"
              horizontal={false}
            />

            <XAxis
              type="number"
              allowDecimals={false}
              tick={{ fill: '#64748b', fontSize: 11 }}
              axisLine={false}
              tickLine={false}
            />

            <YAxis
              type="category"
              dataKey="name"
              width={90}
              tick={{ fill: '#475569', fontSize: 11 }}
              axisLine={false}
              tickLine={false}
            />

            <Tooltip />

            <Bar
              dataKey="primary"
              name={primaryName}
              fill="url(#team-primary-gradient)"
              radius={[0, 6, 6, 0]}
              barSize={12}
            />

            <Bar
              dataKey="secondary"
              name={secondaryName}
              fill="url(#team-secondary-gradient)"
              radius={[0, 6, 6, 0]}
              barSize={12}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  )
}

