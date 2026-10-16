import mongoose from 'mongoose'

const sessionSchema = new mongoose.Schema(
  {
    // SHA-256 of the cookie token; the raw token is never stored.
    token_hash: { type: String, required: true, unique: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    csrf_token: { type: String, required: true },
    expires_at: { type: Date, required: true },
    ip: { type: String, default: null },
    user_agent: { type: String, default: null },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: false } },
)

sessionSchema.index({ expires_at: 1 }, { expireAfterSeconds: 0 })

export const Session = mongoose.model('Session', sessionSchema)
