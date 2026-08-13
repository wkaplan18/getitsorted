// The public quote page — what the tradesperson's customer sees.
//
// Unauthenticated by design: the customer must never need an account. The
// unguessable public_token is the only thing protecting it, which is why it's
// 128 bits of randomness and never derived from the quote id.
//
// Built to be cheap to load. The customer is very likely on the same expensive
// prepaid data as the tradesperson (R22–30/GB on small bundles), so there is no
// client JS beyond the pay form, no web fonts, and no images except the logo.

import { notFound } from 'next/navigation'
import { supabaseAdmin } from '@/lib/supabase'
import { sendWhatsAppTemplate } from '@/lib/whatsapp'
import { loadQuoteByToken, markViewed } from '@/lib/quoteView'
import { paystackConfigured } from '@/lib/paystack'
import { monogram } from '@/lib/monogram'

export const dynamic = 'force-dynamic'

function fmtR(n: number): string {
  return 'R' + Number(n).toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-ZA', { day: 'numeric', month: 'long', year: 'numeric' })
}

function fmtQty(n: number): string {
  return Number.isInteger(Number(n)) ? String(Number(n)) : Number(n).toFixed(2)
}

export default async function QuotePage({ params }: { params: Promise<{ token: string }> }) {
  // Next 15 route params are a Promise — they must be awaited, not read directly.
  const { token } = await params

  const view = await loadQuoteByToken(token)
  if (!view) notFound()

  const { quote, items, business, customer } = view
  const isInvoice = quote.doc_type === 'invoice'
  const isPaid = quote.status === 'paid'
  const showVat = Number(quote.vat_amount) > 0

  // First open → tell the tradesperson. Business-initiated, so it needs an
  // approved Utility template; a missing one must not break the page.
  if (await markViewed(quote)) {
    const { data: owner } = await supabaseAdmin
      .from('users').select('whatsapp_number').eq('id', quote.user_id).maybeSingle()
    if (owner?.whatsapp_number) {
      try {
        await sendWhatsAppTemplate(owner.whatsapp_number, 'quote_viewed', [
          customer?.name ?? 'Your customer',
          quote.number,
        ])
      } catch (err) {
        console.error('[q] quote_viewed notify failed:', err)
      }
    }
  }

  const canPay = !isPaid && paystackConfigured() && Number(quote.total) > 0
  const mark = monogram(business.business_name)

  return (
    <main className="min-h-screen bg-[#FAF9F6] px-4 py-8 sm:py-14">
      <div className="mx-auto w-full max-w-2xl">

        <article className="overflow-hidden rounded-2xl border border-[#E2E0D9] bg-white shadow-[0_1px_2px_rgba(26,26,23,0.04),0_12px_28px_-12px_rgba(180,83,10,0.18)]">

          <header className="flex flex-col gap-4 border-b border-[#E2E0D9] px-6 py-6 sm:flex-row sm:items-start sm:justify-between sm:gap-6 sm:px-8">
            <div className="flex min-w-0 items-start gap-3">
              {business.logo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={business.logo_url}
                  alt=""
                  className="h-14 w-14 shrink-0 rounded-lg object-contain"
                />
              ) : (
                <div
                  className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg text-xl font-bold tracking-wide text-white"
                  style={{ background: mark.color }}
                  aria-hidden="true"
                >
                  {mark.text}
                </div>
              )}
              <div>
                <h1 className="text-lg font-semibold tracking-[-0.01em] text-[#1A1A17]">
                  {business.business_name}
                </h1>
                <p className="mt-0.5 text-sm leading-relaxed text-[#6B6B60]">
                  {[business.trade, business.owner_name].filter(Boolean).join(' · ')}
                </p>
                {business.phone ? (
                  <a
                    href={`https://wa.me/${business.phone.replace(/\D/g, '')}`}
                    className="mt-1 inline-block text-sm text-[#B4530A] underline underline-offset-2 transition-opacity duration-150 hover:opacity-70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#B4530A]"
                  >
                    {business.phone}
                  </a>
                ) : null}
              </div>
            </div>

            {/* Mobile: a full-width strip under the business block, number and
                date on one line. Right-aligning a shrink-to-fit block here left
                the number and date floating mid-card. */}
            <div className="shrink-0 border-t border-[#E2E0D9] pt-4 sm:border-0 sm:pt-0 sm:text-right">
              <p className="text-xl font-semibold tracking-[-0.02em] text-[#B4530A] sm:text-2xl">
                {isInvoice ? 'Invoice' : 'Quotation'}
              </p>
              <p className="mt-1 flex flex-wrap items-baseline gap-x-1.5 text-sm sm:mt-1 sm:block">
                <span className="font-medium text-[#1A1A17]">{quote.number}</span>
                <span aria-hidden="true" className="text-[#B0AEA3] sm:hidden">·</span>
                <span className="text-[#6B6B60]">{fmtDate(quote.created_at)}</span>
              </p>
            </div>
          </header>

          {isPaid ? (
            <p className="border-b border-[#CDE8D2] bg-[#EEF7EF] px-6 py-3 text-sm font-medium text-[#1E5B2A] sm:px-8">
              Paid on {quote.paid_at ? fmtDate(quote.paid_at) : 'record'} — thank you.
            </p>
          ) : null}

          {customer ? (
            <section className="border-b border-[#E2E0D9] px-6 py-5 sm:px-8">
              <h2 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#B4530A]">
                {isInvoice ? 'Invoice for' : 'Quote for'}
              </h2>
              <p className="mt-1.5 font-medium text-[#1A1A17]">{customer.name}</p>
              {customer.address ? (
                <p className="text-sm leading-relaxed text-[#6B6B60]">{customer.address}</p>
              ) : null}
            </section>
          ) : null}

          <section className="px-6 py-5 sm:px-8">
            <div className="flex items-baseline justify-between gap-4 pb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#B4530A]">
              <span>Description</span>
              <span>Amount</span>
            </div>
            <ul className="divide-y divide-[#E2E0D9] border-t border-[#E2E0D9]">
              {items.map(item => (
                <li key={item.id} className="flex items-baseline justify-between gap-4 py-3">
                  <div className="min-w-0">
                    <p className="text-[#1A1A17]">{item.description}</p>
                    {Number(item.quantity) !== 1 ? (
                      <p className="text-sm text-[#6B6B60]">
                        {fmtQty(item.quantity)} × {fmtR(item.unit_price)}
                      </p>
                    ) : null}
                  </div>
                  <p className="shrink-0 tabular-nums text-[#1A1A17]">{fmtR(item.line_total)}</p>
                </li>
              ))}
            </ul>

            <div className="mt-5 border-t border-[#E2E0D9] pt-4">
              {showVat ? (
                <>
                  <div className="flex justify-between py-1 text-sm text-[#6B6B60]">
                    <span>Subtotal</span>
                    <span className="tabular-nums">{fmtR(quote.subtotal)}</span>
                  </div>
                  <div className="flex justify-between py-1 text-sm text-[#6B6B60]">
                    <span>VAT (15%)</span>
                    <span className="tabular-nums">{fmtR(quote.vat_amount)}</span>
                  </div>
                </>
              ) : null}
              <div className="mt-2 flex items-baseline justify-between">
                <span className="font-semibold text-[#B4530A]">Total</span>
                <span className="text-2xl font-semibold tabular-nums tracking-[-0.02em] text-[#B4530A]">
                  {fmtR(quote.total)}
                </span>
              </div>
            </div>
          </section>

          {canPay ? (
            <section className="border-t border-[#E2E0D9] bg-[#FAF9F6] px-6 py-6 sm:px-8">
              <form action={`/api/quotes/${quote.public_token}/pay`} method="POST">
                <label htmlFor="email" className="block text-sm font-medium text-[#1A1A17]">
                  Your email address (for the receipt)
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  defaultValue={customer?.email ?? ''}
                  className="mt-1.5 w-full rounded-lg border border-[#D6D3C9] bg-white px-3 py-2.5 text-[#1A1A17] focus-visible:border-[#B4530A] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#B4530A]/40"
                />
                <button
                  type="submit"
                  className="mt-3 w-full rounded-lg bg-[#B4530A] px-4 py-3 font-semibold text-white shadow-[0_1px_2px_rgba(26,26,23,0.08),0_8px_18px_-8px_rgba(180,83,10,0.55)] transition-transform duration-150 ease-out hover:-translate-y-px active:translate-y-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#B4530A]"
                >
                  Pay {fmtR(quote.total)}
                </button>
              </form>
              <p className="mt-2.5 text-center text-xs text-[#6B6B60]">
                Card, EFT or Capitec Pay · secured by Paystack
              </p>
            </section>
          ) : null}

          {business.account_number ? (
            <section className="border-t border-[#E2E0D9] px-6 py-5 sm:px-8">
              <h2 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#B4530A]">
                Or pay by EFT
              </h2>
              <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-4">
                {business.bank_name ? (
                  <div>
                    <dt className="text-[#6B6B60]">Bank</dt>
                    <dd className="font-medium text-[#1A1A17]">{business.bank_name}</dd>
                  </div>
                ) : null}
                <div>
                  <dt className="text-[#6B6B60]">Account</dt>
                  <dd className="font-medium tabular-nums text-[#1A1A17]">{business.account_number}</dd>
                </div>
                {business.branch_code ? (
                  <div>
                    <dt className="text-[#6B6B60]">Branch</dt>
                    <dd className="font-medium tabular-nums text-[#1A1A17]">{business.branch_code}</dd>
                  </div>
                ) : null}
                <div>
                  <dt className="text-[#6B6B60]">Reference</dt>
                  <dd className="font-medium text-[#1A1A17]">{quote.number}</dd>
                </div>
              </dl>
            </section>
          ) : null}

          <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-[#E2E0D9] px-6 py-4 sm:px-8">
            {/* `download` plus the route's attachment disposition — an inline
                PDF renders as a blank page in WhatsApp's in-app browser and
                several mobile browsers, which have no viewer to hand it to. */}
            <a
              href={`/api/quotes/${quote.public_token}/pdf`}
              download={`${quote.number}.pdf`}
              className="text-sm font-medium text-[#B4530A] underline underline-offset-2 transition-opacity duration-150 hover:opacity-70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#B4530A]"
            >
              Download PDF
            </a>
            <p className="text-xs text-[#6B6B60]">Made with Sorted</p>
          </footer>
        </article>
      </div>
    </main>
  )
}
