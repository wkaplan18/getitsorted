// The picture WhatsApp shows under a forwarded quote link.
//
// This is the tradesperson's shopfront: for most of his clients it is the very
// first thing they ever see from his business, before they open anything. So it
// carries HIS name and HIS document, not Sorted's — the only mention of Sorted
// is a line of small print at the bottom.
//
// Rendered per quote rather than served as one static file because a generic
// image would say nothing, and "R16 500,00 from Kaplan electric" in the preview
// is the whole reason the client taps.

import { ImageResponse } from 'next/og'
import { loadQuoteByToken } from '@/lib/quoteView'
import { monogram } from '@/lib/monogram'

export const runtime = 'nodejs'
export const contentType = 'image/png'
export const size = { width: 1200, height: 630 }
export const alt = 'Quotation'

const AMBER = '#B4530A'
const INK = '#1A1A17'
const MUTED = '#6B6B60'
const SAND = '#FDF6EC'

function rands(n: number): string {
  return 'R' + Number(n).toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export default async function Image({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const view = await loadQuoteByToken(token)

  // A dead link still gets an image — a broken preview looks like a scam, and
  // this one is going to a customer who has never heard of us.
  if (!view) {
    return new ImageResponse(
      (
        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: SAND, color: MUTED, fontSize: 40 }}>
          This link has expired
        </div>
      ),
      size,
    )
  }

  const { quote, business, customer } = view
  const isInvoice = quote.doc_type === 'invoice'
  // Only a registered vendor may head a document "Tax Invoice" (VAT Act s20).
  const docWord = isInvoice ? (business.vat_number ? 'TAX INVOICE' : 'INVOICE') : 'QUOTATION'
  const mark = monogram(business.business_name)
  const meta = [business.trade, business.owner_name].filter(Boolean).join(' · ')

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
          justifyContent: 'space-between', background: SAND, padding: 72,
          // Satori needs an explicit font family; the default sans is the only
          // one guaranteed present, so no webfont is fetched at render time.
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 28 }}>
          {/* The monogram, not the uploaded logo: a remote image that fails to
              fetch takes the whole preview down with it, and no preview is far
              worse than an initialled square. */}
          <div
            style={{
              width: 108, height: 108, borderRadius: 24, background: mark.color,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#fff', fontSize: 46, fontWeight: 700,
            }}
          >
            {mark.text}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ fontSize: 52, fontWeight: 700, color: INK, letterSpacing: '-0.02em' }}>
              {business.business_name}
            </div>
            {meta ? <div style={{ fontSize: 28, color: MUTED, marginTop: 6 }}>{meta}</div> : null}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ fontSize: 26, fontWeight: 700, color: AMBER, letterSpacing: '0.14em' }}>
            {docWord} {quote.number}
          </div>
          {customer ? (
            <div style={{ fontSize: 34, color: MUTED, marginTop: 14 }}>For {customer.name}</div>
          ) : null}
          <div style={{ fontSize: 104, fontWeight: 700, color: AMBER, letterSpacing: '-0.03em', marginTop: 10 }}>
            {rands(quote.total)}
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '2px solid #EFE2D0', paddingTop: 26 }}>
          <div style={{ fontSize: 26, color: MUTED }}>View it or download the PDF</div>
          <div style={{ fontSize: 22, color: '#A9A79C' }}>Made with Sorted</div>
        </div>
      </div>
    ),
    size,
  )
}