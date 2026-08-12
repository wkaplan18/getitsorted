import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export type MessageType = 'new_bill' | 'bank_update' | 'reminder' | 'quote_request' | 'unknown'

export type ExtractedLineItem = {
  description: string
  quantity: number
  unit_price: number
}

export type ExtractedBill = {
  message_type: MessageType
  payee: string | null
  amount: number | null
  due_date: string | null
  remind_at: string | null
  bank_name: string | null
  account_number: string | null
  branch_code: string | null
  reference: string | null

  // Money-in fields — only populated for message_type 'quote_request'.
  customer: string | null
  customer_address: string | null
  line_items: ExtractedLineItem[]

  // 0–1. Below QUOTE_CONFIDENCE_FLOOR the webhook asks the user to disambiguate
  // rather than guessing. Silently turning a supplier invoice into a customer
  // quote is the one failure this product cannot survive.
  confidence: number
}

/** Below this, ask the user whether it's a bill or a quote instead of guessing. */
export const QUOTE_CONFIDENCE_FLOOR = 0.75

// The prompt is built per-call so it always carries today's date — without it the
// model can't resolve relative dates like "due Friday" or "end of the month".
function extractionPrompt(): string {
  const now = new Date()
  const sa = new Intl.DateTimeFormat('en-ZA', {
    timeZone: 'Africa/Johannesburg',
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(now)

  return `You are Sorted, a money assistant for South African households and one-person trade businesses. Parse WhatsApp messages about bills, invoices, banking details, payment reminders, and quotes the user wants to SEND to their own customers.

Right now in South Africa it is: ${sa}. Use this to resolve relative dates ("Friday", "end of the month", "tomorrow at 2pm") to absolute dates.

The user may write in English, isiZulu, isiXhosa, Afrikaans, Sesotho, or a mix of these. Understand all of them. Always return the JSON values in the language the user used for free text (names, descriptions), but keep numbers as numbers.

Return ONLY valid JSON:
{
  "message_type": "new_bill" | "bank_update" | "reminder" | "quote_request" | "unknown",
  "payee": "who to pay, which payee the bank details belong to, or what the reminder is about",
  "amount": 0.00,
  "due_date": "YYYY-MM-DD or null",
  "remind_at": "YYYY-MM-DDTHH:MM (SAST, 24h) or null — only for reminders that mention a specific date and/or time to be nudged at",
  "bank_name": "FNB / Standard Bank / ABSA / Nedbank / Capitec / etc or null",
  "account_number": "as string or null",
  "branch_code": "as string or null",
  "reference": "payment reference or null",
  "customer": "quote_request only: who the quote is FOR, or null",
  "customer_address": "quote_request only: the customer's address if mentioned, else null",
  "line_items": [{ "description": "what the work is", "quantity": 1, "unit_price": 0.00 }],
  "confidence": 0.0
}

message_type rules — MONEY OUT (the user owes it):
- "new_bill": a payment request or invoice WITH a specific amount (e.g. "pay ballet R850", "vet bill R2000 due Friday")
- "reminder": a nudge or note about a payment with NO specific amount attached (e.g. "don't forget to pay the vet", "your account is overdue, please pay")
- "bank_update": the user is providing/updating banking details for a known payee, with NO amount or a separate payee reference (e.g. "ballet banking details are FNB 98887765")

message_type rules — MONEY IN (the user is charging someone else):
- "quote_request": the user is pricing work they will do FOR a customer (e.g. "Quote for Mrs Naidoo, paint 3 bedrooms R850 each, materials R1200", "price for Sipho: fix geyser R1500")

Deciding between new_bill and quote_request — this distinction matters more than anything else here:
- Strong quote_request signals: the words quote/quotation/estimate/price/charge; a named customer introduced with "for"/"vir"/"ka-"; MULTIPLE priced line items; per-unit pricing ("R850 each", "3 x R850"); a job description in first person ("paint", "install", "fix"); a customer address.
- Strong new_bill signals: bank details present; an account or reference number; a due date; "I owe"; the message reads like it came FROM a supplier rather than from the user.
- If genuinely ambiguous, still pick your best guess but set confidence below 0.75 so the app can ask.

"unknown": cannot determine intent at all.

Other rules:
- payee: NEVER null for new_bill/reminder/bank_update — use the service/activity if no name (e.g. 'Ballet lessons', 'Vet', 'Dog grooming'). Null for quote_request.
- amount: number only, strip R/ZAR. Null if not present. For quote_request leave null — the total comes from line_items.
- line_items: ONLY for quote_request, else []. Split the work into one entry per priced thing. "paint 3 bedrooms R850 each" is quantity 3, unit_price 850. "materials R1200" is quantity 1, unit_price 1200. Never invent a price that was not stated — if a job is described with no price, use unit_price 0 and let the app ask.
- customer: for quote_request, the person being quoted, exactly as written. Null if not stated.
- remind_at: for reminders like "remind me at 2pm" or "on Monday morning" resolve to an absolute datetime. If only a date is given, use 08:00. Null if no time or date is mentioned.
- branch_code: infer from bank if not stated (FNB=250655, Standard Bank=051001, ABSA=632005, Nedbank=198765, Capitec=470010)
- confidence: how sure you are of message_type specifically. 0.95+ when unmistakable, below 0.75 when a human would need to ask.
- Return ONLY the JSON, no markdown, no explanation`
}

function stripFence(raw: string): string {
  return raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim()
}

// The model occasionally returns numbers as strings ("850", "R850") or omits a
// field entirely. Normalise here so every caller can rely on the shape rather
// than defending against it — a NaN unit_price silently becomes a R0 line on a
// customer-facing quote otherwise.
function num(value: unknown, fallback = 0): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const parsed = parseFloat(value.replace(/[^\d.-]/g, ''))
    if (Number.isFinite(parsed)) return parsed
  }
  return fallback
}

function normaliseItems(value: unknown): ExtractedLineItem[] {
  if (!Array.isArray(value)) return []
  return value
    .map(raw => {
      const item = (raw ?? {}) as Record<string, unknown>
      return {
        description: String(item.description ?? '').trim(),
        quantity: num(item.quantity, 1),
        unit_price: num(item.unit_price, 0),
      }
    })
    .filter(item => item.description.length > 0)
}

function parseJSON(raw: string): ExtractedBill {
  const parsed = JSON.parse(stripFence(raw)) as Record<string, unknown>
  // Defaults first so older/partial responses can't leave a field undefined.
  return {
    message_type: 'unknown',
    payee: null,
    amount: null,
    due_date: null,
    remind_at: null,
    bank_name: null,
    account_number: null,
    branch_code: null,
    reference: null,
    ...parsed,
    customer: (parsed.customer as string | null) ?? null,
    customer_address: (parsed.customer_address as string | null) ?? null,
    line_items: normaliseItems(parsed.line_items),
    // A missing confidence means an older prompt shape — treat as certain so
    // existing bill behaviour is unchanged, not as uncertain (which would
    // start interrogating every household user about quotes they never sent).
    confidence: num(parsed.confidence, 1),
  } as ExtractedBill
}

export type QuoteDraft = {
  customer: string | null
  customer_address: string | null
  line_items: ExtractedLineItem[]
}

/**
 * Applies a plain-language edit to a draft quote — "change materials to 1500",
 * "add gate R400", "drop the second one", "shintsha materials ku-1500".
 *
 * Returns the complete new item list, not a diff: asking the model for a whole
 * replacement is far more reliable than asking it to describe a mutation, and
 * the draft is small enough that the extra tokens are irrelevant.
 */
export async function applyQuoteEdit(draft: QuoteDraft, instruction: string): Promise<QuoteDraft> {
  const prompt = `You are editing a draft quote for a South African tradesperson.

Current draft:
${JSON.stringify(draft, null, 2)}

The user said: "${instruction}"

Apply that change and return the COMPLETE updated draft as JSON in exactly this shape:
{
  "customer": "name or null",
  "customer_address": "address or null",
  "line_items": [{ "description": "...", "quantity": 1, "unit_price": 0.00 }]
}

Rules:
- The user may write in English, isiZulu, isiXhosa, Afrikaans, Sesotho or a mix. Understand all of them.
- Keep every line the user did not ask you to change, exactly as it is.
- Never invent a price. If the user adds work without a price, use unit_price 0.
- If the instruction makes no sense as an edit, return the draft unchanged.
- Return ONLY the JSON, no markdown, no explanation.`

  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1024,
    messages: [{ role: 'user', content: prompt }],
  })
  const raw = (response.content[0] as { type: string; text: string }).text
  const parsed = JSON.parse(stripFence(raw)) as Record<string, unknown>
  return {
    customer: (parsed.customer as string | null) ?? draft.customer,
    customer_address: (parsed.customer_address as string | null) ?? draft.customer_address,
    line_items: normaliseItems(parsed.line_items),
  }
}

export async function extractBillFromText(text: string): Promise<ExtractedBill> {
  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1024,
    messages: [{ role: 'user', content: `${extractionPrompt()}\n\nMessage:\n${text}` }]
  })
  const raw = (response.content[0] as { type: string; text: string }).text
  return parseJSON(raw)
}

// caption: any text the sender attached alongside the file — it often carries the
// due date or reference that the invoice itself is missing.
export async function extractBillFromPDF(base64Data: string, caption?: string): Promise<ExtractedBill> {
  const prompt = caption
    ? `${extractionPrompt()}\n\nThe sender attached this note to the document: "${caption}"`
    : extractionPrompt()
  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1024,
    messages: [{
      role: 'user',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      content: [
        { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64Data } },
        { type: 'text', text: prompt }
      ] as any
    }]
  })
  const raw = (response.content[0] as { type: string; text: string }).text
  return parseJSON(raw)
}

export async function extractBillFromImage(base64Data: string, mimeType: 'image/jpeg' | 'image/png' | 'image/webp', caption?: string): Promise<ExtractedBill> {
  const prompt = caption
    ? `${extractionPrompt()}\n\nThe sender attached this note to the image: "${caption}"`
    : extractionPrompt()
  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1024,
    messages: [{
      role: 'user',
      content: [
        { type: 'image', source: { type: 'base64', media_type: mimeType, data: base64Data } },
        { type: 'text', text: prompt }
      ]
    }]
  })
  const raw = (response.content[0] as { type: string; text: string }).text
  return parseJSON(raw)
}
