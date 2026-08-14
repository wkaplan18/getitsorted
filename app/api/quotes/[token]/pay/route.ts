// Starts a Paystack payment for one quote and redirects the customer to the
// hosted payment page. Posted to by the form on /q/[token].

import { NextRequest, NextResponse } from 'next/server'
import { randomBytes } from 'crypto'
import { supabaseAdmin } from '@/lib/supabase'
import { loadQuoteByToken } from '@/lib/quoteView'
import {
  createPaymentLink, paystackConfigured, grossUp, cardPaymentsEnabledFor,
  MIN_CARD_PAYABLE_CENTS,
} from '@/lib/paystack'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const quoteUrl = new URL(`/q/${token}`, req.nextUrl.origin)

  if (!paystackConfigured()) {
    return NextResponse.redirect(new URL('?error=unavailable', quoteUrl), 303)
  }

  const view = await loadQuoteByToken(token)
  if (!view) return NextResponse.json({ error: 'not found' }, { status: 404 })

  const { quote, business, customer } = view
  if (quote.status === 'paid') return NextResponse.redirect(quoteUrl, 303)
  // Re-checked here, not just where the button is drawn: this is a plain form
  // POST and the page hiding a button stops nobody from posting to it.
  if (Math.round(Number(quote.total) * 100) < MIN_CARD_PAYABLE_CENTS) {
    return NextResponse.redirect(quoteUrl, 303)
  }

  // No subaccount means there is nowhere for this money to go except Sorted's
  // own balance, which is exactly what the split exists to prevent. Send him
  // back to the EFT details rather than take money we'd have to pay out by hand.
  //
  // The allowlist is re-checked here and not just at subaccount creation:
  // taking someone off it has to actually stop them, including the ones who
  // already have a subaccount from when they were on it.
  if (!business.paystack_subaccount || !cardPaymentsEnabledFor(business.owner_whatsapp)) {
    return NextResponse.redirect(new URL('?error=unavailable', quoteUrl), 303)
  }

  const form = await req.formData()
  const email = String(form.get('email') ?? '').trim()
  if (!email || !email.includes('@')) {
    return NextResponse.redirect(new URL('?error=email', quoteUrl), 303)
  }

  // A fresh reference per attempt — Paystack rejects a reference that has been
  // used before, so reusing the quote number would break every retry after an
  // abandoned or failed payment.
  const reference = `${quote.number}-${randomBytes(4).toString('hex')}`

  // The customer pays the quote total plus the cost of moving it; the
  // tradesperson receives the total itself. See grossUp().
  const fees = grossUp(Number(quote.total))

  try {
    const link = await createPaymentLink({
      chargeCents: fees.chargeCents,
      reference,
      email,
      quoteNumber: quote.number,
      businessName: business.business_name,
      callbackUrl: new URL(`/q/${token}/paid`, req.nextUrl.origin).toString(),
      subaccount: business.paystack_subaccount,
    })

    // Every reference is kept, not just the newest. An abandoned attempt stays
    // payable at Paystack, and a customer who goes back and pays an older link
    // must still be matched to this quote — otherwise the money moves and
    // nothing here knows.
    //
    // Kept apart from quote.total on purpose: one is what he quoted, the other
    // is what the customer's card was hit for.
    const stored = await supabaseAdmin
      .from('quotes')
      .update({
        paystack_reference: link.reference,
        paystack_references: [...(quote.paystack_references ?? []), link.reference],
        charged_total: fees.chargeCents / 100,
      })
      .eq('id', quote.id)

    if (stored.error) {
      // The new columns may not exist yet. Losing the reference entirely means
      // a payment that can never be matched back, so fall back to the column
      // that has always been there rather than send them to Paystack with
      // nothing recorded.
      console.warn(`[pay] full update failed (${stored.error.message}) — falling back; run supabase/paystack-references.sql`)
      await supabaseAdmin
        .from('quotes')
        .update({ paystack_reference: link.reference })
        .eq('id', quote.id)
    }

    // Remember the email so a repeat customer doesn't retype it next time.
    if (customer && !customer.email && quote.customer_id) {
      await supabaseAdmin.from('customers').update({ email }).eq('id', quote.customer_id)
    }

    return NextResponse.redirect(link.authorization_url, 303)
  } catch (err) {
    console.error('[pay] Paystack initialize failed:', err)
    return NextResponse.redirect(new URL('?error=payment', quoteUrl), 303)
  }
}
