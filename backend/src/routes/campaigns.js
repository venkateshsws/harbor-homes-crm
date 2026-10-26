
import express from 'express'
import mongoose from 'mongoose'
import { requireAuth } from '../middleware/auth.js'
import { DripCampaign } from '../models/DripCampaign.js'
import { DripEnrollment } from '../models/DripEnrollment.js'
import { Lead } from '../models/Lead.js'
import { User } from '../models/User.js'

export const campaignsRouter = express.Router()

campaignsRouter.use(requireAuth)

const MANAGER_ROLES = ['super_admin', 'admin']

function requireCampaignManager(req, res, next) {
  if (!MANAGER_ROLES.includes(req.user?.role)) {
    return res.status(403).json({
      success: false,
      error: 'Only Admins can manage drip campaigns.',
    })
  }
  next()
}

function getCompanyId(user) {
  return user.company_id ? String(user.company_id) : null
}

function campaignScope(user) {
  if (user.role === 'super_admin') return {}

  const companyId = getCompanyId(user)
  if (!companyId) return { created_by: user._id }

  return {
    $or: [
      { company_id: user.company_id },
      { created_by: user._id, company_id: null },
    ],
  }
}

function validObjectId(value) {
  return mongoose.isValidObjectId(value)
}

function validateSteps(steps) {
  if (!Array.isArray(steps) || steps.length === 0) {
    return 'Add at least one message step.'
  }

  if (steps.length > 20) {
    return 'A campaign can have at most 20 steps.'
  }

  for (let i = 0; i < steps.length; i += 1) {
    const step = steps[i] ?? {}
    const delay = Number(step.delay_minutes)

    if (
      !Number.isInteger(delay) ||
      delay < 0 ||
      delay > 525600
    ) {
      return `Step ${i + 1} must have a valid delay in minutes.`
    }

    if (
      typeof step.template_name !== 'string' ||
      !/^[a-zA-Z0-9_]+$/.test(step.template_name.trim())
    ) {
      return `Step ${i + 1} must have a valid WhatsApp template name.`
    }

    if (
      step.language_code != null &&
      !/^[a-z]{2,3}(?:_[A-Z]{2})?$/.test(step.language_code)
    ) {
      return `Step ${i + 1} has an invalid language code.`
    }
  }

  return null
}

function normalizeSteps(steps) {
  return steps.map((step, index) => ({
    step_number: index + 1,
    delay_minutes: Number(step.delay_minutes),
    template_name: step.template_name.trim(),
    language_code: step.language_code || 'en',
    is_active: step.is_active !== false,
  }))
}

// GET /api/campaigns
campaignsRouter.get('/', async (req, res, next) => {
  try {
    if (!MANAGER_ROLES.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: 'You cannot view campaign management.',
      })
    }

    const campaigns = await DripCampaign.find(campaignScope(req.user))
      .sort({ updated_at: -1 })
      .lean()

    return res.json({ success: true, data: campaigns })
  } catch (error) {
    next(error)
  }
})

// GET /api/campaigns/:id
campaignsRouter.get('/:id', async (req, res, next) => {
  try {
    if (!validObjectId(req.params.id)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid campaign ID.',
      })
    }

    const campaign = await DripCampaign.findOne({
      _id: req.params.id,
      ...campaignScope(req.user),
    }).lean()

    if (!campaign) {
      return res.status(404).json({
        success: false,
        error: 'Campaign not found.',
      })
    }

    return res.json({ success: true, data: campaign })
  } catch (error) {
    next(error)
  }
})

// POST /api/campaigns
campaignsRouter.post('/', requireCampaignManager, async (req, res, next) => {
  try {
    const name = String(req.body?.name ?? '').trim()
    const description = String(req.body?.description ?? '')
    const trigger = req.body?.trigger ?? 'manual'
    const steps = req.body?.steps
    const triggerStatus =
      req.body?.trigger_status_id == null ||
      req.body.trigger_status_id === ''
        ? null
        : Number(req.body.trigger_status_id)

    if (!name) {
      return res.status(400).json({
        success: false,
        error: 'Campaign name is required.',
      })
    }

    if (name.length > 120 || description.length > 1000) {
      return res.status(400).json({
        success: false,
        error: 'Campaign name or description is too long.',
      })
    }

    if (!['manual', 'new_lead', 'status_change'].includes(trigger)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid campaign trigger.',
      })
    }

    if (
      trigger === 'status_change' &&
      (!Number.isInteger(triggerStatus) || triggerStatus < 1 || triggerStatus > 5)
    ) {
      return res.status(400).json({
        success: false,
        error: 'Choose a valid lead status for this trigger.',
      })
    }

    const stepsError = validateSteps(steps)
    if (stepsError) {
      return res.status(400).json({
        success: false,
        error: stepsError,
      })
    }

    const campaign = await DripCampaign.create({
      name,
      description,
      trigger,
      trigger_status_id: triggerStatus,
      steps: normalizeSteps(steps),
      status: 'draft',
      created_by: req.user._id,
      company_id: req.user.company_id ?? null,
    })

    return res.status(201).json({
      success: true,
      data: campaign,
      message: 'Campaign created in draft mode. No WhatsApp messages were sent.',
    })
  } catch (error) {
    next(error)
  }
})

// PATCH /api/campaigns/:id
campaignsRouter.patch('/:id', requireCampaignManager, async (req, res, next) => {
  try {
    if (!validObjectId(req.params.id)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid campaign ID.',
      })
    }

    const campaign = await DripCampaign.findOne({
      _id: req.params.id,
      ...campaignScope(req.user),
    })

    if (!campaign) {
      return res.status(404).json({
        success: false,
        error: 'Campaign not found.',
      })
    }

    if (campaign.status === 'active') {
      return res.status(409).json({
        success: false,
        error: 'Pause the campaign before editing it.',
      })
    }

    const updates = req.body ?? {}

    if (updates.name !== undefined) {
      const name = String(updates.name).trim()
      if (!name || name.length > 120) {
        return res.status(400).json({
          success: false,
          error: 'Campaign name is required and must be under 120 characters.',
        })
      }
      campaign.name = name
    }

    if (updates.description !== undefined) {
      const description = String(updates.description)
      if (description.length > 1000) {
        return res.status(400).json({
          success: false,
          error: 'Description must be under 1,000 characters.',
        })
      }
      campaign.description = description
    }

    if (updates.trigger !== undefined) {
      if (!['manual', 'new_lead', 'status_change'].includes(updates.trigger)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid campaign trigger.',
        })
      }
      campaign.trigger = updates.trigger
    }

    if (updates.trigger_status_id !== undefined) {
      const value =
        updates.trigger_status_id === null || updates.trigger_status_id === ''
          ? null
          : Number(updates.trigger_status_id)

      if (
        campaign.trigger === 'status_change' &&
        (!Number.isInteger(value) || value < 1 || value > 5)
      ) {
        return res.status(400).json({
          success: false,
          error: 'Choose a valid lead status for this trigger.',
        })
      }

      campaign.trigger_status_id = value
    }

    if (updates.steps !== undefined) {
      const stepsError = validateSteps(updates.steps)
      if (stepsError) {
        return res.status(400).json({
          success: false,
          error: stepsError,
        })
      }
      campaign.steps = normalizeSteps(updates.steps)
    }

    await campaign.save()

    return res.json({
      success: true,
      data: campaign,
      message: 'Campaign updated.',
    })
  } catch (error) {
    next(error)
  }
})

// POST /api/campaigns/:id/activate
// Activation only enables campaign configuration.
// It does not send messages or enroll leads yet.
campaignsRouter.post('/:id/activate', requireCampaignManager, async (req, res, next) => {
  try {
    if (!validObjectId(req.params.id)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid campaign ID.',
      })
    }

    const campaign = await DripCampaign.findOne({
      _id: req.params.id,
      ...campaignScope(req.user),
    })

    if (!campaign) {
      return res.status(404).json({
        success: false,
        error: 'Campaign not found.',
      })
    }

    if (!campaign.steps.some((step) => step.is_active)) {
      return res.status(400).json({
        success: false,
        error: 'Add at least one active message step before activation.',
      })
    }

    campaign.status = 'active'
    await campaign.save()

    return res.json({
      success: true,
      data: campaign,
      message: 'Campaign activated in configuration-only mode. Sending is not enabled.',
    })
  } catch (error) {
    next(error)
  }
})

// POST /api/campaigns/:id/pause
campaignsRouter.post('/:id/pause', requireCampaignManager, async (req, res, next) => {
  try {
    if (!validObjectId(req.params.id)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid campaign ID.',
      })
    }

    const campaign = await DripCampaign.findOne({
      _id: req.params.id,
      ...campaignScope(req.user),
    })

    if (!campaign) {
      return res.status(404).json({
        success: false,
        error: 'Campaign not found.',
      })
    }

    campaign.status = 'paused'
    await campaign.save()

    return res.json({
      success: true,
      data: campaign,
      message: 'Campaign paused. No new messages will be sent.',
    })
  } catch (error) {
    next(error)
  }
})

// POST /api/campaigns/:id/enroll
// Enrollment is recorded only; this route does not send WhatsApp messages.
campaignsRouter.post('/:id/enroll', requireCampaignManager, async (req, res, next) => {
  try {
    if (!validObjectId(req.params.id)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid campaign ID.',
      })
    }

    const leadIds = req.body?.lead_ids
    if (
      !Array.isArray(leadIds) ||
      leadIds.length === 0 ||
      leadIds.length > 100
    ) {
      return res.status(400).json({
        success: false,
        error: 'Provide between 1 and 100 lead IDs.',
      })
    }

    if (!leadIds.every(validObjectId)) {
      return res.status(400).json({
        success: false,
        error: 'One or more lead IDs are invalid.',
      })
    }

    const campaign = await DripCampaign.findOne({
      _id: req.params.id,
      ...campaignScope(req.user),
    })

    if (!campaign) {
      return res.status(404).json({
        success: false,
        error: 'Campaign not found.',
      })
    }

    if (campaign.status !== 'active') {
      return res.status(409).json({
        success: false,
        error: 'Activate the campaign before enrolling leads.',
      })
    }

    const uniqueIds = [...new Set(leadIds.map(String))]
    const leads = await Lead.find({
      _id: { $in: uniqueIds },
      consent_whatsapp: true,
    }).select('_id full_name mobile status_id owner created_by')

    const foundIds = new Set(leads.map((lead) => String(lead._id)))

    const inaccessible = uniqueIds.filter((id) => !foundIds.has(id))
    if (inaccessible.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'Some leads do not exist or have not granted WhatsApp consent.',
        rejected_lead_ids: inaccessible,
      })
    }

    // Match the current CRM visibility model.
    if (req.user.role === 'employee') {
      return res.status(403).json({
        success: false,
        error: 'Employees cannot enroll leads in campaigns.',
      })
    }

    if (req.user.role === 'team_lead') {
      return res.status(403).json({
        success: false,
        error: 'Team Leads cannot enroll leads in campaigns.',
      })
    }

    const now = new Date()
    const firstStep = campaign.steps
      .filter((step) => step.is_active)
      .sort((a, b) => a.step_number - b.step_number)[0]

    if (!firstStep) {
      return res.status(400).json({
        success: false,
        error: 'This campaign has no active message steps.',
      })
    }

    const results = []

    for (const lead of leads) {
      const existing = await DripEnrollment.findOne({
        campaign: campaign._id,
        lead: lead._id,
      })

      if (existing) {
        results.push({
          lead_id: String(lead._id),
          status: 'already_enrolled',
        })
        continue
      }

      try {
        await DripEnrollment.create({
          campaign: campaign._id,
          lead: lead._id,
          current_step: firstStep.step_number,
          status: 'active',
          next_message_at: new Date(
            now.getTime() + firstStep.delay_minutes * 60 * 1000,
          ),
          enrolled_by: req.user._id,
          company_id: req.user.company_id ?? null,
        })

        results.push({
          lead_id: String(lead._id),
          status: 'enrolled_test_mode',
        })
      } catch (error) {
        if (error.code === 11000) {
          results.push({
            lead_id: String(lead._id),
            status: 'already_enrolled',
          })
        } else {
          throw error
        }
      }
    }

    return res.status(201).json({
      success: true,
      data: results,
      message: 'Enrollments recorded. WhatsApp sending is not enabled.',
    })
  } catch (error) {
    next(error)
  }
})

// GET /api/campaigns/:id/enrollments
campaignsRouter.get('/:id/enrollments', async (req, res, next) => {
  try {
    if (!validObjectId(req.params.id)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid campaign ID.',
      })
    }

    if (!MANAGER_ROLES.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: 'You cannot view campaign enrollments.',
      })
    }

    const campaign = await DripCampaign.findOne({
      _id: req.params.id,
      ...campaignScope(req.user),
    }).select('_id')

    if (!campaign) {
      return res.status(404).json({
        success: false,
        error: 'Campaign not found.',
      })
    }

    const enrollments = await DripEnrollment.find({
      campaign: campaign._id,
      ...(req.user.role === 'super_admin'
        ? {}
        : { company_id: req.user.company_id ?? null }),
    })
      .populate('lead', 'full_name mobile lead_code status_id')
      .sort({ created_at: -1 })
      .limit(500)
      .lean()

    return res.json({ success: true, data: enrollments })
  } catch (error) {
    next(error)
  }
})
