import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { sendWhatsApp } from '@/lib/whatsapp'

// GET /api/bills?phone=27821234567 — fetch all bills for a user
export async function GET(req: NextRequest) {
  const phone = req.nextUrl.searchParams.get('phone')
  if (!phone) return NextResponse.json({ error: 'phone required' }, { status: 400 })

  const { data: user } = await supabaseAdmin
    .from('users')
    .select('id')
    .eq('whatsapp_number', phone)
    .single()

  if (!user) return NextResponse.json({ bills: [] })

  const { data: bills } = await supabaseAdmin
    .from('bills')
    .select('*')
    .eq('user_id', user.id)
    .order('due_date', { ascending: true, nullsFirst: false })

  return NextResponse.json({ bills: bills || [] })
}

// DELETE /api/bills?id=xxx — delete a bill
export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  const { error } = await supabaseAdmin.from('bills').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

// PATCH /api/bills — update a bill (status, bank details, etc.)
export async function PATCH(req: NextRequest) {
  const { id, ...fields } = await req.json()
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const allowed = ['status', 'bank_name', 'account_number', 'branch_code', 'reference']
  const update = Object.fromEntries(Object.entries(fields).filter(([k]) => allowed.includes(k)))

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'no valid fields to update' }, { status: 400 })
  }

  const { data: bill, error } = await supabaseAdmin
    .from('bills')
    .update(update)
    .eq('id', id)
    .select('payee, amount, sent_by')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Notify trusted sender when their bill is marked paid
  if (fields.status === 'paid' && bill?.sent_by) {
    await sendWhatsApp(
      bill.sent_by,
      `✅ Paid! R${bill.amount.toFixed(0)} to ${bill.payee} has been marked as paid.`
    )
  }

  return NextResponse.json({ ok: true })
}
