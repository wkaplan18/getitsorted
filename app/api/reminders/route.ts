import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { sendWhatsApp, formatReminder } from '@/lib/whatsapp'

// Called daily by cron-job.org
// Set up at cron-job.org: GET https://your-app.vercel.app/api/reminders?secret=YOUR_CRON_SECRET
export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get('secret')
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const today = new Date()
  const in3Days = new Date(today)
  in3Days.setDate(today.getDate() + 3)
  const dateStr = in3Days.toISOString().split('T')[0]

  // Find all pending bills due in exactly 3 days that haven't been reminded yet
  const { data: bills } = await supabaseAdmin
    .from('bills')
    .select('*, users(whatsapp_number)')
    .eq('status', 'pending')
    .eq('due_date', dateStr)
    .eq('reminder_sent', false)

  if (!bills || bills.length === 0) {
    return NextResponse.json({ sent: 0 })
  }

  let sent = 0
  for (const bill of bills) {
    const user = (bill as { users: { whatsapp_number: string } }).users
    if (!user?.whatsapp_number) continue

    const message = formatReminder(
      bill.payee,
      bill.amount,
      bill.due_date,
      bill.account_number,
      bill.reference
    )

    await sendWhatsApp(user.whatsapp_number, message)

    await supabaseAdmin
      .from('bills')
      .update({ reminder_sent: true })
      .eq('id', bill.id)

    sent++
  }

  return NextResponse.json({ sent })
}
