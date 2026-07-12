import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export type ExtractedBill = {
  message_type: 'new_bill' | 'bank_update' | 'reminder' | 'unknown'
  payee: string | null
  amount: number | null
  due_date: string | null
  remind_at: string | null
  bank_name: string | null
  account_number: string | null
  branch_code: string | null
  reference: string | null
}

// The prompt is built per-call so it always carries today's date — without it the
// model can't resolve relative dates like "due Friday" or "end of the month".
function extractionPrompt(): string {
  const now = new Date()
  const sa = new Intl.DateTimeFormat('en-ZA', {
    timeZone: 'Africa/Johannesburg',
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(now)

  return `You are a payment assistant for South African parents. Parse WhatsApp messages about bills, invoices, banking details, and payment reminders.

Right now in South Africa it is: ${sa}. Use this to resolve relative dates ("Friday", "end of the month", "tomorrow at 2pm") to absolute dates.

Return ONLY valid JSON:
{
  "message_type": "new_bill" | "bank_update" | "reminder" | "unknown",
  "payee": "who to pay, which payee the bank details belong to, or what the reminder is about",
  "amount": 0.00,
  "due_date": "YYYY-MM-DD or null",
  "remind_at": "YYYY-MM-DDTHH:MM (SAST, 24h) or null — only for reminders that mention a specific date and/or time to be nudged at",
  "bank_name": "FNB / Standard Bank / ABSA / Nedbank / Capitec / etc or null",
  "account_number": "as string or null",
  "branch_code": "as string or null",
  "reference": "payment reference or null"
}

message_type rules:
- "new_bill": a payment request or invoice WITH a specific amount (e.g. "pay ballet R850", "vet bill R2000 due Friday")
- "reminder": a nudge or note about a payment with NO specific amount attached (e.g. "don't forget to pay the vet", "remind dad the school fees are due Friday", "your account is overdue, please pay")
- "bank_update": the user is providing/updating banking details for a known payee, with NO amount or a separate payee reference (e.g. "ballet banking details are FNB 98887765", "swimming coach account is 1234 Capitec")
- "unknown": cannot determine intent

Other rules:
- payee: NEVER null — use the service/activity if no name (e.g. 'Ballet lessons', 'Vet', 'Dog grooming')
- amount: number only, strip R/ZAR. Null if not present
- remind_at: for reminders like "remind me at 2pm" or "on Monday morning" resolve to an absolute datetime. If only a date is given, use 08:00. Null if no time or date is mentioned.
- branch_code: infer from bank if not stated (FNB=250655, Standard Bank=051001, ABSA=632005, Nedbank=198765, Capitec=470010)
- Return ONLY the JSON, no markdown, no explanation`
}

function parseJSON(raw: string): ExtractedBill {
  const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim()
  const parsed = JSON.parse(cleaned)
  // Older prompt versions had no remind_at — normalise so callers can rely on it
  return { remind_at: null, ...parsed } as ExtractedBill
}

export async function extractBillFromText(text: string): Promise<ExtractedBill> {
  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 512,
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
    max_tokens: 512,
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
    max_tokens: 512,
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
