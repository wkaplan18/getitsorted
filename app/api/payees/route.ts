import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { sessionPhone } from '@/lib/session'

export async function GET(req: NextRequest) {
  const phone = sessionPhone(req)
  if (!phone) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { data: user } = await supabaseAdmin
    .from('users')
    .select('id')
    .eq('whatsapp_number', phone)
    .single()

  if (!user) return NextResponse.json({ payees: [] })

  const { data: payees } = await supabaseAdmin
    .from('payees')
    .select('*')
    .eq('user_id', user.id)
    .order('display_name', { ascending: true })

  return NextResponse.json({ payees: payees || [] })
}
