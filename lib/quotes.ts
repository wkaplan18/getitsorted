// Sorted — money-in domain logic: totals, numbering, drafts, and the WhatsApp
// rendering of a quote.
//
// Kept out of the webhook so the quote maths has one home and can be reasoned
// about without reading 500 lines of message routing.

import { randomBytes } from 'crypto'
import { supabaseAdmin } from './supabase'
import { t, fmtRand, type Lang } from './i18n'
import type { ExtractedLineItem } from './claude'

export const VAT_RATE = 0.15

export type QuoteStatus = 'draft' | 'sent' | 'viewed' | 'accepted' | 'paid' | 'cancelled'
export type DocType = 'quote' | 'invoice'

export type Quote = {
  id: string
  user_id: string
  customer_id: string | null
  number: string
  doc_type: DocType
  status: QuoteStatus
  subtotal: number
  vat_amount: number
  total: number
  public_token: string
  paystack_reference: string | null
  notes: string | null
  raw_message: string | null
  created_at: string
  sent_at: string | null
  viewed_at: string | null
  paid_at: string | null
}

export type QuoteItem = {
  id: string
  quote_id: string
  description: string
  quantity: number
  unit_price: number
  line_total: number
  position: number
}

export type Customer = {
  id: string
  user_id: string
  name: string
  normalised_name: string
  whatsapp_number: string | null
  email: string | null
  address: string | null
  created_at: string
}

// ---------------------------------------------------------------------------
// Maths
// ---------------------------------------------------------------------------

/** Rounds to cents. Float multiplication of rands otherwise drifts by 1c. */
function cents(n: number): number {
  return Math.round(n * 100) / 100
}

export function lineTotal(item: { quantity: number; unit_price: number }): number {
  return cents(item.quantity * item.unit_price)
}

/**
 * `vatRegistered` is false for almost every user here — 1.9m of these
 * businesses are specifically non-VAT-registered. When false the quote carries
 * no VAT line at all rather than a R0.00 one.
 */
export function totals(items: Array<{ quantity: number; unit_price: number }>, vatRegistered: boolean) {
  const subtotal = cents(items.reduce((sum, item) => sum + lineTotal(item), 0))
  const vat_amount = vatRegistered ? cents(subtotal * VAT_RATE) : 0
  return { subtotal, vat_amount, total: cents(subtotal + vat_amount) }
}

// ---------------------------------------------------------------------------
// Identifiers
// ---------------------------------------------------------------------------

/**
 * 128-bit url-safe token. The public quote page is unauthenticated by design —
 * the customer must not need an account — so this is the only thing protecting
 * it. Never derive it from the quote id or a counter.
 */
export function publicToken(): string {
  return randomBytes(16).toString('base64url')
}

/**
 * Per-user document number. Atomically bumps users.quote_seq so two quotes
 * created in the same second can't collide, and deleting a quote never
 * reissues its number.
 */
export async function nextQuoteNumber(userId: string, docType: DocType): Promise<string> {
  const { data, error } = await supabaseAdmin.rpc('next_quote_seq', { p_user_id: userId })
  let seq: number
  if (error || typeof data !== 'number') {
    // RPC missing (migration not run yet) — fall back to a read-modify-write.
    // Racy under concurrency, but a single user sending two quotes in the same
    // instant is not a real scenario, and quotes_user_number would reject it.
    const { data: row } = await supabaseAdmin
      .from('users').select('quote_seq').eq('id', userId).single()
    seq = ((row?.quote_seq as number | null) ?? 0) + 1
    await supabaseAdmin.from('users').update({ quote_seq: seq }).eq('id', userId)
  } else {
    seq = data
  }
  const prefix = docType === 'invoice' ? 'INV' : 'QUO'
  return `${prefix}-${String(seq).padStart(4, '0')}`
}

export function normaliseName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ')
}

// ---------------------------------------------------------------------------
// Customers
// ---------------------------------------------------------------------------

/** Finds an existing customer by normalised name, or creates one. */
export async function upsertCustomer(
  userId: string,
  name: string,
  address?: string | null,
): Promise<Customer | null> {
  const normalised = normaliseName(name)
  if (!normalised) return null

  const { data: existing } = await supabaseAdmin
    .from('customers')
    .select('*')
    .eq('user_id', userId)
    .eq('normalised_name', normalised)
    .maybeSingle()

  if (existing) {
    // Fill in an address we didn't have before, but never overwrite a known one
    // with null just because this message didn't mention it.
    if (address && !existing.address) {
      await supabaseAdmin.from('customers').update({ address }).eq('id', existing.id)
      return { ...existing, address } as Customer
    }
    return existing as Customer
  }

  const { data, error } = await supabaseAdmin
    .from('customers')
    .insert({ user_id: userId, name: name.trim(), normalised_name: normalised, address: address ?? null })
    .select()
    .single()

  if (error) {
    console.error('[quotes] customer insert failed:', error.message)
    return null
  }
  return data as Customer
}

// ---------------------------------------------------------------------------
// Drafts (held in users.convo_state between WhatsApp messages)
// ---------------------------------------------------------------------------

export type Draft = {
  customer: string | null
  customer_address: string | null
  line_items: ExtractedLineItem[]
  raw_message?: string
}

export type ConvoState = {
  step:
    | 'pick_language'
    | 'ask_business_name'
    | 'ask_trade'
    | 'ask_name'
    | 'ask_logo'
    | 'confirm_quote'
    | 'disambiguate'
  draft?: Draft
  // For 'disambiguate': the original message, replayed down whichever path the
  // user picks so they never have to type it twice.
  pending_message?: string
}

export async function setConvoState(userId: string, state: ConvoState | null): Promise<void> {
  await supabaseAdmin.from('users').update({ convo_state: state }).eq('id', userId)
}

// ---------------------------------------------------------------------------
// WhatsApp rendering
// ---------------------------------------------------------------------------

/**
 * The quote as it appears in WhatsApp before a PDF exists.
 *
 * Monospace alignment is avoided on purpose — WhatsApp renders proportional
 * text on most Android clients, so padded columns come out ragged. One line per
 * item with the amount last reads correctly everywhere and costs fewer bytes.
 */
export function renderDraft(draft: Draft, lang: Lang, vatRegistered: boolean): string {
  const items = draft.line_items
  const { subtotal, vat_amount, total } = totals(items, vatRegistered)

  const lines: string[] = [t(lang, 'quote_header')]

  if (draft.customer) {
    lines.push('')
    lines.push(t(lang, 'quote_for', { customer: draft.customer }))
  }

  lines.push('')
  for (const item of items) {
    // A single-quantity line would otherwise print the same figure twice
    // ("Materials — R1,200.00 = R1,200.00"), which reads like a mistake.
    if (item.quantity === 1) {
      lines.push(`• ${item.description} — ${fmtRand(lineTotal(item))}`)
      continue
    }
    const qty = Number.isInteger(item.quantity) ? String(item.quantity) : item.quantity.toFixed(2)
    lines.push(`• ${item.description} — ${qty} x ${fmtRand(item.unit_price)} = ${fmtRand(lineTotal(item))}`)
  }

  lines.push('')
  if (vatRegistered) {
    lines.push(`Subtotal  ${fmtRand(subtotal)}`)
    lines.push(`VAT 15%   ${fmtRand(vat_amount)}`)
  }
  lines.push(`*${t(lang, 'quote_total')}  ${fmtRand(total)}*`)
  lines.push('')
  lines.push(t(lang, 'quote_confirm'))

  return lines.join('\n')
}

// ---------------------------------------------------------------------------
// Persistence
// ---------------------------------------------------------------------------

/** Writes a draft to quotes + quote_items. Returns null if anything fails. */
export async function saveQuote(opts: {
  userId: string
  draft: Draft
  vatRegistered: boolean
  docType?: DocType
}): Promise<{ quote: Quote; items: QuoteItem[] } | null> {
  const docType = opts.docType ?? 'quote'
  const customer = opts.draft.customer
    ? await upsertCustomer(opts.userId, opts.draft.customer, opts.draft.customer_address)
    : null

  const { subtotal, vat_amount, total } = totals(opts.draft.line_items, opts.vatRegistered)
  const number = await nextQuoteNumber(opts.userId, docType)

  const { data: quote, error } = await supabaseAdmin
    .from('quotes')
    .insert({
      user_id: opts.userId,
      customer_id: customer?.id ?? null,
      number,
      doc_type: docType,
      status: 'sent',
      subtotal,
      vat_amount,
      total,
      public_token: publicToken(),
      raw_message: opts.draft.raw_message ?? null,
      sent_at: new Date().toISOString(),
    })
    .select()
    .single()

  // Insert errors are checked and surfaced, not assumed away — this repo has
  // shipped a silent-write failure before (the bills.unconfirmed incident).
  if (error || !quote) {
    console.error('[quotes] quote insert failed:', error?.message)
    return null
  }

  const rows = opts.draft.line_items.map((item, i) => ({
    quote_id: quote.id,
    description: item.description,
    quantity: item.quantity,
    unit_price: item.unit_price,
    line_total: lineTotal(item),
    position: i,
  }))

  const { data: items, error: itemsError } = await supabaseAdmin
    .from('quote_items')
    .insert(rows)
    .select()

  if (itemsError) {
    console.error('[quotes] quote_items insert failed:', itemsError.message)
    // A quote with no lines is worse than no quote — roll back rather than
    // handing the user a link to an empty document.
    await supabaseAdmin.from('quotes').delete().eq('id', quote.id)
    return null
  }

  return { quote: quote as Quote, items: (items ?? []) as QuoteItem[] }
}

export function quoteUrl(token: string): string {
  const base = (process.env.NEXT_PUBLIC_APP_URL ?? '').replace(/\/$/, '')
  return `${base}/q/${token}`
}
