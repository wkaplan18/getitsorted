import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { sendWhatsApp, formatOTP } from '@/lib/twilio'

function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

// POST /api/auth { phone: "27821234567" } — send OTP
export async function POST(req: NextRequest) {
  const { phone } = await req.json()
  if (!phone) return NextResponse.json({ error: 'phone required' }, { status: 400 })

  const otp = generateOTP()
  const expires = new Date(Date.now() + 10 * 60 * 1000).toISOString()

  const { error } = await supabaseAdmin
    .from('users')
    .upsert({
      whatsapp_number: phone,
      otp,
      otp_expires_at: expires
    }, { onConflict: 'whatsapp_number' })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await sendWhatsApp(phone, formatOTP(otp))
  return NextResponse.json({ ok: true })
}

// PUT /api/auth { phone, otp } — verify OTP, return session
export async function PUT(req: NextRequest) {
  const { phone, otp } = await req.json()
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

  return NextResponse.json({ ok: true, phone })
}
