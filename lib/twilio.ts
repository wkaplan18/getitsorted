import twilio from 'twilio'

const client = twilio(process.env.TWILIO_ACCOUNT_SID!, process.env.TWILIO_AUTH_TOKEN!)
const FROM = `whatsapp:${process.env.TWILIO_WHATSAPP_NUMBER}`

export async function sendWhatsApp(to: string, message: string) {
  // to: SA number without leading + e.g. 27821234567
  return client.messages.create({
    from: FROM,
    to: `whatsapp:+${to}`,
    body: message,
  })
}

export function formatBillConfirmation(payee: string, amount: number, dueDate: string | null): string {
  const due = dueDate
    ? new Date(dueDate).toLocaleDateString('en-ZA', { day: 'numeric', month: 'long', year: 'numeric' })
    : 'no due date found'
  return `Got it! ✓\n\nR${amount.toFixed(2)} to *${payee}*\nDue: ${due}\n\nI'll remind you 3 days before.\n${process.env.NEXT_PUBLIC_APP_URL}`
}

export function formatIncompleteConfirmation(payee: string, amount: number, dueDate: string | null): string {
  const due = dueDate
    ? new Date(dueDate).toLocaleDateString('en-ZA', { day: 'numeric', month: 'long', year: 'numeric' })
    : 'no due date'
  return `Got it — R${amount.toFixed(2)} to *${payee}* (${due}).\n\nI don't have their banking details yet. Add them on the dashboard:\n${process.env.NEXT_PUBLIC_APP_URL}`
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
