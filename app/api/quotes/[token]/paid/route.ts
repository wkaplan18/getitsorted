// Marking a quote or invoice paid by hand, from the dashboard.
//
// Paystack settles its own quotes automatically (webhook + return page), but
// most of this audience is paid by EFT into the account printed on the PDF, or
// in cash on the day. Nothing tells Sorted that happened except the person who
// was paid — so this route exists, and without it every EFT document sits on
// "Sent" for ever and the dashboard totals are fiction.
//
// Deliberately NOT lib/quoteView.markPaid(): that one WhatsApps the owner
// "{customer} paid you" — which is absurd when the owner is the one clicking.
//
// The token in the path identifies the document, but it grants nothing: the
// session decides who is asking, and a quote belonging to someone else is a
// 404 whether or not you hold its link.

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { sessionPhone } from '@/lib/session'

async function ownedQuote(req: NextRequest, token: string) {
  const phone = sessionPhone(req)
  if (!phone) return null

  const { data: user } = await supabaseAdmin
    .from('users').select('id').eq('whatsapp_number', phone).maybeSingle()
  if (!user) return null

  const { data: quote } = await supabaseAdmin
    .from('quotes')
    .select('id, status, viewed_at, paystack_reference')
    .eq('public_token', token)
    .eq('user_id', user.id)
    .maybeSingle()

  return quote ?? null
}

// POST — "my client paid this"
export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const quote = await ownedQuote(req, token)
  if (!quote) return NextResponse.json({ error: 'not found' }, { status: 404 })

  const { error } = await supabaseAdmin
    .from('quotes')
    .update({ status: 'paid', paid_at: new Date().toISOString() })
    .eq('id', quote.id)

  if (error) {
    console.error('[api/quotes/paid] mark paid failed:', error.message)
    return NextResponse.json({ error: 'update failed' }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}

// DELETE — undo, for the inevitable wrong tap.
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const quote = await ownedQuote(req, token)
  if (!quote) return NextResponse.json({ error: 'not found' }, { status: 404 })

  // A Paystack payment is a fact on someone else's ledger, not a status this
  // side gets to retract — the money really did move.
  if (quote.paystack_reference) {
    return NextResponse.json({ error: 'paid by card' }, { status: 409 })
  }

  const { error } = await supabaseAdmin
    .from('quotes')
    // Back to where it was before, not blankly to 'sent': a document the client
    // had already opened should still say so.
    .update({ status: quote.viewed_at ? 'viewed' : 'sent', paid_at: null })
    .eq('id', quote.id)

  if (error) {
    console.error('[api/quotes/paid] undo failed:', error.message)
    return NextResponse.json({ error: 'update failed' }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}