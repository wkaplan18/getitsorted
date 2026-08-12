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

export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params

  const view = await loadQuoteByToken(token)
  if (!view) return NextResponse.json({ error: 'not found' }, { status: 404 })

  const { quote, items, business, customer } = view

  const buffer = await renderToBuffer(
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

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/pdf',
      // inline so WhatsApp's in-app browser previews it instead of forcing a
      // download the user then has to hunt for in a full Downloads folder.
      'Content-Disposition': `inline; filename="${quote.number}.pdf"`,
      'Cache-Control': 'private, max-age=0, must-revalidate',
    },
  })
}
