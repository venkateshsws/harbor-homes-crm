
import mongoose from 'mongoose'
import { toUtcSql } from '../lib/format.js'

export const ROLES = [
  'super_admin',
  'admin',
  'team_lead',
  'employee',
]

export const ROLE_NAMES = {
  super_admin: 'Super Admin',
  admin: 'Admin',
  team_lead: 'Team Lead',
  employee: 'Employee',
}

const userSchema = new mongoose.Schema(
  {
    employee_code: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      unique: true,
    },

    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      unique: true,
      match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    },

    full_name: {
      type: String,
      required: true,
      trim: true,
    },

    phone: {
      type: String,
      trim: true,
      default: null,
    },

    role: {
      type: String,
      enum: ROLES,
      required: true,
    },

    // Company to which this employee belongs.
    // Super Admin accounts can leave this as null.
    company_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Company',
      default: null,
      index: true,
    },

    team_id: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },

    specialization: {
      type: String,
      trim: true,
      default: null,
    },

    assignment_weight: {
      type: Number,
      min: 0,
      default: 1,
    },

    max_open_leads: {
      type: Number,
      min: 0,
      default: 50,
    },

    is_assignment_eligible: {
      type: Boolean,
      default: true,
    },

    is_active: {
      type: Boolean,
      default: true,
    },

    last_login_at: {
      type: Date,
      default: null,
    },

    timezone: {
      type: String,
      default: 'Asia/Kolkata',
    },

    password_hash: {
      type: String,
      required: true,
      select: false,
    },
  },
  {
    timestamps: {
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    },
  },
)

userSchema.methods.toSessionUser = function toSessionUser() {
  return {
    id: this._id.toString(),
    employee_code: this.employee_code,
    email: this.email,
    full_name: this.full_name,
    phone: this.phone,
    role: this.role,
    role_name: ROLE_NAMES[this.role] || this.role,
    company_id: this.company_id
      ? this.company_id.toString()
      : null,
    team_id: this.team_id
      ? this.team_id.toString()
      : null,
    specialization: this.specialization,
    assignment_weight: this.assignment_weight,
    max_open_leads: this.max_open_leads,
    is_assignment_eligible: this.is_assignment_eligible,
    is_active: this.is_active,
    last_login_at: toUtcSql(this.last_login_at),
    timezone: this.timezone,
  }
}

export const User = mongoose.model('User', userSchema)
