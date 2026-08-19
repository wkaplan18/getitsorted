// Refund and cancellation policy.
//
// New Aug 2026, and the one Paystack asked for by name. It has to answer a
// question the usual SaaS refund policy does not: the money a customer pays
// through Sorted is not ours, it is the tradesperson's, and it settles into
// his subaccount. So the policy splits cleanly in two — the job (his) and the
// fees (ours and Paystack's) — rather than pretending we can unilaterally
// refund work we did not do.

import type { Metadata } from 'next'
import { LegalPage, Clause } from '@/components/LegalPage'
import { BUSINESS } from '@/lib/business'
import { SORTED_FEE_CENTS } from '@/lib/paystack'

export const metadata: Metadata = {
  title: 'Refund Policy — Sorted',
  description: 'How refunds, cancellations and payment disputes are handled for quotes paid through Sorted.',
}

const sortedFee = `R${(SORTED_FEE_CENTS / 100).toFixed(2)}`

export default function RefundPolicy() {
  return (
    <LegalPage
      title="Refund & Cancellation Policy"
      intro="Sorted is free for tradespeople, so there is no subscription to refund. This policy covers the money your customer pays for a job, and the fees charged on that payment."
    >
      <Clause title="1. Sorted's own service">
        <p>Sorted charges tradespeople no signup fee and no monthly fee, so there is nothing to cancel and nothing to refund. You can stop using the service at any time by sending STOP on WhatsApp, and ask us to delete your account and data by emailing <a href={`mailto:${BUSINESS.email}`}>{BUSINESS.email}</a>.</p>
        <p>If we introduce a paid plan in future, this policy will be updated before it starts.</p>
      </Clause>

      <Clause title="2. Payments for a job — who to ask">
        <p>When a customer pays a quote through Sorted, the money settles into the <strong>tradesperson's</strong> own account, not ours. The agreement about the work is between the customer and the tradesperson.</p>
        <p>So if you are a customer who wants a refund — the work was not done, was not finished, or was not what you agreed — <strong>contact the tradesperson whose name and details are on the quote first.</strong> They can refund you, in whole or in part, and they decide that.</p>
      </Clause>

      <Clause title="3. When a tradesperson agrees to refund">
        <p>A tradesperson who agrees to refund a customer can either repay them directly, or email us at <a href={`mailto:${BUSINESS.email}`}>{BUSINESS.email}</a> from their registered address with the quote number and the amount, and we will raise the refund with Paystack on their behalf.</p>
        <p>Refunds are returned to the card the customer paid with. Paystack typically settles a refund within <strong>5 to 10 business days</strong>, depending on the customer's bank. We cannot refund to a different card or account than the one used.</p>
      </Clause>

      <Clause title="4. What happens to the fees">
        <p>Where a payment is refunded in full, the card payment fee added at checkout is refunded to the customer with it, including Sorted's {sortedFee}. Paystack's own processing fee is refunded according to Paystack's terms; where Paystack does not return it, that portion cannot be recovered by us.</p>
        <p>Where a payment is refunded in part, the fee is not refunded — it was charged on the transaction, which still took place.</p>
      </Clause>

      <Clause title="5. Duplicate, failed and incorrect payments">
        <p>If a customer is charged twice for the same quote, or charged when the payment failed, email <a href={`mailto:${BUSINESS.email}`}>{BUSINESS.email}</a> with the quote number and the date. We will check the transaction record and, where a duplicate is confirmed, refund it in full — including all fees — without needing the tradesperson's agreement. There is no time limit on a genuine duplicate charge.</p>
      </Clause>

      <Clause title="6. Cancelling before the work starts">
        <p>A quote that has been paid but where no work has started is between the customer and the tradesperson to settle. We will provide both parties with the transaction record on request to help them resolve it.</p>
      </Clause>

      <Clause title="7. Disputes and chargebacks">
        <p>If a customer cannot resolve a refund with the tradesperson, they may email us at <a href={`mailto:${BUSINESS.email}`}>{BUSINESS.email}</a>. We will acknowledge within two business days and share the transaction records with both sides. We cannot decide who is right about the work itself.</p>
        <p>A customer may also dispute the charge with their own bank or card issuer. Where a chargeback is raised, the amount is recovered from the tradesperson who received the payment, and we will pass on the evidence they give us.</p>
      </Clause>

      <Clause title="8. Your rights">
        <p>Nothing here limits a customer's rights under the Consumer Protection Act 68 of 2008, including the right to services performed with reasonable care and skill.</p>
      </Clause>
    </LegalPage>
  )
}
