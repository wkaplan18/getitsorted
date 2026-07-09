import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { sendWhatsAppTemplate } from '@/lib/whatsapp'
import { sessionPhone } from '@/lib/session'

// All handlers identify the user from the session token — the phone/id supplied
// by the client is never trusted on its own.
async function sessionUserId(req: NextRequest): Promise<string | null> {
  const phone = sessionPhone(req)
  if (!phone) return null
  const { data: user } = await supabaseAdmin
    .from('users')
    .select('id')
    .eq('whatsapp_number', phone)
    .single()
  return user?.id ?? null
}

// GET /api/bills — fetch all bills for the logged-in user
export async function GET(req: NextRequest) {
  const userId = await sessionUserId(req)
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { data: bills } = await supabaseAdmin
    .from('bills')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  return NextResponse.json({ bills: bills || [] })
}

// DELETE /api/bills?id=xxx — delete one of the logged-in user's bills
export async function DELETE(req: NextRequest) {
  const userId = await sessionUserId(req)
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const { error } = await supabaseAdmin.from('bills').delete().eq('id', id).eq('user_id', userId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

// POST /api/bills — create a new pending bill (used by "Pay again")
export async function POST(req: NextRequest) {
  const userId = await sessionUserId(req)
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { payee, amount, bank_name, account_number, branch_code, reference } = await req.json()
  if (!payee || !amount) return NextResponse.json({ error: 'payee and amount required' }, { status: 400 })

  const { data: bill, error } = await supabaseAdmin
    .from('bills')
    .insert({ user_id: userId, payee, amount, bank_name, account_number, branch_code, reference, status: 'pending' })
    .select('*')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ bill })
}

// PATCH /api/bills — update one of the logged-in user's bills (status, bank details, etc.)
export async function PATCH(req: NextRequest) {
  const userId = await sessionUserId(req)
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { id, ...fields } = await req.json()
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const allowed = ['status', 'bank_name', 'account_number', 'branch_code', 'reference', 'unconfirmed']
  const update = Object.fromEntries(Object.entries(fields).filter(([k]) => allowed.includes(k)))
  if (fields.status === 'paid') update.paid_at = new Date().toISOString()
  if (fields.status === 'pending') update.paid_at = null

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'no valid fields to update' }, { status: 400 })
  }

  const { data: bill, error } = await supabaseAdmin
    .from('bills')
    .update(update)
    .eq('id', id)
    .eq('user_id', userId)
    .select('payee, amount, sent_by')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Notify trusted sender when their bill is marked paid
  if (fields.status === 'paid' && bill?.sent_by) {
    try {
      await sendWhatsAppTemplate(
        bill.sent_by,
        'bill_paid_notification',
        [(bill.amount ?? 0).toFixed(0), bill.payee]
      )
    } catch (err) {
      console.error('Failed to notify trusted sender:', err)
    }
  }

  return NextResponse.json({ ok: true })
}
