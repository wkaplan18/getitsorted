// Shared loader for everything that renders a quote to someone other than the
// tradesperson: the public /q/[token] page, the PDF route, and the payment
// callback. One query shape so those three can never disagree about what a
// quote says.

import { supabaseAdmin } from './supabase'
import { sendWhatsAppTemplate } from './whatsapp'
import { fmtRand } from './i18n'
import type { Quote, QuoteItem } from './quotes'

export type QuoteView = {
  quote: Quote
  items: QuoteItem[]
  business: {
    business_name: string
    trade: string | null
    owner_name: string | null
    phone: string | null
    logo_url: string | null
    vat_number: string | null
    bank_name: string | null
    account_number: string | null
    branch_code: string | null
  }
  customer: { name: string; address: string | null; email: string | null } | null
}

/** Loads a quote by its unguessable public token. Null if it doesn't exist. */
export async function loadQuoteByToken(token: string): Promise<QuoteView | null> {
  const { data: quote } = await supabaseAdmin
    .from('quotes')
    .select('*')
    .eq('public_token', token)
    .maybeSingle()

  if (!quote) return null

  const [{ data: items }, { data: user }, { data: customer }] = await Promise.all([
    supabaseAdmin.from('quote_items').select('*').eq('quote_id', quote.id).order('position'),
    supabaseAdmin
      .from('users')
      .select('name, whatsapp_number, business_name, trade, logo_url, vat_number, bank_name, account_number, branch_code')
      .eq('id', quote.user_id)
      .maybeSingle(),
    quote.customer_id
      ? supabaseAdmin.from('customers').select('name, address, email').eq('id', quote.customer_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ])

  return {
    quote: quote as Quote,
    items: (items ?? []) as QuoteItem[],
    business: {
      // A quote should never render "null" at the customer — fall back to the
      // owner's name, then to the product name, before showing nothing.
      business_name: user?.business_name ?? user?.name ?? 'Sorted',
      trade: user?.trade ?? null,
      owner_name: user?.name ?? null,
      phone: user?.whatsapp_number ? `+${user.whatsapp_number}` : null,
      logo_url: user?.logo_url ?? null,
      vat_number: user?.vat_number ?? null,
      bank_name: user?.bank_name ?? null,
      account_number: user?.account_number ?? null,
      branch_code: user?.branch_code ?? null,
    },
    customer: customer ? { name: customer.name, address: customer.address, email: customer.email } : null,
  }
}

/**
 * Marks the quote as viewed the first time the customer opens it, and returns
 * whether this was that first time (so the caller can notify the tradesperson).
 * Later views don't re-notify — one ping per quote, not one per refresh.
 */
export async function markViewed(quote: Quote): Promise<boolean> {
  if (quote.viewed_at || quote.status === 'paid') return false
  const { error } = await supabaseAdmin
    .from('quotes')
    .update({
      viewed_at: new Date().toISOString(),
      status: quote.status === 'sent' ? 'viewed' : quote.status,
    })
    .eq('id', quote.id)
  if (error) {
    console.error('[quoteView] markViewed failed:', error.message)
    return false
  }
  return true
}

/**
 * Marks a quote paid and WhatsApps the tradesperson.
 *
 * Called from two places — the Paystack webhook (authoritative) and the
 * customer's return-from-payment page (fast) — so it is idempotent: the update
 * is conditional on the quote not already being paid, and the notification only
 * fires for the call that actually made the change. Whichever arrives first
 * wins; the second is a no-op.
 */
export async function markPaid(quoteId: string): Promise<boolean> {
  const { data: updated, error } = await supabaseAdmin
    .from('quotes')
    .update({ status: 'paid', paid_at: new Date().toISOString() })
    .eq('id', quoteId)
    .neq('status', 'paid')
    .select('id, number, total, user_id, customer_id')

  if (error) {
    console.error('[quoteView] markPaid failed:', error.message)
    return false
  }
  if (!updated || updated.length === 0) return false  // already paid

  const quote = updated[0]

  const [{ data: owner }, { data: customer }] = await Promise.all([
    supabaseAdmin.from('users').select('whatsapp_number').eq('id', quote.user_id).maybeSingle(),
    quote.customer_id
      ? supabaseAdmin.from('customers').select('name').eq('id', quote.customer_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ])

  if (owner?.whatsapp_number) {
    try {
      await sendWhatsAppTemplate(owner.whatsapp_number, 'quote_paid', [
        customer?.name ?? 'Your customer',
        fmtRand(Number(quote.total)),
        quote.number,
      ])
    } catch (err) {
      // A template that isn't approved yet must not lose the payment record.
      console.error('[quoteView] quote_paid notify failed:', err)
    }
  }
  return true
}
