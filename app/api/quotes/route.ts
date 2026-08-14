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
import { ensureSubaccount, resetSubaccount } from '@/lib/paystackSubaccount'

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

  // Backfill. Subaccounts are otherwise only built when banking CHANGES, which
  // silently excludes everyone who filled their details in before this existed
  // — they would never get a card button without going and editing a field for
  // no reason. Cheap to call: it returns immediately once a subaccount exists,
  // and before touching Paystack at all for anyone off the allowlist.
  await ensureSubaccount(userId)

  const [{ data: quotes }, { data: profile }] = await Promise.all([
    supabaseAdmin
      .from('quotes')
      .select('id, number, doc_type, status, subtotal, vat_amount, total, public_token, paystack_reference, created_at, sent_at, viewed_at, paid_at, notes, customers(name, address)')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(200),
    supabaseAdmin
      .from('users')
      .select('business_name, trade, logo_url, vat_number, bank_name, account_number, branch_code, language')
      .eq('id', userId)
      .maybeSingle(),
  ])

  // The line items for every quote in one round trip rather than one query per
  // card — the dashboard shows a full record, and 200 sequential fetches on a
  // prepaid phone connection is not a record anyone waits for.
  const ids = (quotes ?? []).map(q => q.id)
  const { data: allItems } = ids.length
    ? await supabaseAdmin
        .from('quote_items')
        .select('quote_id, description, quantity, unit_price, line_total, position')
        .in('quote_id', ids)
        .order('position')
    : { data: [] }

  const itemsByQuote = new Map<string, Array<Record<string, unknown>>>()
  for (const item of allItems ?? []) {
    const list = itemsByQuote.get(item.quote_id) ?? []
    list.push(item)
    itemsByQuote.set(item.quote_id, list)
  }

  const rows = (quotes ?? []).map(q => {
    // A Supabase FK join comes back as an array, not an object.
    const joined = q.customers as unknown
    const customer = (Array.isArray(joined) ? joined[0] : joined) as
      { name?: string; address?: string | null } | null | undefined
    return {
      ...q,
      customers: undefined,
      customer_name: customer?.name ?? null,
      customer_address: customer?.address ?? null,
      items: itemsByQuote.get(q.id) ?? [],
    }
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

  // Banking changed → the old subaccount now points at the wrong bank account.
  // Rebuild it, or a tradesperson who switched banks keeps being paid into the
  // account he just left. Business name is on the list too: Paystack shows it
  // on the customer's card statement.
  const touchedBanking = ['bank_name', 'account_number', 'business_name']
    .some(field => field in updates)
  if (touchedBanking) {
    await resetSubaccount(userId)
    await ensureSubaccount(userId)
  }

  return NextResponse.json({ ok: true })
}
