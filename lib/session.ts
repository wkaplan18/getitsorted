import crypto from 'crypto'
import { NextRequest } from 'next/server'

// User dashboard sessions — issued by /api/auth after WhatsApp OTP verification,
// required (Bearer header) by every user-facing API route. Same HMAC pattern as
// the admin token in /api/admin.
const SECRET = process.env.CRON_SECRET || 'sorted-admin-fallback-secret'
const REMEMBER_TTL_MS = 365 * 24 * 60 * 60 * 1000 // "keep me logged in" — 1 year
const SHORT_TTL_MS = 24 * 60 * 60 * 1000 // unticked — backstop for the browser-session storage

function sign(payload: string) {
  return crypto.createHmac('sha256', SECRET).update(payload).digest('hex')
}

export function makeSessionToken(phone: string, remember = true): string {
  const ttl = remember ? REMEMBER_TTL_MS : SHORT_TTL_MS
  const payload = `${phone}:${Date.now() + ttl}`
  return `${payload}:${sign(payload)}`
}

// Returns the phone number the session was issued for, or null if the request
// has no valid unexpired token. Routes must use this phone — never one supplied
// by the client — to look up the user.
export function sessionPhone(req: NextRequest): string | null {
  const auth = req.headers.get('authorization')
  const token = auth?.startsWith('Bearer ') ? auth.slice(7) : null
  if (!token) return null

  const parts = token.split(':')
  if (parts.length !== 3) return null
  const [phone, exp, sig] = parts

  const expected = sign(`${phone}:${exp}`)
  if (sig.length !== expected.length) return null
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null
  if (Date.now() >= Number(exp)) return null

  return phone
}
