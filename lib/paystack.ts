// Paystack — one-off transactions for customer quote payments.
//
// Replaces the parked Stitch integration. Chosen because it is already working
// in SnagIT, supports SA cards, EFT and Capitec Pay, and settles into a local
// bank account without the merchant needing to be VAT-registered.
//
// This is deliberately NOT the subscription API SnagIT uses — a tradesman's
// customer pays once, per job. Transaction Initialize is the whole surface.

import { createHmac, timingSafeEqual } from 'crypto'

const BASE = 'https://api.paystack.co'

function secretKey(): string {
  const key = process.env.PAYSTACK_SECRET_KEY
  if (!key) throw new Error('PAYSTACK_SECRET_KEY is not set')
  return key
}

export function paystackConfigured(): boolean {
  return Boolean(process.env.PAYSTACK_SECRET_KEY)
}

export type PaymentLink = {
  authorization_url: string
  reference: string
}

/**
 * Creates a hosted payment page for one quote.
 *
 * `amountRands` is converted to kobo/cents — Paystack works in the smallest
 * currency unit and silently misbills if you send rands. Rounded rather than
 * truncated so R3,750.005 never becomes R3,750.00 short.
 */
export async function createPaymentLink(opts: {
  amountRands: number
  reference: string
  email: string
  quoteNumber: string
  businessName: string
  callbackUrl: string
}): Promise<PaymentLink> {
  const res = await fetch(`${BASE}/transaction/initialize`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${secretKey()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      amount: Math.round(opts.amountRands * 100),
      currency: 'ZAR',
      reference: opts.reference,
      email: opts.email,
      callback_url: opts.callbackUrl,
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
