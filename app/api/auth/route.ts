import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { makeSessionToken } from '@/lib/session'

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
