import crypto from 'node:crypto'
import { promisify } from 'node:util'

const scrypt = promisify(crypto.scrypt)
const PARAMS = { N: 2 ** 15, r: 8, p: 1, maxmem: 64 * 1024 * 1024 }
const KEY_LENGTH = 64

export const MIN_PASSWORD_LENGTH = 10

export async function hashPassword(password) {
  const salt = crypto.randomBytes(16)
  const key = await scrypt(password, salt, KEY_LENGTH, PARAMS)
  return ['scrypt', PARAMS.N, PARAMS.r, PARAMS.p, salt.toString('base64'), key.toString('base64')].join('$')
}

let dummyHash
// Unknown accounts are checked against a throwaway hash so the response time
// doesn't reveal whether an email or employee ID exists.
export async function verifyPassword(password, stored) {
  if (!stored) {
    dummyHash ??= await hashPassword(crypto.randomBytes(16).toString('hex'))
    await verifyPassword(String(password), dummyHash)
    return false
  }
  const [scheme, N, r, p, saltB64, keyB64] = String(stored).split('$')
  if (scheme !== 'scrypt' || !saltB64 || !keyB64) return false
  const expected = Buffer.from(keyB64, 'base64')
  const actual = await scrypt(String(password), Buffer.from(saltB64, 'base64'), expected.length, {
    N: Number(N),
    r: Number(r),
    p: Number(p),
    maxmem: PARAMS.maxmem,
  })
  return crypto.timingSafeEqual(actual, expected)
}

export function passwordProblem(password) {
  if (typeof password !== 'string' || password.length < MIN_PASSWORD_LENGTH) {
    return `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`
  }
  if (password.length > 200) return 'Password must be at most 200 characters.'
  return null
}
