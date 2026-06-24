// Meta Cloud API — WhatsApp messaging (direct, no third-party BSP)
// Docs: https://developers.facebook.com/docs/whatsapp/cloud-api

const BASE = 'https://graph.facebook.com/v19.0'

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

export function formatBillConfirmation(payee: string, amount: number, dueDate: string | null): string {
  return `Got it! ✓\n\nR${amount.toFixed(2)} to *${payee}*\n\nView your dashboard:\n${process.env.NEXT_PUBLIC_APP_URL}`
}

export function formatIncompleteConfirmation(payee: string, amount: number, dueDate: string | null): string {
  return `Got it — R${amount.toFixed(2)} to *${payee}*.\n\nI don't have their banking details yet. Add them on the dashboard:\n${process.env.NEXT_PUBLIC_APP_URL}`
}

export function formatReminder(payee: string, amount: number, dueDate: string, accountNumber: string | null, reference: string | null): string {
  const due = new Date(dueDate).toLocaleDateString('en-ZA', { day: 'numeric', month: 'long' })
  let msg = `Reminder: R${amount.toFixed(2)} due to *${payee}* on ${due}`
  if (accountNumber) msg += `\nAccount: ${accountNumber}`
  if (reference) msg += `\nRef: ${reference}`
  msg += `\n\n${process.env.NEXT_PUBLIC_APP_URL}`
  return msg
}

export function formatOTP(otp: string): string {
  return `Your Sorted login code is: *${otp}*\n\nExpires in 10 minutes.`
}
