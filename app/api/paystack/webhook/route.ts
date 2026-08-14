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

  let event: {
    event?: string
    data?: {
      reference?: string
      fees_split?: { subaccount?: number | string; integration?: number | string }
    }
  }
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

  const quote = await findQuoteByReference(reference)

  if (!quote) {
    // Genuinely not ours. Still 200 — a non-2xx makes Paystack retry a
    // delivery that can never succeed.
    console.warn('[paystack] no quote for reference', reference)
    return NextResponse.json({ status: 'ignored' })
  }

  await markPaid(quote.id)
  assertNotShort(quote.number, Number(quote.total), event.data?.fees_split)

  return NextResponse.json({ status: 'ok' })
}

/**
 * Finds the quote a payment belongs to.
 *
 * Matches against every reference the quote has ever had, not just the newest.
 * Paying an abandoned link is ordinary customer behaviour — two taps on Pay,
 * then the older tab — and matching only the latest meant the money moved while
 * the quote sat unpaid and nobody was told.
 *
 * Falls back to the single-column match if `paystack_references` isn't there
 * yet, so this survives being deployed before its migration is run. That order
 * has gone wrong in this repo before, and the failure here is silent and
 * expensive: payments taken and attributed to nothing.
 */
async function findQuoteByReference(reference: string) {
  const { data, error } = await supabaseAdmin
    .from('quotes')
    .select('id, number, total')
    .contains('paystack_references', [reference])
    .maybeSingle()

  if (!error) return data

  console.warn(`[paystack] reference array lookup failed (${error.message}) — has supabase/paystack-references.sql been run? Falling back.`)
  const { data: legacy } = await supabaseAdmin
    .from('quotes')
    .select('id, number, total')
    .eq('paystack_reference', reference)
    .maybeSingle()
  return legacy
}

/**
 * Shouts if the tradesperson netted less than he quoted.
 *
 * grossUp() hardcodes Paystack's rate, and the whole scheme rests on that
 * number being right — when it was wrong by the 15% VAT nobody publishes, every
 * job silently paid out R20 short and only a hand-checked test transaction
 * caught it. This is the check that would have caught it on its own: the one
 * moment the real fee is knowable is the moment Paystack reports the split.
 *
 * Deliberately not a WhatsApp to the tradesperson — he can do nothing about it,
 * and "you were underpaid" is a terrible message to receive with no next step.
 * It goes to the logs, loudly, for whoever is watching them.
 */
function assertNotShort(
  number: string,
  quoteTotal: number,
  split?: { subaccount?: number | string },
): void {
  if (split?.subaccount === undefined) return
  const receivedCents = Number(split.subaccount)
  const owedCents = Math.round(quoteTotal * 100)
  if (!Number.isFinite(receivedCents) || receivedCents >= owedCents) return

  console.error(
    `[paystack] FEE SHORTFALL on ${number}: tradesperson received ` +
    `R${(receivedCents / 100).toFixed(2)} against a quote of R${(owedCents / 100).toFixed(2)} ` +
    `(short R${((owedCents - receivedCents) / 100).toFixed(2)}). ` +
    `The fee constants in lib/paystack.ts no longer match what Paystack charges.`
  )
}
