import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { sessionPhone } from '@/lib/session'
import { sendWhatsAppTemplate } from '@/lib/whatsapp'

async function sessionUser(req: NextRequest): Promise<{ id: string; name: string | null } | null> {
  const phone = sessionPhone(req)
  if (!phone) return null
  const { data } = await supabaseAdmin.from('users').select('id, name').eq('whatsapp_number', phone).single()
  return data ?? null
}

async function sessionUserId(req: NextRequest): Promise<string | null> {
  return (await sessionUser(req))?.id ?? null
}

// GET /api/trusted-senders — the logged-in user's trusted senders
export async function GET(req: NextRequest) {
  const userId = await sessionUserId(req)
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const { data } = await supabaseAdmin.from('trusted_senders').select('*').eq('user_id', userId).order('created_at')
  return NextResponse.json({ senders: data || [] })
}

// POST /api/trusted-senders — add a trusted sender
export async function POST(req: NextRequest) {
  const user = await sessionUser(req)
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { trustedNumber, label } = await req.json()
  if (!trustedNumber) return NextResponse.json({ error: 'missing fields' }, { status: 400 })

  const clean = trustedNumber.replace(/\D/g, '').replace(/^0/, '27')

  // Check before upserting so we only message them on a genuinely new add, not
  // when the owner is just editing an existing sender's label.
  const { data: existing } = await supabaseAdmin
    .from('trusted_senders')
    .select('id')
    .eq('user_id', user.id)
    .eq('whatsapp_number', clean)
    .maybeSingle()

  const { error } = await supabaseAdmin.from('trusted_senders').upsert(
    { user_id: user.id, whatsapp_number: clean, label: label || null },
    { onConflict: 'user_id,whatsapp_number' }
  )
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Let them know they've been trusted and can now WhatsApp this number directly.
  // Business-initiated (they likely haven't messaged in), so needs an approved template.
  if (!existing) {
    try {
      await sendWhatsAppTemplate(clean, 'trusted_sender_added', [user.name || 'Someone'])
    } catch (err) {
      console.error('Failed to notify new trusted sender:', err)
    }
  }

  return NextResponse.json({ ok: true })
}

// DELETE /api/trusted-senders?trustedNumber=...
export async function DELETE(req: NextRequest) {
  const userId = await sessionUserId(req)
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const trustedNumber = req.nextUrl.searchParams.get('trustedNumber')
  if (!trustedNumber) return NextResponse.json({ error: 'missing fields' }, { status: 400 })
  await supabaseAdmin.from('trusted_senders').delete().eq('user_id', userId).eq('whatsapp_number', trustedNumber)
  return NextResponse.json({ ok: true })
}
