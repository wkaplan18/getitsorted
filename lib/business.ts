// Who Sorted legally is, in one place.
//
// Written because Paystack's activation review (Aug 2026) rejected the site
// for having no operator, no address, no contact details and no policies on
// it. Those facts now appear on the landing page, in the footer, and on three
// policy pages — so they live here rather than being retyped in six files and
// drifting apart the first time one of them changes.
//
// Money constants are NOT duplicated here. Anything about fees is imported
// from lib/paystack.ts, which is the only place they are allowed to exist.

export const BUSINESS = {
  /** The registered entity that operates Sorted and holds the Paystack account. */
  legalName: 'QuotingHub (Pty) Ltd',
  tradingAs: 'Sorted',
  /** Published address. City and province only — deliberate, not a stub. */
  address: 'Johannesburg, Gauteng, South Africa',
  country: 'South Africa',
  /** Monitored inbox. Support, billing, privacy and data-deletion all land here. */
  email: 'hello@quotinghub.co.za',
  site: 'www.getitsorted.co.za',
  siteUrl: 'https://www.getitsorted.co.za',
} as const

/**
 * The date shown on the policy pages.
 *
 * A single constant so all three say the same thing — a privacy policy dated
 * June and terms dated August reads as neglect to anyone reviewing the site.
 */
export const POLICY_UPDATED = 'August 2026'
