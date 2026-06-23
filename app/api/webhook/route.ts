import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { extractBillFromText, extractBillFromPDF, extractBillFromImage, ExtractedBill } from '@/lib/claude'
import { sendWhatsApp, formatBillConfirmation, formatIncompleteConfirmation } from '@/lib/twilio'

// Twilio verifies the webhook with a GET during setup
export async function GET() {
  return NextResponse.json({ status: 'ok' })
}

export async function POST(req: NextRequest) {
  try {
    // Twilio sends application/x-www-form-urlencoded
    const form = await req.formData()

    const rawFrom = form.get('From') as string        // "whatsapp:+27821234567"
    const body    = form.get('Body') as string        // text content (may be empty for media)
    const numMedia = parseInt((form.get('NumMedia') as string) || '0')
    const mediaUrl  = form.get('MediaUrl0') as string | null
    const mediaMime = form.get('MediaContentType0') as string | null

    if (!rawFrom) return NextResponse.json({ status: 'ignored' })

    // Normalise to 27821234567 (no + or whatsapp: prefix)
    const from = rawFrom.replace('whatsapp:+', '').replace('whatsapp:', '')

    // Upsert user
    const { data: user, error: userError } = await supabaseAdmin
      .from('users')
      .upsert({ whatsapp_number: from }, { onConflict: 'whatsapp_number' })
      .select('id')
      .single()

    if (userError || !user) {
      console.error('User upsert failed', userError)
      return NextResponse.json({ error: 'user error' }, { status: 500 })
    }

    let extracted: ExtractedBill | null = null
    let rawContent = ''

    if (numMedia > 0 && mediaUrl && mediaMime) {
      rawContent = `[media: ${mediaUrl}]`

      // Fetch the media using Twilio credentials (media URLs are auth-protected)
      const mediaRes = await fetch(mediaUrl, {
        headers: {
          Authorization: 'Basic ' + Buffer.from(
            `${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`
          ).toString('base64')
        }
      })

      const buffer = await mediaRes.arrayBuffer()
      const base64 = Buffer.from(buffer).toString('base64')

      if (mediaMime === 'application/pdf') {
        extracted = await extractBillFromPDF(base64)
      } else if (mediaMime.startsWith('image/')) {
        extracted = await extractBillFromImage(base64, mediaMime as 'image/jpeg' | 'image/png' | 'image/webp')
      }
    } else if (body?.trim()) {
      rawContent = body
      extracted = await extractBillFromText(body)
    }

    if (!extracted?.payee || !extracted?.amount) {
      await sendWhatsApp(from, "Sorry, I couldn't read that. Try forwarding the PDF or type: who to pay, how much, their bank details and due date.")
      return NextResponse.json({ status: 'ok' })
    }

    // Payee memory — save details if we have them, look them up if we don't
    if (extracted.account_number) {
      await upsertPayee(user.id, extracted)
    } else {
      const savedPayee = await lookupPayee(user.id, extracted.payee)
      if (savedPayee) {
        extracted.bank_name     = savedPayee.bank_name
        extracted.account_number = savedPayee.account_number
        extracted.branch_code   = savedPayee.branch_code
        extracted.reference     = extracted.reference ?? savedPayee.default_reference
      }
    }

    await supabaseAdmin.from('bills').insert({
      user_id:        user.id,
      payee:          extracted.payee,
      amount:         extracted.amount,
      due_date:       extracted.due_date,
      bank_name:      extracted.bank_name,
      account_number: extracted.account_number,
      branch_code:    extracted.branch_code,
      reference:      extracted.reference,
      raw_message:    rawContent,
      status:         'pending',
    })

    const reply = extracted.account_number
      ? formatBillConfirmation(extracted.payee, extracted.amount, extracted.due_date)
      : formatIncompleteConfirmation(extracted.payee, extracted.amount, extracted.due_date)

    await sendWhatsApp(from, reply)
    return NextResponse.json({ status: 'ok' })

  } catch (err) {
    console.error('Webhook error', err)
    return NextResponse.json({ error: 'internal error' }, { status: 500 })
  }
}

async function upsertPayee(userId: string, bill: ExtractedBill) {
  if (!bill.payee || !bill.account_number) return
  const name = bill.payee.toLowerCase().trim()
  await supabaseAdmin.from('payees').upsert({
    user_id:           userId,
    name,
    display_name:      bill.payee,
    bank_name:         bill.bank_name,
    account_number:    bill.account_number,
    branch_code:       bill.branch_code,
    default_reference: bill.reference,
    updated_at:        new Date().toISOString(),
  }, { onConflict: 'user_id,name' })
}

async function lookupPayee(userId: string, payeeName: string) {
  const { data: payees } = await supabaseAdmin
    .from('payees')
    .select('*')
    .eq('user_id', userId)

  if (!payees?.length) return null
  const needle = payeeName.toLowerCase().trim()
  return payees.find(p => p.name.includes(needle) || needle.includes(p.name)) ?? null
}
