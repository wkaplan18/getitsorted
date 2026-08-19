// Shared shell for the three policy pages (privacy, terms, refunds).
//
// One component rather than three copies of the same markup: the pages are
// read side by side by anyone checking the business is real — a compliance
// reviewer, a customer deciding whether to pay — and three slightly different
// layouts is exactly the tell that says nobody maintains them.
//
// Deliberately plainer than the landing page. This is a document, not a pitch:
// one column, generous line-height, no motion, no decoration competing with
// the text. It keeps the brand only where it identifies the page as Sorted's
// (the mark, the amber accent, Plus Jakarta Sans on headings).

import Link from 'next/link'
import { BUSINESS, POLICY_UPDATED } from '@/lib/business'

/** The three policy pages, in the order they are linked everywhere. */
export const LEGAL_LINKS = [
  { href: '/terms', label: 'Terms of Service' },
  { href: '/privacy', label: 'Privacy Policy' },
  { href: '/refunds', label: 'Refund Policy' },
] as const

export function LegalPage({
  title,
  intro,
  children,
}: {
  title: string
  intro?: string
  children: React.ReactNode
}) {
  return (
    <div style={{ background: '#fff', minHeight: '100vh' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@600;700;800&family=Inter:wght@400;500;600&display=swap');
        .legal-body { font-family: 'Inter', -apple-system, sans-serif; }
        .legal-body h2 {
          font-family: 'Plus Jakarta Sans', sans-serif;
          font-weight: 700; font-size: 19px; letter-spacing: -0.02em;
          color: #0f172a; margin: 0 0 10px;
        }
        .legal-body p { color: #475569; font-size: 15px; line-height: 1.75; margin: 0 0 12px; }
        .legal-body p:last-child { margin-bottom: 0; }
        .legal-body ul { margin: 8px 0 12px; padding-left: 20px; color: #475569; font-size: 15px; line-height: 1.75; }
        .legal-body li { margin-bottom: 6px; }
        .legal-body strong { color: #1e293b; font-weight: 600; }
        .legal-body a { color: #B4530A; text-decoration: underline; text-underline-offset: 2px; }
        .legal-body a:hover { color: #8A4B12; }
        .legal-body a:focus-visible { outline: 2px solid #B4530A; outline-offset: 2px; border-radius: 2px; }
      `}</style>

      {/* Header — the mark is a link home, so a reviewer who arrives on a deep
          link from a policy URL can get to the product in one tap. */}
      <header style={{ borderBottom: '1px solid #f1f5f9', background: 'rgba(255,255,255,0.92)' }}>
        <div style={{ maxWidth: 720, margin: '0 auto', padding: '0 24px', height: 64, display: 'flex', alignItems: 'center' }}>
          <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
            <span style={{ width: 30, height: 30, borderRadius: 9, background: '#B4530A', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 800, fontSize: 16 }}>S</span>
            <span style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 800, fontSize: 19, color: '#0f172a', letterSpacing: '-0.03em' }}>Sorted</span>
          </Link>
        </div>
      </header>

      <main className="legal-body" style={{ maxWidth: 720, margin: '0 auto', padding: '56px 24px 72px' }}>
        <h1 style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 800, fontSize: 'clamp(28px, 5vw, 36px)', letterSpacing: '-0.03em', color: '#0f172a', margin: '0 0 8px' }}>
          {title}
        </h1>
        <p style={{ color: '#94a3b8', fontSize: 13, margin: '0 0 8px' }}>Last updated: {POLICY_UPDATED}</p>
        {intro && <p style={{ color: '#475569', fontSize: 16, lineHeight: 1.75, margin: '0 0 8px' }}>{intro}</p>}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 32, marginTop: 40 }}>
          {children}
        </div>

        {/* Every policy page ends with the same identifiable operator block.
            This is the thing Paystack's review said was missing, so it is
            repeated on all three rather than living on one of them. */}
        <section style={{ marginTop: 44, background: '#FDF6EC', border: '1px solid #F0E1CC', borderRadius: 16, padding: 24 }}>
          <h2 style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 700, fontSize: 18, letterSpacing: '-0.02em', color: '#0f172a', margin: '0 0 12px' }}>
            Contact us
          </h2>
          <p style={{ color: '#6B6B60', fontSize: 15, lineHeight: 1.8, margin: 0 }}>
            <strong style={{ color: '#1A1A17' }}>{BUSINESS.legalName}</strong><br />
            Trading as {BUSINESS.tradingAs}<br />
            {BUSINESS.address}<br />
            Email: <a href={`mailto:${BUSINESS.email}`}>{BUSINESS.email}</a><br />
            Web: <a href={BUSINESS.siteUrl}>{BUSINESS.site}</a>
          </p>
          <p style={{ color: '#6B6B60', fontSize: 14, lineHeight: 1.7, margin: '14px 0 0' }}>
            We answer email enquiries within two business days.
          </p>
        </section>

        <nav style={{ marginTop: 32, display: 'flex', flexWrap: 'wrap', gap: 20, borderTop: '1px solid #f1f5f9', paddingTop: 24 }}>
          <Link href="/" style={{ fontSize: 14, color: '#64748b', textDecoration: 'none' }}>← Back to Sorted</Link>
          {LEGAL_LINKS.map(l => (
            <Link key={l.href} href={l.href} style={{ fontSize: 14, color: '#64748b', textDecoration: 'none' }}>{l.label}</Link>
          ))}
        </nav>
      </main>
    </div>
  )
}

/** One titled block of a policy. Kept tiny so the pages read as content. */
export function Clause({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2>{title}</h2>
      {children}
    </section>
  )
}
