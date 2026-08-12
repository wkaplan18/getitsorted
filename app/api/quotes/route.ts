// Dashboard API for the money-in side: list the logged-in user's quotes, and
// read/update their business profile.
//
// Auth is the same signed session token every other user route uses. The phone
// always comes from the token, never from the query string — a client-supplied
// phone would let anyone read anyone's quotes.

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { sessionPhone } from '@/lib/session'
import { isLang } from '@/lib/i18n'

async function userIdFor(req: NextRequest): Promise<string | null> {
  const phone = sessionPhone(req)
  if (!phone) return null
  const { data } = await supabaseAdmin
    .from('users').select('id').eq('whatsapp_number', phone).maybeSingle()
  return data?.id ?? null
}

// GET /api/quotes — the user's quotes plus their business profile
export async function GET(req: NextRequest) {
  const userId = await userIdFor(req)
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const [{ data: quotes }, { data: profile }] = await Promise.all([
    supabaseAdmin
      .from('quotes')
      .select('id, number, doc_type, status, total, public_token, created_at, paid_at, customers(name)')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(100),
    supabaseAdmin
      .from('users')
      .select('business_name, trade, logo_url, vat_number, bank_name, account_number, branch_code, language')
      .eq('id', userId)
      .maybeSingle(),
  ])

  const rows = (quotes ?? []).map(q => {
    // A Supabase FK join comes back as an array, not an object.
    const joined = q.customers as unknown
    const name = Array.isArray(joined)
      ? (joined[0] as { name?: string } | undefined)?.name
      : (joined as { name?: string } | null)?.name
    return { ...q, customers: undefined, customer_name: name ?? null }
  })

  return NextResponse.json({ quotes: rows, profile: profile ?? null })
}

// PATCH /api/quotes — update the business profile shown on quotes and PDFs
const EDITABLE = [
  'business_name', 'trade', 'vat_number',
  'bank_name', 'account_number', 'branch_code', 'language',
] as const

export async function PATCH(req: NextRequest) {
  const userId = await userIdFor(req)
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const body = await req.json()
  const updates: Record<string, string | null> = {}

  // Allowlist rather than passing the body through — an unfiltered update would
  // let a client set otp, quote_seq or convo_state.
  for (const field of EDITABLE) {
    if (!(field in body)) continue
    const value = typeof body[field] === 'string' ? body[field].trim() : null
    if (field === 'language') {
      if (isLang(value)) updates.language = value
      continue
    }
    updates[field] = value || null
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'nothing to update' }, { status: 400 })
  }

  const { error } = await supabaseAdmin.from('users').update(updates).eq('id', userId)
  if (error) {
    console.error('[api/quotes] profile update failed:', error.message)
    return NextResponse.json({ error: 'update failed' }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
