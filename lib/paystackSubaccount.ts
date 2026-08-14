// Creating and refreshing a tradesperson's Paystack subaccount.
//
// Called from the two places bank details can change — the WhatsApp onboarding
// flow and the dashboard profile form — so that by the time anyone can pay a
// quote, there is somewhere for the money to land.
//
// Everything here fails soft. A tradesperson whose subaccount could not be
// created still has a working quote with his EFT details printed on it; he
// just doesn't get a card button. Blowing up his onboarding over it would be a
// far worse trade.

import { supabaseAdmin } from './supabase'
import { sendWhatsApp } from './whatsapp'
import { t, toLang } from './i18n'
import {
  paystackConfigured, paystackBankCode, createSubaccount, cardPaymentsEnabledFor,
} from './paystack'

export type SubaccountOutcome =
  | { ok: true; code: string }
  /** Card payments aren't on for this user, or his banking isn't filled in. */
  | { ok: false; reason: 'off' | 'incomplete' }
  /** His fault and fixable — worth telling him about. */
  | { ok: false; reason: 'rejected' | 'unknown_bank'; bank: string }
  /** Ours. Log it; don't bother him with it. */
  | { ok: false; reason: 'error' }

/**
 * Makes sure the user has a Paystack subaccount, creating one if his bank
 * details are complete and he doesn't already have one.
 *
 * `notify` sends him a WhatsApp when the failure is one he can fix. It must be
 * true only where he just did something — finishing the bank step, saving the
 * profile — and never on the dashboard-load backfill, which would message him
 * every single time he opened the app.
 */
export async function ensureSubaccount(
  userId: string,
  opts: { notify?: boolean } = {}
): Promise<SubaccountOutcome> {
  if (!paystackConfigured()) return { ok: false, reason: 'off' }

  const { data: user } = await supabaseAdmin
    .from('users')
    .select('whatsapp_number, business_name, name, bank_name, account_number, paystack_subaccount, language')
    .eq('id', userId)
    .maybeSingle()

  if (!user) return { ok: false, reason: 'off' }

  // Card payments are behind an allowlist while they're being proven. Checked
  // here rather than only at the payment: no subaccount means no card button
  // anywhere, so there is one switch instead of several to keep in step.
  if (!cardPaymentsEnabledFor(user.whatsapp_number)) return { ok: false, reason: 'off' }

  if (user.paystack_subaccount) return { ok: true, code: user.paystack_subaccount }

  // Paystack needs both. Someone who skipped the bank step is not an error, he
  // just isn't payable by card yet.
  if (!user.bank_name || !user.account_number) return { ok: false, reason: 'incomplete' }

  const bank = user.bank_name
  const lang = toLang(user.language)

  /** Tells him only when he can act on it, and only when he just asked. */
  const tell = async (key: 'card_bank_rejected' | 'card_bank_unknown') => {
    if (!opts.notify || !user.whatsapp_number) return
    try {
      await sendWhatsApp(user.whatsapp_number, t(lang, key, { bank }))
    } catch (err) {
      console.error('[paystack] could not send bank warning:', err)
    }
  }

  try {
    const bankCode = await paystackBankCode(bank)
    if (!bankCode) {
      // An unrecognised bank must never be settled to a guessed code.
      console.warn(`[paystack] no Paystack bank code for "${bank}" (user ${userId})`)
      await tell('card_bank_unknown')
      return { ok: false, reason: 'unknown_bank', bank }
    }

    const result = await createSubaccount({
      // Paystack shows this on the customer's card statement, so it wants to
      // be the trading name the customer recognises, not "Sorted".
      businessName: user.business_name ?? user.name ?? 'Sorted',
      bankCode,
      accountNumber: user.account_number,
    })

    if (!result.ok) {
      console.warn(`[paystack] subaccount refused for user ${userId}: ${result.message}`)
      if (!result.rejected) return { ok: false, reason: 'error' }
      await tell('card_bank_rejected')
      return { ok: false, reason: 'rejected', bank }
    }

    await supabaseAdmin
      .from('users')
      .update({ paystack_subaccount: result.code, paystack_subaccount_at: new Date().toISOString() })
      .eq('id', userId)

    return { ok: true, code: result.code }
  } catch (err) {
    console.error('[paystack] ensureSubaccount failed:', err)
    return { ok: false, reason: 'error' }
  }
}

/**
 * Clears the stored subaccount so the next call rebuilds it against the new
 * bank details.
 *
 * Paystack's subaccount update endpoint exists, but re-creating is safer: it
 * cannot half-apply, and an abandoned subaccount with no transactions against
 * it costs nothing. Called when banking details are edited — without this, a
 * tradesperson who changes banks keeps getting paid into the old account.
 */
export async function resetSubaccount(userId: string): Promise<void> {
  await supabaseAdmin
    .from('users')
    .update({ paystack_subaccount: null, paystack_subaccount_at: null })
    .eq('id', userId)
}