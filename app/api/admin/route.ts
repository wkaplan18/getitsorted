import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { supabaseAdmin } from '@/lib/supabase'

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'warren@kaplan.co.za'
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'password'
const SECRET = process.env.CRON_SECRET || 'sorted-admin-fallback-secret'
const TOKEN_TTL_MS = 12 * 60 * 60 * 1000 // 12 hours

function sign(payload: string) {
  return crypto.createHmac('sha256', SECRET).update(payload).digest('hex')
}

function makeToken() {
  const payload = `admin:${Date.now() + TOKEN_TTL_MS}`
  return `${payload}:${sign(payload)}`
}

function verifyToken(token: string | null) {
  if (!token) return false
  const parts = token.split(':')
  if (parts.length !== 3) return false
  const [label, exp, sig] = parts
  if (sign(`${label}:${exp}`) !== sig) return false
  return Date.now() < Number(exp)
}

// POST /api/admin { email, password } — log in, returns a session token
export async function POST(req: NextRequest) {
  const { email, password } = await req.json()
  if (email !== ADMIN_EMAIL || password !== ADMIN_PASSWORD) {
    return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 })
  }
  return NextResponse.json({ token: makeToken() })
}

// GET /api/admin — registered users + invoice counts (requires Bearer token from POST above)
// GET /api/admin?userId=<id> — that user's invoices, with resolved sender info
export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization')
  const token = auth?.startsWith('Bearer ') ? auth.slice(7) : null
  if (!verifyToken(token)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const userId = req.nextUrl.searchParams.get('userId')
  if (userId) return getUserDetail(userId)

  const [
    { data: users, error: usersError },
    { data: bills, error: billsError },
    { data: quotes, error: quotesError },
  ] = await Promise.all([
    supabaseAdmin
      .from('users')
      .select('id, whatsapp_number, name, whatsapp_profile_name, business_name, trade, logo_url, vat_number, language, onboarded_at, created_at')
      .order('created_at', { ascending: false }),
    supabaseAdmin.from('bills').select('user_id, status, created_at'),
    supabaseAdmin.from('quotes').select('user_id, doc_type, status, total, created_at'),
  ])

  if (usersError) return NextResponse.json({ error: usersError.message }, { status: 500 })
  if (billsError) return NextResponse.json({ error: billsError.message }, { status: 500 })
  // Quotes are additive: if that migration hasn't run on some environment the
  // signup list must still load, so this degrades to zeroes rather than 500ing.
  if (quotesError) console.error('[admin] quotes read failed:', quotesError.message)

  type Agg = {
    bills: number; billsPending: number; billsPaid: number
    quotes: number; invoices: number
    quotedValue: number; paidValue: number
    lastActivity: string | null
  }
  const empty = (): Agg => ({
    bills: 0, billsPending: 0, billsPaid: 0,
    quotes: 0, invoices: 0, quotedValue: 0, paidValue: 0, lastActivity: null,
  })
  const agg = new Map<string, Agg>()
  const touch = (id: string) => {
    const a = agg.get(id) ?? empty()
    agg.set(id, a)
    return a
  }
  const seen = (a: Agg, when: string) => {
    if (!a.lastActivity || when > a.lastActivity) a.lastActivity = when
  }

  for (const bill of bills || []) {
    const a = touch(bill.user_id)
    a.bills++
    if (bill.status === 'pending' || bill.status === 'overdue') a.billsPending++
    else if (bill.status === 'paid') a.billsPaid++
    seen(a, bill.created_at)
  }

  for (const q of quotes || []) {
    const a = touch(q.user_id)
    if (q.doc_type === 'invoice') a.invoices++
    else a.quotes++
    // Cancelled and draft documents are money nobody was ever going to send.
    if (q.status !== 'cancelled' && q.status !== 'draft') {
      a.quotedValue += Number(q.total)
      if (q.status === 'paid') a.paidValue += Number(q.total)
    }
    seen(a, q.created_at)
  }

  const rows = (users || []).map(u => ({
    id: u.id,
    whatsapp_number: u.whatsapp_number,
    name: u.name,
    // What their phone says they're called, captured from inbound messages.
    profile_name: u.whatsapp_profile_name ?? null,
    business_name: u.business_name,
    trade: u.trade,
    has_logo: Boolean(u.logo_url),
    vat_registered: Boolean(u.vat_number),
    language: u.language,
    onboarded_at: u.onboarded_at,
    created_at: u.created_at,
    ...(agg.get(u.id) ?? empty()),
  }))

  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

  return NextResponse.json({
    users: rows,
    stats: {
      total: rows.length,
      newThisWeek: rows.filter(r => r.created_at >= weekAgo).length,
      // Signed up is not the same as set up: onboarded means they answered the
      // business questions and can actually send a quote.
      onboarded: rows.filter(r => r.onboarded_at).length,
      // The only number that says the product is being used for its job.
      quoting: rows.filter(r => r.quotes + r.invoices > 0).length,
      activeThisMonth: rows.filter(r => r.lastActivity && r.lastActivity >= monthAgo).length,
      quotes: rows.reduce((s, r) => s + r.quotes, 0),
      invoices: rows.reduce((s, r) => s + r.invoices, 0),
      quotedValue: rows.reduce((s, r) => s + r.quotedValue, 0),
      paidValue: rows.reduce((s, r) => s + r.paidValue, 0),
      bills: rows.reduce((s, r) => s + r.bills, 0),
    },
  })
}

async function getUserDetail(userId: string) {
  const [
    { data: owner, error: ownerError },
    { data: bills, error: billsError },
    { data: senders, error: sendersError },
    { data: quotes },
  ] = await Promise.all([
    supabaseAdmin.from('users').select('whatsapp_number').eq('id', userId).single(),
    supabaseAdmin
      .from('bills')
      .select('id, payee, amount, status, due_date, created_at, sent_by')
      .eq('user_id', userId)
      .order('created_at', { ascending: false }),
    supabaseAdmin.from('trusted_senders').select('whatsapp_number, label').eq('user_id', userId),
    supabaseAdmin
      .from('quotes')
      .select('id, number, doc_type, status, total, created_at, public_token, customers(name)')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50),
  ])

  if (ownerError) return NextResponse.json({ error: ownerError.message }, { status: 500 })
  if (billsError) return NextResponse.json({ error: billsError.message }, { status: 500 })
  if (sendersError) return NextResponse.json({ error: sendersError.message }, { status: 500 })

  const senderLabels = new Map((senders || []).map((s) => [s.whatsapp_number, s.label]))

  const invoices = (bills || []).map((b) => ({
    id: b.id,
    payee: b.payee,
    amount: b.amount,
    status: b.status,
    due_date: b.due_date,
    created_at: b.created_at,
    sender: b.sent_by
      ? { number: b.sent_by, label: senderLabels.get(b.sent_by) || null, isOwner: false }
      : { number: owner?.whatsapp_number || null, label: null, isOwner: true },
  }))

  const quoteRows = (quotes ?? []).map(q => {
    // A Supabase FK join comes back as an array, not an object.
    const joined = q.customers as unknown
    const name = Array.isArray(joined)
      ? (joined[0] as { name?: string } | undefined)?.name
      : (joined as { name?: string } | null)?.name
    return {
      id: q.id,
      number: q.number,
      doc_type: q.doc_type,
      status: q.status,
      total: Number(q.total),
      created_at: q.created_at,
      public_token: q.public_token,
      customer_name: name ?? null,
    }
  })

  return NextResponse.json({ invoices, quotes: quoteRows })
}
