import { toUtcSql } from '../lib/format'

// Offline fallback that mirrors GET /api/employee/workspace. Used only when the API is
// unreachable or VITE_EMPLOYEE_MOCK=true; all changes live in memory until reload.

const HOUR = 3600 * 1000
const DAY = 24 * HOUR
const at = (offsetMs) => toUtcSql(new Date(Date.now() + offsetMs))

const STATUSES = [
  [1, 'new_lead', 'New Lead'], [2, 'assigned', 'Assigned'], [3, 'not_contacted', 'Not Contacted'],
  [4, 'contacted', 'Contacted'], [5, 'interested', 'Interested'], [6, 'follow_up_required', 'Follow-up Required'],
  [7, 'site_visit_scheduled', 'Site Visit Scheduled'], [8, 'site_visit_completed', 'Site Visit Completed'],
  [9, 'negotiation', 'Negotiation'], [10, 'booking_in_progress', 'Booking in Progress'], [11, 'converted', 'Converted'],
  [12, 'not_interested', 'Not Interested'], [13, 'lost', 'Lost'], [14, 'invalid_number', 'Invalid Number'],
  [15, 'do_not_contact', 'Do Not Contact'],
].map(([id, code, name]) => ({ id, code, name }))

const statusById = Object.fromEntries(STATUSES.map((s) => [s.id, s]))

const LEADS = [
  ['Rahul Bhatia', '9876511001', 2, 'high', -3 * HOUR, 2 * HOUR, null, '2 BHK'],
  ['Sneha Kulkarni', '9876511002', 3, 'medium', -DAY, 5 * HOUR, null, '3 BHK'],
  ['Imran Sheikh', '9876511003', 4, 'medium', -2 * DAY, DAY, -5 * HOUR, '1 BHK'],
  ['Pooja Menon', '9876511004', 5, 'urgent', -4 * DAY, HOUR, -2 * HOUR, '3 BHK'],
  ['Aditya Rane', '9876511005', 5, 'high', -6 * DAY, 2 * DAY, -DAY, '2 BHK'],
  ['Kavya Reddy', '9876511006', 6, 'medium', -8 * DAY, -3 * HOUR, -2 * DAY, '2 BHK'],
  ['Nikhil Agarwal', '9876511007', 7, 'high', -10 * DAY, DAY, -HOUR, '3 BHK'],
  ['Tanvi Deshmukh', '9876511008', 9, 'urgent', -15 * DAY, 4 * HOUR, -3 * HOUR, '2 BHK'],
  ['Gaurav Malhotra', '9876511009', 11, 'medium', -45 * DAY, null, -9 * DAY, '2 BHK'],
  ['Ritika Sen', '9876511010', 11, 'high', -20 * DAY, null, -6 * DAY, '3 BHK'],
  ['Manoj Pillai', '9876511011', 12, 'low', -12 * DAY, null, -4 * DAY, '1 BHK'],
  ['Shalini Gupta', '9876511012', 1, 'medium', -0.5 * HOUR, 0.5 * HOUR, null, '2 BHK'],
]

const NOTES = [
  'Discussed 2 BHK layout and pricing; shared brochure on WhatsApp.',
  'No answer, will retry in the evening.',
  'Very interested in tower B. Wants a site visit this weekend.',
  'Asked to call back after 6 PM.',
  'Line busy.',
  'Clarified payment plan and loan tie-ups.',
]
const OUTCOMES = ['answered', 'no_answer', 'interested', 'callback_requested', 'busy', 'answered']

function buildState() {
  const leads = LEADS.map(([name, mobile, statusId, priority, enquiry, next, last, config], i) => ({
    id: 9001 + i,
    lead_code: `LD-${2001 + i}`,
    full_name: name,
    mobile,
    email: null,
    city: 'Mumbai',
    location: 'Andheri East',
    priority,
    status_id: statusId,
    status_name: statusById[statusId].name,
    status_code: statusById[statusId].code,
    is_terminal: statusId >= 11 ? 1 : 0,
    last_contact_at: last === null ? null : at(last),
    next_follow_up_at: next === null ? null : at(next),
    enquiry_at: at(enquiry),
    preferred_configuration: config,
    budget_min: 9000000 + i * 500000,
    budget_max: 12000000 + i * 600000,
    requirements: null,
    source_name: ['Website', 'Google Ads', 'Facebook Ads', 'Referral'][i % 4],
    call_count: statusId === 1 ? 0 : 2 + (i % 4),
  }))

  const calls = []
  for (let d = 0; d < 14; d++) {
    for (let c = 0; c < 3 + ((d * 7) % 4); c++) {
      const lead = leads[1 + ((d + c) % 10)]
      const k = (d * 3 + c) % 6
      calls.push({
        id: 50000 + d * 10 + c,
        lead_id: lead.id,
        lead_name: lead.full_name,
        mobile: lead.mobile,
        lead_code: lead.lead_code,
        initiated_at: at(-d * DAY - (c + 1) * 0.7 * HOUR),
        outcome: OUTCOMES[k],
        notes: NOTES[k],
        next_follow_up_at: null,
        is_employee_reported: 1,
      })
    }
  }

  const followUps = [
    [3, 'call', 'urgent', 'Confirm site visit slot', HOUR, 'pending'],
    [0, 'call', 'high', 'Intro call — share 2 BHK options', 2 * HOUR, 'pending'],
    [7, 'meeting', 'urgent', 'Negotiation follow-up with manager', 4 * HOUR, 'pending'],
    [5, 'whatsapp', 'medium', 'Send price sheet and floor plans', -3 * HOUR, 'overdue'],
    [4, 'call', 'high', 'Home loan eligibility check', 2 * DAY, 'pending'],
    [9, 'call', 'medium', 'Booking document checklist', -7 * DAY, 'completed'],
  ].map(([li, type, priority, title, due, status], i) => ({
    id: 7000 + i,
    lead_id: leads[li].id,
    lead_name: leads[li].full_name,
    mobile: leads[li].mobile,
    task_type: type,
    priority,
    title,
    notes: null,
    due_at: at(due),
    status,
    completed_at: status === 'completed' ? at(due) : null,
  }))

  const properties = [
    { id: 1, name: 'Skyline 2 BHK', city: 'Mumbai', configuration: '2 BHK' },
    { id: 2, name: 'Skyline 3 BHK', city: 'Mumbai', configuration: '3 BHK' },
    { id: 3, name: 'Green Valley Villa Type A', city: 'Pune', configuration: '4 BHK' },
  ]

  const siteVisits = [
    [6, 2, DAY, 'scheduled', null],
    [3, 2, 3 * DAY, 'scheduled', null],
    [9, 2, -9 * DAY, 'completed', 'Liked the view from 14th floor; proceeded to booking.'],
  ].map(([li, pid, when, status, feedback], i) => ({
    id: 8000 + i,
    lead_id: leads[li].id,
    lead_name: leads[li].full_name,
    mobile: leads[li].mobile,
    property_id: pid,
    property_name: properties.find((p) => p.id === pid).name,
    property_location: 'Andheri East',
    scheduled_at: at(when),
    status,
    feedback,
    completed_at: status === 'completed' ? at(when) : null,
  }))

  const loginAt = at(-3.2 * HOUR)
  return {
    profile: {
      id: 4,
      employee_code: 'EMP001',
      full_name: 'Anita Shah',
      email: 'anita@harborhomes.crm',
      phone: '9000000004',
      specialization: 'apartments',
      timezone: 'Asia/Kolkata',
      role_name: 'Employee',
      team_name: 'North Sales',
      department: 'Sales — North Sales',
      date_of_joining: toUtcSql(new Date(Date.now() - 420 * DAY)).slice(0, 10),
      manager_id: 2,
      manager_name: 'Rohan Mehta',
      manager_email: 'lead.north@harborhomes.crm',
      manager_phone: '9000000002',
      last_login_at: loginAt,
    },
    session: {
      current: { login_at: loginAt, last_seen_at: at(0), expires_at: at(9 * HOUR), ip_address: '127.0.0.1', user_agent: navigator.userAgent },
      recent: [0, 1, 2, 3].map((d) => ({
        login_at: d === 0 ? loginAt : at(-d * DAY - 7 * HOUR),
        logout_at: d === 0 ? null : at(-d * DAY + 2 * HOUR),
        last_seen_at: d === 0 ? at(0) : at(-d * DAY + 2 * HOUR),
        ip_address: '127.0.0.1',
      })),
      today: {
        first_login_at: loginAt, last_logout_at: null, is_open: true, is_late: false,
        working_seconds: 3.2 * 3600 - 1500, break_seconds: 1500, on_break_since: null, sessions: 1,
      },
      office_hours: { start: '09:30', end: '18:30', grace_minutes: 15, timezone: 'Asia/Kolkata' },
    },
    leads,
    calls,
    follow_ups: followUps,
    site_visits: siteVisits,
    properties,
    statuses: STATUSES,
  }
}

let state = null

export function mockState() {
  if (!state) state = buildState()
  return state
}

function computeStats(s) {
  const today = new Date().toDateString()
  const sameDay = (v) => v && new Date(`${v.replace(' ', 'T')}Z`).toDateString() === today
  const open = s.follow_ups.filter((f) => ['pending', 'overdue'].includes(f.status))
  const connected = ['answered', 'interested', 'callback_requested', 'not_interested']
  return {
    assigned_leads: s.leads.length,
    open_leads: s.leads.filter((l) => !l.is_terminal).length,
    new_leads: s.leads.filter((l) => [1, 2, 3].includes(l.status_id)).length,
    calls_today: s.calls.filter((c) => sameDay(c.initiated_at)).length,
    connected_today: s.calls.filter((c) => sameDay(c.initiated_at) && connected.includes(c.outcome)).length,
    follow_ups_today: open.filter((f) => sameDay(f.due_at)).length,
    overdue_follow_ups: open.filter((f) => new Date(`${f.due_at.replace(' ', 'T')}Z`) < new Date()).length,
    interested: s.leads.filter((l) => l.status_id === 5).length,
    converted: s.leads.filter((l) => l.status_id === 11).length,
    pending: open.length,
    site_visits_upcoming: s.site_visits.filter((v) => v.status === 'scheduled').length,
    definitions: {
      new_leads: 'Leads in New, Assigned or Not Contacted status',
      pending: 'Open follow-up tasks (pending + overdue)',
      connected_today: 'Calls with an answered, interested, callback or not-interested outcome',
    },
  }
}

export function mockAttendance(month) {
  const [y, m] = month.split('-').map(Number)
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate()
  const todayIso = new Date().toISOString().slice(0, 10)
  const days = []
  const summary = { working_days: 0, present: 0, absent: 0, leave: 0, late: 0, early_logout: 0, missing_logout: 0, holidays: 0, working_seconds: 0, break_seconds: 0, session_seconds: 0 }
  for (let d = 1; d <= daysInMonth; d++) {
    const date = `${month}-${String(d).padStart(2, '0')}`
    const weekday = new Date(`${date}T00:00:00Z`).getUTCDay()
    let status
    let working = 0
    let brk = 0
    let login = null
    let logout = null
    if (date > todayIso) status = 'upcoming'
    else if (weekday === 0) status = 'holiday'
    else if (d % 11 === 6) status = 'absent'
    else if (d % 13 === 5) status = 'leave'
    else {
      status = date === todayIso ? 'in_progress' : d % 7 === 3 ? 'late' : 'present'
      login = `${date} ${d % 7 === 3 ? '04:33' : '03:58'}:00`
      logout = date === todayIso ? null : `${date} 13:0${d % 5}:00`
      working = date === todayIso ? 3 * 3600 : 8 * 3600 + (d % 4) * 600
      brk = 2700
    }
    if (date <= todayIso && weekday !== 0) summary.working_days++
    if (login) {
      summary.present++
      summary.late += status === 'late' ? 1 : 0
      summary.working_seconds += working
      summary.break_seconds += brk
      summary.session_seconds += working + brk
    } else if (status === 'absent') summary.absent++
    else if (status === 'leave') summary.leave++
    else if (status === 'holiday' && date <= todayIso) summary.holidays++
    days.push({ date, weekday, status, login_at: login, logout_at: logout, working_seconds: working, break_seconds: brk, is_late: status === 'late', is_early_logout: false })
  }
  summary.avg_working_seconds = Math.round(summary.working_seconds / Math.max(1, summary.present))
  summary.attendance_rate = summary.working_days ? Math.round((1000 * (summary.present + summary.leave)) / summary.working_days) / 10 : 0
  return { month, from: `${month}-01`, to: `${month}-${daysInMonth}`, days, summary, note: 'Demo data — attendance is generated locally.' }
}

function mockPerformance(s) {
  const daily = []
  for (let i = 13; i >= 0; i--) {
    const date = new Date(Date.now() - i * DAY).toISOString().slice(0, 10)
    const dayCalls = s.calls.filter((c) => c.initiated_at.startsWith(date))
    daily.push({
      date,
      calls: dayCalls.length,
      connected: dayCalls.filter((c) => ['answered', 'interested', 'callback_requested'].includes(c.outcome)).length,
      follow_ups_done: i % 3 === 0 ? 1 : 0,
    })
  }
  const monthly = []
  for (let i = 5; i >= 0; i--) {
    const d = new Date()
    d.setUTCDate(1)
    d.setUTCMonth(d.getUTCMonth() - i)
    monthly.push({ month: d.toISOString().slice(0, 7), calls: 20 + (5 - i) * 9, conversions: i % 2 === 0 ? 1 : 0, site_visits: (5 - i) % 3 })
  }
  const pipeline = s.statuses
    .map((st) => ({ name: st.name, code: st.code, cnt: s.leads.filter((l) => l.status_id === st.id).length }))
    .filter((p) => p.cnt > 0)
  const counts = {}
  s.calls.forEach((c) => { counts[c.outcome] = (counts[c.outcome] || 0) + 1 })
  return {
    daily,
    monthly,
    pipeline,
    outcomes_this_month: Object.entries(counts).map(([outcome, cnt]) => ({ outcome, cnt })).sort((a, b) => b.cnt - a.cnt),
    summary: {
      calls_this_month: s.calls.length,
      connect_rate: 68.4,
      conversion_rate: Math.round((1000 * s.leads.filter((l) => l.status_id === 11).length) / s.leads.length) / 10,
      follow_up_completion: 72.5,
      conversions_this_month: 1,
      site_visits_this_month: 2,
      team_rank: 1,
      team_size: 2,
    },
    definitions: {
      connect_rate: 'Calls with a conversation outcome ÷ calls logged this month',
      conversion_rate: 'Converted leads ÷ all leads you currently own',
      follow_up_completion: 'Completed ÷ (completed + missed) follow-ups due this month',
      team_rank: 'Your position by calls logged this month within your team',
    },
  }
}

export function mockWorkspace(month) {
  const s = mockState()
  return {
    ...s,
    stats: computeStats(s),
    attendance: mockAttendance(month),
    performance: mockPerformance(s),
    server_time: toUtcSql(new Date()),
  }
}

let nextId = 100000

export const mockMutations = {
  logCall({ lead_id, outcome, notes, next_follow_up_at }) {
    const s = mockState()
    const lead = s.leads.find((l) => l.id === Number(lead_id))
    const now = toUtcSql(new Date())
    s.calls.unshift({
      id: nextId++, lead_id: lead.id, lead_name: lead.full_name, mobile: lead.mobile, lead_code: lead.lead_code,
      initiated_at: now, outcome, notes, next_follow_up_at: next_follow_up_at || null, is_employee_reported: 1,
    })
    lead.last_contact_at = now
    lead.call_count += 1
    if (next_follow_up_at) lead.next_follow_up_at = next_follow_up_at
    if (['answered', 'interested', 'callback_requested'].includes(outcome) && lead.status_id < 4) this.setStatus(lead.id, 4)
    if (outcome === 'invalid_number') this.setStatus(lead.id, 14)
  },
  setStatus(leadId, statusId) {
    const lead = mockState().leads.find((l) => l.id === Number(leadId))
    const st = statusById[Number(statusId)]
    Object.assign(lead, { status_id: st.id, status_name: st.name, status_code: st.code, is_terminal: st.id >= 11 ? 1 : 0 })
  },
  addFollowUp({ lead_id, title, due_at, task_type, priority, notes }) {
    const s = mockState()
    const lead = s.leads.find((l) => l.id === Number(lead_id))
    s.follow_ups.push({
      id: nextId++, lead_id: lead.id, lead_name: lead.full_name, mobile: lead.mobile,
      task_type, priority, title, notes, due_at, status: 'pending', completed_at: null,
    })
    lead.next_follow_up_at = due_at
  },
  updateFollowUp(id, patch) {
    const f = mockState().follow_ups.find((x) => x.id === Number(id))
    Object.assign(f, patch, patch.status === 'completed' ? { completed_at: toUtcSql(new Date()) } : {})
  },
  addSiteVisit({ lead_id, property_id, scheduled_at }) {
    const s = mockState()
    const lead = s.leads.find((l) => l.id === Number(lead_id))
    const prop = s.properties.find((p) => p.id === Number(property_id))
    s.site_visits.push({
      id: nextId++, lead_id: lead.id, lead_name: lead.full_name, mobile: lead.mobile,
      property_id: prop?.id ?? null, property_name: prop?.name ?? null, property_location: null,
      scheduled_at, status: 'scheduled', feedback: null, completed_at: null,
    })
    this.setStatus(lead.id, 7)
  },
  updateSiteVisit(id, patch) {
    const v = mockState().site_visits.find((x) => x.id === Number(id))
    Object.assign(v, patch, patch.status === 'completed' ? { completed_at: toUtcSql(new Date()) } : {})
    if (patch.status === 'completed') this.setStatus(v.lead_id, 8)
  },
  startBreak() {
    mockState().session.today.on_break_since = toUtcSql(new Date())
  },
  endBreak() {
    const t = mockState().session.today
    if (t.on_break_since) {
      t.break_seconds += Math.round((Date.now() - new Date(`${t.on_break_since.replace(' ', 'T')}Z`).getTime()) / 1000)
      t.on_break_since = null
    }
  },
}
