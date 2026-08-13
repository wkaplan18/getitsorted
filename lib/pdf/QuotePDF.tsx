import React from 'react'
import { Document, Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer'
import { monogram } from '../monogram'
import { SORTED_MARK_PNG } from './sortedMark'

// Palette: deliberately not a stock framework blue. A quote from a one-person
// trade business should read as solid and warm, not as a SaaS invoice.
const ACCENT = '#B4530A'   // burnt amber
const INK    = '#1A1A17'
const MUTED  = '#6B6B60'
const BORDER = '#E2E0D9'
const SURF   = '#FAF9F6'

const s = StyleSheet.create({
  page:        { fontFamily: 'Helvetica', fontSize: 9, color: INK, padding: 44, paddingBottom: 62 },

  header:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 },
  brandLeft:   { flexDirection: 'row', alignItems: 'flex-start', gap: 10, maxWidth: 300 },
  logo:        { width: 52, height: 52, objectFit: 'contain' },
  mark:        { width: 52, height: 52, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  markText:    { fontSize: 20, fontFamily: 'Helvetica-Bold', color: '#FFFFFF', letterSpacing: 0.5 },
  company:     { fontSize: 15, fontFamily: 'Helvetica-Bold', color: INK, marginBottom: 3 },
  companyMeta: { fontSize: 7.5, color: MUTED, lineHeight: 1.5 },

  docTitle:    { fontSize: 22, fontFamily: 'Helvetica-Bold', color: ACCENT, textAlign: 'right', letterSpacing: -0.5 },
  docNum:      { fontSize: 9.5, color: INK, textAlign: 'right', marginTop: 4 },
  docMeta:     { fontSize: 7.5, color: MUTED, textAlign: 'right', marginTop: 2 },

  infoBox:     { padding: 11, backgroundColor: SURF, borderWidth: 0.5, borderColor: BORDER, borderRadius: 3, marginBottom: 20 },
  infoHd:      { fontSize: 6.5, color: ACCENT, fontFamily: 'Helvetica-Bold', letterSpacing: 0.6, marginBottom: 5 },
  infoBold:    { fontSize: 10, fontFamily: 'Helvetica-Bold', color: INK, marginBottom: 2 },
  infoRow:     { fontSize: 8.5, color: MUTED, lineHeight: 1.4 },

  tableHead:   { flexDirection: 'row', backgroundColor: ACCENT, paddingVertical: 6, paddingHorizontal: 9 },
  th:          { fontSize: 7.5, color: '#FFFFFF', fontFamily: 'Helvetica-Bold', letterSpacing: 0.4 },
  row:         { flexDirection: 'row', paddingVertical: 6, paddingHorizontal: 9, borderBottomWidth: 0.5, borderBottomColor: BORDER },
  rowAlt:      { backgroundColor: SURF },
  td:          { fontSize: 9, color: INK },
  tdMuted:     { fontSize: 9, color: MUTED },

  colDesc:     { flex: 1 },
  colQty:      { width: 46, textAlign: 'right' },
  colUnit:     { width: 76, textAlign: 'right' },
  colTotal:    { width: 84, textAlign: 'right' },

  totalsWrap:  { marginTop: 16, alignItems: 'flex-end' },
  totalsBox:   { width: 240, padding: 13, borderWidth: 0.5, borderColor: BORDER, borderRadius: 3 },
  tRow:        { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 },
  tLabel:      { fontSize: 8.5, color: MUTED },
  tVal:        { fontSize: 8.5, color: INK },
  tDivider:    { borderTopWidth: 0.5, borderTopColor: BORDER, marginVertical: 6 },
  tBigLabel:   { fontSize: 11.5, fontFamily: 'Helvetica-Bold', color: ACCENT },
  tBigVal:     { fontSize: 11.5, fontFamily: 'Helvetica-Bold', color: ACCENT },
  vatNote:     { fontSize: 7, color: MUTED, lineHeight: 1.45, marginTop: 7, borderTopWidth: 0.5, borderTopColor: BORDER, paddingTop: 6 },

  section:     { marginTop: 20 },
  secTitle:    { fontSize: 6.5, color: ACCENT, fontFamily: 'Helvetica-Bold', letterSpacing: 0.6, borderBottomWidth: 0.5, borderBottomColor: BORDER, paddingBottom: 4, marginBottom: 7 },
  secBody:     { fontSize: 8.5, color: INK, lineHeight: 1.6 },
  bankGrid:    { flexDirection: 'row', gap: 24, marginTop: 2 },
  bankKey:     { fontSize: 6.5, color: MUTED, marginBottom: 2 },
  bankVal:     { fontSize: 9, color: INK, fontFamily: 'Helvetica-Bold' },

  footer:      { position: 'absolute', bottom: 22, left: 44, right: 44, borderTopWidth: 0.5, borderTopColor: BORDER, paddingTop: 7, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  footerText:  { fontSize: 7, color: MUTED },
  madeWith:    { flexDirection: 'row', alignItems: 'center', gap: 4 },
  madeWithMark:{ width: 9, height: 9, objectFit: 'contain' },
  footerPage:  { fontSize: 7, color: MUTED, width: 44, textAlign: 'right' },
})

function fmtR(n: number): string {
  return 'R ' + n.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

// Quantities are usually whole ("3 bedrooms") but can be fractional ("2.5 hrs").
// Show the decimal only when there is one.
function fmtQty(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(2)
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Date(iso.length === 10 ? iso + 'T12:00:00' : iso)
    .toLocaleDateString('en-ZA', { day: 'numeric', month: 'long', year: 'numeric' })
}

export type QuotePDFItem = {
  description: string
  quantity: number
  unit_price: number
  line_total: number
}

export type QuotePDFProps = {
  number: string
  docType: 'quote' | 'invoice'
  createdAt: string
  subtotal: number
  vatAmount: number
  total: number
  notes?: string | null

  businessName: string
  trade?: string | null
  ownerName?: string | null
  phone?: string | null
  vatNumber?: string | null
  logoUrl?: string | null

  bankName?: string | null
  accountNumber?: string | null
  branchCode?: string | null

  customerName?: string | null
  customerAddress?: string | null

  items: QuotePDFItem[]
}

export function QuotePDF(props: QuotePDFProps) {
  const {
    number, docType, createdAt, subtotal, vatAmount, total, notes,
    businessName, trade, ownerName, phone, vatNumber, logoUrl,
    bankName, accountNumber, branchCode,
    customerName, customerAddress, items,
  } = props

  const mark = monogram(businessName)
  const hasBank = Boolean(bankName || accountNumber)
  // VAT only appears when the business is actually registered. Most of these
  // users are not, and a R0.00 VAT row on their quote invites questions they
  // don't want from a customer.
  const showVat = vatAmount > 0 || Boolean(vatNumber)

  // Only a registered vendor may head a document "TAX INVOICE" (VAT Act s20) —
  // for everyone else it is an invoice, full stop.
  const title = docType === 'invoice'
    ? (vatNumber ? 'TAX INVOICE' : 'INVOICE')
    : 'QUOTATION'

  // Said plainly rather than as "zero-rated" or "nil VAT": those are
  // classifications of a registered vendor's supplies, and a business that
  // isn't registered has neither. Without this line a client sees a total with
  // no VAT on it and cannot tell whether VAT is included, excluded, or missing.
  const vatNote = showVat
    ? null
    : `${businessName} is not registered for VAT. No VAT is charged on this ${docType === 'invoice' ? 'invoice' : 'quotation'}.`

  return (
    <Document title={`${number} — ${businessName}`} author={businessName}>
      <Page size="A4" style={s.page}>

        <View style={s.header}>
          <View style={s.brandLeft}>
            {logoUrl ? (
              <Image src={logoUrl} style={s.logo} />
            ) : (
              // No uploaded logo — a derived monogram, so the quote is never
              // headed by an empty space where a brand should be.
              <View style={[s.mark, { backgroundColor: mark.color }]}>
                <Text style={s.markText}>{mark.text}</Text>
              </View>
            )}
            <View>
              <Text style={s.company}>{businessName}</Text>
              <Text style={s.companyMeta}>
                {[trade, ownerName, phone].filter(Boolean).join('\n')}
                {vatNumber ? `\nVAT ${vatNumber}` : ''}
              </Text>
            </View>
          </View>
          <View>
            <Text style={s.docTitle}>{title}</Text>
            <Text style={s.docNum}>{number}</Text>
            <Text style={s.docMeta}>{fmtDate(createdAt)}</Text>
          </View>
        </View>

        {customerName ? (
          <View style={s.infoBox}>
            <Text style={s.infoHd}>{docType === 'invoice' ? 'INVOICE FOR' : 'QUOTE FOR'}</Text>
            <Text style={s.infoBold}>{customerName}</Text>
            {customerAddress ? <Text style={s.infoRow}>{customerAddress}</Text> : null}
          </View>
        ) : null}

        <View style={s.tableHead}>
          <Text style={[s.th, s.colDesc]}>DESCRIPTION</Text>
          <Text style={[s.th, s.colQty]}>QTY</Text>
          <Text style={[s.th, s.colUnit]}>UNIT</Text>
          <Text style={[s.th, s.colTotal]}>AMOUNT</Text>
        </View>

        {items.map((item, i) => (
          <View key={i} style={i % 2 === 1 ? [s.row, s.rowAlt] : s.row} wrap={false}>
            <Text style={[s.td, s.colDesc]}>{item.description}</Text>
            <Text style={[s.tdMuted, s.colQty]}>{fmtQty(item.quantity)}</Text>
            <Text style={[s.tdMuted, s.colUnit]}>{fmtR(item.unit_price)}</Text>
            <Text style={[s.td, s.colTotal]}>{fmtR(item.line_total)}</Text>
          </View>
        ))}

        <View style={s.totalsWrap}>
          <View style={s.totalsBox}>
            {showVat ? (
              <>
                <View style={s.tRow}>
                  <Text style={s.tLabel}>Subtotal</Text>
                  <Text style={s.tVal}>{fmtR(subtotal)}</Text>
                </View>
                <View style={s.tRow}>
                  <Text style={s.tLabel}>VAT (15%)</Text>
                  <Text style={s.tVal}>{fmtR(vatAmount)}</Text>
                </View>
                <View style={s.tDivider} />
              </>
            ) : null}
            <View style={s.tRow}>
              <Text style={s.tBigLabel}>TOTAL</Text>
              <Text style={s.tBigVal}>{fmtR(total)}</Text>
            </View>
            {vatNote ? <Text style={s.vatNote}>{vatNote}</Text> : null}
          </View>
        </View>

        {hasBank ? (
          <View style={s.section}>
            <Text style={s.secTitle}>BANKING DETAILS</Text>
            <View style={s.bankGrid}>
              {bankName ? (
                <View>
                  <Text style={s.bankKey}>BANK</Text>
                  <Text style={s.bankVal}>{bankName}</Text>
                </View>
              ) : null}
              {accountNumber ? (
                <View>
                  <Text style={s.bankKey}>ACCOUNT</Text>
                  <Text style={s.bankVal}>{accountNumber}</Text>
                </View>
              ) : null}
              {branchCode ? (
                <View>
                  <Text style={s.bankKey}>BRANCH</Text>
                  <Text style={s.bankVal}>{branchCode}</Text>
                </View>
              ) : null}
              <View>
                <Text style={s.bankKey}>REFERENCE</Text>
                <Text style={s.bankVal}>{number}</Text>
              </View>
            </View>
          </View>
        ) : null}

        {notes ? (
          <View style={s.section}>
            <Text style={s.secTitle}>NOTES</Text>
            <Text style={s.secBody}>{notes}</Text>
          </View>
        ) : null}

        <View style={s.footer} fixed>
          <Text style={s.footerText}>{businessName} · {number}</Text>
          <View style={s.madeWith}>
            <Image src={SORTED_MARK_PNG} style={s.madeWithMark} />
            <Text style={s.footerText}>Made with Sorted</Text>
          </View>
          <Text style={s.footerPage} render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
        </View>
      </Page>
    </Document>
  )
}
