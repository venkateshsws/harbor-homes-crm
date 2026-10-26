
import mongoose from 'mongoose'

const leadSchema = new mongoose.Schema(
  {
    lead_code: { type: String, required: true, unique: true, index: true },
    full_name: { type: String, required: true, trim: true },
    mobile: { type: String, required: true, trim: true, index: true },
    email: { type: String, trim: true, lowercase: true, default: '' },
    city: { type: String, trim: true, default: '' },
    location: { type: String, trim: true, default: '' },
    property_type: {
      type: String,
      enum: ['apartment', 'villa', 'plot', 'commercial', 'other'],
      default: 'apartment',
    },
    budget_min: { type: Number, default: null },
    budget_max: { type: Number, default: null },
    preferred_configuration: { type: String, default: '2 BHK' },
    source_id: { type: Number, default: 1 },
    priority: {
      type: String,
      enum: ['urgent', 'high', 'medium', 'low'],
      default: 'medium',
    },
    requirements: { type: String, default: '' },
    consent_whatsapp: { type: Boolean, default: false },
    status_id: { type: Number, default: 1 },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    created_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    next_follow_up_at: { type: Date, default: null },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } },
)

leadSchema.index({ mobile: 1, created_by: 1 })

export const Lead = mongoose.model('Lead', leadSchema)
