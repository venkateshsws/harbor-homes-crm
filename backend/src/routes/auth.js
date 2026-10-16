import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import { env } from '../config/env.js'
import { verifyPassword } from '../lib/password.js'
import { hashToken, randomToken, requireAuth, SESSION_COOKIE } from '../middleware/auth.js'
import { Session } from '../models/Session.js'
import { User } from '../models/User.js'

const INVALID_LOGIN = 'Invalid email, employee ID, or password.'

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  skipSuccessfulRequests: true,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  handler: (req, res, next, options) => {
    res.status(options.statusCode).json({ success: false, error: 'Too many sign-in attempts. Try again in 15 minutes.' })
  },
})

function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: env.nodeEnv === 'production',
    path: '/',
  }
}

export const authRouter = Router()

authRouter.post('/login', loginLimiter, async (req, res) => {
  const { identifier, password } = req.body ?? {}
  if (typeof identifier !== 'string' || typeof password !== 'string' || !identifier.trim() || !password) {
    return res.status(400).json({ success: false, error: 'Enter your email or employee ID and password.' })
  }

  const id = identifier.trim()
  const user = await User.findOne({ $or: [{ email: id.toLowerCase() }, { employee_code: id.toUpperCase() }] }).select('+password_hash')
  const valid = await verifyPassword(password, user?.password_hash)
  if (!user || !valid) return res.status(401).json({ success: false, error: INVALID_LOGIN })
  if (!user.is_active) {
    return res.status(403).json({ success: false, error: 'This account has been deactivated. Contact your administrator.' })
  }

  if (req.authSession) await req.authSession.deleteOne()
  const token = randomToken()
  const ttlMs = env.sessionTtlHours * 60 * 60 * 1000
  const session = await Session.create({
    token_hash: hashToken(token),
    user: user._id,
    csrf_token: randomToken(24),
    expires_at: new Date(Date.now() + ttlMs),
    ip: req.ip || null,
    user_agent: req.get('user-agent')?.slice(0, 300) || null,
  })

  user.last_login_at = new Date()
  await User.updateOne({ _id: user._id }, { $set: { last_login_at: user.last_login_at } })

  res.cookie(SESSION_COOKIE, token, { ...cookieOptions(), maxAge: ttlMs })
  res.json({ success: true, data: { user: user.toSessionUser(), csrf_token: session.csrf_token } })
})

authRouter.get('/me', requireAuth, (req, res) => {
  res.json({ success: true, data: { user: req.user.toSessionUser(), csrf_token: req.authSession.csrf_token } })
})

authRouter.post('/logout', async (req, res) => {
  if (req.authSession) await req.authSession.deleteOne()
  res.clearCookie(SESSION_COOKIE, cookieOptions())
  res.json({ success: true, data: {} })
})
