
import express from 'express'
import { User } from '../models/User.js'
import { requireAuth } from '../middleware/auth.js'
import { hashPassword } from '../lib/password.js'

export const usersRouter = express.Router()

// Only Super Admin can create or manage employee accounts.
function requireSuperAdmin(req, res, next) {
  if (req.user?.role !== 'super_admin') {
    return res.status(403).json({
      success: false,
      error: 'Only Super Admin can manage employee accounts',
    })
  }

  next()
}

// GET /api/users
// Super Admin can view all users.
// Admin can view employee details for their company.
// Team Lead can view employees assigned to their team.
usersRouter.get('/', requireAuth, async (req, res, next) => {
  try {
    const role = req.user?.role
    let filter = {}

    if (role === 'super_admin') {
      // Super Admin can view all users.
      filter = {}
    } else if (role === 'admin') {
      // Admin can view employees, but cannot manage accounts.
      // If company_id is available, restrict results to that company.
      filter = { role: 'employee' }

      if (req.user.company_id) {
        filter.company_id = req.user.company_id
      }
    } else if (role === 'team_lead') {
      // Team Lead can view only employees in their team.
      if (!req.user.team_id) {
        return res.json({
          success: true,
          users: [],
        })
      }

      filter = {
        role: 'employee',
        team_id: req.user.team_id,
      }
    } else {
      return res.status(403).json({
        success: false,
        error: 'You do not have permission to view employee details',
      })
    }

    const users = await User.find(filter)
      .select('-password_hash')
      .sort({ created_at: -1 })

    return res.json({
      success: true,
      users: users.map((user) => user.toSessionUser()),
    })
  } catch (error) {
    next(error)
  }
})

// POST /api/users
// Only Super Admin can create an employee account.
usersRouter.post('/', requireAuth, requireSuperAdmin, async (req, res, next) => {
  try {
    const {
      employee_code,
      email,
      full_name,
      phone = '',
      password,
      team_id,
      specialization = '',
      assignment_weight = 1,
      max_open_leads = 50,
    } = req.body ?? {}

    if (
      !employee_code?.trim() ||
      !email?.trim() ||
      !full_name?.trim() ||
      !password
    ) {
      return res.status(400).json({
        success: false,
        error: 'Employee code, email, full name and password are required',
      })
    }

    if (password.length < 8) {
      return res.status(400).json({
        success: false,
        error: 'Password must contain at least 8 characters',
      })
    }

    const normalizedCode = employee_code.trim().toUpperCase()
    const normalizedEmail = email.trim().toLowerCase()

    const existingUser = await User.findOne({
      $or: [
        { employee_code: normalizedCode },
        { email: normalizedEmail },
      ],
    })

    if (existingUser) {
      return res.status(409).json({
        success: false,
        error: 'An account with this employee code or email already exists',
      })
    }

    const numericWeight = Number(assignment_weight)
    const numericMaxLeads = Number(max_open_leads)

    if (
      !Number.isFinite(numericWeight) ||
      numericWeight < 1 ||
      !Number.isInteger(numericMaxLeads) ||
      numericMaxLeads < 1
    ) {
      return res.status(400).json({
        success: false,
        error: 'Assignment weight and maximum open leads must be valid positive numbers',
      })
    }

    const userData = {
      employee_code: normalizedCode,
      email: normalizedEmail,
      full_name: full_name.trim(),
      phone: phone.trim(),
      role: 'employee',
      specialization: specialization.trim(),
      assignment_weight: numericWeight,
      max_open_leads: numericMaxLeads,
      is_assignment_eligible: true,
      is_active: true,
      password_hash: await hashPassword(password),
    }

    if (team_id) {
      userData.team_id = team_id
    }

    const user = await User.create(userData)

    return res.status(201).json({
      success: true,
      message: 'Employee account created successfully',
      user: user.toSessionUser(),
    })
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        error: 'Employee code or email already exists',
      })
    }

    next(error)
  }
})
