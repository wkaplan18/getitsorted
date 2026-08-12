// Paystack webhook — the authoritative record that a quote was paid.
//
// The customer's return-from-payment page also marks quotes paid, but only
// after verifying with Paystack server-side. Neither path trusts being reached
// as evidence of payment; that was the bug parked in the old Stitch flow, where
// /pay/success marked a bill paid for anyone who visited the URL.

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { verifyWebhookSignature, paystackConfigured } from '@/lib/paystack'
import { markPaid } from '@/lib/quoteView'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  if (!paystackConfigured()) {
    return NextResponse.json({ error: 'not configured' }, { status: 503 })
  }

  // Signature is HMAC-SHA512 of the RAW body — re-serialising the parsed object
  // changes the whitespace and invalidates the hash.
  const rawBody = await req.text()
  if (!verifyWebhookSignature(rawBody, req.headers.get('x-paystack-signature'))) {
    return NextResponse.json({ error: 'invalid signature' }, { status: 401 })
  }

  let event: { event?: string; data?: { reference?: string } }
  try {
    event = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: 'bad json' }, { status: 400 })
  }

  if (event.event !== 'charge.success') {
    return NextResponse.json({ status: 'ignored' })
  }

  const reference = event.data?.reference
  if (!reference) return NextResponse.json({ status: 'ignored' })

  const { data: quote } = await supabaseAdmin
    .from('quotes')
    .select('id')
    .eq('paystack_reference', reference)
    .maybeSingle()

  if (!quote) {
    // Not one of ours (or the reference was replaced by a retry). Still 200 —
    // a non-2xx makes Paystack retry a delivery that can never succeed.
    console.warn('[paystack] no quote for reference', reference)
    return NextResponse.json({ status: 'ignored' })
  }

  await markPaid(quote.id)
  return NextResponse.json({ status: 'ok' })
}
