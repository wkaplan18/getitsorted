import { NextRequest, NextResponse, after } from 'next/server'
import crypto from 'crypto'
import { supabaseAdmin } from '@/lib/supabase'
import { extractBillFromText, extractBillFromPDF, extractBillFromImage, ExtractedBill, QUOTE_CONFIDENCE_FLOOR } from '@/lib/claude'
import { sendWhatsApp, sendWhatsAppTemplate, downloadMedia, formatBillConfirmation, formatIncompleteConfirmation, formatReminderConfirmation } from '@/lib/whatsapp'
import {
  handleConvoStep, pendingDisambiguation, awaitingDisambiguation, startLanguagePicker, startGuidedQuote, startQuote, askBillOrQuote,
  showMenu, startInvoice, startEdit, inConversation, CONVO_USER_COLUMNS, type ConvoUser,
} from '@/lib/convo'
import { setConvoState } from '@/lib/quotes'
import { recentQuotesMessage, pendingBillsMessage, issueLoginCode } from '@/lib/replies'
import { t, toLang, PICK_LANGUAGE, type Lang } from '@/lib/i18n'

// One account this inbound message should be applied to. Normally there's exactly
// one (the sender's own account, or the single account that trusts them) — but the
// same number (e.g. a vet's front desk) can be a trusted sender on more than one
// account, so a single inbound message can fan out to several targets.
type Target = { userId: string; sentBy: string | null; label: string | null }

type InboundMessage = {
  id: string
  from: string
  type: string
  text?: { body: string }
  document?: { id: string; mime_type: string; filename?: string; caption?: string }
  image?: { id: string; caption?: string }
}

const READ_FAIL_REPLY = "Sorry, I couldn't read that. Try forwarding the PDF or type: who to pay, how much, their bank details and due date.\n\nStuck? Reply MENU to start again."
const SAVE_FAIL_REPLY = "Something went wrong saving that on my side — it has NOT been added. Please try sending it again in a minute."

/**
 * The language each QUOTE trigger word implies.
 *
 * A man only types I-QUOTE because the isiZulu page told him to — the word is
 * printed on it and prefilled into the WhatsApp box by its buttons. That is the
 * language question, already answered on the website, so a brand-new user who
 * arrives on one of these skips being asked it a second time. Plain "quote"
 * maps to nothing and still gets the picker.
 *
 * Only ever consulted for a user who has never been onboarded — see
 * startGuidedQuote. A returning user's saved language is never overwritten by a
 * link he happened to tap.
 */
const QUOTE_TRIGGER_LANG: Record<string, Lang> = {
  'iquote': 'zu',
  'i-quote': 'zu',
  'kwotasie': 'af',
}

const WELCOME_MESSAGE = `👋 Welcome to *Sorted* — I help you send professional quotes and get paid.

Reply *QUOTE* and I'll walk you through it. I only ask for your business details once, then every quote after that takes under a minute.

Text *MENU* any time for a numbered list of everything I can do.`

const HELP_MESSAGE = `Here's what I can do:

📋 *MENU* — everything below as a numbered list, so you don't have to remember any of it.

*Sending quotes*
🧾 *QUOTE* — I'll ask you three quick questions and send back a PDF quote with your logo, ready to forward to your client.
✏️ *EDIT* — something wrong on the last quote? I'll fix it, same quote number.
🧮 *INVOICE* — turn a quote you've already sent into an invoice, same figures.
📋 *QUOTES* — your recent quotes

*Keeping track of what you owe*
📄 Forward an invoice (PDF or photo) — I'll pull out the amount, payee and banking details
💬 Type a bill: "pay ballet R850 by Friday"
📌 Set a reminder: "remind me to pay the vet Monday 2pm"
🏦 *BILLS* — see what's still pending

*Settings*
🔑 *LOGIN* — get a dashboard login code
🌍 *LANGUAGE* — reply in English, isiZulu or Afrikaans
🚫 *STOP* — stop sending to someone's dashboard (trusted senders)

Dashboard: ${process.env.NEXT_PUBLIC_APP_URL}`

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

    // The sender's WhatsApp display name, which Meta includes on every inbound
    // message and nowhere else — there is no endpoint to look a name up from a
    // number. If it isn't taken here it is gone.
    const profileName: string | null = change?.contacts?.[0]?.profile?.name ?? null

    // Return 200 immediately so Meta doesn't retry and create duplicates
    // Process the message in the background after the response is sent
    after(() => processMessage(message, profileName))
    return NextResponse.json({ status: 'ok' })

  } catch (err) {
    console.error('Webhook error', err)
    return NextResponse.json({ error: 'internal error' }, { status: 500 })
  }
}

/**
 * Stores the sender's WhatsApp display name against their number.
 *
 * Never touches users.name — that is what they typed when asked "and your
 * name?", and it is theirs. This is only what their phone says about them, and
 * it exists so the admin list shows a person rather than a bare number.
 *
 * Failure is swallowed on purpose: if the profile_name migration hasn't been
 * run, every inbound message must still work. (See the bills.unconfirmed
 * incident — a missing column silently broke every save for a day.)
 */
async function rememberProfileName(from: string, profileName: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from('users')
    .update({ whatsapp_profile_name: profileName })
    .eq('whatsapp_number', from)
  if (error) console.warn('[webhook] profile name not stored:', error.message)
}

/** Creates the account for a number we've never heard from. Null if the insert failed. */
async function createUser(from: string, profileName?: string | null): Promise<ConvoUser | null> {
  const { data, error } = await supabaseAdmin
    .from('users')
    .insert({ whatsapp_number: from })
    .select(CONVO_USER_COLUMNS)
    .single()
  if (error || !data) {
    console.error('User insert failed', error)
    return null
  }
  // Second write rather than part of the insert: a missing column would fail
  // the whole insert and lose the user, not just their display name.
  if (profileName) await rememberProfileName(from, profileName)
  return data as ConvoUser
}

// Handles MENU / LOGIN / HELP / BILLS / QUOTES / LANGUAGE / STOP keywords. Returns
// true if the message was a command and has been fully dealt with.
//
// `user` is the sender's own account (null if they've never messaged before, or
// if they're only a trusted sender on someone else's account). It's used for
// reply language and for the quote commands, both of which are per-account.
async function handleCommand(from: string, text: string, user: ConvoUser | null): Promise<boolean> {
  const cmd = text.trim().toLowerCase()
  const lang = toLang(user?.language)

  // "LANGUAGE" — re-opens the language picker. Deliberately recognised in all
  // three languages plus the bare word, because a user who picked the wrong
  // one can't necessarily read the menu that got them there.
  if (cmd === 'language' || cmd === 'taal' || cmd === 'ulimi') {
    if (user) {
      await startLanguagePicker(user)
    } else {
      await sendWhatsApp(from, PICK_LANGUAGE)
    }
    return true
  }

  // "MENU" — the numbered list of everything, and the way in for anyone who
  // doesn't know the keywords. Recognised in all three languages: someone who
  // can't find their way around is exactly who reaches for this.
  if (cmd === 'menu' || cmd === 'opsies' || cmd === 'imenu' || cmd === 'i-menu') {
    const target = user ?? (await createUser(from))
    if (!target) {
      await sendWhatsApp(from, t(lang, 'save_failed'))
      return true
    }
    await showMenu(target)
    return true
  }

  // "BANK" — straight to changing banking details.
  //
  // Exists because the card-payment warning tells them to reply BANK, and for
  // a while that was a promise the app didn't keep: the word did nothing, and
  // the one person guaranteed to see that message is someone whose account
  // number was just refused. Only for a known user — there is nothing to
  // change on an account that doesn't exist yet.
  if (user && (cmd === 'bank' || cmd === 'ibhange' || cmd === 'bankbesonderhede')) {
    await setConvoState(user.id, { step: 'ask_bank', edit: 'bank' })
    await sendWhatsApp(from, t(lang, 'ask_bank'))
    return true
  }

  // "QUOTE" — the main way in. Starts the guided quote, asking only for the
  // setup this number hasn't already given. Checked before "QUOTES" (plural,
  // the history list) so the two never collide.
  if (cmd === 'quote' || cmd === 'new quote' || cmd === 'kwotasie' || cmd === 'iquote' || cmd === 'i-quote') {
    // First contact via QUOTE — create the account here rather than letting it
    // fall through to extraction, which has nothing to extract.
    const target = user ?? (await createUser(from))
    if (!target) {
      await sendWhatsApp(from, t(lang, 'save_failed'))
      return true
    }
    await startGuidedQuote(target, QUOTE_TRIGGER_LANG[cmd] ?? null)
    return true
  }

  // "EDIT" — fix the document he just sent, in place. Only ever on the
  // explicit keyword: after a quote goes out the conversation is cleared, and
  // treating whatever he says next as an edit would swallow the next job.
  if (cmd === 'edit' || cmd === 'i-edit' || cmd === 'shintsha' || cmd === 'wysig' || cmd === 'verander') {
    if (!user) {
      await sendWhatsApp(from, t(lang, 'edit_none'))
      return true
    }
    await startEdit(user, lang)
    return true
  }

  // "INVOICE" — turn a quote already sent into an invoice. Checked before
  // "INVOICES" would be, and never creates an account: there is nothing to
  // invoice from until you've sent a quote.
  if (cmd === 'invoice' || cmd === 'faktuur' || cmd === 'i-invoice') {
    if (!user) {
      await sendWhatsApp(from, t(lang, 'invoice_none'))
      return true
    }
    await startInvoice(user, lang)
    return true
  }

  // "QUOTES" — the money-in counterpart to BILLS.
  if (cmd === 'quotes' || cmd === 'kwotasies' || cmd === 'amaquote') {
    await sendWhatsApp(from, await recentQuotesMessage(user?.id ?? null, lang))
    return true
  }

  if (cmd === 'login') {
    await sendWhatsApp(from, await issueLoginCode(from))
    return true
  }

  if (cmd === 'help') {
    // The English HELP_MESSAGE is kept for English users — it's more detailed
    // than the translated string and covers forwarding PDFs and photos.
    const help = lang === 'en' ? HELP_MESSAGE : `${t(lang, 'help')}\n\n${process.env.NEXT_PUBLIC_APP_URL}`
    await sendWhatsApp(from, help)
    return true
  }

  // "BILLS" — list the sender's own pending bills without needing the dashboard
  if (cmd === 'bills') {
    await sendWhatsApp(from, await pendingBillsMessage(user?.id ?? null))
    return true
  }

  // "STOP" — a trusted sender opting out of sending to someone's dashboard.
  // POPIA-relevant: they never signed up themselves, so they need a way out.
  if (cmd === 'stop') {
    const { data: trustedRows } = await supabaseAdmin.from('trusted_senders').select('id').eq('whatsapp_number', from)
    if (trustedRows && trustedRows.length > 0) {
      await supabaseAdmin.from('trusted_senders').delete().eq('whatsapp_number', from)
      await sendWhatsApp(from, `Done — you've been removed as a trusted sender. Messages you send here will no longer appear on anyone else's dashboard.`)
    } else {
      await sendWhatsApp(from, `You're not sending to anyone else's dashboard. If you want to stop using Sorted, simply stop messaging — or text HELP to see what I can do.`)
    }
    return true
  }

  return false
}

async function processMessage(message: InboundMessage, profileName: string | null = null) {
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

    // The sender's own account, if they have one. Loaded up front because the
    // reply language, any in-progress conversation, and the quote commands all
    // hang off it. Null for a pure trusted sender who has never signed up.
    const { data: senderRow } = await supabaseAdmin
      .from('users')
      .select(CONVO_USER_COLUMNS)
      .eq('whatsapp_number', from)
      .maybeSingle()
    let sender = (senderRow as ConvoUser | null) ?? null
    const senderLang = toLang(sender?.language)

    // Kept fresh on every message: people rename themselves, and this is the
    // only place the name is ever available.
    if (sender && profileName) await rememberProfileName(from, profileName)

    if (message.type === 'text' && message.text?.body) {
      if (await handleCommand(from, message.text.body, sender)) return
    }

    // A pending "bill or quote?" answer: replay the original message down the
    // path the user chose instead of making them type it again.
    let forcedQuote = false
    let replayText: string | null = null
    // Set when this message arrived while the question was open. Whatever
    // happens next, the question is not asked again — a user who can't answer
    // it in the shape we expect must never be asked it a third time.
    let justDisambiguated = false

    if (sender && message.type === 'text' && message.text?.body) {
      const wasAsked = awaitingDisambiguation(sender)
      const pending = pendingDisambiguation(sender, message.text.body)

      if (pending) {
        await setConvoState(sender.id, null)
        sender = { ...sender, convo_state: null }
        replayText = pending.message
        forcedQuote = pending.asQuote
        justDisambiguated = true
      } else if (wasAsked) {
        // They replied with something we couldn't read as an answer — very
        // often by simply retyping the job. Drop the question and treat this
        // message as a fresh one, rather than blocking on an answer.
        await setConvoState(sender.id, null)
        sender = { ...sender, convo_state: null }
        justDisambiguated = true
      }
    }

    // Voice notes, before handleConvoStep and not after it.
    //
    // Every guided step reads message.text.body, which a voice note doesn't
    // have, so the step sees an empty string and re-sends its own question.
    // Answering out loud got you the same prompt back, word for word, with
    // nothing to say we simply can't hear you — and no way out, since the next
    // voice note did the same thing. Onboarding and step 3 of a quote were the
    // worst of it: step 3 is the longest thing to type, so it's exactly where
    // someone reaches for the mic.
    //
    // convo_state is deliberately left alone: typing the answer carries on from
    // wherever he was, draft intact.
    if (message.type === 'audio' || message.type === 'voice') {
      const key = sender && inConversation(sender) ? 'voice_unsupported' : 'voice_unsupported_new'
      await sendWhatsApp(from, t(senderLang, key))
      return
    }

    // Mid-conversation (language pick, onboarding, quote confirm/edit) takes
    // priority over extraction — otherwise "1200" as an answer gets parsed as
    // a bill. Skipped when replaying a disambiguation, which already cleared it.
    if (sender && !replayText && (await handleConvoStep(sender, message))) return

    if (message.type !== 'text' && message.type !== 'document' && message.type !== 'image') {
      await sendWhatsApp(from, `I can only read text messages, photos and PDFs for now. Try one of those!`)
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
    let isNewUser = false

    if (trustedSenderRows && trustedSenderRows.length > 0) {
      targets = trustedSenderRows.map(row => ({ userId: row.user_id, sentBy: from, label: row.label }))
    } else {
      if (!sender) {
        isNewUser = true
        const created = await createUser(from, profileName)
        if (!created) return
        sender = created
      }
      targets = [{ userId: sender.id, sentBy: null, label: null }]
    }

    let extracted: ExtractedBill | null = null
    let rawContent = ''

    if (message.type === 'text') {
      // replayText is set when the user has just answered "bill or quote?" —
      // the message being parsed is the original one, not their "1"/"2".
      rawContent = replayText ?? message.text?.body ?? ''
      extracted = await extractBillFromText(rawContent)

    } else if (message.type === 'document' && message.document) {
      const mediaId  = message.document.id
      const caption  = message.document.caption
      rawContent = caption
        ? `[document: ${message.document.filename ?? mediaId}] ${caption}`
        : `[document: ${message.document.filename ?? mediaId}]`

      const { base64, mimeType: mime } = await downloadMedia(mediaId)

      if (mime === 'application/pdf') {
        extracted = await extractBillFromPDF(base64, caption)
      } else if (mime.startsWith('image/')) {
        extracted = await extractBillFromImage(base64, mime as 'image/jpeg' | 'image/png' | 'image/webp', caption)
      }

    } else if (message.type === 'image' && message.image) {
      const mediaId = message.image.id
      const caption = message.image.caption
      rawContent = caption ? `[image: ${mediaId}] ${caption}` : `[image: ${mediaId}]`
      const { base64, mimeType: mime } = await downloadMedia(mediaId)
      extracted = await extractBillFromImage(base64, mime as 'image/jpeg' | 'image/png' | 'image/webp', caption)
    }

    // ---------------------------------------------------------------------
    // MONEY IN — the user is quoting their own customer.
    //
    // Deliberately ahead of the payee check below: a quote has a customer, not
    // a payee, and would otherwise be rejected as unparseable. Only ever runs
    // on the sender's own account — a trusted sender forwarding a bill for
    // someone else can't send quotes from that person's business.
    // ---------------------------------------------------------------------
    const ownAccount = sender && targets.length === 1 && targets[0].sentBy === null

    if (extracted && ownAccount && sender) {
      const looksLikeQuote = extracted.message_type === 'quote_request'
      const uncertain = extracted.confidence < QUOTE_CONFIDENCE_FLOOR

      // Ambiguous and the user has a business to quote from → ask rather than
      // guess. Turning a supplier invoice into a customer quote (or the
      // reverse) is the one mistake this product can't come back from.
      //
      // Asked at most once, ever, for any one exchange: `justDisambiguated`
      // covers both the answered case and the unreadable-answer case, so the
      // question can never be re-asked in response to its own answer.
      if (uncertain && !justDisambiguated && sender.business_name && message.type === 'text') {
        await askBillOrQuote(sender, rawContent)
        return
      }

      if (looksLikeQuote || forcedQuote) {
        // Same signal as startGuidedQuote: onboarded_at, not language, because
        // the migration's 'en' default backfilled every pre-existing row.
        if (!sender.onboarded_at) {
          // Pick a language first, carrying the draft so the job they just
          // described is waiting for them on the other side.
          await startLanguagePicker(sender, {
            customer: extracted.customer,
            customer_address: extracted.customer_address,
            line_items: extracted.line_items,
            raw_message: rawContent,
          })
          return
        }
        await startQuote(sender, extracted, rawContent)
        return
      }
    }

    // A brand-new user gets the welcome whatever they sent — and if their first
    // message didn't parse, the welcome already explains how to use Sorted, so
    // skip the cold "couldn't read that" error on top of it.
    //
    // Note this deliberately does NOT return, and does NOT open the language
    // picker: a new user forwarding an invoice must still have that invoice
    // saved. The picker would swallow it. Money-out users reach the picker via
    // the LANGUAGE command (mentioned in the welcome); money-in users get it
    // automatically in the quote branch above, where the draft is carried
    // through and nothing is lost.
    if (isNewUser) {
      await sendWhatsApp(from, WELCOME_MESSAGE)
    }

    if (!extracted?.payee) {
      if (!isNewUser) {
        await sendWhatsApp(from, senderLang === 'en' ? READ_FAIL_REPLY : t(senderLang, 'not_understood'))
      }
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
          .in('status', ['pending', 'overdue'])
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
      let savedAny = false
      for (const target of targets) {
        const { error: insertError } = await supabaseAdmin.from('reminders').insert({
          user_id:             target.userId,
          sent_by:             target.sentBy,
          sender_label:        target.label,
          message:             rawContent,
          remind_at:           extracted.remind_at ? new Date(extracted.remind_at + '+02:00').toISOString() : null,
          whatsapp_message_id: message.id,
        })
        if (insertError) {
          console.error('Reminder insert failed', insertError)
          continue
        }
        savedAny = true

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

      if (!savedAny) {
        await sendWhatsApp(from, SAVE_FAIL_REPLY)
        return
      }

      let reply = formatReminderConfirmation(extracted.payee, !!targets[0].sentBy)
      if (extracted.remind_at) {
        const at = new Date(extracted.remind_at + '+02:00').toLocaleString('en-ZA', {
          timeZone: 'Africa/Johannesburg', weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
        })
        reply += `\n\n⏰ I'll send a nudge on ${at}.`
      }
      await sendWhatsApp(from, reply)
      return
    }

    if (!extracted.amount) {
      await sendWhatsApp(from, READ_FAIL_REPLY)
      return
    }

    // Soft duplicate check — same payee and amount within the last 7 days on the
    // first target's account. The bill is still saved (it might be legitimate, e.g.
    // two kids at the same ballet school); the reply just flags it.
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
    const { data: recentSimilar } = await supabaseAdmin
      .from('bills')
      .select('id, payee, created_at')
      .eq('user_id', targets[0].userId)
      .eq('amount', extracted.amount)
      .gte('created_at', weekAgo)
    const needle = extracted.payee.toLowerCase().trim()
    const looksDuplicate = (recentSimilar || []).some(b =>
      b.payee?.toLowerCase().includes(needle) || needle.includes(b.payee?.toLowerCase() ?? '')
    )

    let savedAny = false
    // The reply (sent once, after the loop) shows whether bank details were found —
    // captured from the first target since a single reply can't cover them all.
    let firstResolvedAccount: string | null = null
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
      if (target === targets[0]) firstResolvedAccount = accountNumber

      const { error: insertError } = await supabaseAdmin.from('bills').insert({
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
      if (insertError) {
        console.error('Bill insert failed', insertError)
        continue
      }
      savedAny = true

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
    }

    if (!savedAny) {
      await sendWhatsApp(from, SAVE_FAIL_REPLY)
      return
    }

    // A single WhatsApp reply can't show different bank details per target, so
    // when the same sender fans out to multiple accounts, reply using the first.
    let reply = firstResolvedAccount
      ? formatBillConfirmation(extracted.payee, extracted.amount, extracted.due_date, !!targets[0].sentBy)
      : formatIncompleteConfirmation(extracted.payee, extracted.amount, extracted.due_date, !!targets[0].sentBy)
    if (looksDuplicate) {
      reply += `\n\n⚠️ Heads up — this looks similar to a bill from the last few days (same amount, same payee). If it's a duplicate, delete one on the dashboard.`
    }
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
