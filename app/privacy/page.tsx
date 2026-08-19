// Privacy policy.
//
// Rewritten Aug 2026. The previous version described the money-out half only
// (bills, payees, reminders) and predated quotes and card payments entirely —
// so it did not mention Paystack, bank details, or the tradesperson's
// customers, who are data subjects too. It also ended with "contact us through
// the Sorted app", which gives someone exercising a POPIA right nowhere to go.

import type { Metadata } from 'next'
import { LegalPage, Clause } from '@/components/LegalPage'
import { BUSINESS } from '@/lib/business'

export const metadata: Metadata = {
  title: 'Privacy Policy — Sorted',
  description: `How ${BUSINESS.legalName} collects, uses and protects personal information on Sorted, in line with POPIA.`,
}

export default function PrivacyPolicy() {
  return (
    <LegalPage
      title="Privacy Policy"
      intro={`Sorted is operated by ${BUSINESS.legalName} ("we", "us"). We are the responsible party under the Protection of Personal Information Act 4 of 2013 ("POPIA") for the personal information described below.`}
    >
      <Clause title="1. Information we collect">
        <p>We collect only what the service needs to work:</p>
        <ul>
          <li><strong>From tradespeople using Sorted:</strong> your WhatsApp phone number, your business name, your logo if you send one, and the banking details you give us to print on your quotes (bank, account number, branch code).</li>
          <li><strong>The quotes and bills you send us:</strong> customer names and addresses, the work described, line items and amounts, and any photos or documents you forward.</li>
          <li><strong>From your customers:</strong> when a customer opens or pays a quote, we record that it was opened, the payment amount and status, and whatever contact detail you gave us to send the quote to.</li>
          <li><strong>Technical data:</strong> basic, aggregated page analytics. Our analytics are cookieless and do not profile individuals.</li>
        </ul>
        <p>We do not collect card numbers. Card details are entered directly with our payment processor and never reach our servers.</p>
      </Clause>

      <Clause title="2. How we use it">
        <p>We use your information to build and send your quotes, to display them on your dashboard, to send you WhatsApp notifications (a quote opened, a payment received, a bill due), to process payments your customers make, and to answer your support enquiries.</p>
        <p><strong>We do not sell your personal information, and we do not share it with third parties for their own marketing.</strong></p>
      </Clause>

      <Clause title="3. Legal basis">
        <p>We process your information to perform the agreement you enter into with us when you start using Sorted, to comply with our legal obligations (including financial record-keeping), and on the basis of our legitimate interest in keeping the service secure and working.</p>
      </Clause>

      <Clause title="4. Who we share it with">
        <p>We use the following processors, each only to the extent needed to run the service:</p>
        <ul>
          <li><strong>Meta Platforms (WhatsApp Business Platform)</strong> — sending and receiving your WhatsApp messages.</li>
          <li><strong>Paystack</strong> — processing card payments from your customers. Paystack handles card data as its own responsible party under its privacy policy.</li>
          <li><strong>Supabase</strong> — encrypted database hosting.</li>
          <li><strong>Anthropic (Claude)</strong> — reading your message to extract the quote or bill details. Content sent for extraction is not used to train models.</li>
          <li><strong>Vercel</strong> — application hosting and cookieless analytics.</li>
        </ul>
        <p>We will also disclose information where the law requires it, or to establish or defend a legal claim.</p>
      </Clause>

      <Clause title="5. Cross-border transfers">
        <p>Some of the processors above store or process data outside South Africa. Where that happens, we rely on the provider's contractual data-protection commitments, which POPIA section 72 permits, and we transfer no more than the service requires.</p>
      </Clause>

      <Clause title="6. How long we keep it">
        <p>Quotes, bills and payment records are kept for as long as your account is active, and afterwards for five years where South African financial record-keeping rules require it. You can delete individual bills and quotes from your dashboard at any time.</p>
        <p>To delete your account and everything associated with it, email us at <a href={`mailto:${BUSINESS.email}`}>{BUSINESS.email}</a> from the address you use with us, or send us a WhatsApp from your registered number. We action deletion requests within 30 days.</p>
      </Clause>

      <Clause title="7. Security">
        <p>Data is encrypted in transit and at rest. Access to your dashboard requires a one-time code sent to your WhatsApp number, and every API request is authenticated with a signed session token. Access to production data is limited to the people who need it to operate the service.</p>
      </Clause>

      <Clause title="8. Your rights under POPIA">
        <p>You may ask us what personal information we hold about you, ask us to correct or delete it, object to processing, or withdraw consent where we relied on it. Email <a href={`mailto:${BUSINESS.email}`}>{BUSINESS.email}</a> and we will respond within 30 days at no charge.</p>
        <p>If you are not satisfied with our response, you may complain to the Information Regulator (South Africa) at <a href="https://inforegulator.org.za">inforegulator.org.za</a>.</p>
      </Clause>

      <Clause title="9. Children">
        <p>Sorted is a business tool and is not intended for anyone under 18. We do not knowingly collect information from children.</p>
      </Clause>

      <Clause title="10. Changes to this policy">
        <p>If we change this policy materially, we will update the date at the top of this page and notify active users on WhatsApp before the change takes effect.</p>
      </Clause>
    </LegalPage>
  )
}
