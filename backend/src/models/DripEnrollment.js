
import mongoose from 'mongoose'

const dripEnrollmentSchema = new mongoose.Schema(
  {
    campaign: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'DripCampaign',
      required: true,
      index: true,
    },
    lead: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Lead',
      required: true,
      index: true,
    },
    current_step: {
      type: Number,
      default: 1,
      min: 1,
    },
    status: {
      type: String,
      enum: [
        'active',
        'paused',
        'completed',
        'stopped',
        'failed',
      ],
      default: 'active',
      index: true,
    },
    next_message_at: {
      type: Date,
      default: null,
      index: true,
    },
    enrolled_at: {
      type: Date,
      default: Date.now,
    },
    completed_at: {
      type: Date,
      default: null,
    },
    stopped_reason: {
      type: String,
      default: '',
      maxlength: 500,
    },
    enrolled_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    company_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Company',
      default: null,
      index: true,
    },
  },
  {
    timestamps: {
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    },
  },
)

// Prevent the same lead from being enrolled in the same campaign twice.
dripEnrollmentSchema.index(
  { campaign: 1, lead: 1 },
  { unique: true },
)

// Efficiently find due messages.
dripEnrollmentSchema.index({
  status: 1,
  next_message_at: 1,
})

export const DripEnrollment = mongoose.model(
  'DripEnrollment',
  dripEnrollmentSchema,
)
