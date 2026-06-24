import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

async function getUserId(phone: string) {
  const { data } = await supabaseAdmin.from('users').select('id').eq('whatsapp_number', phone).single()
  return data?.id ?? null
}

// GET /api/trusted-senders?phone=27821234567
export async function GET(req: NextRequest) {
  const phone = req.nextUrl.searchParams.get('phone')
  if (!phone) return NextResponse.json({ error: 'phone required' }, { status: 400 })
  const userId = await getUserId(phone)
  if (!userId) return NextResponse.json({ senders: [] })
  const { data } = await supabaseAdmin.from('trusted_senders').select('*').eq('user_id', userId).order('created_at')
  return NextResponse.json({ senders: data || [] })
}

// POST /api/trusted-senders — add a trusted sender
export async function POST(req: NextRequest) {
  const { phone, trustedNumber, label } = await req.json()
  if (!phone || !trustedNumber) return NextResponse.json({ error: 'missing fields' }, { status: 400 })
  const userId = await getUserId(phone)
  if (!userId) return NextResponse.json({ error: 'user not found' }, { status: 404 })

  const clean = trustedNumber.replace(/\D/g, '').replace(/^0/, '27')
  const { error } = await supabaseAdmin.from('trusted_senders').upsert(
    { user_id: userId, whatsapp_number: clean, label: label || null },
    { onConflict: 'user_id,whatsapp_number' }
  )
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

// DELETE /api/trusted-senders?phone=...&trustedNumber=...
export async function DELETE(req: NextRequest) {
  const phone = req.nextUrl.searchParams.get('phone')
  const trustedNumber = req.nextUrl.searchParams.get('trustedNumber')
  if (!phone || !trustedNumber) return NextResponse.json({ error: 'missing fields' }, { status: 400 })
  const userId = await getUserId(phone)
  if (!userId) return NextResponse.json({ error: 'user not found' }, { status: 404 })
  await supabaseAdmin.from('trusted_senders').delete().eq('user_id', userId).eq('whatsapp_number', trustedNumber)
  return NextResponse.json({ ok: true })
}
