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
import {
  paystackConfigured, paystackBankCode, createSubaccount, cardPaymentsEnabledFor,
} from './paystack'

/**
 * Makes sure the user has a Paystack subaccount, creating one if his bank
 * details are complete and he doesn't already have one.
 *
 * Returns the subaccount code, or null if one could not be made — which is the
 * normal case for a user who skipped the banking questions.
 */
export async function ensureSubaccount(userId: string): Promise<string | null> {
  if (!paystackConfigured()) return null

  const { data: user } = await supabaseAdmin
    .from('users')
    .select('whatsapp_number, business_name, name, bank_name, account_number, paystack_subaccount')
    .eq('id', userId)
    .maybeSingle()

  if (!user) return null

  // Card payments are behind an allowlist while they're being proven. Checked
  // here rather than only at the payment: no subaccount means no card button
  // anywhere, so there is one switch instead of several to keep in step.
  if (!cardPaymentsEnabledFor(user.whatsapp_number)) return null

  if (user.paystack_subaccount) return user.paystack_subaccount

  // Paystack needs all three. Someone who skipped the bank step is not an
  // error, he just isn't payable by card yet.
  if (!user.bank_name || !user.account_number) return null

  try {
    const bankCode = await paystackBankCode(user.bank_name)
    if (!bankCode) {
      // An unrecognised bank must never be settled to a guessed code.
      console.warn(`[paystack] no Paystack bank code for "${user.bank_name}" (user ${userId})`)
      return null
    }

    const code = await createSubaccount({
      // Paystack shows this on the customer's card statement, so it wants to
      // be the trading name the customer recognises, not "Sorted".
      businessName: user.business_name ?? user.name ?? 'Sorted',
      bankCode,
      accountNumber: user.account_number,
    })

    await supabaseAdmin
      .from('users')
      .update({ paystack_subaccount: code, paystack_subaccount_at: new Date().toISOString() })
      .eq('id', userId)

    return code
  } catch (err) {
    console.error('[paystack] ensureSubaccount failed:', err)
    return null
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