import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { makeSessionToken, sessionPhone } from '@/lib/session'

// The OTP itself is generated and sent by the webhook when the user messages
// "LOGIN" to the Sorted WhatsApp number — see app/api/webhook/route.ts.
// This route only verifies the code they were sent.

// PUT /api/auth { phone, otp } — verify OTP, return session
export async function PUT(req: NextRequest) {
  const { phone, otp, remember } = await req.json()
  if (!phone || !otp) return NextResponse.json({ error: 'phone and otp required' }, { status: 400 })

  const { data: user } = await supabaseAdmin
    .from('users')
    .select('id, otp, otp_expires_at')
    .eq('whatsapp_number', phone)
    .single()

  if (!user) return NextResponse.json({ error: 'not found' }, { status: 404 })
  if (user.otp !== otp) return NextResponse.json({ error: 'invalid code' }, { status: 401 })
  if (new Date(user.otp_expires_at) < new Date()) return NextResponse.json({ error: 'code expired' }, { status: 401 })

  // Clear OTP after use
  await supabaseAdmin
    .from('users')
    .update({ otp: null, otp_expires_at: null })
    .eq('id', user.id)

  return NextResponse.json({ ok: true, phone, token: makeSessionToken(phone, remember !== false) })
}

// GET /api/auth — the logged-in user's display name (used to populate the "Your name" field)
export async function GET(req: NextRequest) {
  const phone = sessionPhone(req)
  if (!phone) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const { data: user } = await supabaseAdmin.from('users').select('name').eq('whatsapp_number', phone).single()
  return NextResponse.json({ name: user?.name ?? null })
}

// PATCH /api/auth { name } — set the logged-in user's display name. Shown to trusted
// senders in the WhatsApp message they get when added ("X has allowed you to...").
export async function PATCH(req: NextRequest) {
  const phone = sessionPhone(req)
  if (!phone) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const { name } = await req.json()
  await supabaseAdmin.from('users').update({ name: (name || '').trim() || null }).eq('whatsapp_number', phone)
  return NextResponse.json({ ok: true })
}
