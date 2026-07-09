import { NextRequest, NextResponse, after } from 'next/server'
import crypto from 'crypto'
import { supabaseAdmin } from '@/lib/supabase'
import { extractBillFromText, extractBillFromPDF, extractBillFromImage, ExtractedBill } from '@/lib/claude'
import { sendWhatsApp, sendWhatsAppTemplate, downloadMedia, formatBillConfirmation, formatIncompleteConfirmation, formatReminderConfirmation } from '@/lib/whatsapp'

// One account this inbound message should be applied to. Normally there's exactly
// one (the sender's own account, or the single account that trusts them) — but the
// same number (e.g. a vet's front desk) can be a trusted sender on more than one
// account, so a single inbound message can fan out to several targets.
type Target = { userId: string; sentBy: string | null; label: string | null }

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

// Meta signs every delivery with X-Hub-Signature-256 (HMAC-SHA256 of the raw
// body using the app secret). Without this check anyone who finds the URL can
// POST fake WhatsApp messages. Skips (with a warning) if META_APP_SECRET isn't
// set, so the webhook keeps working until the env var is added in Vercel.
function verifyMetaSignature(rawBody: string, signatureHeader: string | null): boolean {
  const secret = process.env.META_APP_SECRET
  if (!secret) {
    console.warn('META_APP_SECRET not set — webhook signature NOT verified')
    return true
  }
  if (!signatureHeader?.startsWith('sha256=')) return false
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex')
  const received = signatureHeader.slice(7)
  if (received.length !== expected.length) return false
  return crypto.timingSafeEqual(Buffer.from(received), Buffer.from(expected))
}

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text()
    if (!verifyMetaSignature(rawBody, req.headers.get('x-hub-signature-256'))) {
      return NextResponse.json({ error: 'invalid signature' }, { status: 401 })
    }
    const body = JSON.parse(rawBody)

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
    // Deduplicate: ignore if we've already processed this message ID (Meta retries
    // webhooks that don't get a fast 200). A message can produce rows in either
    // table depending on message_type, so both need checking.
    const [{ count: billCount }, { count: reminderCount }] = await Promise.all([
      supabaseAdmin.from('bills').select('id', { count: 'exact', head: true }).eq('whatsapp_message_id', message.id),
      supabaseAdmin.from('reminders').select('id', { count: 'exact', head: true }).eq('whatsapp_message_id', message.id),
    ])
    if ((billCount && billCount > 0) || (reminderCount && reminderCount > 0)) return

    const from: string = message.from  // e.g. "27821234567"

    // "LOGIN" command — generates and sends a dashboard OTP. WhatsApp only allows
    // free-form text replies to numbers that messaged us first, so the OTP has to be
    // requested this way rather than pushed out when someone visits the website.
    if (message.type === 'text' && message.text?.body.trim().toLowerCase() === 'login') {
      const otp = Math.floor(100000 + Math.random() * 900000).toString()
      const expires = new Date(Date.now() + 5 * 60 * 1000).toISOString()

      await supabaseAdmin
        .from('users')
        .upsert({ whatsapp_number: from, otp, otp_expires_at: expires }, { onConflict: 'whatsapp_number' })

      await sendWhatsApp(from, `Your Sorted login code is *${otp}*\n\nExpires in 5 minutes.`)
      return
    }

    // Check if this number is a trusted sender for one or more accounts. The same
    // number can be trusted by more than one account (e.g. a vet used by two
    // families), so this fans out to every match rather than assuming one.
    const { data: trustedSenderRows } = await supabaseAdmin
      .from('trusted_senders')
      .select('user_id, label')
      .eq('whatsapp_number', from)

    let targets: Target[]

    if (trustedSenderRows && trustedSenderRows.length > 0) {
      targets = trustedSenderRows.map(row => ({ userId: row.user_id, sentBy: from, label: row.label }))
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
      targets = [{ userId: user.id, sentBy: null, label: null }]
    }

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

    // Handle bank details update — find matching pending bills and fill in the details,
    // for every account this sender is trusted by
    if (extracted.message_type === 'bank_update' && extracted.account_number) {
      let totalUpdated = 0

      for (const target of targets) {
        await upsertPayee(target.userId, extracted)

        // Update any pending bills for this payee that are missing bank details
        const { data: matchingBills } = await supabaseAdmin
          .from('bills')
          .select('id, payee')
          .eq('user_id', target.userId)
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

        totalUpdated += toUpdate.length
      }

      await sendWhatsApp(from,
        `✅ Banking details saved for ${extracted.payee}!\n${extracted.bank_name ? extracted.bank_name + ' · ' : ''}${extracted.account_number}` +
        (totalUpdated > 0 ? `\n\nUpdated ${totalUpdated} pending bill${totalUpdated > 1 ? 's' : ''} on your dashboard.` : '\n\nI\'ll use these details for future invoices.')
      )
      return
    }

    // Reminder — a nudge with no specific amount attached (e.g. "don't forget to pay the vet")
    if (extracted.message_type === 'reminder') {
      for (const target of targets) {
        await supabaseAdmin.from('reminders').insert({
          user_id:             target.userId,
          sent_by:             target.sentBy,
          sender_label:        target.label,
          message:             rawContent,
          whatsapp_message_id: message.id,
        })

        // Notify the account owner when a trusted sender sends the reminder.
        // Business-initiated, so it needs an approved template, not a free-form message.
        if (target.sentBy) {
          const { data: owner } = await supabaseAdmin
            .from('users')
            .select('whatsapp_number')
            .eq('id', target.userId)
            .single()

          if (owner?.whatsapp_number) {
            try {
              await sendWhatsAppTemplate(
                owner.whatsapp_number,
                'new_reminder_notification',
                [target.label || target.sentBy, extracted.payee]
              )
            } catch (err) {
              console.error('Failed to notify owner of reminder:', err)
            }
          }
        }
      }

      await sendWhatsApp(from, formatReminderConfirmation(extracted.payee))
      return
    }

    if (!extracted.amount) {
      await sendWhatsApp(from, "Sorry, I couldn't read that. Try forwarding the PDF or type: who to pay, how much, their bank details and due date.")
      return
    }

    for (const target of targets) {
      // Payee memory lookup for new bills — each account can have different saved
      // bank details for the same payee name, so this is resolved per target.
      let bankName      = extracted.bank_name
      let accountNumber = extracted.account_number
      let branchCode     = extracted.branch_code
      let reference      = extracted.reference

      if (accountNumber) {
        await upsertPayee(target.userId, extracted)
      } else {
        const savedPayee = await lookupPayee(target.userId, extracted.payee)
        if (savedPayee) {
          bankName      = savedPayee.bank_name
          accountNumber = savedPayee.account_number
          branchCode    = savedPayee.branch_code
          reference     = reference ?? savedPayee.default_reference
        }
      }

      await supabaseAdmin.from('bills').insert({
        user_id:              target.userId,
        sent_by:              target.sentBy,
        payee:                extracted.payee,
        amount:               extracted.amount,
        due_date:             extracted.due_date,
        bank_name:            bankName,
        account_number:       accountNumber,
        branch_code:          branchCode,
        reference:            reference,
        raw_message:          rawContent,
        whatsapp_message_id:  message.id,
        status:               'pending',
        // A sender trusted by more than one account (e.g. a vet shared by two
        // families) can't be disambiguated — every matching account gets the bill,
        // but it stays unconfirmed (unpayable) until its owner claims it as theirs.
        unconfirmed:          targets.length > 1,
      })

      // Notify the account owner when a trusted sender adds a bill on their behalf.
      // This is business-initiated (the owner may not have messaged us in the last
      // 24h), so it must go via an approved template, not a free-form message.
      if (target.sentBy) {
        const { data: owner } = await supabaseAdmin
          .from('users')
          .select('whatsapp_number')
          .eq('id', target.userId)
          .single()

        if (owner?.whatsapp_number) {
          try {
            await sendWhatsAppTemplate(
              owner.whatsapp_number,
              'new_bil_notification',
              [target.label || target.sentBy, extracted.amount.toFixed(0), extracted.payee]
            )
          } catch (err) {
            console.error('Failed to notify owner of new bill:', err)
          }
        }
      }

      // A single WhatsApp reply can't show different bank details per target, so
      // when the same sender fans out to multiple accounts, reply using the first.
      if (target === targets[0]) {
        const reply = accountNumber
          ? formatBillConfirmation(extracted.payee, extracted.amount, extracted.due_date)
          : formatIncompleteConfirmation(extracted.payee, extracted.amount, extracted.due_date)
        await sendWhatsApp(from, reply)
      }
    }

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
