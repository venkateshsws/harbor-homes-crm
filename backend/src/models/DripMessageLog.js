
import mongoose from 'mongoose'

const dripMessageLogSchema = new mongoose.Schema(
  {
    campaign: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'DripCampaign',
      required: true,
      index: true,
    },
    enrollment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'DripEnrollment',
      required: true,
      index: true,
    },
    lead: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Lead',
      required: true,
      index: true,
    },
    step_id: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },
    recipient_phone: {
      type: String,
      required: true,
      trim: true,
    },
    template_name: {
      type: String,
      required: true,
      trim: true,
    },
    status: {
      type: String,
      enum: [
        'queued',
        'processing',
        'sent',
        'delivered',
        'read',
        'failed',
        'skipped',
      ],
      default: 'queued',
      index: true,
    },
    provider_message_id: {
      type: String,
      default: null,
      index: true,
    },
    attempt_count: {
      type: Number,
      default: 0,
      min: 0,
    },
    last_error: {
      type: String,
      default: '',
      maxlength: 2000,
    },
    scheduled_at: {
      type: Date,
      required: true,
      index: true,
    },
    sent_at: {
      type: Date,
      default: null,
    },
    delivered_at: {
      type: Date,
      default: null,
    },
    read_at: {
      type: Date,
      default: null,
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

// Avoid creating duplicate logs for the same step of an enrollment.
dripMessageLogSchema.index(
  { enrollment: 1, step_id: 1 },
  { unique: true },
)

dripMessageLogSchema.index({
  status: 1,
  scheduled_at: 1,
})

export const DripMessageLog = mongoose.model(
  'DripMessageLog',
  dripMessageLogSchema,
)
