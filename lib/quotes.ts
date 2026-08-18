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
  /** The most recent attempt — what the return-from-payment page verifies. */
  paystack_reference: string | null
  /**
   * Every reference ever minted for this quote. The webhook matches against
   * this, not the one above: an abandoned checkout link stays payable, so the
   * reference that comes back is not always the newest one.
   */
  paystack_references: string[] | null
  /**
   * What the customer's card was actually charged — the total plus the card
   * payment fee. Null for anything not paid by card. Never use this as the
   * value of the job: `total` is what was quoted and what the tradesperson
   * receives.
   */
  charged_total: number | null
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

/**
 * The user's most recently quoted clients, newest first.
 *
 * Ordered by their last quote rather than when they were created — a plumber's
 * regular from last week matters more than the first customer he ever entered.
 */
export async function recentCustomers(userId: string, limit = 5): Promise<Customer[]> {
  const { data: quotes } = await supabaseAdmin
    .from('quotes')
    .select('customer_id, created_at')
    .eq('user_id', userId)
    .not('customer_id', 'is', null)
    .order('created_at', { ascending: false })
    .limit(40)

  const seen: string[] = []
  for (const row of quotes ?? []) {
    const id = row.customer_id as string
    if (id && !seen.includes(id)) seen.push(id)
    if (seen.length >= limit) break
  }
  if (seen.length === 0) return []

  const { data } = await supabaseAdmin.from('customers').select('*').in('id', seen)
  // .in() returns rows in arbitrary order — restore most-recent-first.
  return seen
    .map(id => (data ?? []).find(c => c.id === id))
    .filter(Boolean) as Customer[]
}

/** Finds a saved customer by name, tolerating case and spacing. Null if new. */
export async function findCustomer(userId: string, name: string): Promise<Customer | null> {
  const normalised = normaliseName(name)
  if (!normalised) return null
  const { data } = await supabaseAdmin
    .from('customers')
    .select('*')
    .eq('user_id', userId)
    .eq('normalised_name', normalised)
    .maybeSingle()
  return (data as Customer | null) ?? null
}

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

/** One entry in the "who is this for?" list, frozen at the moment it was sent. */
export type ClientOption = { id: string; name: string; address: string | null }

/** One entry in the "which quote should I invoice?" list, frozen the same way. */
export type QuoteOption = { id: string; number: string; name: string }

export type ConvoState = {
  step:
    // One-time profile setup. Everything captured here is stored against the
    // user's WhatsApp number and reused on every future quote — they are never
    // asked again.
    | 'pick_language'
    | 'ask_business_name'
    | 'ask_trade'
    | 'ask_name'
    | 'ask_bank'
    | 'ask_account'
    | 'ask_logo'
    // The guided quote, one question per message.
    | 'ask_client_name'
    | 'ask_client_address'
    | 'ask_quote_items'
    // Free-form path: the user typed a whole quote in one go, so it's shown
    // back for confirmation instead of being collected step by step.
    | 'confirm_quote'
    | 'disambiguate'
    // The numbered MENU and the jobs reachable only from it.
    | 'menu'
    | 'menu_logo'
    | 'invoice_pick'
    | 'edit_client_pick'
    | 'edit_client_name'
    | 'edit_client_address'
  draft?: Draft
  // The numbered client list as shown, so a reply of "2" resolves to the same
  // person even if a quote was saved in between and reordered the list.
  client_options?: ClientOption[]
  // The numbered quote list for 'invoice_pick', frozen for the same reason: a
  // quote saved between the two messages must not renumber the list underneath
  // the user and invoice the wrong job.
  quote_options?: QuoteOption[]
  // For 'disambiguate': the original message, replayed down whichever path the
  // user picks so they never have to type it twice.
  pending_message?: string
  // For 'ask_quote_items': what they typed that didn't parse on its own.
  //
  // People split a job across two messages — "Second hand shirts", then
  // "R1500" — and each half is unparseable alone: the first has no price, the
  // second has no work. Read as a pair they are an obvious line item, so the
  // rejected half is kept and prepended to whatever comes next.
  pending_items_text?: string
  // Set when a profile step was re-entered from the menu rather than reached
  // during first-time setup: the same questions are asked, but the chain ends
  // in a confirmation instead of carrying on into a quote.
  edit?: 'business' | 'bank'
  // For the client-edit flow: which saved client is being changed.
  client_id?: string
  // Set when 'confirm_quote' was entered by EDIT rather than by a new quote.
  // Its presence is what makes SEND rewrite the existing document instead of
  // creating a second one.
  editing_quote_id?: string
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
  return [
    t(lang, 'quote_header'),
    renderLines(draft, lang, vatRegistered),
    t(lang, 'quote_confirm'),
  ].join('\n\n')
}

/**
 * Just the customer, the priced lines, and the total — no header, no call to
 * action. Shared by the draft preview and the "here's your quote" message so
 * the figures are formatted identically in both.
 */
export function renderLines(draft: Draft, lang: Lang, vatRegistered: boolean): string {
  const items = draft.line_items
  const { subtotal, vat_amount, total } = totals(items, vatRegistered)

  const lines: string[] = []

  if (draft.customer) {
    lines.push(t(lang, 'quote_for', { customer: draft.customer }))
    lines.push('')
  }

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

  return lines.join('\n')
}

/**
 * The message the tradesperson forwards to his client, and nothing else.
 *
 * Sent as its own WhatsApp message, last, so a long-press → forward carries
 * exactly this and none of the conversation around it. Every word is written
 * for the client to read: it opens with the business, not with "your quote is
 * ready", and it never says "you" to someone who isn't the customer.
 *
 * This is the first thing most of these clients will see from the business, so
 * it carries the same details as the letterhead on the PDF — who this is, what
 * they do, and how to reach them.
 *
 * ALWAYS ENGLISH, whatever language the tradesperson chose. His language
 * setting is a fact about him, not about his customers — a plumber who reads
 * isiZulu still quotes clients whose language nobody here knows, and English is
 * the one they can all be assumed to read. The figures and names are identical
 * in every language anyway.
 */
export function renderForwardCard(opts: {
  business: string
  trade?: string | null
  ownerName?: string | null
  phone?: string | null
  docType: DocType
  vatRegistered: boolean
  number: string
  customer: string | null
  total: number
  link: string
}): string {
  const lang: Lang = 'en'
  const lines: string[] = [`*${opts.business}*`]

  // Trade, name and number on one line under the business, exactly as they sit
  // under the logo on the PDF. Any of them may be missing.
  const details = [opts.trade, opts.ownerName].filter(Boolean).join(' · ')
  if (details) lines.push(details)
  if (opts.phone) lines.push(opts.phone)

  // Only a registered vendor may head a document "Tax Invoice" (VAT Act s20).
  const docWord = opts.docType === 'invoice'
    ? t(lang, opts.vatRegistered ? 'doc_tax_invoice' : 'doc_invoice')
    : t(lang, 'doc_quotation')

  lines.push('', `${docWord} ${opts.number}`)
  if (opts.customer) lines.push(`${t(lang, 'fwd_for')}: ${opts.customer}`)
  lines.push(`${t(lang, 'fwd_total')}: *${fmtRand(opts.total)}*`)
  lines.push('', t(lang, 'fwd_open'), opts.link)

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

/**
 * The document EDIT works on: whatever this user most recently created.
 *
 * Deliberately not a numbered picker like invoiceableQuotes — EDIT is reached
 * seconds after sending, and "the one I just made" is what it means almost
 * every time. Loaded as separate queries rather than an FK join, matching
 * loadQuoteByToken: joins here come back as arrays and read as null if you
 * treat them as objects.
 */
export async function latestQuoteForEdit(userId: string): Promise<{
  quote: Quote
  items: QuoteItem[]
  customerName: string | null
  customerAddress: string | null
} | null> {
  const { data: quote } = await supabaseAdmin
    .from('quotes')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!quote) return null

  const [{ data: items }, { data: customer }] = await Promise.all([
    supabaseAdmin.from('quote_items').select('*').eq('quote_id', quote.id).order('position'),
    quote.customer_id
      ? supabaseAdmin.from('customers').select('name, address').eq('id', quote.customer_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ])

  return {
    quote: quote as Quote,
    items: (items ?? []) as QuoteItem[],
    customerName: customer?.name ?? null,
    customerAddress: customer?.address ?? null,
  }
}

/**
 * Rewrites a quote in place: new figures, same number, same public token.
 *
 * Same link on purpose. A corrected quote issued under a fresh number leaves
 * the original live and payable, and the client can end up holding two
 * documents for one job — worse than the mistake being fixed.
 */
export async function updateQuote(opts: {
  userId: string
  quoteId: string
  draft: Draft
  vatRegistered: boolean
}): Promise<{ quote: Quote; items: QuoteItem[] } | null> {
  const { subtotal, vat_amount, total } = totals(opts.draft.line_items, opts.vatRegistered)

  const { data: quote, error } = await supabaseAdmin
    .from('quotes')
    .update({ subtotal, vat_amount, total })
    .eq('id', opts.quoteId)
    .eq('user_id', opts.userId)   // scoped to the owner: an id is not authority to edit
    .select()
    .single()

  if (error || !quote) {
    console.error('[quotes] quote update failed:', error?.message)
    return null
  }

  // Kept so the old lines can go back if the replacement fails. The model
  // returns the whole item set on every edit, so these are replaced wholesale
  // rather than diffed — which means a failed insert would otherwise leave a
  // priced quote with no lines behind it.
  const { data: previous } = await supabaseAdmin
    .from('quote_items')
    .select('*')
    .eq('quote_id', opts.quoteId)
    .order('position')

  const { error: clearError } = await supabaseAdmin
    .from('quote_items')
    .delete()
    .eq('quote_id', opts.quoteId)

  if (clearError) {
    console.error('[quotes] quote_items clear failed:', clearError.message)
    return null
  }

  const rows = opts.draft.line_items.map((item, i) => ({
    quote_id: opts.quoteId,
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
    console.error('[quotes] quote_items replace failed:', itemsError.message)
    if (previous?.length) {
      const { error: restoreError } = await supabaseAdmin.from('quote_items').insert(previous)
      if (restoreError) console.error('[quotes] restore of old lines FAILED:', restoreError.message)
    }
    return null
  }

  return { quote: quote as Quote, items: (items ?? []) as QuoteItem[] }
}

/**
 * The quotes a user could turn into an invoice: their recent quotes, newest
 * first, excluding ones that are already invoices.
 *
 * Cancelled quotes are excluded; paid ones are not. A tradesperson who took
 * cash on the day still needs the invoice for his own books.
 */
export async function invoiceableQuotes(
  userId: string,
  limit = 5,
): Promise<Array<{ id: string; number: string; total: number; customerName: string | null }>> {
  const { data } = await supabaseAdmin
    .from('quotes')
    .select('id, number, total, customers(name)')
    .eq('user_id', userId)
    .eq('doc_type', 'quote')
    .neq('status', 'cancelled')
    .order('created_at', { ascending: false })
    .limit(limit)

  return (data ?? []).map(row => {
    // Supabase renders a foreign-key join as an array, not an object.
    const joined = row.customers as unknown
    const name = Array.isArray(joined) ? joined[0]?.name : (joined as { name?: string } | null)?.name
    return { id: row.id, number: row.number, total: Number(row.total), customerName: name ?? null }
  })
}

/**
 * Copies an accepted quote into an invoice.
 *
 * The figures are copied, never recomputed: if the user registered for VAT
 * between quoting and invoicing, the client must still be charged the amount he
 * agreed to. The quote is left in place and marked accepted — it is the record
 * of what was agreed, and deleting it would erase that.
 */
export async function createInvoiceFromQuote(
  userId: string,
  quoteId: string,
): Promise<{ quote: Quote; items: QuoteItem[] } | null> {
  const { data: source } = await supabaseAdmin
    .from('quotes')
    .select('*')
    .eq('id', quoteId)
    .eq('user_id', userId)   // scoped to the owner: a token is not authority to invoice
    .maybeSingle()

  if (!source) return null

  const { data: sourceItems } = await supabaseAdmin
    .from('quote_items').select('*').eq('quote_id', source.id).order('position')

  const number = await nextQuoteNumber(userId, 'invoice')

  // An invoice raised from a quote the customer already paid is a receipt, not
  // a demand. Carried across, it renders "Paid on …" and shows no Pay button;
  // left as 'sent' it would ask a paying customer for the money a second time,
  // and show up as outstanding on the tradesperson's own dashboard.
  //
  // The Paystack references are deliberately NOT copied. They are how the
  // webhook finds the quote a payment belongs to, and two rows carrying the
  // same reference makes that lookup ambiguous — it would break settlement for
  // the very payment this invoice is evidence of.
  const alreadyPaid = source.status === 'paid'

  const { data: invoice, error } = await supabaseAdmin
    .from('quotes')
    .insert({
      user_id: userId,
      customer_id: source.customer_id,
      number,
      doc_type: 'invoice',
      status: alreadyPaid ? 'paid' : 'sent',
      paid_at: alreadyPaid ? source.paid_at : null,
      charged_total: alreadyPaid ? source.charged_total : null,
      subtotal: source.subtotal,
      vat_amount: source.vat_amount,
      total: source.total,
      public_token: publicToken(),   // its own token — never the quote's
      notes: source.notes,
      raw_message: source.raw_message,
      sent_at: new Date().toISOString(),
    })
    .select()
    .single()

  if (error || !invoice) {
    console.error('[quotes] invoice insert failed:', error?.message)
    return null
  }

  const rows = (sourceItems ?? []).map((item, i) => ({
    quote_id: invoice.id,
    description: item.description,
    quantity: item.quantity,
    unit_price: item.unit_price,
    line_total: item.line_total,
    position: i,
  }))

  const { data: items, error: itemsError } = await supabaseAdmin
    .from('quote_items').insert(rows).select()

  if (itemsError) {
    console.error('[quotes] invoice items insert failed:', itemsError.message)
    // An invoice with no lines is worse than none — roll back rather than
    // handing the customer a link to an empty demand for money.
    await supabaseAdmin.from('quotes').delete().eq('id', invoice.id)
    return null
  }

  // Only once the invoice actually exists. 'paid' is left alone — it is further
  // along than 'accepted' and must not be walked backwards.
  if (source.status !== 'paid') {
    await supabaseAdmin.from('quotes').update({ status: 'accepted' }).eq('id', source.id)
  }

  return { quote: invoice as Quote, items: (items ?? []) as QuoteItem[] }
}

export function quoteUrl(token: string): string {
  const base = (process.env.NEXT_PUBLIC_APP_URL ?? '').replace(/\/$/, '')
  return `${base}/q/${token}`
}
