// Where Paystack returns the customer after payment.
//
// Verifies with Paystack server-side before marking anything paid — being
// redirected here is not evidence of payment, and anyone can visit the URL.
// The webhook is still the authoritative path; markPaid() is idempotent, so
// whichever arrives first wins and the other is a no-op.

import Link from 'next/link'
import { notFound } from 'next/navigation'
import { loadQuoteByToken, markPaid } from '@/lib/quoteView'
import { verifyTransaction, paystackConfigured, type PaymentOutcome } from '@/lib/paystack'

export const dynamic = 'force-dynamic'

function fmtR(n: number): string {
  return 'R' + Number(n).toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export default async function PaidPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params

  const view = await loadQuoteByToken(token)
  if (!view) notFound()

  const { quote, business } = view
  const docWord = quote.doc_type === 'invoice' ? 'invoice' : 'quote'

  // Three outcomes, not two. Every payment method Paystack offers lands back
  // here, and every one of them can also decline or be abandoned — so the page
  // has to say which of those happened rather than assume it went through.
  let outcome: PaymentOutcome = quote.status === 'paid' ? 'paid' : 'pending'
  if (outcome !== 'paid' && quote.paystack_reference && paystackConfigured()) {
    const result = await verifyTransaction(quote.paystack_reference)
    outcome = result.outcome
    if (result.paid) await markPaid(quote.id)
  }
  const paid = outcome === 'paid'

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#FAF9F6] px-4 py-12">
      <div className="w-full max-w-md rounded-2xl border border-[#E2E0D9] bg-white p-8 text-center shadow-[0_1px_2px_rgba(26,26,23,0.04),0_12px_28px_-12px_rgba(180,83,10,0.18)]">
        {paid ? (
          <>
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#EEF7EF] text-2xl text-[#1E5B2A]">
              ✓
            </div>
            <h1 className="mt-4 text-xl font-semibold tracking-[-0.01em] text-[#1A1A17]">
              Payment received
            </h1>
            {/* The amount charged, not the quote total — those differ by the
                card fee, and quoting the smaller one back at someone who just
                paid the larger one invites a query about the difference. */}
            <p className="mt-2 leading-relaxed text-[#6B6B60]">
              {fmtR(quote.charged_total ?? quote.total)} paid to {business.business_name} for{' '}
              {quote.number}. They&rsquo;ve been notified.
            </p>
          </>
        ) : outcome === 'failed' ? (
          <>
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#FDECEC] text-2xl text-[#9B1C1C]">
              ✕
            </div>
            <h1 className="mt-4 text-xl font-semibold tracking-[-0.01em] text-[#1A1A17]">
              Payment didn&rsquo;t go through
            </h1>
            {/* Said plainly, and it must invite another attempt. Showing the
                "sit tight, no need to pay again" copy here is what a declined
                card used to get — so nobody retried, and nobody was paid. */}
            <p className="mt-2 leading-relaxed text-[#6B6B60]">
              Nothing has been taken from your account. You can try again, or pay{' '}
              {business.business_name} by EFT using the details on the {docWord}.
            </p>
          </>
        ) : (
          <>
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#FDF3E7] text-2xl text-[#B4530A]">
              ⏳
            </div>
            <h1 className="mt-4 text-xl font-semibold tracking-[-0.01em] text-[#1A1A17]">
              Still confirming
            </h1>
            <p className="mt-2 leading-relaxed text-[#6B6B60]">
              We haven&rsquo;t had confirmation from the bank yet. If you completed the
              payment it will show shortly — no need to pay again.
            </p>
          </>
        )}

        {/* Present in every state. However the payment ended, there is always a
            way back to the document it was for. */}
        <Link
          href={`/q/${token}`}
          className="mt-6 inline-block rounded-lg border border-[#D6D3C9] px-4 py-2.5 font-medium text-[#1A1A17] transition-transform duration-150 ease-out hover:-translate-y-px active:translate-y-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#B4530A]"
        >
          {outcome === 'failed' ? `Try again` : `Back to ${docWord}`}
        </Link>
      </div>
    </main>
  )
}
