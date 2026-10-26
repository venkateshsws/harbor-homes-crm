
import mongoose from 'mongoose'

const campaignStepSchema = new mongoose.Schema(
  {
    step_number: {
      type: Number,
      required: true,
      min: 1,
    },
    delay_minutes: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    template_name: {
      type: String,
      required: true,
      trim: true,
    },
    language_code: {
      type: String,
      trim: true,
      default: 'en',
    },
    is_active: {
      type: Boolean,
      default: true,
    },
  },
  { _id: true },
)

const dripCampaignSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    description: {
      type: String,
      trim: true,
      default: '',
      maxlength: 1000,
    },
    trigger: {
      type: String,
      enum: ['manual', 'new_lead', 'status_change'],
      default: 'manual',
      required: true,
    },
    trigger_status_id: {
      type: Number,
      default: null,
    },
    steps: {
      type: [campaignStepSchema],
      default: [],
    },
    status: {
      type: String,
      enum: ['draft', 'active', 'paused', 'archived'],
      default: 'draft',
      index: true,
    },
    created_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    // Optional company ownership for multi-company CRM support.
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

dripCampaignSchema.index({ status: 1, trigger: 1 })

export const DripCampaign = mongoose.model(
  'DripCampaign',
  dripCampaignSchema,
)
