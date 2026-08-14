// Sorted — the multi-step WhatsApp conversation: language choice, business
// onboarding, and the quote draft → confirm → send loop.
//
// Lives outside the webhook so message routing stays readable. Everything here
// operates on the SENDER'S OWN account only — a trusted sender forwarding a
// bill on someone else's behalf never enters a conversation, because they have
// no business profile and no draft of their own.
//
// State lives in users.convo_state (jsonb) because the webhook is stateless and
// the user's phone is not somewhere we can keep anything.

import sharp from 'sharp'
import { supabaseAdmin } from './supabase'
import { sendWhatsApp, downloadMedia } from './whatsapp'
import { t, toLang, langFromChoice, fmtRand, type Lang } from './i18n'
import { applyQuoteEdit, type ExtractedBill } from './claude'
import { resolveBank, cleanAccountNumber } from './banks'
import { ensureSubaccount, resetSubaccount } from './paystackSubaccount'
import {
  renderDraft, renderLines, saveQuote, setConvoState, quoteUrl,
  recentCustomers, findCustomer, normaliseName, renderForwardCard,
  invoiceableQuotes, createInvoiceFromQuote,
  type ConvoState, type Draft,
} from './quotes'
import { recentQuotesMessage, pendingBillsMessage, issueLoginCode } from './replies'

/** The subset of the users row this module needs. */
export type ConvoUser = {
  id: string
  whatsapp_number: string
  name: string | null
  language: string | null
  business_name: string | null
  trade: string | null
  logo_url: string | null
  vat_number: string | null
  bank_name: string | null
  account_number: string | null
  onboarded_at: string | null
  convo_state: unknown | null
}

export const CONVO_USER_COLUMNS =
  'id, whatsapp_number, name, language, business_name, trade, logo_url, vat_number, bank_name, account_number, onboarded_at, convo_state'

function readState(user: ConvoUser): ConvoState | null {
  const state = user.convo_state
  if (!state || typeof state !== 'object') return null
  const step = (state as ConvoState).step
  return step ? (state as ConvoState) : null
}

function isVatRegistered(user: ConvoUser): boolean {
  return Boolean(user.vat_number)
}

/** Words that mean "skip this question", across the three output languages. */
const SKIP_WORDS = new Set(['skip', 'none', 'no', 'geen', 'nee', 'cha', 'awukho'])
const CANCEL_WORDS = new Set(['cancel', 'stop it', 'kanselleer', 'khansela', 'hayi'])
const SEND_WORDS = new Set(['send', 'yes', 'ok', 'okay', 'stuur', 'ja', 'thumela', 'yebo'])
const NO_ADDRESS = new Set(['n/a', 'na', 'none', 'no', 'skip', 'geen', 'nee', 'cha', '-'])

function emptyDraft(): Draft {
  return { customer: null, customer_address: null, line_items: [] }
}

/**
 * Step 1, with the user's recent clients offered as a numbered list so a repeat
 * job doesn't mean retyping a name and address he's already given us.
 *
 * The list is stored on the conversation state, not recomputed on the reply —
 * a quote saved between the two messages would otherwise renumber the options
 * under him and pick the wrong client.
 */
async function askForClient(user: ConvoUser, lang: Lang, draft: Draft): Promise<void> {
  const recent = await recentCustomers(user.id, 5)

  if (recent.length === 0) {
    await setConvoState(user.id, { step: 'ask_client_name', draft })
    await sendWhatsApp(user.whatsapp_number, t(lang, 'ask_client_name'))
    return
  }

  const options = recent.map(c => ({ id: c.id, name: c.name, address: c.address }))
  const list = options.map((c, i) => `${i + 1}. ${c.name}`).join('\n')

  await setConvoState(user.id, { step: 'ask_client_name', draft, client_options: options })
  await sendWhatsApp(user.whatsapp_number, t(lang, 'ask_client_pick', { list }))
}

/** Maps a bare "2" onto the list the user was shown. Null for anything else. */
function pickFromList<T>(text: string, options?: T[]): T | null {
  if (!options || options.length === 0) return null
  if (!/^\d{1,2}$/.test(text.trim())) return null
  const index = parseInt(text.trim(), 10) - 1
  return options[index] ?? null
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

/**
 * If the user is mid-conversation, advance it and return true. Otherwise
 * return false so the webhook falls through to normal extraction.
 *
 * Media (the logo step) is handled here too, which is why this takes the whole
 * message rather than just its text.
 */
export async function handleConvoStep(
  user: ConvoUser,
  message: { type: string; text?: { body: string }; image?: { id: string } },
): Promise<boolean> {
  const state = readState(user)
  if (!state) return false

  const from = user.whatsapp_number
  const lang = toLang(user.language)
  const text = (message.text?.body ?? '').trim()
  const lower = text.toLowerCase()

  // A universal escape hatch. Being stuck in a conversation with no way out is
  // the fastest way to lose a user who has no support channel.
  if (CANCEL_WORDS.has(lower)) {
    await setConvoState(user.id, null)
    await sendWhatsApp(from, t(lang, 'cancelled'))
    return true
  }

  switch (state.step) {
    // The numbered menu. Every option is reachable by typing its keyword too —
    // this exists for the user who doesn't know the keywords, which on this
    // product is most of them.
    case 'menu': {
      switch (text.trim()) {
        case '1':
          await setConvoState(user.id, null)
          await startGuidedQuote(user)
          return true

        case '2':
          await startInvoice(user, lang)
          return true

        case '3':
          await setConvoState(user.id, null)
          await sendWhatsApp(from, await recentQuotesMessage(user.id, lang))
          return true

        case '4':
          await setConvoState(user.id, { step: 'menu_logo' })
          await sendWhatsApp(from, t(lang, 'menu_logo_ask'))
          return true

        case '5':
          // Same questions as first-time setup, but `edit` stops the chain at
          // the end instead of running on into banking and a quote.
          await setConvoState(user.id, { step: 'ask_business_name', edit: 'business' })
          await sendWhatsApp(from, t(lang, 'ask_business_name'))
          return true

        case '6':
          await setConvoState(user.id, { step: 'ask_bank', edit: 'bank' })
          await sendWhatsApp(from, t(lang, 'ask_bank'))
          return true

        case '7':
          await startClientEdit(user, lang)
          return true

        case '8':
          await setConvoState(user.id, null)
          await sendWhatsApp(from, await pendingBillsMessage(user.id))
          return true

        case '9':
          await setConvoState(user.id, null)
          await sendWhatsApp(from, await issueLoginCode(from))
          return true

        case '10':
          await startLanguagePicker(user)
          return true

        default:
          // A number that isn't on the list is a miss-tap — show it again.
          if (/^\d+$/.test(text.trim())) {
            await sendWhatsApp(from, `${t(lang, 'menu_invalid')}\n\n${t(lang, 'menu')}`)
            return true
          }
          // Anything else is someone who opened the menu and then decided to
          // just type the job. Drop the menu and let the message through rather
          // than making them answer it first.
          await setConvoState(user.id, null)
          return false
      }
    }

    case 'menu_logo': {
      if (message.type === 'image' && message.image) {
        const uploaded = await saveLogo(user.id, message.image.id)
        await setConvoState(user.id, null)
        await sendWhatsApp(from, uploaded ? t(lang, 'logo_saved') : t(lang, 'save_failed'))
        return true
      }
      await sendWhatsApp(from, t(lang, 'menu_logo_again'))
      return true
    }

    case 'invoice_pick': {
      const picked = pickFromList(text, state.quote_options)
      if (!picked) {
        await startInvoice(user, lang)
        return true
      }

      const created = await createInvoiceFromQuote(user.id, picked.id)
      if (!created) {
        await setConvoState(user.id, null)
        await sendWhatsApp(from, t(lang, 'save_failed'))
        return true
      }

      await setConvoState(user.id, null)

      // Same two-message shape as a new quote: what happened, then the message
      // he forwards. The client should never receive "same figures as QUO-0002".
      await sendWhatsApp(from, t(lang, 'invoice_sent', {
        number: created.quote.number,
        customer: picked.name,
        source: picked.number,
      }))
      await sendWhatsApp(from, forwardCardFor(user, {
        docType: 'invoice',
        number: created.quote.number,
        customer: picked.name || null,
        total: Number(created.quote.total),
        token: created.quote.public_token,
      }))
      return true
    }

    case 'edit_client_pick': {
      const picked = pickFromList(text, state.client_options)
      const known = picked ?? (text ? await findCustomer(user.id, text) : null)
      if (!known) {
        await startClientEdit(user, lang)
        return true
      }
      await setConvoState(user.id, { step: 'edit_client_name', client_id: known.id })
      await sendWhatsApp(from, t(lang, 'edit_client_name', { customer: known.name }))
      return true
    }

    case 'edit_client_name': {
      if (!state.client_id) {
        await setConvoState(user.id, null)
        return true
      }
      if (text && !SKIP_WORDS.has(lower)) {
        // normalised_name is what findCustomer matches on, so it has to move
        // with the display name or the client becomes unfindable by the new one.
        await supabaseAdmin
          .from('customers')
          .update({ name: text, normalised_name: normaliseName(text) })
          .eq('id', state.client_id)
          .eq('user_id', user.id)
      }
      await setConvoState(user.id, { step: 'edit_client_address', client_id: state.client_id })
      await sendWhatsApp(from, t(lang, 'edit_client_address'))
      return true
    }

    case 'edit_client_address': {
      if (!state.client_id) {
        await setConvoState(user.id, null)
        return true
      }
      if (text && !SKIP_WORDS.has(lower)) {
        await supabaseAdmin
          .from('customers')
          .update({ address: NO_ADDRESS.has(lower) ? null : text })
          .eq('id', state.client_id)
          .eq('user_id', user.id)
      }
      const { data: saved } = await supabaseAdmin
        .from('customers').select('name').eq('id', state.client_id).maybeSingle()
      await setConvoState(user.id, null)
      await sendWhatsApp(from, t(lang, 'edit_client_saved', { customer: saved?.name ?? '' }))
      return true
    }

    case 'pick_language': {
      const picked = langFromChoice(text)
      if (!picked) {
        await sendWhatsApp(from, t(lang, 'pick_language'))
        return true
      }
      await supabaseAdmin.from('users').update({ language: picked }).eq('id', user.id)
      await sendWhatsApp(from, t(picked, 'language_set'))

      // Only continue into business onboarding if they got here on their way to
      // a quote — the presence of a draft (even an empty one) is that marker. A
      // household user who only tracks bills must never be asked what their
      // business is called, because most of them don't have one.
      if (state.draft && !user.business_name) {
        await setConvoState(user.id, { step: 'ask_business_name', draft: state.draft })
        await sendWhatsApp(from, `${t(picked, 'onboarding_offer')}\n\n${t(picked, 'ask_business_name')}`)
      } else if (state.draft) {
        // Already has a profile — straight to the quote.
        await askForClient(user, picked, state.draft)
      } else {
        await setConvoState(user.id, null)
        const dashboard = process.env.NEXT_PUBLIC_APP_URL
        await sendWhatsApp(
          from,
          t(picked, 'welcome') + (dashboard ? `\n\n${dashboard}` : ''),
        )
      }
      return true
    }

    case 'ask_business_name': {
      if (!text) {
        await sendWhatsApp(from, t(lang, 'ask_business_name'))
        return true
      }
      await supabaseAdmin.from('users').update({ business_name: text }).eq('id', user.id)
      await setConvoState(user.id, { step: 'ask_trade', draft: state.draft, edit: state.edit })
      await sendWhatsApp(from, t(lang, 'ask_trade', { business: text }))
      return true
    }

    case 'ask_trade': {
      if (text && !SKIP_WORDS.has(lower)) {
        await supabaseAdmin.from('users').update({ trade: text }).eq('id', user.id)
      }
      await setConvoState(user.id, { step: 'ask_name', draft: state.draft, edit: state.edit })
      await sendWhatsApp(from, t(lang, 'ask_name'))
      return true
    }

    case 'ask_name': {
      if (text && !SKIP_WORDS.has(lower)) {
        await supabaseAdmin.from('users').update({ name: text }).eq('id', user.id)
      }
      // Reached from the menu, this is the end of the job — an already
      // onboarded user must not be walked through banking and a logo again.
      if (state.edit === 'business') {
        await setConvoState(user.id, null)
        await sendWhatsApp(from, t(lang, 'profile_updated'))
        return true
      }
      await setConvoState(user.id, { step: 'ask_bank', draft: state.draft })
      await sendWhatsApp(from, t(lang, 'ask_bank'))
      return true
    }

    case 'ask_bank': {
      // Required, so there is no way past it but answering. Skipping used to
      // be allowed and produced a quote nobody could pay — see ask_account.
      if (!text) {
        await sendWhatsApp(from, t(lang, 'ask_bank'))
        return true
      }
      // Branch code is derived from the bank rather than asked for — every SA
      // bank has one universal code, and almost nobody knows theirs. An
      // unrecognised bank keeps the name with a null code; the quote is still
      // payable on name + account number.
      const bank = resolveBank(text)
      await supabaseAdmin
        .from('users')
        .update({ bank_name: bank.name, branch_code: bank.branchCode })
        .eq('id', user.id)
      // `edit` has to survive the hop to the next question. Without it the
      // account step forgets this came from the menu, decides it is first-time
      // setup, and carries a user who only wanted to fix a digit onwards into
      // being asked for a logo.
      await setConvoState(user.id, { step: 'ask_account', draft: state.draft, edit: state.edit })
      await sendWhatsApp(from, t(lang, 'ask_account'))
      return true
    }

    case 'ask_account': {
      // No SKIP, here or on the bank question. A quote with no account number
      // has no way to be paid — it isn't a quote with a gap in it, it's a
      // document that cannot do its job. Asking again beats printing one.
      // MENU still leaves, as it does from anywhere.
      const account = cleanAccountNumber(text)
      if (!account) {
        // Anything with no digits in it isn't an account number. Ask again
        // rather than saving a blank and printing an unpayable quote.
        await sendWhatsApp(from, t(lang, 'ask_account'))
        return true
      }
      await supabaseAdmin.from('users').update({ account_number: account }).eq('id', user.id)

      // His banking changed, so any existing subaccount now points at the
      // wrong account and has to be rebuilt.
      await resetSubaccount(user.id)

      const fresh = await reloadUser(user.id)
      const bankSaved = t(lang, 'bank_saved', {
        bank: fresh?.bank_name ?? 'your bank',
        account,
      })

      // Built AFTER the confirmation is sent, not before: ensureSubaccount can
      // send a warning of its own, and leading with "⚠️ that number was
      // refused" only to follow it with "✓ bank saved" reads as a system
      // arguing with itself. Saved first, then what it means for cards.
      if (state.edit === 'bank') {
        await setConvoState(user.id, null)
        await sendWhatsApp(from, bankSaved)
        await ensureSubaccount(user.id, { notify: true })
        return true
      }

      await setConvoState(user.id, { step: 'ask_logo', draft: state.draft })
      await sendWhatsApp(from, bankSaved)
      await ensureSubaccount(user.id, { notify: true })
      await sendWhatsApp(from, t(lang, 'ask_logo'))
      return true
    }

    case 'ask_logo': {
      let uploaded = false
      if (message.type === 'image' && message.image) {
        uploaded = await saveLogo(user.id, message.image.id)
      }
      await supabaseAdmin.from('users').update({ onboarded_at: new Date().toISOString() }).eq('id', user.id)

      // No logo is not a dead end — a monogram is derived from the business
      // name and rendered on every quote, so nothing goes out unbranded.
      await sendWhatsApp(from, uploaded ? t(lang, 'logo_saved') : t(lang, 'logo_made'))
      await sendWhatsApp(from, t(lang, 'onboarding_done'))

      const fresh = (await reloadUser(user.id)) ?? user
      const draft = state.draft

      // Arrived here from a free-form quote — resume it rather than making them
      // retype a job they already described.
      if (draft && draft.line_items.length > 0) {
        await setConvoState(user.id, { step: 'confirm_quote', draft })
        await sendWhatsApp(from, renderDraft(draft, lang, isVatRegistered(fresh)))
        return true
      }

      // Otherwise straight into the guided quote they asked for.
      await askForClient(user, lang, emptyDraft())
      return true
    }

    case 'ask_client_name': {
      if (!text) {
        await askForClient(user, lang, state.draft ?? emptyDraft())
        return true
      }

      const base = state.draft ?? emptyDraft()

      // A bare number picks from the list they were just shown. Anything else
      // is a name — which may still turn out to be someone already saved,
      // because people type the name rather than count down a list.
      const picked = pickFromList(text, state.client_options)
      const known = picked ?? (await findCustomer(user.id, text))

      if (known) {
        const draft: Draft = { ...base, customer: known.name, customer_address: known.address }
        await sendWhatsApp(from, t(lang, 'client_known', { customer: known.name }))
        // Their address is already on file, so step 2 would be asking a repeat
        // client something we already know. Skip straight to the work — and
        // say "last step" rather than "step 3 of 3", because a count that
        // jumps from 1 to 3 reads as a fault rather than a shortcut.
        if (known.address) {
          await setConvoState(user.id, { step: 'ask_quote_items', draft })
          await sendWhatsApp(from, t(lang, 'ask_quote_items_short'))
          return true
        }
        await setConvoState(user.id, { step: 'ask_client_address', draft })
        await sendWhatsApp(from, t(lang, 'ask_client_address'))
        return true
      }

      const draft: Draft = { ...base, customer: text }
      await setConvoState(user.id, { step: 'ask_client_address', draft })
      await sendWhatsApp(from, t(lang, 'ask_client_address'))
      return true
    }

    case 'ask_client_address': {
      // "N/A" is an answer, not a skip — plenty of jobs genuinely have no
      // address worth printing, and the quote should not stall on one.
      const address = !text || NO_ADDRESS.has(lower) ? null : text
      const draft: Draft = { ...(state.draft ?? emptyDraft()), customer_address: address }
      await setConvoState(user.id, { step: 'ask_quote_items', draft })
      await sendWhatsApp(from, t(lang, 'ask_quote_items'))
      return true
    }

    case 'ask_quote_items': {
      if (!text) {
        await sendWhatsApp(from, t(lang, 'ask_quote_items'))
        return true
      }

      const base = state.draft ?? emptyDraft()
      await sendWhatsApp(from, t(lang, 'quote_thanks'))

      // Anything they typed here that didn't parse is read together with this
      // message. "Second hand shirts" then "R1500" is one line item split over
      // two sends, and parsing each alone rejects both — the work with no
      // price, then the price with no work. Capped so a run of unparseable
      // messages can't grow into a prompt of its own.
      const carried = state.pending_items_text
      const combined = carried ? `${carried}\n${text}`.slice(-300) : text

      // The work and its prices arrive as one line of natural language, so it
      // still needs parsing — applyQuoteEdit against an empty draft is exactly
      // "turn this sentence into line items", and keeps the customer we
      // already collected rather than re-deriving it from the text.
      let items
      try {
        const parsed = await applyQuoteEdit({ ...base, line_items: [] }, combined)
        items = parsed.line_items
      } catch (err) {
        console.error('[convo] item parse failed:', err)
        await setConvoState(user.id, { ...state, pending_items_text: combined })
        await sendWhatsApp(from, t(lang, 'quote_no_items'))
        return true
      }

      const priced = items.filter(i => i.unit_price > 0)
      if (priced.length === 0) {
        // Stay on this step rather than clearing state — they've already
        // answered two questions and shouldn't lose them to a typo — and keep
        // what they said, so the next message completes it instead of
        // replacing it.
        await setConvoState(user.id, { ...state, pending_items_text: combined })
        // Ask for the half that's actually missing. Someone who just typed
        // "R1500" and is told no prices were found reasonably concludes it is
        // broken and stops.
        const gavePrice = items.length === 0 && /\d/.test(combined)
        await sendWhatsApp(from, t(lang, gavePrice ? 'quote_no_work' : 'quote_no_items'))
        return true
      }

      const draft: Draft = { ...base, line_items: items, raw_message: combined }
      await sendQuote(user, draft, lang)
      return true
    }

    case 'confirm_quote': {
      const draft = state.draft
      if (!draft) {
        await setConvoState(user.id, null)
        return false
      }

      if (SEND_WORDS.has(lower)) {
        await sendQuote(user, draft, lang)
        return true
      }

      // Anything else is an edit instruction in plain language.
      if (!text) {
        await sendWhatsApp(from, t(lang, 'quote_confirm'))
        return true
      }
      try {
        const updated = await applyQuoteEdit(draft, text)
        const next: Draft = { ...updated, raw_message: draft.raw_message }
        await setConvoState(user.id, { step: 'confirm_quote', draft: next })
        await sendWhatsApp(from, `${t(lang, 'quote_updated')}\n\n${renderDraft(next, lang, isVatRegistered(user))}`)
      } catch (err) {
        console.error('[convo] quote edit failed:', err)
        await sendWhatsApp(from, t(lang, 'quote_confirm'))
      }
      return true
    }

    case 'disambiguate': {
      // Both outcomes are handled by the webhook before this runs: a recognised
      // answer replays the original message, and an unrecognised one drops the
      // question entirely rather than asking it again. Re-asking here is what
      // used to trap people in a loop with no way out.
      await setConvoState(user.id, null)
      return false
    }
  }

  return false
}

/** True while the user is sitting on the "bill or quote?" question. */
export function awaitingDisambiguation(user: ConvoUser): boolean {
  return readState(user)?.step === 'disambiguate'
}

// People answer a numbered question in words at least as often as with the
// number — "im sending it to a customer" is a perfectly good answer and used to
// be treated as gibberish.
const MEANS_BILL = /\b(1|one|bill|pay|paying|owe|khokha|ibhili|betaal|rekening)\b/
const MEANS_QUOTE = /\b(2|two|quote|quoting|send|sending|customer|client|kwotasie|stuur|kliënt|klient|thumela|ikhasimende)\b/

/**
 * If the user is being asked "bill or quote?" and just answered, returns the
 * original message plus which way to treat it. The webhook replays that message
 * down the chosen path so the user never types it twice.
 *
 * Answers are read loosely on purpose: this question is a dead end for anyone
 * whose reply isn't understood, so "2.", "TWO" and "I'm sending it to a client"
 * all have to land. Anything still unrecognised is handled by the caller, which
 * drops the question rather than asking it again.
 */
export function pendingDisambiguation(
  user: ConvoUser,
  text: string,
): { message: string; asQuote: boolean } | null {
  const state = readState(user)
  if (state?.step !== 'disambiguate' || !state.pending_message) return null

  const answer = text.trim().toLowerCase().replace(/[.,)\]!]+$/, '')
  const bill = MEANS_BILL.test(answer)
  const quote = MEANS_QUOTE.test(answer)

  // "1 or 2?" — a reply hitting both sides answers nothing.
  if (bill === quote) return null

  return { message: state.pending_message, asQuote: quote }
}

// ---------------------------------------------------------------------------
// Starting flows
// ---------------------------------------------------------------------------

/**
 * The MENU command — everything Sorted can do, as a numbered list.
 *
 * The keyword commands still work and always will, but they only help someone
 * who already knows them. A tradesperson meeting this on WhatsApp for the first
 * time needs to be shown the options, not asked to remember them.
 */
export async function showMenu(user: ConvoUser): Promise<void> {
  const lang = toLang(user.language)

  // MENU is the escape hatch from anywhere — it is handled before the
  // conversation steps, so it works mid-quote, mid-onboarding, anywhere. It
  // always did, but silently: a half-finished quote disappeared with no
  // acknowledgement. Say so, so the user knows the slate is clean.
  const interrupted = readState(user)
  const dropped = interrupted && interrupted.step !== 'menu'

  await setConvoState(user.id, { step: 'menu' })
  await sendWhatsApp(
    user.whatsapp_number,
    dropped ? `${t(lang, 'menu_dropped')}\n\n${t(lang, 'menu')}` : t(lang, 'menu'),
  )
}

/**
 * The INVOICE command, and menu option 2 — turn a quote already sent into an
 * invoice.
 *
 * Built as a copy rather than a status flip on the quote: the quote is the
 * record of what was agreed and stays exactly as the client saw it, with its
 * own link that keeps working. The invoice is a second document with its own
 * number and its own token.
 */
export async function startInvoice(user: ConvoUser, lang: Lang): Promise<void> {
  const quotes = await invoiceableQuotes(user.id, 5)

  if (quotes.length === 0) {
    await setConvoState(user.id, null)
    await sendWhatsApp(user.whatsapp_number, t(lang, 'invoice_none'))
    return
  }

  const options = quotes.map(q => ({
    id: q.id,
    number: q.number,
    name: q.customerName ?? '',
  }))
  const list = quotes
    .map((q, i) => `${i + 1}. ${q.number}${q.customerName ? ` — ${q.customerName}` : ''} — ${fmtRand(q.total)}`)
    .join('\n')

  await setConvoState(user.id, { step: 'invoice_pick', quote_options: options })
  await sendWhatsApp(user.whatsapp_number, t(lang, 'invoice_pick', { list }))
}

/**
 * Menu option 7 — correct a saved client's name or address.
 *
 * Same frozen-list treatment as step 1 of a quote: the options are stored on
 * the conversation state so a reply of "2" can't be renumbered underneath them.
 */
async function startClientEdit(user: ConvoUser, lang: Lang): Promise<void> {
  const recent = await recentCustomers(user.id, 5)

  if (recent.length === 0) {
    await setConvoState(user.id, null)
    await sendWhatsApp(user.whatsapp_number, t(lang, 'edit_client_none'))
    return
  }

  const options = recent.map(c => ({ id: c.id, name: c.name, address: c.address }))
  const list = options.map((c, i) => `${i + 1}. ${c.name}`).join('\n')

  await setConvoState(user.id, { step: 'edit_client_pick', client_options: options })
  await sendWhatsApp(user.whatsapp_number, t(lang, 'edit_client_pick', { list }))
}

/** Asks a brand-new user which language to reply in. */
export async function startLanguagePicker(user: ConvoUser, draft?: Draft): Promise<void> {
  await setConvoState(user.id, { step: 'pick_language', draft })
  await sendWhatsApp(user.whatsapp_number, t('en', 'pick_language'))
}

/**
 * The QUOTE command — the main way in.
 *
 * Routes through whichever setup is still missing (language, then business
 * profile) and lands on step 1 of the quote. Each of those is asked exactly
 * once ever, because the answers are stored against the WhatsApp number and
 * reused on every future quote.
 */
export async function startGuidedQuote(user: ConvoUser): Promise<void> {
  const draft = emptyDraft()

  // onboarded_at, not language, is the signal for "has this person been set up".
  // The migration gave users.language a default of 'en', which backfilled every
  // pre-existing row — so language being set proves nothing about whether the
  // user ever actually chose it.
  if (!user.onboarded_at) {
    await startLanguagePicker(user, draft)
    return
  }

  const lang = toLang(user.language)

  if (!user.business_name) {
    await setConvoState(user.id, { step: 'ask_business_name', draft })
    await sendWhatsApp(user.whatsapp_number, `${t(lang, 'onboarding_offer')}\n\n${t(lang, 'ask_business_name')}`)
    return
  }

  await askForClient(user, lang, draft)
}

/** Asks whether an ambiguous message is a bill or a quote. */
export async function askBillOrQuote(user: ConvoUser, rawMessage: string): Promise<void> {
  const lang = toLang(user.language)
  await setConvoState(user.id, { step: 'disambiguate', pending_message: rawMessage })
  await sendWhatsApp(user.whatsapp_number, t(lang, 'ask_bill_or_quote'))
}

/**
 * Turns a parsed quote_request into a draft the user can confirm or edit.
 *
 * Routes into onboarding first if there's no business name — a PDF headed
 * "null" is worse than a one-minute setup detour.
 */
export async function startQuote(
  user: ConvoUser,
  extracted: ExtractedBill,
  rawMessage: string,
): Promise<void> {
  const from = user.whatsapp_number
  const lang = toLang(user.language)

  const priced = extracted.line_items.filter(item => item.unit_price > 0)
  if (priced.length === 0) {
    await sendWhatsApp(from, t(lang, 'quote_no_items'))
    return
  }

  const draft: Draft = {
    customer: extracted.customer,
    customer_address: extracted.customer_address,
    line_items: extracted.line_items,
    raw_message: rawMessage,
  }

  if (!user.business_name) {
    await setConvoState(user.id, { step: 'ask_business_name', draft })
    await sendWhatsApp(from, `${t(lang, 'onboarding_offer')}\n\n${t(lang, 'ask_business_name')}`)
    return
  }

  await setConvoState(user.id, { step: 'confirm_quote', draft })
  await sendWhatsApp(from, renderDraft(draft, lang, isVatRegistered(user)))
}

// ---------------------------------------------------------------------------
// Sending
// ---------------------------------------------------------------------------

async function sendQuote(user: ConvoUser, draft: Draft, lang: Lang): Promise<void> {
  const from = user.whatsapp_number

  // Last chance to have a subaccount before a customer is looking at a quote.
  // Subaccounts are otherwise only built when banking changes, so a Paystack
  // blip at that moment switched card payments off for good — and a user who
  // lives entirely in WhatsApp never opens the dashboard that would rebuild
  // it. Costs nothing when one already exists, which is almost always.
  await ensureSubaccount(user.id)

  const saved = await saveQuote({
    userId: user.id,
    draft,
    vatRegistered: isVatRegistered(user),
  })

  if (!saved) {
    await sendWhatsApp(from, t(lang, 'save_failed'))
    return
  }

  await setConvoState(user.id, null)

  // Two messages, and the split is the point. The first is between Sorted and
  // the tradesperson — the figures, so he can eyeball what was parsed before it
  // leaves his phone. The second is the one he forwards, and it has to arrive
  // at the client with nothing of this conversation attached to it.
  await sendWhatsApp(
    from,
    [
      renderLines(draft, lang, isVatRegistered(user)),
      t(lang, 'quote_sent', { number: saved.quote.number }),
      t(lang, 'quote_forward', { customer: draft.customer ?? 'your customer' }),
    ].join('\n\n'),
  )

  await sendWhatsApp(from, forwardCardFor(user, {
    docType: 'quote',
    number: saved.quote.number,
    customer: draft.customer,
    total: Number(saved.quote.total),
    token: saved.quote.public_token,
  }))
}

/**
 * The forwardable message for one document, filled in from the user's profile.
 *
 * Kept here rather than at each call site so the quote flow and the invoice
 * flow can never drift into presenting the same business two different ways.
 */
function forwardCardFor(
  user: ConvoUser,
  doc: {
    docType: 'quote' | 'invoice'
    number: string
    customer: string | null
    total: number
    token: string
  },
): string {
  return renderForwardCard({
    business: user.business_name ?? user.name ?? 'Sorted',
    trade: user.trade,
    ownerName: user.name,
    // Stored bare (27821234567) — printed the way a client would dial it.
    phone: user.whatsapp_number ? `+${user.whatsapp_number}` : null,
    docType: doc.docType,
    vatRegistered: isVatRegistered(user),
    number: doc.number,
    customer: doc.customer,
    total: doc.total,
    link: quoteUrl(doc.token),
  })
}

// ---------------------------------------------------------------------------
// Logo
// ---------------------------------------------------------------------------

/**
 * Downloads the logo from WhatsApp and puts it in Supabase storage.
 *
 * Uploads go through the service-role client, not the browser — the buckets
 * reject anonymous writes. Failure is non-fatal: onboarding continues with no
 * logo rather than dead-ending on a storage error.
 */
/**
 * Widest a stored logo needs to be.
 *
 * It is drawn 116pt wide on the PDF, which is ~480px at print resolution. A
 * phone camera photo of a signboard arrives at 1536px or more and costs the
 * customer data on every quote they open, for detail no one can see.
 */
const LOGO_MAX_PX = 512

async function saveLogo(userId: string, mediaId: string): Promise<boolean> {
  try {
    const { base64 } = await downloadMedia(mediaId)
    const original = Buffer.from(base64, 'base64')

    // Transparency has to survive — a logo with a knocked-out background turns
    // into a white rectangle sitting on the quote if it is flattened to JPEG.
    // Everything else compresses far better as JPEG: a real 1536x1024 upload
    // went 93KB → 19KB, where palette PNG only reached 43KB.
    const image = sharp(original).resize(LOGO_MAX_PX, LOGO_MAX_PX, {
      fit: 'inside',
      withoutEnlargement: true,
    })
    const { hasAlpha } = await sharp(original).metadata()

    const [body, ext, contentType] = hasAlpha
      ? [await image.png({ compressionLevel: 9, palette: true }).toBuffer(), 'png', 'image/png']
      : [await image.jpeg({ quality: 80, mozjpeg: true }).toBuffer(), 'jpg', 'image/jpeg']

    // Clear the folder first. Uploading to logo.<ext> with upsert only replaces
    // a file of the SAME extension, so someone who sent a JPEG and later a PNG
    // left the original orphaned in the bucket for good — paid for forever and
    // referenced by nothing.
    const { data: existing } = await supabaseAdmin.storage.from('logos').list(userId)
    if (existing?.length) {
      await supabaseAdmin.storage
        .from('logos')
        .remove(existing.map(file => `${userId}/${file.name}`))
    }

    const path = `${userId}/logo.${ext}`
    const { error } = await supabaseAdmin.storage
      .from('logos')
      .upload(path, body, { contentType, upsert: true })

    if (error) {
      console.error('[convo] logo upload failed:', error.message)
      return false
    }

    const { data } = supabaseAdmin.storage.from('logos').getPublicUrl(path)
    // Cache-buster. The path is stable by design, so without it a replaced logo
    // keeps serving the old image from the CDN and the user thinks the upload
    // silently failed.
    const versioned = `${data.publicUrl}?v=${Date.now()}`
    await supabaseAdmin.from('users').update({ logo_url: versioned }).eq('id', userId)

    console.log(`[convo] logo ${original.length} → ${body.length} bytes (${ext}) for ${userId}`)
    return true
  } catch (err) {
    console.error('[convo] logo download failed:', err)
    return false
  }
}

async function reloadUser(userId: string): Promise<ConvoUser | null> {
  const { data } = await supabaseAdmin
    .from('users')
    .select(CONVO_USER_COLUMNS)
    .eq('id', userId)
    .maybeSingle()
  return (data as ConvoUser | null) ?? null
}
