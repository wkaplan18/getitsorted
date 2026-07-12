// Meta Cloud API — WhatsApp messaging (direct, no third-party BSP)
// Docs: https://developers.facebook.com/docs/whatsapp/cloud-api

const BASE = 'https://graph.facebook.com/v19.0'

async function sendTemplate(to: string, name: string, params: string[]) {
  const res = await fetch(`${BASE}/${process.env.META_PHONE_NUMBER_ID}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.META_ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to,
      type: 'template',
      template: {
        name,
        language: { code: 'en_US' },
        components: [{
          type: 'body',
          parameters: params.map(text => ({ type: 'text', text })),
        }],
      },
    }),
  })
  if (!res.ok) throw new Error(`Meta API error ${res.status}: ${await res.text()}`)
  return res.json()
}

async function sendMessage(to: string, body: string) {
  const res = await fetch(`${BASE}/${process.env.META_PHONE_NUMBER_ID}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.META_ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to,
      type: 'text',
      text: { body },
    }),
  })
  if (!res.ok) throw new Error(`Meta API error ${res.status}: ${await res.text()}`)
  return res.json()
}

export async function sendWhatsAppTemplate(to: string, name: string, params: string[]) {
  return sendTemplate(to, name, params)
}

// Meta template variables can't contain newlines/tabs or run past ~60 chars cleanly —
// collapse whitespace and truncate so arbitrary reminder text is safe to send.
export function sanitizeTemplateParam(text: string, maxLength = 60): string {
  const collapsed = text.replace(/\s+/g, ' ').trim()
  return collapsed.length > maxLength ? collapsed.slice(0, maxLength - 1) + '…' : collapsed
}

export async function sendWhatsApp(to: string, message: string) {
  // to: SA number without + e.g. 27821234567
  return sendMessage(to, message)
}

// Download a media file by its Meta media ID — returns base64 string + mime type
export async function downloadMedia(mediaId: string): Promise<{ base64: string; mimeType: string }> {
  // Step 1: get the download URL
  const urlRes = await fetch(`${BASE}/${mediaId}`, {
    headers: { Authorization: `Bearer ${process.env.META_ACCESS_TOKEN}` },
  })
  const { url, mime_type } = await urlRes.json()

  // Step 2: download the actual file
  const fileRes = await fetch(url, {
    headers: { Authorization: `Bearer ${process.env.META_ACCESS_TOKEN}` },
  })
  const buffer = await fileRes.arrayBuffer()
  return { base64: Buffer.from(buffer).toString('base64'), mimeType: mime_type }
}

// viaSender: true when this is replying to a trusted sender forwarding something on
// someone else's behalf, rather than the account owner messaging themselves. That
// person has no dashboard of their own, so the reply thanks them instead of pointing
// them at a link that isn't theirs.
export function formatBillConfirmation(payee: string, amount: number, dueDate: string | null, viaSender = false): string {
  if (viaSender) return `Nice one! 🙌 R${amount.toFixed(2)} to *${payee}* is sorted — thanks for the heads up, it's landed safely.`
  return `Got it! ✓\n\nR${amount.toFixed(2)} to *${payee}*\n\nView your dashboard:\n${process.env.NEXT_PUBLIC_APP_URL}`
}

export function formatIncompleteConfirmation(payee: string, amount: number, dueDate: string | null, viaSender = false): string {
  if (viaSender) return `Got it, thank you! 🙏 R${amount.toFixed(2)} to *${payee}* is logged — just need their banking details before it can be paid.`
  return `Got it — R${amount.toFixed(2)} to *${payee}*.\n\nI don't have their banking details yet. Add them on the dashboard:\n${process.env.NEXT_PUBLIC_APP_URL}`
}

export function formatReminderConfirmation(payee: string, viaSender = false): string {
  if (viaSender) return `Noted, thank you! 📌 I've passed along the reminder about *${payee}*.`
  return `Noted! ✓\n\nReminder about *${payee}* added to the dashboard:\n${process.env.NEXT_PUBLIC_APP_URL}`
}

export function formatReminder(payee: string, amount: number, dueDate: string, accountNumber: string | null, reference: string | null): string {
  const due = new Date(dueDate).toLocaleDateString('en-ZA', { day: 'numeric', month: 'long' })
  let msg = `Reminder: R${amount.toFixed(2)} due to *${payee}* on ${due}`
  if (accountNumber) msg += `\nAccount: ${accountNumber}`
  if (reference) msg += `\nRef: ${reference}`
  msg += `\n\n${process.env.NEXT_PUBLIC_APP_URL}`
  return msg
}

export function formatOverdueReminder(payee: string, amount: number, dueDate: string, accountNumber: string | null, reference: string | null): string {
  const due = new Date(dueDate).toLocaleDateString('en-ZA', { day: 'numeric', month: 'long' })
  let msg = `⚠️ Overdue: R${amount.toFixed(2)} to *${payee}* was due on ${due}`
  if (accountNumber) msg += `\nAccount: ${accountNumber}`
  if (reference) msg += `\nRef: ${reference}`
  msg += `\n\nPay it or mark it paid on your dashboard:\n${process.env.NEXT_PUBLIC_APP_URL}`
  return msg
}

