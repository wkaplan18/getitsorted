import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { createPaymentInitiation, toBankId } from '@/lib/stitch'
import { sessionPhone } from '@/lib/session'

// POST /api/pay { billId }
// Creates a Stitch payment initiation and returns the redirect URL
export async function POST(req: NextRequest) {
  const phone = sessionPhone(req)
  if (!phone) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { billId } = await req.json()
  if (!billId) return NextResponse.json({ error: 'billId required' }, { status: 400 })

  // Verify bill belongs to this user
  const { data: user } = await supabaseAdmin
    .from('users')
    .select('id')
    .eq('whatsapp_number', phone)
    .single()

  if (!user) return NextResponse.json({ error: 'user not found' }, { status: 404 })

  const { data: bill } = await supabaseAdmin
    .from('bills')
    .select('*')
    .eq('id', billId)
    .eq('user_id', user.id)
    .single()

  if (!bill) return NextResponse.json({ error: 'bill not found' }, { status: 404 })
  if (!bill.account_number) return NextResponse.json({ error: 'no bank details — add them first' }, { status: 400 })

  const bankId = toBankId(bill.bank_name)
  if (!bankId) return NextResponse.json({ error: `Unknown bank: ${bill.bank_name}. Add bank details manually.` }, { status: 400 })

  const result = await createPaymentInitiation({
    billId: bill.id,
    payeeName: bill.payee,
    amount: bill.amount,
    accountNumber: bill.account_number,
    bankId,
    branchCode: bill.branch_code,
    reference: bill.reference,
    payerReference: 'Sorted',
  })

  // Save the Stitch payment ID so we can verify on callback
  await supabaseAdmin
    .from('bills')
    .update({ stitch_payment_id: result.paymentId })
    .eq('id', billId)

  return NextResponse.json({ redirectUrl: result.redirectUrl })
}
