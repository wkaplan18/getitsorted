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

import { supabaseAdmin } from './supabase'
import { sendWhatsApp, downloadMedia } from './whatsapp'
import { t, toLang, langFromChoice, fmtRand, type Lang } from './i18n'
import { applyQuoteEdit, type ExtractedBill } from './claude'
import {
  renderDraft, saveQuote, setConvoState, quoteUrl, totals,
  type ConvoState, type Draft,
} from './quotes'

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
  onboarded_at: string | null
  convo_state: unknown | null
}

export const CONVO_USER_COLUMNS =
  'id, whatsapp_number, name, language, business_name, trade, logo_url, vat_number, onboarded_at, convo_state'

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
    case 'pick_language': {
      const picked = langFromChoice(text)
      if (!picked) {
        await sendWhatsApp(from, t(lang, 'pick_language'))
        return true
      }
      await supabaseAdmin.from('users').update({ language: picked }).eq('id', user.id)
      await sendWhatsApp(from, t(picked, 'language_set'))

      // Only continue into business onboarding if they got here by trying to
      // send a quote. A household user who only tracks bills must never be
      // asked what their business is called — most people here have none.
      if (state.draft && state.draft.line_items.length > 0 && !user.business_name) {
        await setConvoState(user.id, { step: 'ask_business_name', draft: state.draft })
        await sendWhatsApp(from, `${t(picked, 'onboarding_offer')}\n\n${t(picked, 'ask_business_name')}`)
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
      await setConvoState(user.id, { step: 'ask_trade', draft: state.draft })
      await sendWhatsApp(from, t(lang, 'ask_trade', { business: text }))
      return true
    }

    case 'ask_trade': {
      if (text && !SKIP_WORDS.has(lower)) {
        await supabaseAdmin.from('users').update({ trade: text }).eq('id', user.id)
      }
      await setConvoState(user.id, { step: 'ask_name', draft: state.draft })
      await sendWhatsApp(from, t(lang, 'ask_name'))
      return true
    }

    case 'ask_name': {
      if (text && !SKIP_WORDS.has(lower)) {
        await supabaseAdmin.from('users').update({ name: text }).eq('id', user.id)
      }
      await setConvoState(user.id, { step: 'ask_logo', draft: state.draft })
      await sendWhatsApp(from, t(lang, 'ask_logo'))
      return true
    }

    case 'ask_logo': {
      if (message.type === 'image' && message.image) {
        const saved = await saveLogo(user.id, message.image.id)
        if (saved) await sendWhatsApp(from, t(lang, 'logo_saved'))
      }
      await supabaseAdmin.from('users').update({ onboarded_at: new Date().toISOString() }).eq('id', user.id)

      // If they arrived here from a quote attempt, resume it rather than making
      // them retype the job they already described.
      const draft = state.draft
      if (draft && draft.line_items.length > 0) {
        await setConvoState(user.id, { step: 'confirm_quote', draft })
        const fresh = await reloadUser(user.id)
        await sendWhatsApp(from, renderDraft(draft, lang, isVatRegistered(fresh ?? user)))
      } else {
        await setConvoState(user.id, null)
        await sendWhatsApp(from, t(lang, 'onboarding_done'))
      }
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
      // A valid "1"/"2" is intercepted by the webhook before this runs (it needs
      // to re-extract the stored message), so anything reaching here is invalid.
      await sendWhatsApp(from, t(lang, 'ask_bill_or_quote'))
      return true
    }
  }

  return false
}

/**
 * If the user is being asked "bill or quote?" and just answered, returns the
 * original message plus which way to treat it. The webhook replays that message
 * down the chosen path so the user never types it twice.
 */
export function pendingDisambiguation(
  user: ConvoUser,
  text: string,
): { message: string; asQuote: boolean } | null {
  const state = readState(user)
  if (state?.step !== 'disambiguate' || !state.pending_message) return null
  const choice = text.trim().toLowerCase()
  if (choice !== '1' && choice !== '2') return null
  return { message: state.pending_message, asQuote: choice === '2' }
}

// ---------------------------------------------------------------------------
// Starting flows
// ---------------------------------------------------------------------------

/** Asks a brand-new user which language to reply in. */
export async function startLanguagePicker(user: ConvoUser, draft?: Draft): Promise<void> {
  await setConvoState(user.id, { step: 'pick_language', draft })
  await sendWhatsApp(user.whatsapp_number, t('en', 'pick_language'))
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

  const link = quoteUrl(saved.quote.public_token)
  const { total } = totals(draft.line_items, isVatRegistered(user))

  await sendWhatsApp(from, t(lang, 'quote_sent', { number: saved.quote.number, link }))
  await sendWhatsApp(
    from,
    t(lang, 'quote_forward', { customer: draft.customer ?? 'your customer' }) +
      `\n\n${fmtRand(total)}`,
  )
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
async function saveLogo(userId: string, mediaId: string): Promise<boolean> {
  try {
    const { base64, mimeType } = await downloadMedia(mediaId)
    const ext = mimeType.split('/')[1]?.replace('jpeg', 'jpg') ?? 'jpg'
    const path = `${userId}/logo.${ext}`

    const { error } = await supabaseAdmin.storage
      .from('logos')
      .upload(path, Buffer.from(base64, 'base64'), { contentType: mimeType, upsert: true })

    if (error) {
      console.error('[convo] logo upload failed:', error.message)
      return false
    }

    const { data } = supabaseAdmin.storage.from('logos').getPublicUrl(path)
    await supabaseAdmin.from('users').update({ logo_url: data.publicUrl }).eq('id', userId)
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
