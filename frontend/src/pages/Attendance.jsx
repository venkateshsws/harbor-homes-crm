import { useEffect, useState } from 'react'
import { api } from '../api/client'
import { ErrorBanner, LoadingBlock, PageHeader, StatusBadge } from '../components/ui'

function fmtSeconds(sec) {
  const s = Number(sec || 0)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  return `${h}h ${m}m`
}

export default function Attendance() {
  const [rows, setRows] = useState([])
  const [summary, setSummary] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  const load = async () => {
    setLoading(true)
    try {
      const [list, sum] = await Promise.all([api('/api/attendance'), api('/api/attendance/summary')])
      setRows(list.data)
      setSummary(sum.data)
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const startBreak = async () => {
    try { await api('/api/attendance/breaks/start', { method: 'POST' }); await load() }
    catch (e) { setError(e.message) }
  }
  const endBreak = async () => {
    try { await api('/api/attendance/breaks/end', { method: 'POST' }); await load() }
    catch (e) { setError(e.message) }
  }

  return (
    <div>
      <PageHeader
        title="Attendance"
        subtitle="Session duration is login-to-logout time. Working duration excludes recorded breaks and is not verified productive time."
        actions={
          <>
            <button className="btn btn-secondary" onClick={startBreak}>Start break</button>
            <button className="btn btn-primary" onClick={endBreak}>End break</button>
          </>
        }
      />
      <ErrorBanner message={error} />
      {loading ? <LoadingBlock /> : (
        <>
          <div className="card-panel mb-4 table-wrap p-2">
            <h2 className="px-3 pt-3 font-semibold">Summary</h2>
            <table className="data">
              <thead><tr><th>Employee</th><th>Present days</th><th>Working</th><th>Session</th><th>Breaks</th><th>Late</th><th>Missing logout</th></tr></thead>
              <tbody>
                {(summary?.employees || []).map((e) => (
                  <tr key={e.id}>
                    <td>{e.full_name}</td>
                    <td>{e.present_days}</td>
                    <td>{fmtSeconds(e.total_working_seconds)}</td>
                    <td>{fmtSeconds(e.total_session_seconds)}</td>
                    <td>{fmtSeconds(e.total_break_seconds)}</td>
                    <td>{e.late_count}</td>
                    <td>{e.missing_logout_count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="px-3 pb-3 text-xs text-[var(--color-ink-soft)]">{summary?.note}</p>
          </div>
          <div className="card-panel table-wrap p-2">
            <table className="data">
              <thead><tr><th>Date</th><th>Employee</th><th>Login</th><th>Logout</th><th>Working</th><th>Late</th><th>Status</th></tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td>{r.work_date}</td>
                    <td>{r.full_name}</td>
                    <td>{r.login_at}</td>
                    <td>{r.logout_at || '—'}</td>
                    <td>{fmtSeconds(r.working_seconds)}</td>
                    <td>{r.is_late ? 'Yes' : 'No'}</td>
                    <td><StatusBadge status={r.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
