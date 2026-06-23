// Clickatell Chat Commerce / One API — WhatsApp messaging
// Docs: https://docs.clickatell.com

const BASE_URL = 'https://platform.clickatell.com'

async function post(path: string, body: object) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: {
      'Authorization': process.env.CLICKATELL_API_KEY!,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    body: JSON.stringify(body)
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Clickatell error ${res.status}: ${text}`)
  }
  return res.json()
}

export async function sendWhatsApp(to: string, message: string) {
  // to: SA number in international format e.g. 27821234567
  return post('/v1/message', {
    messages: [{
      channel: 'whatsapp',
      to,
      content: message
    }]
  })
}

export function formatBillConfirmation(payee: string, amount: number, dueDate: string | null): string {
  const due = dueDate
    ? new Date(dueDate).toLocaleDateString('en-ZA', { day: 'numeric', month: 'long', year: 'numeric' })
    : 'no due date found'
  return `Got it! ✓\n\nR${amount.toFixed(2)} to *${payee}*\nDue: ${due}\n\nI'll remind you 3 days before. View all bills at ${process.env.NEXT_PUBLIC_APP_URL}`
}

export function formatReminder(payee: string, amount: number, dueDate: string, accountNumber: string | null, reference: string | null): string {
  const due = new Date(dueDate).toLocaleDateString('en-ZA', { day: 'numeric', month: 'long' })
  let msg = `Reminder: R${amount.toFixed(2)} due to *${payee}* on ${due}`
  if (accountNumber) msg += `\nAccount: ${accountNumber}`
  if (reference) msg += `\nRef: ${reference}`
  msg += `\n\n${process.env.NEXT_PUBLIC_APP_URL}`
  return msg
}

export function formatIncompleteConfirmation(payee: string, amount: number, dueDate: string | null): string {
  const due = dueDate
    ? new Date(dueDate).toLocaleDateString('en-ZA', { day: 'numeric', month: 'long', year: 'numeric' })
    : 'no due date'
  return `Got it — R${amount.toFixed(2)} to *${payee}* (${due}).\n\nI don't have their banking details yet. Add them on the dashboard: ${process.env.NEXT_PUBLIC_APP_URL}`
}

export function formatOTP(otp: string): string {
  return `Your Sorted login code is: *${otp}*\n\nExpires in 10 minutes.`
}
