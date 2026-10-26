
import { Router } from 'express'
import mongoose from 'mongoose'
import { Company } from '../models/Company.js'
import { User } from '../models/User.js'
import { requireAuth, requireRole } from '../middleware/auth.js'

export const companiesRouter = Router()

companiesRouter.use(requireAuth)
companiesRouter.use(requireRole('super_admin'))

// GET /api/companies
companiesRouter.get('/', async (req, res, next) => {
  try {
    const companies = await Company.find()
      .sort({ created_at: -1 })
      .lean()

    const companyIds = companies.map((company) => company._id)

    const employeeCounts = await User.aggregate([
      {
        $match: {
          company_id: { $in: companyIds },
          role: 'employee',
        },
      },
      {
        $group: {
          _id: '$company_id',
          count: { $sum: 1 },
        },
      },
    ])

    const countMap = new Map(
      employeeCounts.map((item) => [
        item._id.toString(),
        item.count,
      ]),
    )

    return res.json({
      success: true,
      data: {
        companies: companies.map((company) => ({
          id: company._id.toString(),
          name: company.name,
          code: company.code,
          admin_name: company.admin_name || '',
          admin_email: company.admin_email || '',
          employees: countMap.get(company._id.toString()) || 0,
          leads: 0,
          is_active: company.is_active !== false,
          status: company.is_active === false ? 'Inactive' : 'Active',
          created_at: company.created_at,
        })),
      },
    })
  } catch (error) {
    next(error)
  }
})

// POST /api/companies
companiesRouter.post('/', async (req, res, next) => {
  try {
    const { name, admin_name, admin_email } = req.body

    if (
      typeof name !== 'string' ||
      !name.trim() ||
      typeof admin_name !== 'string' ||
      !admin_name.trim() ||
      typeof admin_email !== 'string' ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(admin_email.trim())
    ) {
      return res.status(400).json({
        success: false,
        error: 'Enter a company name, admin name, and valid admin email.',
      })
    }

    const company = await Company.create({
      name: name.trim(),
      admin_name: admin_name.trim(),
      admin_email: admin_email.trim().toLowerCase(),
      code: `YCR-${new mongoose.Types.ObjectId()
        .toString()
        .slice(-6)
        .toUpperCase()}`,
      is_active: true,
    })

    return res.status(201).json({
      success: true,
      data: {
        company: {
          id: company._id.toString(),
          name: company.name,
          code: company.code,
          admin_name: company.admin_name,
          admin_email: company.admin_email,
          employees: 0,
          leads: 0,
          status: 'Active',
          is_active: true,
          created_at: company.created_at,
        },
      },
    })
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        error: 'A company with this unique value already exists.',
      })
    }

    next(error)
  }
})

// PATCH /api/companies/:id/status
companiesRouter.patch('/:id/status', async (req, res, next) => {
  try {
    const { id } = req.params
    const { is_active } = req.body

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid company ID.',
      })
    }

    if (typeof is_active !== 'boolean') {
      return res.status(400).json({
        success: false,
        error: 'is_active must be true or false.',
      })
    }

    const company = await Company.findByIdAndUpdate(
      id,
      { $set: { is_active } },
      { new: true, runValidators: true },
    )

    if (!company) {
      return res.status(404).json({
        success: false,
        error: 'Company not found.',
      })
    }

    return res.json({
      success: true,
      data: {
        id: company._id.toString(),
        is_active: company.is_active,
        status: company.is_active ? 'Active' : 'Inactive',
      },
    })
  } catch (error) {
    next(error)
  }
})
