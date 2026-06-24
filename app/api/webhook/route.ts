import { NextRequest, NextResponse, after } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { extractBillFromText, extractBillFromPDF, extractBillFromImage, ExtractedBill } from '@/lib/claude'
import { sendWhatsApp, downloadMedia, formatBillConfirmation, formatIncompleteConfirmation } from '@/lib/whatsapp'

// Meta sends a GET to verify the webhook endpoint on setup
export async function GET(req: NextRequest) {
  const mode      = req.nextUrl.searchParams.get('hub.mode')
  const token     = req.nextUrl.searchParams.get('hub.verify_token')
  const challenge = req.nextUrl.searchParams.get('hub.challenge')

  if (mode === 'subscribe' && token === process.env.META_WEBHOOK_VERIFY_TOKEN) {
    return new NextResponse(challenge, { status: 200 })
  }
  return NextResponse.json({ error: 'forbidden' }, { status: 403 })
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    // Meta wraps messages in entry[].changes[].value.messages[]
    const entry   = body?.entry?.[0]
    const change  = entry?.changes?.[0]?.value
    const message = change?.messages?.[0]

    if (!message) return NextResponse.json({ status: 'ignored' })

    // Return 200 immediately so Meta doesn't retry and create duplicates
    // Process the message in the background after the response is sent
    after(() => processMessage(message))
    return NextResponse.json({ status: 'ok' })

  } catch (err) {
    console.error('Webhook error', err)
    return NextResponse.json({ error: 'internal error' }, { status: 500 })
  }
}

async function processMessage(message: { id: string; from: string; type: string; text?: { body: string }; document?: { id: string; mime_type: string; filename?: string }; image?: { id: string } }) {
  try {
    // Deduplicate: ignore if we've already processed this message ID
    const { count } = await supabaseAdmin
      .from('bills')
      .select('id', { count: 'exact', head: true })
      .eq('whatsapp_message_id', message.id)
    if (count && count > 0) return

    const from: string = message.from  // e.g. "27821234567"

    // Check if this number is a trusted sender for another user's account
    const { data: trustedSender } = await supabaseAdmin
      .from('trusted_senders')
      .select('user_id')
      .eq('whatsapp_number', from)
      .single()

    let userId: string
    const sentBy: string | null = trustedSender ? from : null

    if (trustedSender) {
      // Route bill to the primary account owner
      userId = trustedSender.user_id
    } else {
      // Upsert as own user
      const { data: user, error: userError } = await supabaseAdmin
        .from('users')
        .upsert({ whatsapp_number: from }, { onConflict: 'whatsapp_number' })
        .select('id')
        .single()

      if (userError || !user) {
        console.error('User upsert failed', userError)
        return
      }
      userId = user.id
    }

    const user = { id: userId }

    let extracted: ExtractedBill | null = null
    let rawContent = ''

    if (message.type === 'text') {
      rawContent = message.text?.body ?? ''
      extracted = await extractBillFromText(rawContent)

    } else if (message.type === 'document' && message.document) {
      const mediaId  = message.document.id
      rawContent = `[document: ${message.document.filename ?? mediaId}]`

      const { base64, mimeType: mime } = await downloadMedia(mediaId)

      if (mime === 'application/pdf') {
        extracted = await extractBillFromPDF(base64)
      } else if (mime.startsWith('image/')) {
        extracted = await extractBillFromImage(base64, mime as 'image/jpeg' | 'image/png' | 'image/webp')
      }

    } else if (message.type === 'image' && message.image) {
      const mediaId = message.image.id
      rawContent = `[image: ${mediaId}]`
      const { base64, mimeType: mime } = await downloadMedia(mediaId)
      extracted = await extractBillFromImage(base64, mime as 'image/jpeg' | 'image/png' | 'image/webp')
    }

    if (!extracted?.payee) {
      await sendWhatsApp(from, "Sorry, I couldn't read that. Try forwarding the PDF or type: who to pay, how much, their bank details and due date.")
      return
    }

    // Handle bank details update — find matching pending bills and fill in the details
    if (extracted.message_type === 'bank_update' && extracted.account_number) {
      await upsertPayee(user.id, extracted)

      // Update any pending bills for this payee that are missing bank details
      const { data: matchingBills } = await supabaseAdmin
        .from('bills')
        .select('id, payee')
        .eq('user_id', user.id)
        .eq('status', 'pending')
        .is('account_number', null)

      const needle = extracted.payee.toLowerCase().trim()
      const toUpdate = (matchingBills || []).filter(b =>
        b.payee?.toLowerCase().includes(needle) || needle.includes(b.payee?.toLowerCase() ?? '')
      )

      for (const bill of toUpdate) {
        await supabaseAdmin.from('bills').update({
          bank_name: extracted.bank_name,
          account_number: extracted.account_number,
          branch_code: extracted.branch_code,
          reference: extracted.reference,
        }).eq('id', bill.id)
      }

      const updated = toUpdate.length
      await sendWhatsApp(from,
        `✅ Banking details saved for ${extracted.payee}!\n${extracted.bank_name ? extracted.bank_name + ' · ' : ''}${extracted.account_number}` +
        (updated > 0 ? `\n\nUpdated ${updated} pending bill${updated > 1 ? 's' : ''} on your dashboard.` : '\n\nI\'ll use these details for future invoices.')
      )
      return
    }

    if (!extracted.amount) {
      await sendWhatsApp(from, "Sorry, I couldn't read that. Try forwarding the PDF or type: who to pay, how much, their bank details and due date.")
      return
    }

    // Payee memory lookup for new bills
    if (extracted.account_number) {
      await upsertPayee(user.id, extracted)
    } else {
      const savedPayee = await lookupPayee(user.id, extracted.payee)
      if (savedPayee) {
        extracted.bank_name      = savedPayee.bank_name
        extracted.account_number = savedPayee.account_number
        extracted.branch_code    = savedPayee.branch_code
        extracted.reference      = extracted.reference ?? savedPayee.default_reference
      }
    }

    await supabaseAdmin.from('bills').insert({
      user_id:              user.id,
      sent_by:              sentBy,
      payee:                extracted.payee,
      amount:               extracted.amount,
      due_date:             extracted.due_date,
      bank_name:            extracted.bank_name,
      account_number:       extracted.account_number,
      branch_code:          extracted.branch_code,
      reference:            extracted.reference,
      raw_message:          rawContent,
      whatsapp_message_id:  message.id,
      status:               'pending',
    })

    const reply = extracted.account_number
      ? formatBillConfirmation(extracted.payee, extracted.amount, extracted.due_date)
      : formatIncompleteConfirmation(extracted.payee, extracted.amount, extracted.due_date)

    await sendWhatsApp(from, reply)

  } catch (err) {
    console.error('Webhook error', err)
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
