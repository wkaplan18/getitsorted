// Renders a quote or invoice to PDF on demand.
//
// Generated per request rather than stored: quotes are small, the render is
// fast, and it means an edited logo or business name is never stale on a
// document the customer downloads later.

import { NextResponse } from 'next/server'
import { renderToBuffer } from '@react-pdf/renderer'
import { loadQuoteByToken } from '@/lib/quoteView'
import { QuotePDF } from '@/lib/pdf/QuotePDF'

// @react-pdf/renderer needs Node APIs — it cannot run on the edge runtime.
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params

  const view = await loadQuoteByToken(token)
  if (!view) return NextResponse.json({ error: 'not found' }, { status: 404 })

  const { quote, items, business, customer } = view

  // ?inline=1 renders in the browser's viewer; the default downloads. Mobile
  // browsers and WhatsApp's in-app browser frequently show an inline PDF as a
  // blank white page because they have no viewer to hand it to, so a link
  // labelled "Download PDF" must actually download.
  const inline = new URL(req.url).searchParams.get('inline') === '1'

  let buffer: Buffer
  try {
    buffer = await renderToBuffer(
    QuotePDF({
      number: quote.number,
      docType: quote.doc_type,
      createdAt: quote.created_at,
      subtotal: Number(quote.subtotal),
      vatAmount: Number(quote.vat_amount),
      total: Number(quote.total),
      notes: quote.notes,

      businessName: business.business_name,
      trade: business.trade,
      ownerName: business.owner_name,
      phone: business.phone,
      vatNumber: business.vat_number,
      logoUrl: business.logo_url,

      bankName: business.bank_name,
      accountNumber: business.account_number,
      branchCode: business.branch_code,

      customerName: customer?.name ?? null,
      customerAddress: customer?.address ?? null,

      items: items.map(item => ({
        description: item.description,
        quantity: Number(item.quantity),
        unit_price: Number(item.unit_price),
        line_total: Number(item.line_total),
      })),
    }),
    )
  } catch (err) {
    // Previously this threw into a blank response with no trace of why. A
    // remote logo that won't load is the most likely cause, so name it.
    console.error(`[pdf] render failed for ${quote.number} (logo: ${business.logo_url ?? 'none'}):`, err)
    return NextResponse.json({ error: 'could not build the PDF' }, { status: 500 })
  }

  const disposition = inline ? 'inline' : 'attachment'

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `${disposition}; filename="${quote.number}.pdf"`,
      'Content-Length': String(buffer.length),
      'Cache-Control': 'private, max-age=0, must-revalidate',
    },
  })
}
