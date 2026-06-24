import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export type ExtractedBill = {
  message_type: 'new_bill' | 'bank_update' | 'unknown'
  payee: string | null
  amount: number | null
  due_date: string | null
  bank_name: string | null
  account_number: string | null
  branch_code: string | null
  reference: string | null
}

const EXTRACTION_PROMPT = `You are a payment assistant for South African parents. Parse WhatsApp messages about bills, invoices, and banking details.

Return ONLY valid JSON:
{
  "message_type": "new_bill" | "bank_update" | "unknown",
  "payee": "who to pay or which payee the bank details belong to",
  "amount": 0.00,
  "due_date": "YYYY-MM-DD or null",
  "bank_name": "FNB / Standard Bank / ABSA / Nedbank / Capitec / etc or null",
  "account_number": "as string or null",
  "branch_code": "as string or null",
  "reference": "payment reference or null"
}

message_type rules:
- "new_bill": a payment request, invoice, or reminder with an amount (e.g. "pay ballet R850", "vet bill R2000 due Friday")
- "bank_update": the user is providing/updating banking details for a known payee, with NO amount or a separate payee reference (e.g. "ballet banking details are FNB 98887765", "swimming coach account is 1234 Capitec")
- "unknown": cannot determine intent

Other rules:
- payee: NEVER null — use the service/activity if no name (e.g. 'Ballet lessons', 'Vet', 'Dog grooming')
- amount: number only, strip R/ZAR. Null if not present
- branch_code: infer from bank if not stated (FNB=250655, Standard Bank=051001, ABSA=632005, Nedbank=198765, Capitec=470010)
- Return ONLY the JSON, no markdown, no explanation`

function parseJSON(raw: string): ExtractedBill {
  const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim()
  return JSON.parse(cleaned) as ExtractedBill
}

export async function extractBillFromText(text: string): Promise<ExtractedBill> {
  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 512,
    messages: [{ role: 'user', content: `${EXTRACTION_PROMPT}\n\nMessage:\n${text}` }]
  })
  const raw = (response.content[0] as { type: string; text: string }).text
  return parseJSON(raw)
}

export async function extractBillFromPDF(base64Data: string): Promise<ExtractedBill> {
  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 512,
    messages: [{
      role: 'user',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      content: [
        { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64Data } },
        { type: 'text', text: EXTRACTION_PROMPT }
      ] as any
    }]
  })
  const raw = (response.content[0] as { type: string; text: string }).text
  return parseJSON(raw)
}

export async function extractBillFromImage(base64Data: string, mimeType: 'image/jpeg' | 'image/png' | 'image/webp'): Promise<ExtractedBill> {
  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 512,
    messages: [{
      role: 'user',
      content: [
        { type: 'image', source: { type: 'base64', media_type: mimeType, data: base64Data } },
        { type: 'text', text: EXTRACTION_PROMPT }
      ]
    }]
  })
  const raw = (response.content[0] as { type: string; text: string }).text
  return parseJSON(raw)
}
