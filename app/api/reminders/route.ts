import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { sendWhatsApp, formatReminder, formatOverdueReminder } from '@/lib/whatsapp'

// Called by cron-job.org — run this every 15 minutes so timed reminders
// ("remind me Monday 2pm") fire close to their time. Bill nudges only go out
// once per bill regardless of how often this runs.
// GET https://your-app.vercel.app/api/reminders?secret=YOUR_CRON_SECRET

// Today's date in South Africa — Vercel runs in UTC, and SA is UTC+2, so using
// the server date directly would flip to the wrong day between 22:00 and 00:00 SA.
function saToday(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Johannesburg' }).format(new Date())
}

export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get('secret')
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const today = saToday()
  const in3Days = new Date(today)
  in3Days.setDate(in3Days.getDate() + 3)
  const horizon = in3Days.toISOString().split('T')[0]

  // Anything pending and past due becomes overdue — the dashboard shows these
  // with a red badge, and they get a firmer nudge below.
  await supabaseAdmin
    .from('bills')
    .update({ status: 'overdue' })
    .eq('status', 'pending')
    .lt('due_date', today)

  // Bills due within the next 3 days (inclusive) or already overdue, not yet
  // nudged. A window rather than an exact-date match, so bills captured late
  // (or a day the cron missed) still get their reminder.
  const { data: bills } = await supabaseAdmin
    .from('bills')
    .select('*, users(whatsapp_number)')
    .in('status', ['pending', 'overdue'])
    .eq('reminder_sent', false)
    .not('due_date', 'is', null)
    .lte('due_date', horizon)

  let sent = 0
  for (const bill of bills || []) {
    const user = (bill as { users: { whatsapp_number: string } }).users
    if (!user?.whatsapp_number) continue

    const message = bill.due_date < today
      ? formatOverdueReminder(bill.payee, bill.amount, bill.due_date, bill.account_number, bill.reference)
      : formatReminder(bill.payee, bill.amount, bill.due_date, bill.account_number, bill.reference)

    // Mark sent BEFORE sending: if the send succeeds but the update were to fail,
    // the user would be re-nudged every 15 minutes forever. The reverse failure
    // (marked but not sent) costs one missed nudge — much cheaper.
    await supabaseAdmin.from('bills').update({ reminder_sent: true }).eq('id', bill.id)

    try {
      await sendWhatsApp(user.whatsapp_number, message)
      sent++
    } catch (err) {
      console.error(`Bill reminder send failed for bill ${bill.id}:`, err)
    }
  }

  // Timed freeform reminders — "remind me Monday 2pm" — fire once when their
  // time arrives. Skips dismissed ones (already done, no point nudging).
  const { data: dueReminders } = await supabaseAdmin
    .from('reminders')
    .select('*, users(whatsapp_number)')
    .eq('nudge_sent', false)
    .eq('dismissed', false)
    .not('remind_at', 'is', null)
    .lte('remind_at', new Date().toISOString())

  let nudged = 0
  for (const reminder of dueReminders || []) {
    const user = (reminder as { users: { whatsapp_number: string } }).users
    if (!user?.whatsapp_number) continue

    await supabaseAdmin.from('reminders').update({ nudge_sent: true }).eq('id', reminder.id)

    try {
      const fromLine = reminder.sender_label ? ` (from ${reminder.sender_label})` : ''
      await sendWhatsApp(user.whatsapp_number, `⏰ Reminder${fromLine}:\n\n${reminder.message}\n\nTick it off on your dashboard:\n${process.env.NEXT_PUBLIC_APP_URL}`)
      nudged++
    } catch (err) {
      console.error(`Reminder nudge send failed for reminder ${reminder.id}:`, err)
    }
  }

  return NextResponse.json({ sent, nudged })
}
