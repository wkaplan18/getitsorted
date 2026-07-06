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
  if (userId) return getUserInvoices(userId)

  const [{ data: users, error: usersError }, { data: bills, error: billsError }] = await Promise.all([
    supabaseAdmin.from('users').select('id, whatsapp_number, name, created_at').order('created_at', { ascending: false }),
    supabaseAdmin.from('bills').select('user_id, status'),
  ])

  if (usersError) return NextResponse.json({ error: usersError.message }, { status: 500 })
  if (billsError) return NextResponse.json({ error: billsError.message }, { status: 500 })

  const counts = new Map<string, { total: number; pending: number; paid: number; overdue: number }>()
  for (const bill of bills || []) {
    const c = counts.get(bill.user_id) || { total: 0, pending: 0, paid: 0, overdue: 0 }
    c.total++
    if (bill.status === 'pending') c.pending++
    else if (bill.status === 'paid') c.paid++
    else if (bill.status === 'overdue') c.overdue++
    counts.set(bill.user_id, c)
  }

  const rows = (users || []).map((u) => ({
    id: u.id,
    whatsapp_number: u.whatsapp_number,
    name: u.name,
    created_at: u.created_at,
    ...(counts.get(u.id) || { total: 0, pending: 0, paid: 0, overdue: 0 }),
  }))

  return NextResponse.json({
    users: rows,
    totalUsers: rows.length,
    totalInvoices: bills?.length || 0,
  })
}

async function getUserInvoices(userId: string) {
  const [{ data: owner, error: ownerError }, { data: bills, error: billsError }, { data: senders, error: sendersError }] = await Promise.all([
    supabaseAdmin.from('users').select('whatsapp_number').eq('id', userId).single(),
    supabaseAdmin
      .from('bills')
      .select('id, payee, amount, status, due_date, created_at, sent_by')
      .eq('user_id', userId)
      .order('created_at', { ascending: false }),
    supabaseAdmin.from('trusted_senders').select('whatsapp_number, label').eq('user_id', userId),
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

  return NextResponse.json({ invoices })
}
