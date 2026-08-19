// Terms of service.
//
// New Aug 2026 — the site had none. The load-bearing clause is section 4:
// Sorted is not a party to the job. The tradesperson contracts with his own
// customer and Paystack settles into the tradesperson's own subaccount; money
// never sits in our balance. Saying so plainly is both true and the thing that
// keeps this from looking like unlicensed money transmission.

import type { Metadata } from 'next'
import { LegalPage, Clause } from '@/components/LegalPage'
import { BUSINESS } from '@/lib/business'
import { SORTED_FEE_CENTS, MIN_CARD_PAYABLE_CENTS } from '@/lib/paystack'

export const metadata: Metadata = {
  title: 'Terms of Service — Sorted',
  description: `The terms on which ${BUSINESS.legalName} provides the Sorted quoting service to South African tradespeople.`,
}

const sortedFee = `R${(SORTED_FEE_CENTS / 100).toFixed(2)}`
const minCard = `R${(MIN_CARD_PAYABLE_CENTS / 100).toFixed(0)}`

export default function TermsOfService() {
  return (
    <LegalPage
      title="Terms of Service"
      intro={`These terms govern your use of Sorted, a WhatsApp quoting service operated by ${BUSINESS.legalName} ("we", "us"). By sending a message to our WhatsApp number or using our dashboard, you agree to them.`}
    >
      <Clause title="1. What Sorted does">
        <p>Sorted turns a WhatsApp message into a professional quote. You describe a job in your own words; we build a branded PDF quote carrying your business name, your logo and your banking details, host it on a web page you can forward to your customer, and notify you when that customer opens or pays it.</p>
        <p>Sorted also lets you forward bills and reminders to keep track of what you owe and when it is due.</p>
      </Clause>

      <Clause title="2. Who may use it">
        <p>You must be 18 or older and operating a genuine business or trade in South Africa. You are responsible for everything sent from your WhatsApp number, so keep access to that number secure and tell us immediately if it is lost or compromised.</p>
      </Clause>

      <Clause title="3. Your content and your quotes">
        <p>You keep ownership of your business name, logo, customer details and quote content. You grant us permission to use them only to produce, host and deliver your quotes and to operate the service.</p>
        <p>You are responsible for the accuracy of what you quote, for the banking details you give us, and for having the right to use any logo you upload. <strong>Check your banking details before your first quote goes out.</strong> We print what you give us.</p>
      </Clause>

      <Clause title="4. We are not a party to your jobs">
        <p>The agreement to do the work, and the agreement about what it costs, is between you and your customer. We are not the supplier of the work, we do not guarantee it, and we are not responsible for disputes about it.</p>
        <p>Where your customer pays by card, the payment is processed by Paystack and settles into a Paystack subaccount held in your own name and paid out to your own bank account. <strong>We do not hold, pool or pay out your money.</strong></p>
      </Clause>

      <Clause title="5. Fees">
        <p>Sorted is currently free for tradespeople: no signup fee, no monthly fee, and no charge for sending quotes, uploading a logo or receiving notifications. If we introduce a subscription later, we will tell active users on WhatsApp at least 30 days before it starts, and you may stop using the service instead.</p>
        <p>When your customer chooses to pay a quote by card, one <strong>card payment fee</strong> is added to the amount the customer pays, and shown to them before they confirm. That fee covers Paystack's processing cost plus {sortedFee} to Sorted per paid quote. You receive your quote total in full, to the cent.</p>
        <p>Card payment is only offered on quotes of {minCard} or more, because below that the fixed portion of the fee is out of proportion to the job. EFT is always available and carries no fee from us at all.</p>
        <p>Full detail is on the <a href="/#pricing">pricing section</a> of our home page.</p>
      </Clause>

      <Clause title="6. Acceptable use">
        <p>Do not use Sorted to quote for or sell anything illegal, to send quotes to people who have not asked for them, to impersonate another business, or to attempt to break, overload or reverse-engineer the service. We may suspend or close an account that does.</p>
      </Clause>

      <Clause title="7. Availability">
        <p>We work to keep Sorted running but do not promise uninterrupted service. It depends on third parties — WhatsApp, Paystack and our hosting providers — whose outages are outside our control. We may change or discontinue features, and will give reasonable notice of anything material.</p>
      </Clause>

      <Clause title="8. Liability">
        <p>Nothing in these terms limits liability that cannot lawfully be limited, including under the Consumer Protection Act 68 of 2008.</p>
        <p>Subject to that, we are not liable for indirect or consequential loss, for lost profits or lost business, or for loss arising from a job, a customer or a payment dispute we are not a party to. Where we are liable, our total liability is limited to the fees you paid us in the three months before the claim arose.</p>
      </Clause>

      <Clause title="9. Ending it">
        <p>You may stop using Sorted at any time — send STOP on WhatsApp, or email us to close your account and delete your data (see our <a href="/privacy">Privacy Policy</a>). We may suspend or close an account that breaches these terms, and will tell you why unless the law prevents us.</p>
      </Clause>

      <Clause title="10. Governing law">
        <p>These terms are governed by South African law, and the South African courts have jurisdiction. If a term is found unenforceable, the rest continues to apply.</p>
      </Clause>

      <Clause title="11. Changes">
        <p>We may update these terms. The date at the top of this page shows when they last changed, and we will notify active users on WhatsApp before a material change takes effect.</p>
      </Clause>
    </LegalPage>
  )
}
