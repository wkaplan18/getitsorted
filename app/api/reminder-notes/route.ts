import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { sessionPhone } from '@/lib/session'
import { sendWhatsAppTemplate, sanitizeTemplateParam } from '@/lib/whatsapp'

async function sessionUserId(req: NextRequest): Promise<string | null> {
  const phone = sessionPhone(req)
  if (!phone) return null
  const { data: user } = await supabaseAdmin
    .from('users')
    .select('id')
    .eq('whatsapp_number', phone)
    .single()
  return user?.id ?? null
}

// GET /api/reminder-notes — fetch all reminders for the logged-in user
export async function GET(req: NextRequest) {
  const userId = await sessionUserId(req)
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { data: reminders } = await supabaseAdmin
    .from('reminders')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  return NextResponse.json({ reminders: reminders || [] })
}

// DELETE /api/reminder-notes?id=xxx — delete one of the logged-in user's reminders
// DELETE /api/reminder-notes?dismissed=true — delete all of their dismissed (done) reminders
export async function DELETE(req: NextRequest) {
  const userId = await sessionUserId(req)
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  if (req.nextUrl.searchParams.get('dismissed') === 'true') {
    const { error } = await supabaseAdmin.from('reminders').delete().eq('user_id', userId).eq('dismissed', true)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  const { error } = await supabaseAdmin.from('reminders').delete().eq('id', id).eq('user_id', userId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

// PATCH /api/reminder-notes — mark one of the logged-in user's reminders dismissed/undismissed
export async function PATCH(req: NextRequest) {
  const userId = await sessionUserId(req)
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { id, dismissed } = await req.json()
  if (!id || typeof dismissed !== 'boolean') return NextResponse.json({ error: 'id and dismissed required' }, { status: 400 })

  const { data: current } = await supabaseAdmin
    .from('reminders')
    .select('sent_by, message, dismissed')
    .eq('id', id)
    .eq('user_id', userId)
    .single()

  const { error } = await supabaseAdmin.from('reminders').update({ dismissed }).eq('id', id).eq('user_id', userId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Tell the original sender their reminder was completed — only on the false->true
  // transition (so re-ticking after an accidental untick doesn't spam them), and only
  // when it came from a trusted sender (self-reminders have no one else to notify).
  // Business-initiated, so it needs an approved template, not a free-form message.
  if (dismissed && current && !current.dismissed && current.sent_by) {
    try {
      await sendWhatsAppTemplate(
        current.sent_by,
        'reminder_done_notification',
        [sanitizeTemplateParam(current.message)]
      )
    } catch (err) {
      console.error('Failed to notify sender of completed reminder:', err)
    }
  }

  return NextResponse.json({ ok: true })
}
