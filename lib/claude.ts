import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export type ExtractedBill = {
  payee: string | null
  amount: number | null
  due_date: string | null       // ISO format: YYYY-MM-DD
  bank_name: string | null
  account_number: string | null
  branch_code: string | null
  reference: string | null
}

const EXTRACTION_PROMPT = `You are extracting payment details from a South African invoice or bill.

Extract the following fields and return ONLY valid JSON, nothing else:
{
  "payee": "name of the person or company to pay",
  "amount": 0.00,
  "due_date": "YYYY-MM-DD or null if not found",
  "bank_name": "FNB / Standard Bank / ABSA / Nedbank / Capitec / etc or null",
  "account_number": "account number as string or null",
  "branch_code": "branch code as string or null",
  "reference": "payment reference or null"
}

Rules:
- amount must be a number (no currency symbols)
- If due date is not explicit but says "end of month", use the last day of the current month
- branch_code: if not stated, infer from bank (FNB=250655, Standard Bank=051001, ABSA=632005, Nedbank=198765, Capitec=470010)
- If a field cannot be found, use null
- Return ONLY the JSON object, no explanation`

function parseJSON(raw: string): ExtractedBill {
  const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim()
  return JSON.parse(cleaned) as ExtractedBill
}

export async function extractBillFromText(text: string): Promise<ExtractedBill> {
  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 512,
    messages: [{
      role: 'user',
      content: `${EXTRACTION_PROMPT}\n\nInvoice content:\n${text}`
    }]
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
        {
          type: 'document',
          source: { type: 'base64', media_type: 'application/pdf', data: base64Data }
        },
        {
          type: 'text',
          text: EXTRACTION_PROMPT
        }
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
        {
          type: 'image',
          source: {
            type: 'base64',
            media_type: mimeType,
            data: base64Data
          }
        },
        {
          type: 'text',
          text: EXTRACTION_PROMPT
        }
      ]
    }]
  })

  const raw = (response.content[0] as { type: string; text: string }).text
  return parseJSON(raw)
}
