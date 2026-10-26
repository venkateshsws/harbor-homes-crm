import express from 'express'
import { Lead } from '../models/Lead.js'
import { User } from '../models/User.js'
import { requireAuth } from '../middleware/auth.js'

export const leadsRouter = express.Router()

leadsRouter.use(requireAuth)

const statuses = [
  { id: 1, name: 'New' },
  { id: 2, name: 'Interested' },
  { id: 3, name: 'Schedule for site visit' },
  { id: 4, name: 'Not interested' },
  { id: 5, name: 'Follow up' },
]

const sources = [
  { id: 1, name: 'Website' },
  { id: 2, name: 'Phone' },
  { id: 3, name: 'WhatsApp' },
  { id: 4, name: 'Referral' },
  { id: 5, name: 'Other' },
]

const assignmentMethods = [
  'manual',
  'round_robin',
  'workload',
  'priority',
]

const priorityRank = {
  urgent: 0,
  high: 1,
  medium: 2,
  low: 3,
}

function serializeLead(lead) {
  return {
    id: lead._id.toString(),
    lead_code: lead.lead_code,
    full_name: lead.full_name,
    mobile: lead.mobile,
    email: lead.email,
    city: lead.city,
    location: lead.location,
    property_type: lead.property_type,
    budget_min: lead.budget_min,
    budget_max: lead.budget_max,
    preferred_configuration: lead.preferred_configuration,
    source_id: lead.source_id,
    priority: lead.priority,
    requirements: lead.requirements,
    consent_whatsapp: lead.consent_whatsapp,
    status_id: lead.status_id,
    status_name:
      statuses.find((status) => status.id === lead.status_id)?.name ?? 'New',
    owner_name: lead.owner?.full_name ?? null,
    owner_id: lead.owner?._id?.toString() ?? null,
    next_follow_up_at: lead.next_follow_up_at?.toISOString() ?? null,
    created_at: lead.created_at?.toISOString() ?? null,
  }
}

function httpError(status, message) {
  const error = new Error(message)
  error.status = status
  return error
}

function canAssign(user) {
  return ['admin', 'team_lead'].includes(user.role)
}

async function visibleLeadFilter(user) {
  if (user.role === 'admin') {
    return {}
  }

  if (user.role === 'employee') {
    return { owner: user._id }
  }

  const teamMembers = await User.find({
    team_id: user.team_id,
    is_active: true,
  }).select('_id')

  return {
    $or: [
      { owner: user._id },
      { owner: { $in: teamMembers.map((member) => member._id) } },
    ],
  }
}

async function createLead(data, user) {
  const full_name = String(data.full_name ?? '').trim()
  const mobile = String(data.mobile ?? '').trim()

  if (!full_name || !mobile) {
    throw httpError(400, 'Full name and mobile are required.')
  }

  const priority = ['urgent', 'high', 'medium', 'low'].includes(
    data.priority,
  )
    ? data.priority
    : 'medium'

  const budgetMin =
    data.budget_min === '' || data.budget_min == null
      ? null
      : Number(data.budget_min)

  const budgetMax =
    data.budget_max === '' || data.budget_max == null
      ? null
      : Number(data.budget_max)

  if (
    (budgetMin !== null && !Number.isFinite(budgetMin)) ||
    (budgetMax !== null && !Number.isFinite(budgetMax))
  ) {
    throw httpError(400, 'Budget values must be valid numbers.')
  }

  const lead = await Lead.create({
    lead_code: `YH-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 6)
      .toUpperCase()}`,
    full_name,
    mobile,
    email: data.email ?? '',
    city: data.city ?? '',
    location: data.location ?? '',
    property_type: data.property_type ?? 'apartment',
    preferred_configuration: data.preferred_configuration ?? '2 BHK',
    budget_min: budgetMin,
    budget_max: budgetMax,
    source_id: Number(data.source_id) || 1,
    priority,
    requirements: data.requirements ?? '',
    consent_whatsapp:
      data.consent_whatsapp === true ||
      data.consent_whatsapp === 1 ||
      data.consent_whatsapp === '1' ||
      data.consent_whatsapp === 'true',
    status_id: Number(data.status_id) || 1,
    owner: user.role === 'employee' ? user._id : null,
    created_by: user._id,
  })

  return Lead.findById(lead._id).populate('owner', 'full_name')
}

// Get lead statuses and sources
leadsRouter.get('/meta', (req, res) => {
  res.json({
    success: true,
    data: { statuses, sources },
  })
})

// Get visible leads, with search, filters and unassigned queue support
leadsRouter.get('/', async (req, res, next) => {
  try {
    let filter

    if (req.query.unassigned === '1') {
      if (!canAssign(req.user)) {
        return res.status(403).json({
          success: false,
          error: 'Only Admins and Team Leads can view the assignment queue.',
        })
      }

      filter = { owner: null }
    } else {
      filter = await visibleLeadFilter(req.user)
    }

    if (req.query.status_id) {
      filter.status_id = Number(req.query.status_id)
    }

    if (req.query.priority) {
      filter.priority = req.query.priority
    }

    if (req.query.q) {
      const search = String(req.query.q).trim()

      filter.$and = [
        ...(filter.$and ?? []),
        {
          $or: [
            { full_name: { $regex: search, $options: 'i' } },
            { mobile: { $regex: search, $options: 'i' } },
            { lead_code: { $regex: search, $options: 'i' } },
            { city: { $regex: search, $options: 'i' } },
          ],
        },
      ]
    }

    const [leads, total] = await Promise.all([
      Lead.find(filter)
        .populate('owner', 'full_name')
        .sort({ created_at: -1 })
        .limit(500),
      Lead.countDocuments(filter),
    ])

    if (req.query.unassigned === '1' && req.query.sort === 'priority') {
      leads.sort(
        (a, b) =>
          (priorityRank[a.priority] ?? 99) -
            (priorityRank[b.priority] ?? 99) ||
          new Date(b.created_at ?? 0) - new Date(a.created_at ?? 0),
      )
    }

    return res.json({
      success: true,
      data: leads.map(serializeLead),
      meta: { total },
    })
  } catch (error) {
    next(error)
  }
})

// Assign one lead manually or automatically.
leadsRouter.post('/:id/assign', async (req, res, next) => {
  try {
    const user = req.user

    if (!canAssign(user)) {
      return res.status(403).json({
        success: false,
        error: 'Only Admins and Team Leads can assign leads.',
      })
    }

    const method = String(req.body?.method ?? 'round_robin')
    const employeeId = req.body?.employee_id

    if (!assignmentMethods.includes(method)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid assignment method.',
      })
    }

    const lead = await Lead.findById(req.params.id)

    if (!lead) {
      return res.status(404).json({
        success: false,
        error: 'Lead not found.',
      })
    }

    if (lead.owner) {
      return res.status(409).json({
        success: false,
        error: 'This lead has already been assigned. Refresh the queue.',
      })
    }

    // Team Leads may only assign leads visible within their team.
    if (user.role === 'team_lead') {
      const visibleFilter = await visibleLeadFilter(user)

      const isVisible = await Lead.exists({
        $and: [
          { _id: lead._id },
          visibleFilter,
        ],
      })

      if (!isVisible) {
        return res.status(403).json({
          success: false,
          error: 'This lead is outside your team.',
        })
      }
    }

    // Find active employees who are eligible for assignments.
    const employeeFilter = {
      role: 'employee',
      is_active: true,
      is_assignment_eligible: true,
    }

    if (user.role === 'team_lead') {
      if (!user.team_id) {
        return res.status(400).json({
          success: false,
          error: 'Your account is not assigned to a team.',
        })
      }

      employeeFilter.team_id = user.team_id
    }

    const employees = await User.find(employeeFilter)
      .select('_id full_name team_id assignment_weight max_open_leads')
      .sort({ _id: 1 })

    if (employees.length === 0) {
      return res.status(400).json({
        success: false,
        error:
          'No eligible active employees found. Add employees or enable assignment eligibility.',
      })
    }

    // Calculate the current assigned lead count for every employee.
    const workload = await Promise.all(
      employees.map(async (employee) => ({
        employee,
        count: await Lead.countDocuments({
          owner: employee._id,
        }),
      })),
    )

    // Exclude employees who have reached their configured lead limit.
    const available = workload.filter(({ employee, count }) => {
      const limit = Number.isFinite(employee.max_open_leads)
        ? employee.max_open_leads
        : 50

      return count < limit
    })

    if (available.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'All eligible employees have reached their lead limits.',
      })
    }

    let chosenEmployee

    if (method === 'manual') {
      if (!employeeId) {
        return res.status(400).json({
          success: false,
          error: 'Select an employee for manual assignment.',
        })
      }

      const selected = available.find(
        ({ employee }) =>
          employee._id.toString() === String(employeeId),
      )

      if (!selected) {
        return res.status(400).json({
          success: false,
          error:
            'Selected employee is inactive, ineligible, outside your team, or at their lead limit.',
        })
      }

      chosenEmployee = selected.employee
    } else if (method === 'round_robin') {
      // Rotate through employees who can accept more leads.
      const lastAssignedLead = await Lead.findOne({
        owner: {
          $in: available.map(({ employee }) => employee._id),
        },
      })
        .sort({ updated_at: -1, created_at: -1 })
        .select('owner')

      const lastOwnerId = lastAssignedLead?.owner?.toString()

      const lastIndex = available.findIndex(
        ({ employee }) => employee._id.toString() === lastOwnerId,
      )

      const nextIndex =
        lastIndex >= 0 ? (lastIndex + 1) % available.length : 0

      chosenEmployee = available[nextIndex].employee
    } else {
      // Workload and priority assignment choose the least-loaded employee.
      available.sort(
        (a, b) =>
          a.count - b.count ||
          (b.employee.assignment_weight ?? 1) -
            (a.employee.assignment_weight ?? 1) ||
          a.employee._id.toString().localeCompare(
            b.employee._id.toString(),
          ),
      )

      chosenEmployee = available[0].employee
    }

    if (!chosenEmployee) {
      return res.status(400).json({
        success: false,
        error: 'Unable to find an eligible employee.',
      })
    }

    // Assign only if the lead remains unassigned.
    const updated = await Lead.findOneAndUpdate(
      {
        _id: lead._id,
        $or: [
          { owner: null },
          { owner: { $exists: false } },
        ],
      },
      {
        $set: {
          owner: chosenEmployee._id,
        },
      },
      {
        new: true,
        runValidators: true,
      },
    ).populate('owner', 'full_name')

    if (!updated) {
      return res.status(409).json({
        success: false,
        error: 'This lead has already been assigned. Refresh the queue.',
      })
    }

    return res.json({
      success: true,
      message: 'Lead assigned successfully.',
      data: serializeLead(updated),
    })
  } catch (error) {
    next(error)
  }
})

// Create one lead
leadsRouter.post('/', async (req, res, next) => {
  try {
    const lead = await createLead(req.body, req.user)

    return res.status(201).json({
      success: true,
      data: serializeLead(lead),
    })
  } catch (error) {
    next(error)
  }
})

// Import leads from Excel/CSV records sent by the frontend
leadsRouter.post('/import', async (req, res, next) => {
  try {
    if (!['admin', 'team_lead'].includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: 'Only Admins and Team Leads can import leads.',
      })
    }

    const records = req.body?.records

    if (!Array.isArray(records) || records.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Provide a non-empty records array.',
      })
    }

    if (records.length > 1000) {
      return res.status(400).json({
        success: false,
        error: 'Import is limited to 1,000 records per request.',
      })
    }

    const imported = []
    const rejected = []
    const seen = new Set()

    for (let i = 0; i < records.length; i++) {
      const record = records[i] ?? {}
      const fullName = String(record.full_name ?? '').trim()
      const mobile = String(record.mobile ?? '').trim()
      const rowNumber = i + 2

      if (!fullName || !mobile) {
        rejected.push({
          row: rowNumber,
          reason: 'Name and mobile are required.',
        })
        continue
      }

      if (seen.has(mobile)) {
        rejected.push({
          row: rowNumber,
          reason: 'Duplicate mobile in this file.',
        })
        continue
      }

      seen.add(mobile)

      try {
        const existing = await Lead.findOne({ mobile })

        if (existing) {
          rejected.push({
            row: rowNumber,
            reason: 'Mobile already exists in CRM.',
          })
          continue
        }

        const lead = await createLead(record, req.user)
        imported.push(serializeLead(lead))
      } catch (error) {
        rejected.push({
          row: rowNumber,
          reason: error.message || 'Could not import this row.',
        })
      }
    }

    return res.status(200).json({
      success: true,
      data: {
        imported: imported.length,
        rejected,
        leads: imported,
      },
    })
  } catch (error) {
    next(error)
  }
})

// Export visible leads as CSV data
leadsRouter.get('/export', async (req, res, next) => {
  try {
    if (!['admin', 'team_lead'].includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: 'You do not have permission to export leads.',
      })
    }

    const filter = await visibleLeadFilter(req.user)

    const leads = await Lead.find(filter)
      .populate('owner', 'full_name')
      .sort({ created_at: -1 })

    const escapeCsv = (value) =>
      `"${String(value ?? '').replace(/"/g, '""')}"`

    const csv = [
      [
        'Code',
        'Name',
        'Mobile',
        'Email',
        'City',
        'Priority',
        'Status',
        'Owner',
      ],
      ...leads.map((lead) => {
        const row = serializeLead(lead)

        return [
          row.lead_code,
          row.full_name,
          row.mobile,
          row.email,
          row.city,
          row.priority,
          row.status_name,
          row.owner_name,
        ]
      }),
    ]
      .map((row) => row.map(escapeCsv).join(','))
      .join('\r\n')

    return res.json({
      success: true,
      data: { csv },
    })
  } catch (error) {
    next(error)
  }
})