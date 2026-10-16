import crypto from 'node:crypto'
import { Session } from '../models/Session.js'
import { User } from '../models/User.js'

export const SESSION_COOKIE = 'hh_session'
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])

export const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex')
export const randomToken = (bytes = 32) => crypto.randomBytes(bytes).toString('base64url')

function readCookie(req, name) {
  const header = req.headers.cookie || ''
  const match = header.split(';').map((part) => part.trim()).find((part) => part.startsWith(`${name}=`))
  if (!match) return ''
  try {
    return decodeURIComponent(match.slice(name.length + 1))
  } catch {
    return ''
  }
}

function safeEqual(a, b) {
  const x = Buffer.from(String(a))
  const y = Buffer.from(String(b))
  return x.length === y.length && crypto.timingSafeEqual(x, y)
}

export async function loadSession(req, res, next) {
  const token = readCookie(req, SESSION_COOKIE)
  if (!token) return next()
  const session = await Session.findOne({ token_hash: hashToken(token), expires_at: { $gt: new Date() } })
  if (!session) return next()
  const user = await User.findById(session.user)
  if (!user || !user.is_active) {
    await session.deleteOne()
    return next()
  }
  req.authSession = session
  req.user = user
  next()
}

// Signed-in requests that change data must echo the session's CSRF token
// (the frontend sends it as X-CSRF-Token). Login is exempt so a stale
// session never blocks signing in again.
export function verifyCsrf(req, res, next) {
  if (SAFE_METHODS.has(req.method) || !req.authSession || req.path === '/auth/login') return next()
  if (!safeEqual(req.get('x-csrf-token') || '', req.authSession.csrf_token)) {
    return res.status(403).json({ success: false, error: 'Invalid or missing CSRF token. Refresh the page and try again.' })
  }
  next()
}

export function requireAuth(req, res, next) {
  if (!req.user) return res.status(401).json({ success: false, error: 'Sign in required.' })
  next()
}

export const requireRole = (...roles) => (req, res, next) => {
  if (!req.user) return res.status(401).json({ success: false, error: 'Sign in required.' })
  if (!roles.includes(req.user.role)) {
    return res.status(403).json({ success: false, error: 'You do not have permission to do this.' })
  }
  next()
}
