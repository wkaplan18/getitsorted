// Paystack — one-off transactions for customer quote payments.
//
// Replaces the parked Stitch integration. Chosen because it is already working
// in SnagIT, supports SA cards, EFT and Capitec Pay, and settles into a local
// bank account without the merchant needing to be VAT-registered.
//
// This is deliberately NOT the subscription API SnagIT uses — a tradesman's
// customer pays once, per job. Transaction Initialize is the whole surface.

import { createHmac, timingSafeEqual } from 'crypto'
import { SA_BANKS } from './banks'

const BASE = 'https://api.paystack.co'

function secretKey(): string {
  const key = process.env.PAYSTACK_SECRET_KEY
  if (!key) throw new Error('PAYSTACK_SECRET_KEY is not set')
  return key
}

export function paystackConfigured(): boolean {
  return Boolean(process.env.PAYSTACK_SECRET_KEY)
}

/**
 * Normalises an SA number to the bare international form the database uses
 * (27821234567), so the allowlist below can be written however it comes to
 * hand — 0828986780, +27 82 898 6780, 27828986780 all land in the same place.
 */
function normaliseSaNumber(input: string): string {
  const digits = input.replace(/\D/g, '')
  if (digits.startsWith('27')) return digits
  if (digits.startsWith('0')) return '27' + digits.slice(1)
  if (digits.length === 9) return '27' + digits          // 828986780
  return digits
}

/**
 * Whether card payments are switched on for this tradesperson.
 *
 * PAYSTACK_ALLOWED_NUMBERS is a comma-separated allowlist. While it is set,
 * only those numbers get a card button and a subaccount; everyone else keeps
 * working exactly as before, on EFT. Unset means everyone — so it has to be
 * deliberately cleared to go live, never accidentally.
 *
 * Fail-closed on a blank-but-present value: `PAYSTACK_ALLOWED_NUMBERS=` reads
 * as "nobody", not "everybody", because the likeliest way that happens is a
 * half-finished edit in the Vercel dashboard.
 */
export function cardPaymentsEnabledFor(whatsappNumber: string | null | undefined): boolean {
  const raw = process.env.PAYSTACK_ALLOWED_NUMBERS
  if (raw === undefined) return true
  if (!whatsappNumber) return false

  const allowed = raw.split(',').map(n => normaliseSaNumber(n)).filter(Boolean)
  return allowed.includes(normaliseSaNumber(whatsappNumber))
}

// ---------------------------------------------------------------------------
// Fees
//
// The tradesperson must receive his quote total to the cent — that is the
// number he agreed with his customer and the number printed on the PDF. So the
// customer is charged the total plus everything it costs to move the money,
// shown to him as one "convenience fee" line.
//
// Change these three numbers and nothing else: every amount in the app is
// derived from them.
// ---------------------------------------------------------------------------

/** Sorted's cut, in cents. Taken via `transaction_charge` on each payment. */
export const SORTED_FEE_CENTS = 200

/**
 * Paystack's published SA rate for local cards: 2.9% + R1.
 *
 * Published EX-VAT, which every comparison site quotes and none of them
 * mention. Paystack is a South African entity, so 15% goes on top and the real
 * cost is 3.335% + R1.15. Measured, not assumed: a R4,637.49 test charge was
 * billed R155.82, and (0.029 × 4637.49 + 1) × 1.15 = R155.81. Budgeting the
 * ex-VAT number left the tradesperson R20.33 short on a R4,500 job.
 */
const PAYSTACK_PERCENT = 0.029
const PAYSTACK_FLAT_CENTS = 100
const PAYSTACK_VAT = 0.15

/**
 * A few cents of headroom. Paystack rounds its own fee to whole cents at a
 * step we can't see — the test came in 1c above the exact calculation. The
 * shortfall lands on the tradesperson, so it is bought off for 5c of the
 * customer's money rather than left to chance.
 */
const ROUNDING_BUFFER_CENTS = 5

export type FeeBreakdown = {
  /** What the tradesperson receives — exactly the quote total. */
  quoteTotalCents: number
  /** The single line the customer sees added to his bill. */
  convenienceFeeCents: number
  /** What the customer is actually charged. */
  chargeCents: number
}

/**
 * Works out what to charge so that, after Paystack's percentage fee is taken
 * off the grossed-up amount, the tradesperson is left with exactly his total.
 *
 * The fee is levied on the final charge, not on the quote, which makes this
 * circular — solving it rather than adding a fee on top is the only way the
 * arithmetic closes:
 *
 *   charge = (total + sorted fee + paystack flat inc VAT) / (1 - paystack percent inc VAT)
 *
 * Rounded UP: a half-cent of rounding has to come out of the customer's side,
 * never out of the amount the tradesperson was promised.
 */
export function grossUp(quoteTotalRands: number): FeeBreakdown {
  const quoteTotalCents = Math.round(quoteTotalRands * 100)
  const percent = PAYSTACK_PERCENT * (1 + PAYSTACK_VAT)
  const flatCents = PAYSTACK_FLAT_CENTS * (1 + PAYSTACK_VAT)
  const chargeCents = Math.ceil(
    (quoteTotalCents + SORTED_FEE_CENTS + flatCents + ROUNDING_BUFFER_CENTS) / (1 - percent)
  )
  return {
    quoteTotalCents,
    chargeCents,
    convenienceFeeCents: chargeCents - quoteTotalCents,
  }
}

// ---------------------------------------------------------------------------
// Subaccounts — one per tradesperson, so Paystack settles into HIS bank
// account and the money never passes through Sorted's balance. Holding other
// people's money and paying it out is a different, licensed business.
// ---------------------------------------------------------------------------

type PaystackBank = { name: string; code: string }

// Paystack's SA bank list is static in practice and costs a round trip, so it
// is fetched once per server instance. A cold start re-fetches; that is fine,
// this runs only when someone finishes onboarding.
let bankCache: PaystackBank[] | null = null

async function listBanks(): Promise<PaystackBank[]> {
  if (bankCache) return bankCache
  const res = await fetch(`${BASE}/bank?currency=ZAR`, {
    headers: { Authorization: `Bearer ${secretKey()}` },
  })
  const body = await res.json().catch(() => null)
  if (!res.ok || !body?.status) {
    throw new Error(`Paystack bank list failed (${res.status}): ${body?.message ?? 'no body'}`)
  }
  bankCache = (body.data as PaystackBank[]).map(b => ({ name: b.name, code: b.code }))
  return bankCache
}

/**
 * Maps a bank name as Sorted stored it onto Paystack's own bank code.
 *
 * Deliberately not a hardcoded table: Paystack's codes are its own, they are
 * not the SA universal branch codes we already hold, and a wrong one would
 * settle a tradesperson's money into a stranger's account. Null when there is
 * no confident match — the caller must not guess.
 */
export async function paystackBankCode(bankName: string | null): Promise<string | null> {
  if (!bankName) return null
  const banks = await listBanks()
  const wanted = bankName.trim().toLowerCase()

  const exact = banks.find(b => b.name.trim().toLowerCase() === wanted)
  if (exact) return exact.code

  // Fall back to the alias list the WhatsApp onboarding already uses, so
  // "FNB" finds Paystack's "First National Bank".
  const known = SA_BANKS.find(b => b.name.toLowerCase() === wanted)
  if (!known) return null

  // Longest alias first, and the alias drives the search rather than the list
  // order. Paystack carries both "Standard Bank South Africa" and "Standard
  // Chartered Bank" — matching the short alias "standard" against whichever it
  // happened to return first would eventually settle a plumber's money into
  // Standard Chartered.
  //
  // Each alias is tried three ways, narrowest first, and a tie is never broken
  // arbitrarily: "african bank" appears in both "African Bank Limited" and
  // "South African Bank of Athens", and only the prefix pass separates them.
  const names = banks.map(bank => ({ code: bank.code, name: bank.name.trim().toLowerCase() }))
  const aliases = [...known.aliases].sort((a, b) => b.length - a.length)

  for (const alias of aliases) {
    const exact = names.filter(b => b.name === alias)
    if (exact.length === 1) return exact[0].code

    const prefix = names.filter(b => b.name.startsWith(alias))
    if (prefix.length === 1) return prefix[0].code

    const anywhere = names.filter(b => b.name.includes(alias))
    if (anywhere.length === 1) return anywhere[0].code
  }
  return null
}

/**
 * Creates a Paystack subaccount and returns its code.
 *
 * `percentage_charge` is required by the API but is irrelevant here: every
 * payment passes `transaction_charge`, which Paystack documents as overriding
 * the split configuration outright ("the amount specified goes to the main
 * account regardless of the split configuration"). It is set to 0 so that if
 * an override were ever missed, the failure is Sorted earning nothing — not a
 * tradesperson losing his money.
 */
export type CreateSubaccountResult =
  | { ok: true; code: string }
  /**
   * Paystack checked the account number against the bank and refused it. This
   * is the tradesperson's typo, not our outage, and it is the one failure he
   * can actually do something about — so it is a distinct case rather than a
   * generic error, and the caller is expected to tell him.
   */
  | { ok: false; rejected: true; message: string }
  | { ok: false; rejected: false; message: string }

export async function createSubaccount(opts: {
  businessName: string
  bankCode: string
  accountNumber: string
}): Promise<CreateSubaccountResult> {
  const res = await fetch(`${BASE}/subaccount`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${secretKey()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      business_name: opts.businessName,
      settlement_bank: opts.bankCode,
      account_number: opts.accountNumber,
      percentage_charge: 0,
    }),
  })
  const body = await res.json().catch(() => null)

  if (res.ok && body?.status) return { ok: true, code: body.data.subaccount_code as string }

  const message = String(body?.message ?? `HTTP ${res.status}`)
  // Paystack answers a bad account number with 400 and "Account number is
  // invalid". Anything 5xx, or a network failure, is ours and not his.
  const rejected = res.status === 400 && /account number/i.test(message)
  return { ok: false, rejected, message }
}

export type PaymentLink = {
  authorization_url: string
  reference: string
}

/**
 * Creates a hosted payment page for one quote.
 *
 * `chargeCents` is already grossed up by grossUp() — Paystack works in the
 * smallest currency unit and silently misbills if you hand it rands.
 *
 * The split: `subaccount` sends the money to the tradesperson's own bank,
 * `transaction_charge` peels Sorted's flat R2 off to the main account, and
 * `bearer: 'subaccount'` puts Paystack's own fee on the subaccount side. That
 * last one looks like the tradesperson paying the fee, and would be, except
 * the charge was grossed up by exactly that fee first — so he still nets his
 * full total and the customer covered it. It cannot be borne by the main
 * account instead: Sorted's share is R2, and a R135 fee will not come out of
 * it.
 */
export async function createPaymentLink(opts: {
  chargeCents: number
  reference: string
  email: string
  quoteNumber: string
  businessName: string
  callbackUrl: string
  subaccount: string
}): Promise<PaymentLink> {
  const res = await fetch(`${BASE}/transaction/initialize`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${secretKey()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      amount: opts.chargeCents,
      currency: 'ZAR',
      reference: opts.reference,
      email: opts.email,
      callback_url: opts.callbackUrl,
      subaccount: opts.subaccount,
      transaction_charge: SORTED_FEE_CENTS,
      bearer: 'subaccount',
      metadata: {
        quote_number: opts.quoteNumber,
        business_name: opts.businessName,
        custom_fields: [
          { display_name: 'Quote', variable_name: 'quote', value: opts.quoteNumber },
          { display_name: 'Business', variable_name: 'business', value: opts.businessName },
        ],
      },
    }),
  })

  const body = await res.json().catch(() => null)
  if (!res.ok || !body?.status) {
    throw new Error(`Paystack initialize failed (${res.status}): ${body?.message ?? 'no response body'}`)
  }
  return {
    authorization_url: body.data.authorization_url as string,
    reference: body.data.reference as string,
  }
}

/**
 * Server-side verification of a transaction.
 *
 * The webhook is the source of truth, but the callback page also verifies —
 * the parked Stitch bug was a success page that marked things paid purely on
 * being reached, which anyone could do by visiting the URL.
 */
export async function verifyTransaction(reference: string): Promise<{
  paid: boolean
  amountRands: number
  paidAt: string | null
}> {
  const res = await fetch(`${BASE}/transaction/verify/${encodeURIComponent(reference)}`, {
    headers: { Authorization: `Bearer ${secretKey()}` },
  })
  const body = await res.json().catch(() => null)
  if (!res.ok || !body?.status) {
    return { paid: false, amountRands: 0, paidAt: null }
  }
  return {
    paid: body.data?.status === 'success',
    amountRands: (body.data?.amount ?? 0) / 100,
    paidAt: body.data?.paid_at ?? null,
  }
}

/**
 * Verifies the x-paystack-signature header (HMAC SHA-512 of the raw body).
 *
 * Must be given the RAW request text, not a re-serialised object — any
 * whitespace difference invalidates the hash. Same pattern as SnagIT's webhook.
 */
export function verifyWebhookSignature(rawBody: string, signature: string | null): boolean {
  if (!signature) return false
  const expected = createHmac('sha512', secretKey()).update(rawBody).digest('hex')
  const a = Buffer.from(expected)
  const b = Buffer.from(signature)
  // Length check first: timingSafeEqual throws on mismatched lengths.
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}
