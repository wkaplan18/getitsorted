// Sorted — replies that are needed from two places: a typed keyword (QUOTES,
// BILLS, LOGIN) and the numbered MENU.
//
// These build the message and return it rather than sending it, so the caller
// decides what else goes with it. Kept out of both the webhook and convo.ts
// because importing either one from the other would be a cycle.

import { supabaseAdmin } from './supabase'
import { t, fmtRand, type Lang } from './i18n'

/** The user's five most recent quotes, or the "none yet" line. */
export async function recentQuotesMessage(userId: string | null, lang: Lang): Promise<string> {
  if (!userId) return t(lang, 'quotes_none')

  const { data: quotes } = await supabaseAdmin
    .from('quotes')
    .select('number, total, status, customers(name)')
    .eq('user_id', userId)
    .neq('status', 'cancelled')
    .order('created_at', { ascending: false })
    .limit(5)

  if (!quotes || quotes.length === 0) return t(lang, 'quotes_none')

  const lines = quotes.map(q => {
    // Supabase renders a foreign-key join as an array, not an object.
    const joined = q.customers as unknown
    const customer = Array.isArray(joined) ? joined[0]?.name : (joined as { name?: string } | null)?.name
    const who = customer ? ` — ${customer}` : ''
    return `• ${q.number}${who} — ${fmtRand(Number(q.total))} (${q.status})`
  })
  return `${t(lang, 'quotes_header')}\n\n${lines.join('\n')}`
}

/** Everything still owed, oldest due first. */
export async function pendingBillsMessage(userId: string | null): Promise<string> {
  if (!userId) {
    return `You don't have any bills with me yet. Forward an invoice or type one (e.g. "pay ballet R850 by Friday") to get started.`
  }

  const { data: bills } = await supabaseAdmin
    .from('bills')
    .select('payee, amount, due_date')
    .eq('user_id', userId)
    .in('status', ['pending', 'overdue'])
    .order('due_date', { ascending: true, nullsFirst: false })

  if (!bills || bills.length === 0) return `Nothing pending — you're all sorted! ✅`

  const total = bills.reduce((sum, b) => sum + Number(b.amount), 0)
  const lines = bills.map(b => {
    const due = b.due_date
      ? ` (due ${new Date(b.due_date).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' })})`
      : ''
    return `• R${Number(b.amount).toFixed(2)} — ${b.payee}${due}`
  })
  return `You have ${bills.length} pending bill${bills.length > 1 ? 's' : ''} totalling *R${total.toFixed(2)}*:\n\n${lines.join('\n')}\n\nPay them from your dashboard:\n${process.env.NEXT_PUBLIC_APP_URL}`
}

/**
 * Generates a dashboard OTP and returns the message carrying it.
 *
 * WhatsApp only allows free-form replies to numbers that messaged us first,
 * which is why the code is requested from this side rather than pushed out when
 * someone visits the website.
 */
export async function issueLoginCode(from: string): Promise<string> {
  const otp = Math.floor(100000 + Math.random() * 900000).toString()
  const expires = new Date(Date.now() + 5 * 60 * 1000).toISOString()

  let { error } = await supabaseAdmin
    .from('users')
    .upsert({ whatsapp_number: from, otp, otp_expires_at: expires, otp_attempts: 0 }, { onConflict: 'whatsapp_number' })

  // Retry without otp_attempts in case the column migration hasn't run yet — a
  // schema lag must never break login (see the bills.unconfirmed incident).
  if (error) {
    ({ error } = await supabaseAdmin
      .from('users')
      .upsert({ whatsapp_number: from, otp, otp_expires_at: expires }, { onConflict: 'whatsapp_number' }))
  }
  if (error) {
    console.error('OTP save failed', error)
    return `Something went wrong generating your code — please try again in a minute.`
  }

  return `Your Sorted login code is *${otp}*\n\nExpires in 5 minutes.`
}