// Frontend-only data for the CRM screens. Records are saved JSON held in
// memory for this Vite process. There is no PHP API and no database.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const fixtureDir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures')
const readFixture = (name) => JSON.parse(fs.readFileSync(path.join(fixtureDir, name), 'utf8'))

const PASSWORD = 'Password123!'
const ROLE_NAMES = { admin: 'Admin', team_lead: 'Team Lead', employee: 'Employee' }

const store = {
  leads: readFixture('admin-leads.json'),
  leadDetail: readFixture('lead-detail.json'),
  users: readFixture('users.json'),
  notifications: readFixture('notifications.json'),
}

const staticGet = {
  '/api/leads/meta': () => readFixture('leads-meta.json'),
  '/api/users': () => store.users,
  '/api/teams': () => readFixture('teams.json'),
  '/api/attendance': () => readFixture('attendance.json'),
  '/api/attendance/summary': () => readFixture('attendance-summary.json'),
  '/api/calls': () => readFixture('calls.json'),
  '/api/calls/analytics': () => readFixture('calls-analytics.json'),
  '/api/follow-ups': () => readFixture('followups.json'),
  '/api/properties': () => readFixture('properties.json'),
  '/api/site-visits': () => readFixture('sitevisits.json'),
  '/api/campaigns': () => readFixture('campaigns.json'),
  '/api/nurturing': () => readFixture('nurturing.json'),
  '/api/reports/performance': () => readFixture('reports-perf.json'),
  '/api/reports/lead-conversion': () => readFixture('reports-conv.json'),
  '/api/reports/assignments': () => readFixture('reports-assign.json'),
  '/api/notifications': () => store.notifications,
  '/api/settings': () => readFixture('settings.json'),
  '/api/settings/assignment-rules': () => readFixture('rules.json'),
  '/api/settings/queues': () => readFixture('queues.json'),
  '/api/whatsapp/status': () => readFixture('wa.json'),
  '/api/audit-logs': () => readFixture('audit.json'),
  '/api/employee/workspace': () => readFixture('anita-workspace.json'),
  '/api/employee/attendance': () => readFixture('anita-attendance.json'),
  '/api/employee/calls': () => readFixture('calls.json'),
}

const sessions = new Map()

function sessionUser(row) {
  return {
    id: row.id,
    employee_code: row.employee_code,
    email: row.email,
    full_name: row.full_name,
    phone: row.phone,
    role: row.role,
    role_name: ROLE_NAMES[row.role] || row.role,
    team_id: row.team_id,
    specialization: row.specialization,
    assignment_weight: row.assignment_weight,
    max_open_leads: row.max_open_leads,
    is_assignment_eligible: Boolean(row.is_assignment_eligible),
    is_active: Boolean(row.is_active),
    last_login_at: row.last_login_at,
    timezone: 'Asia/Kolkata',
  }
}

function findUser(identifier) {
  const id = String(identifier || '').trim().toLowerCase()
  return store.users.data.find(
    (user) => user.email.toLowerCase() === id || String(user.employee_code).toLowerCase() === id,
  )
}

function readCookie(req, name) {
  const header = req.headers.cookie || ''
  const match = header.split(';').map((part) => part.trim()).find((part) => part.startsWith(`${name}=`))
  return match ? decodeURIComponent(match.slice(name.length + 1)) : ''
}

function currentUser(req) {
  const token = readCookie(req, 'hh_local_demo')
  return token ? sessions.get(token) || null : null
}

function send(res, status, body, headers = {}) {
  const payload = JSON.stringify(body)
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(payload),
    'Cache-Control': 'no-store',
    ...headers,
  })
  res.end(payload)
}

function readBody(req) {
  return new Promise((resolve) => {
    const chunks = []
    req.on('data', (chunk) => chunks.push(chunk))
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8')
      if (!raw) return resolve({})
      try {
        resolve(JSON.parse(raw))
      } catch {
        resolve({})
      }
    })
  })
}

export async function handleDemoRequest(req, res) {
  const url = new URL(req.url || '/', 'http://127.0.0.1')
  const pathname = url.pathname.replace(/\/$/, '') || '/'
  const method = (req.method || 'GET').toUpperCase()

  if (method === 'GET' && pathname === '/api/health') {
    send(res, 200, {
      success: true,
      data: { status: 'ok', mode: 'local-demo', database: false },
    })
    return
  }

  if (method === 'POST' && pathname === '/api/auth/login') {
    const body = await readBody(req)
    const row = findUser(body.identifier)
    if (!row || body.password !== PASSWORD) {
      send(res, 401, { success: false, error: 'Invalid email, employee ID, or password.' })
      return
    }
    const token = `demo-${row.id}-${Date.now()}`
    const user = sessionUser(row)
    sessions.set(token, user)
    send(res, 200, { success: true, data: { user, csrf_token: 'local-demo' } }, {
      'Set-Cookie': `hh_local_demo=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax`,
    })
    return
  }

  if (method === 'POST' && pathname === '/api/auth/logout') {
    const token = readCookie(req, 'hh_local_demo')
    if (token) sessions.delete(token)
    send(res, 200, { success: true, data: {} }, {
      'Set-Cookie': 'hh_local_demo=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax',
    })
    return
  }

  const user = currentUser(req)
  if (!user) {
    send(res, 401, { success: false, error: 'Sign in required.' })
    return
  }

  if (method === 'GET' && pathname === '/api/auth/me') {
    send(res, 200, { success: true, data: { user, csrf_token: 'local-demo' } })
    return
  }

  if (method === 'GET' && pathname === '/api/dashboard') {
    const file = user.role === 'team_lead' ? 'lead-dashboard.json' : 'admin-dashboard.json'
    send(res, 200, readFixture(file))
    return
  }

  if (method === 'GET' && pathname === '/api/leads') {
    let rows = store.leads.data
    const q = (url.searchParams.get('q') || '').toLowerCase()
    const statusId = url.searchParams.get('status_id')
    const priority = url.searchParams.get('priority')
    if (url.searchParams.get('unassigned') === '1') rows = rows.filter((lead) => !lead.owner_id)
    if (statusId) rows = rows.filter((lead) => String(lead.status_id) === statusId)
    if (priority) rows = rows.filter((lead) => lead.priority === priority)
    if (q) {
      rows = rows.filter((lead) =>
        [lead.full_name, lead.mobile, lead.lead_code, lead.city, lead.email]
          .some((value) => String(value || '').toLowerCase().includes(q)),
      )
    }
    send(res, 200, { success: true, data: rows, meta: { ...store.leads.meta, total: rows.length } })
    return
  }

  if (method === 'GET' && pathname === '/api/leads/export') {
    const header = 'lead_code,full_name,mobile,city,priority,status,owner'
    const lines = store.leads.data.map((lead) =>
      [lead.lead_code, lead.full_name, lead.mobile, lead.city, lead.priority, lead.status_name, lead.owner_name]
        .map((value) => `"${String(value || '').replaceAll('"', '""')}"`)
        .join(','),
    )
    send(res, 200, { success: true, data: { csv: [header, ...lines].join('\n') } })
    return
  }

  const leadMatch = pathname.match(/^\/api\/leads\/(\d+)$/)
  if (leadMatch && method === 'GET') {
    const id = Number(leadMatch[1])
    const row = store.leads.data.find((lead) => lead.id === id)
    const detail = structuredClone(store.leadDetail)
    if (row) detail.data.lead = { ...detail.data.lead, ...row }
    else if (detail.data.lead) detail.data.lead.id = id
    send(res, 200, detail)
    return
  }

  if (leadMatch && method === 'PUT') {
    const body = await readBody(req)
    const row = store.leads.data.find((lead) => lead.id === Number(leadMatch[1]))
    if (row && body.status_id) row.status_id = Number(body.status_id)
    send(res, 200, { success: true, data: row || {} })
    return
  }

  if (method === 'POST' && pathname === '/api/leads') {
    const body = await readBody(req)
    const row = {
      id: Date.now(),
      lead_code: `LD-${Date.now().toString().slice(-4)}`,
      full_name: body.full_name,
      mobile: body.mobile,
      email: body.email || '',
      city: body.city || '',
      location: body.location || '',
      property_type: body.property_type || 'apartment',
      budget_min: body.budget_min,
      budget_max: body.budget_max,
      preferred_configuration: body.preferred_configuration || '',
      priority: body.priority || 'medium',
      status_id: 1,
      status_name: 'New',
      owner_id: user.role === 'employee' ? user.id : null,
      owner_name: user.role === 'employee' ? user.full_name : null,
      next_follow_up_at: null,
      requirements: body.requirements || '',
    }
    store.leads.data.unshift(row)
    send(res, 200, { success: true, data: row })
    return
  }

  if (method === 'GET' && /^\/api\/teams\/\d+\/members$/.test(pathname)) {
    send(res, 200, readFixture('team-members.json'))
    return
  }

  if (method === 'GET' && /^\/api\/properties\/\d+\/matches$/.test(pathname)) {
    send(res, 200, readFixture('matches.json'))
    return
  }

  if (method === 'GET' && staticGet[pathname]) {
    send(res, 200, staticGet[pathname]())
    return
  }

  if (method === 'POST' || method === 'PUT') {
    send(res, 200, { success: true, data: {} })
    return
  }

  send(res, 404, { success: false, error: `No local demo data for ${pathname}` })
}

export function localDemoMiddleware() {
  return async function demoMiddleware(req, res, next) {
    const pathname = (req.url || '').split('?')[0]
    if (!pathname.startsWith('/api')) return next()
    try {
      await handleDemoRequest(req, res)
    } catch (error) {
      next(error)
    }
  }
}
