// Sorted — landing page
//
// THESIS: Sorted is two jobs on one WhatsApp number, and the page says so out
// loud instead of flattening them into one undifferentiated feature list. It
// refuses the category default of a single hero plus nine equal benefit cards.
//
// OWN-WORLD: The incumbent Sorted system, inherited: Plus Jakarta Sans display
// over Inter, deeply rounded surfaces, real WhatsApp bubbles as the proof
// device. What's new is a second accent — burnt amber #B4530A on warm sand
// #FDF6EC for money-in — set against the existing green #16A34A on mint for
// money-out. The amber is the exact accent on the PDF the tradesman's client
// receives, so the site and the artefact match.
//
// STORY: A tradesman lands, sees his own job priced and sent inside WhatsApp,
// and texts QUOTE. A household visitor scrolls one section and finds bills
// intact.
//
// FIRST VIEWPORT: Amber-washed hero, headline left with the WhatsApp CTA, the
// three-step thread on a phone right, and the finished quote document
// overlapping it — mechanism and output in one frame.
//
// FORM: Extension of an established surface. No concept tournament run.

import Link from 'next/link'

const WA_NUMBER = (process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || '').replace(/\D/g, '')
const WA_QUOTE_LINK = WA_NUMBER ? `https://wa.me/${WA_NUMBER}?text=quote` : '/app'

export default function Home() {
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Inter:wght@400;500&display=swap');
        * { box-sizing: border-box; }
        body { font-family: 'Inter', sans-serif; color: #0f172a; background: #fff; -webkit-font-smoothing: antialiased; margin: 0; }
        h1, h2, h3, h4, .font-heading { font-family: 'Plus Jakarta Sans', sans-serif; }
        html { scroll-behavior: smooth; }

        /* Money-in hero: warm sand washed with amber, the same accent that
           lands on the PDF the tradesman's client opens. */
        .hero-bg {
          background: linear-gradient(140deg, #FDF6EC 0%, #FBEBD6 42%, #fff 74%);
          position: relative;
          overflow: hidden;
        }
        .hero-bg::before {
          content: '';
          position: absolute;
          top: -140px; right: -140px;
          width: 520px; height: 520px;
          border-radius: 50%;
          background: radial-gradient(circle, rgba(180,83,10,0.13) 0%, transparent 70%);
          pointer-events: none;
        }

        .wa-bubble {
          background: #fff;
          border-radius: 12px 12px 12px 2px;
          font-size: 13px;
          line-height: 1.55;
          padding: 10px 13px;
          max-width: 215px;
          box-shadow: 0 1px 2px rgba(15,23,42,0.06), 0 4px 12px -6px rgba(15,23,42,0.12);
        }
        .wa-bubble-right {
          background: #DCF8C6;
          border-radius: 12px 12px 2px 12px;
          margin-left: auto;
        }

        /* Only transform and opacity animate. Spring-ish ease so a card lifts
           rather than slides. */
        .lift { transition: transform 0.22s cubic-bezier(0.34, 1.4, 0.64, 1), box-shadow 0.22s ease; }
        .lift:hover { transform: translateY(-3px); }
        .lift:focus-visible { outline: 2px solid #B4530A; outline-offset: 3px; }

        .btn { transition: transform 0.15s cubic-bezier(0.34, 1.4, 0.64, 1), opacity 0.15s ease; display: inline-block; text-decoration: none; }
        .btn:hover { transform: translateY(-2px); }
        .btn:active { transform: translateY(0); }
        .btn:focus-visible { outline: 2px solid currentColor; outline-offset: 3px; }

        .nav-link { color: #64748b; text-decoration: none; font-size: 14px; font-weight: 500; transition: color 0.15s; }
        .nav-link:hover { color: #0f172a; }
        .nav-link:focus-visible { outline: 2px solid #B4530A; outline-offset: 3px; border-radius: 4px; }

        .section-title { font-family: 'Plus Jakarta Sans', sans-serif; font-weight: 800; letter-spacing: -0.03em; color: #0f172a; }
        .label { font-weight: 600; font-size: 13px; text-transform: uppercase; letter-spacing: 0.1em; font-family: 'Plus Jakarta Sans', sans-serif; margin-bottom: 12px; display: block; }

        @media (max-width: 900px) {
          .hide-mobile { display: none !important; }
          .hero-grid { grid-template-columns: 1fr !important; }
          .phone-col { display: none; }
          .steps-grid { grid-template-columns: 1fr !important; }
          .lanes-grid { grid-template-columns: 1fr !important; }
          .split-grid { grid-template-columns: 1fr !important; gap: 40px !important; }
          .bills-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>

      {/* NAV */}
      <nav style={{ position: 'sticky', top: 0, zIndex: 50, background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(12px)', borderBottom: '1px solid #f1f5f9' }}>
        <div style={{ maxWidth: 1152, margin: '0 auto', padding: '0 32px', height: 64, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <a href="#" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
            <SortedMark size={34} />
            <span style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 800, fontSize: 20, color: '#0f172a', letterSpacing: '-0.03em' }}>Sorted</span>
          </a>
          <div className="hide-mobile" style={{ display: 'flex', gap: 32 }}>
            <a href="#quotes" className="nav-link">Send quotes</a>
            <a href="#bills" className="nav-link">Track bills</a>
            <a href="#who" className="nav-link">Who it&apos;s for</a>
          </div>
          <Link href="/app" className="btn" style={{ background: '#0f172a', color: '#fff', fontSize: 14, fontWeight: 600, padding: '10px 20px', borderRadius: 12, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
            Open app →
          </Link>
        </div>
      </nav>

      {/* ═══ HERO — money in ═══ */}
      <section className="hero-bg">
        <div className="hero-grid" style={{ maxWidth: 1152, margin: '0 auto', padding: '84px 32px 100px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 48, alignItems: 'center' }}>

          <div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: '#fff', border: '1px solid #F0DCC2', color: '#8A4B12', fontSize: 12, fontWeight: 600, padding: '6px 14px', borderRadius: 999, marginBottom: 24, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#B4530A', display: 'inline-block' }} />
              For plumbers, electricians, painters &amp; every one-person trade
            </div>

            <h1 style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 'clamp(40px, 6vw, 60px)', fontWeight: 800, letterSpacing: '-0.04em', lineHeight: 1.05, color: '#0f172a', margin: '0 0 20px' }}>
              Send a professional quote<br />
              <span style={{ color: '#B4530A' }}>straight from WhatsApp.</span>
            </h1>

            <p style={{ fontSize: 18, color: '#64748b', lineHeight: 1.7, margin: '0 0 32px', maxWidth: 440 }}>
              Answer three questions on WhatsApp. Get back a branded PDF quote with your logo, your banking details, and a link you forward to your client. Under a minute, every time.
            </p>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 36 }}>
              <a href={WA_QUOTE_LINK} className="btn" style={{ background: '#B4530A', color: '#fff', fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 700, fontSize: 16, padding: '14px 24px', borderRadius: 12, boxShadow: '0 1px 2px rgba(15,23,42,0.1), 0 10px 24px -10px rgba(180,83,10,0.6)' }}>
                Send your first quote →
              </a>
              <a href="#quotes" className="btn" style={{ background: '#fff', color: '#334155', fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 600, fontSize: 16, padding: '14px 24px', borderRadius: 12, border: '1px solid #E8DCC8' }}>
                See how it works
              </a>
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {['No app to download', 'English, isiZulu & Afrikaans', 'We make your logo', 'Your banking details on every quote'].map(t => (
                <span key={t} style={{ fontSize: 12, background: 'rgba(255,255,255,0.75)', border: '1px solid #EFE2D0', color: '#6B6B60', padding: '6px 12px', borderRadius: 999 }}>{t}</span>
              ))}
            </div>
          </div>

          {/* The mechanism and its output in one frame: the thread that makes
              the quote, and the quote it makes, overlapping. */}
          <div className="phone-col" style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <div style={{ position: 'relative' }}>
              <div style={{ position: 'relative', background: '#0f172a', borderRadius: 48, padding: 12, boxShadow: '0 40px 80px rgba(15,23,42,0.25), 0 8px 20px rgba(15,23,42,0.15)', width: 292 }}>
                <div style={{ background: '#ECE5DD', borderRadius: 40, overflow: 'hidden' }}>
                  <div style={{ background: '#fff', padding: '20px 20px 12px', display: 'flex', alignItems: 'center', gap: 8, borderBottom: '1px solid #f1f5f9' }}>
                    <SortedMark size={32} radius={16} />
                    <div>
                      <p style={{ fontSize: 12, fontWeight: 600, color: '#0f172a', margin: 0, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Sorted</p>
                      <p style={{ fontSize: 11, color: '#16a34a', margin: 0 }}>● Online</p>
                    </div>
                  </div>

                  <div style={{ background: '#ECE5DD', padding: '14px 12px', minHeight: 300, display: 'flex', flexDirection: 'column', gap: 9 }}>
                    <div className="wa-bubble wa-bubble-right"><p style={{ margin: 0, color: '#0f172a', fontWeight: 600 }}>quote</p></div>
                    <div className="wa-bubble"><p style={{ margin: 0, color: '#334155' }}><strong>Step 1 of 3</strong> — What is your client&apos;s name?</p></div>
                    <div className="wa-bubble wa-bubble-right"><p style={{ margin: 0, color: '#0f172a' }}>Mrs Naidoo</p></div>
                    <div className="wa-bubble"><p style={{ margin: 0, color: '#334155' }}><strong>Step 3 of 3</strong> — What work are you doing, and what are you charging?</p></div>
                    <div className="wa-bubble wa-bubble-right"><p style={{ margin: 0, color: '#0f172a' }}>Paint 3 bedrooms R850 each, materials R1200</p></div>
                    <div className="wa-bubble"><p style={{ margin: 0, color: '#334155' }}>Thanks. Putting your quote together now…</p></div>
                  </div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'center', marginTop: 8 }}>
                  <div style={{ width: 96, height: 4, background: 'rgba(255,255,255,0.3)', borderRadius: 999 }} />
                </div>
              </div>

              {/* What comes out the other end. */}
              <div style={{ position: 'absolute', right: -52, bottom: -30, background: '#fff', borderRadius: 16, padding: 18, boxShadow: '0 2px 4px rgba(15,23,42,0.06), 0 20px 44px -18px rgba(180,83,10,0.45)', border: '1px solid #F0E7DA', width: 226 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 30, height: 30, borderRadius: 7, background: '#1D5B4C', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <span style={{ color: '#fff', fontSize: 12, fontWeight: 700, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>SP</span>
                    </div>
                    <div>
                      <p style={{ fontSize: 11, fontWeight: 700, color: '#1A1A17', margin: 0, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Sipho Plumbing</p>
                      <p style={{ fontSize: 10, color: '#94a3b8', margin: 0 }}>QUO-0001</p>
                    </div>
                  </div>
                  <span style={{ fontSize: 10, fontWeight: 700, color: '#B4530A', fontFamily: "'Plus Jakarta Sans', sans-serif", letterSpacing: '0.04em' }}>QUOTE</span>
                </div>
                <div style={{ borderTop: '1px solid #F1EDE6', paddingTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <Row label="Paint bedrooms" note="3 × R850.00" value="R2,550.00" />
                  <Row label="Materials" value="R1,200.00" />
                </div>
                <div style={{ borderTop: '1px solid #F1EDE6', marginTop: 10, paddingTop: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#B4530A', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>TOTAL</span>
                  <span style={{ fontSize: 17, fontWeight: 800, color: '#B4530A', fontFamily: "'Plus Jakarta Sans', sans-serif", letterSpacing: '-0.02em' }}>R3,750.00</span>
                </div>
              </div>

              <div style={{ position: 'absolute', left: -36, top: 72, background: '#fff', borderRadius: 12, padding: '8px 12px', boxShadow: '0 2px 4px rgba(15,23,42,0.05), 0 12px 28px -14px rgba(15,23,42,0.4)', border: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', gap: 9 }}>
                <div style={{ width: 28, height: 28, background: '#FDF0E2', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 13 }}>👀</div>
                <div>
                  <p style={{ fontSize: 12, fontWeight: 600, color: '#0f172a', margin: 0, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Mrs Naidoo opened it</p>
                  <p style={{ fontSize: 11, color: '#94a3b8', margin: 0 }}>2 minutes ago</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ TWO LANES — the page says out loud that it's two jobs ═══ */}
      <section style={{ background: '#fff', padding: '64px 32px 8px' }}>
        <div style={{ maxWidth: 1000, margin: '0 auto' }}>
          <p style={{ textAlign: 'center', fontSize: 15, color: '#64748b', margin: '0 0 28px', lineHeight: 1.7 }}>
            One WhatsApp number. Both sides of your money.
          </p>
          <div className="lanes-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
            <Lane
              href="#quotes"
              accent="#B4530A"
              ground="#FDF6EC"
              border="#F0E1CC"
              kicker="Money in"
              title="Send a quote, get paid"
              body="Three questions on WhatsApp and your client has a branded PDF with your banking details on it."
              cta="How quoting works"
            />
            <Lane
              href="#bills"
              accent="#16a34a"
              ground="#F0FDF4"
              border="#D7F0DE"
              kicker="Money out"
              title="Never miss a bill again"
              body="Forward any invoice and Sorted reads the amount, due date and bank details, then reminds you before it's due."
              cta="How bills work"
            />
          </div>
        </div>
      </section>

      {/* ═══ SECTION A — QUOTES ═══ */}
      <section id="quotes" style={{ padding: '88px 32px 96px', background: '#fff' }}>
        <div style={{ maxWidth: 1000, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 56 }}>
            <span className="label" style={{ color: '#B4530A' }}>Money in · Quotes</span>
            <h2 className="section-title" style={{ fontSize: 'clamp(28px, 4vw, 40px)', margin: '0 0 16px' }}>
              Three questions. One quote.
            </h2>
            <p style={{ color: '#64748b', fontSize: 18, lineHeight: 1.7, maxWidth: 520, margin: '0 auto' }}>
              You text <strong style={{ color: '#B4530A' }}>QUOTE</strong>. Sorted asks your business details once — then never again.
            </p>
          </div>

          <div className="steps-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 24, marginBottom: 28 }}>
            <Step num="01" title="Who is it for?" body="Your client's name, then their address. No address? Reply N/A and Sorted moves on." />
            <Step num="02" title="What are you charging?" body='Type it how you speak: "Paint 3 bedrooms R850 each, materials R1200." Sorted splits it into priced lines and adds it up.' />
            <Step num="03" title="Forward the link" body="Back comes a PDF with your logo, your banking details and the quote number as the reference. Sorted tells you when your client opens it." filled />
          </div>

          {/* Proof: what the client actually receives. */}
          <div className="split-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 48, alignItems: 'center', background: '#FDF6EC', border: '1px solid #F0E1CC', borderRadius: 24, padding: 36 }}>
            <div>
              <h3 style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 800, fontSize: 24, letterSpacing: '-0.02em', color: '#0f172a', margin: '0 0 14px' }}>
                Your client sees a real company.
              </h3>
              <p style={{ color: '#6B6B60', fontSize: 16, lineHeight: 1.75, margin: '0 0 20px' }}>
                Not a WhatsApp message with a number in it. A proper quote, on its own page, that opens on any phone and downloads as a PDF.
              </p>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 11 }}>
                {[
                  ['Your logo', 'Send yours, or Sorted makes you one from your business name.'],
                  ['Your banking details', 'Bank, account and branch code, with the quote number as the reference.'],
                  ['Opened & paid alerts', 'A WhatsApp the moment your client opens the quote.'],
                ].map(([t, d]) => (
                  <li key={t} style={{ display: 'flex', gap: 11, alignItems: 'flex-start' }}>
                    <span style={{ width: 18, height: 18, borderRadius: '50%', background: '#B4530A', color: '#fff', fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2 }}>✓</span>
                    <span style={{ fontSize: 14, lineHeight: 1.6, color: '#334155' }}>
                      <strong style={{ color: '#1A1A17' }}>{t}</strong> — {d}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            <QuoteDocument />
          </div>
        </div>
      </section>

      {/* ═══ BANK BAR ═══ */}
      <div style={{ background: '#f8fafc', borderTop: '1px solid #f1f5f9', borderBottom: '1px solid #f1f5f9', padding: '22px 32px' }}>
        <div style={{ maxWidth: 960, margin: '0 auto' }}>
          <p style={{ textAlign: 'center', fontSize: 11, color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 16, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Works with every SA bank</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '12px 32px', alignItems: 'center' }}>
            {['FNB', 'Standard Bank', 'ABSA', 'Nedbank', 'Capitec', 'Investec', 'TymeBank'].map((b, i, arr) => (
              <span key={b} style={{ display: 'flex', alignItems: 'center', gap: 32 }}>
                <span style={{ color: '#94a3b8', fontWeight: 600, fontSize: 14 }}>{b}</span>
                {i < arr.length - 1 && <span style={{ width: 1, height: 16, background: '#e2e8f0', display: 'inline-block' }} />}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* ═══ SECTION B — BILLS ═══ */}
      <section id="bills" style={{ padding: '88px 32px 96px', background: '#F7FCF8' }}>
        <div style={{ maxWidth: 1000, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 56 }}>
            <span className="label" style={{ color: '#16a34a' }}>Money out · Bills</span>
            <h2 className="section-title" style={{ fontSize: 'clamp(28px, 4vw, 40px)', margin: '0 0 16px' }}>
              And the bills you owe, sorted too.
            </h2>
            <p style={{ color: '#64748b', fontSize: 18, lineHeight: 1.7, maxWidth: 520, margin: '0 auto' }}>
              Forward an invoice — PDF, photo, or a plain WhatsApp message. Sorted reads it, files it, and reminds you before it&apos;s due.
            </p>
          </div>

          <div className="bills-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
            <BillCard
              title="Forward anything"
              body="Your supplier emails a PDF. The municipality sends a photo. Someone texts you “pay the vet R2000.” Forward it and it&apos;s captured — amount, due date and banking details read automatically."
            />
            <BillCard
              title="Bank details remembered"
              body="Enter a payee's account once. Sorted keeps it for every future invoice from them, so a bill with missing details still arrives payable."
            />
            <BillCard
              title="Reminders before it's due"
              body="A WhatsApp three days before every due date, with the banking details attached ready to copy. Overdue bills get flagged red on your dashboard."
            />
            <BillCard
              title="Someone else can send it"
              body="Add a trusted sender — a partner, an office manager, a supplier — and what they forward lands in your dashboard. You get pinged the moment it does."
            />
          </div>

          <div style={{ textAlign: 'center', marginTop: 32 }}>
            <Link href="/app" className="btn" style={{ background: '#16a34a', color: '#fff', fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 700, fontSize: 16, padding: '14px 26px', borderRadius: 12, boxShadow: '0 1px 2px rgba(15,23,42,0.1), 0 10px 24px -10px rgba(22,163,74,0.6)' }}>
              Open your dashboard →
            </Link>
          </div>
        </div>
      </section>

      {/* ═══ WHO IT'S FOR ═══ */}
      <section id="who" style={{ padding: '88px 32px', background: '#fff' }}>
        <div style={{ maxWidth: 960, margin: '0 auto' }}>
          <div className="split-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 64, alignItems: 'center' }}>
            <div>
              <span className="label" style={{ color: '#B4530A' }}>Who it&apos;s for</span>
              <h2 className="section-title" style={{ fontSize: 'clamp(28px, 4vw, 40px)', margin: '0 0 20px' }}>
                Anyone who does the work and does the paperwork
              </h2>
              <p style={{ color: '#64748b', fontSize: 18, lineHeight: 1.7, marginBottom: 32 }}>
                If you quote from the back of your bakkie, chase your own payments, and do the admin at 9pm — Sorted is for you.
              </p>
              <a href={WA_QUOTE_LINK} className="btn" style={{ background: '#B4530A', color: '#fff', fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 700, fontSize: 16, padding: '14px 24px', borderRadius: 12, boxShadow: '0 1px 2px rgba(15,23,42,0.1), 0 10px 24px -10px rgba(180,83,10,0.6)' }}>
                Send your first quote →
              </a>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {[
                { emoji: '🔧', title: 'Plumbers & electricians', desc: 'Price a callout on site and send it before you leave the driveway.' },
                { emoji: '🎨', title: 'Painters & tilers', desc: 'Per-room pricing, split into lines automatically. "3 bedrooms R850 each."' },
                { emoji: '🌿', title: 'Landscapers & cleaners', desc: 'Regular clients, repeat quotes. Your details are already saved.' },
                { emoji: '🚚', title: 'Movers & handymen', desc: 'A written quote makes you the one they trust out of three.' },
              ].map(item => (
                <div key={item.title} className="lift" style={{ display: 'flex', alignItems: 'flex-start', gap: 15, background: '#fff', borderRadius: 16, padding: 16, border: '1px solid #F0E7DA', boxShadow: '0 1px 2px rgba(15,23,42,0.04)' }}>
                  <div style={{ width: 36, height: 36, background: '#FDF6EC', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 17 }}>{item.emoji}</div>
                  <div>
                    <p style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 600, color: '#0f172a', fontSize: 14, margin: '0 0 4px' }}>{item.title}</p>
                    <p style={{ color: '#6B6B60', fontSize: 13, margin: 0, lineHeight: 1.6 }}>{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ═══ CTA ═══ */}
      <section style={{ padding: '92px 32px', background: '#B4530A', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: -70, right: -70, width: 260, height: 260, borderRadius: '50%', background: 'rgba(255,255,255,0.09)' }} />
        <div style={{ position: 'absolute', bottom: -70, left: -70, width: 200, height: 200, borderRadius: '50%', background: 'rgba(0,0,0,0.07)' }} />
        <div style={{ maxWidth: 640, margin: '0 auto', textAlign: 'center', position: 'relative' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(255,255,255,0.18)', color: '#fff', fontSize: 12, fontWeight: 600, padding: '6px 14px', borderRadius: 999, marginBottom: 24, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#fff', display: 'inline-block' }} />
            Now live
          </div>
          <h2 style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 'clamp(32px, 5vw, 48px)', fontWeight: 800, letterSpacing: '-0.03em', color: '#fff', margin: '0 0 16px' }}>
            Text <span style={{ color: '#FFE2C2' }}>QUOTE</span>.<br />That&apos;s the whole thing.
          </h2>
          <p style={{ color: 'rgba(255,255,255,0.82)', fontSize: 18, lineHeight: 1.7, margin: '0 0 36px' }}>
            No app to download, no signup form, no password. Just WhatsApp.
          </p>
          <a href={WA_QUOTE_LINK} className="btn" style={{ background: '#0f172a', color: '#fff', fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 700, fontSize: 18, padding: '16px 34px', borderRadius: 14, boxShadow: '0 2px 4px rgba(0,0,0,0.15), 0 16px 32px -14px rgba(0,0,0,0.5)' }}>
            Start on WhatsApp →
          </a>
          <p style={{ color: 'rgba(255,255,255,0.82)', fontSize: 13, marginTop: 16 }}>Replies in English, isiZulu or Afrikaans.</p>
        </div>
      </section>

      {/* ═══ FOOTER ═══ */}
      <footer style={{ background: '#0f172a', padding: '40px 32px' }}>
        <div style={{ maxWidth: 960, margin: '0 auto', display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <SortedMark size={28} radius={8} />
            <span style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 800, color: '#fff', fontSize: 18, letterSpacing: '-0.03em' }}>Sorted</span>
          </div>
          <p style={{ color: '#475569', fontSize: 14, margin: 0 }}>Built in South Africa 🇿🇦</p>
          <p style={{ color: '#334155', fontSize: 13, margin: 0 }}>© 2026 Sorted</p>
        </div>
      </footer>
    </>
  )
}

/* ── pieces ───────────────────────────────────────────────────────────── */

function SortedMark({ size = 34, radius = 11 }: { size?: number; radius?: number }) {
  const id = `sg${size}${radius}`
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#22C55E" /><stop offset="50%" stopColor="#10B981" /><stop offset="100%" stopColor="#06B6D4" />
        </linearGradient>
      </defs>
      <rect width="40" height="40" rx={radius * (40 / size)} fill={`url(#${id})`} />
      <ellipse cx="20" cy="8" rx="14" ry="6" fill="white" fillOpacity="0.15" />
      <path d="M9 20.5L16.5 28L31 13" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function Row({ label, note, value }: { label: string; note?: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10 }}>
      <span style={{ fontSize: 11, color: '#1A1A17' }}>
        {label}{note ? <span style={{ color: '#6F6F63' }}> · {note}</span> : null}
      </span>
      <span style={{ fontSize: 11, color: '#1A1A17', whiteSpace: 'nowrap' }}>{value}</span>
    </div>
  )
}

function Lane(props: {
  href: string; accent: string; ground: string; border: string
  kicker: string; title: string; body: string; cta: string
}) {
  return (
    <a
      href={props.href}
      className="lift"
      style={{
        display: 'block', textDecoration: 'none',
        background: props.ground, border: `1px solid ${props.border}`,
        borderRadius: 22, padding: 28,
        boxShadow: '0 1px 2px rgba(15,23,42,0.04)',
      }}
    >
      <span style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 12, fontWeight: 700, letterSpacing: '0.09em', textTransform: 'uppercase', color: props.accent }}>{props.kicker}</span>
      <h3 style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 800, fontSize: 21, letterSpacing: '-0.02em', color: '#0f172a', margin: '10px 0 8px' }}>{props.title}</h3>
      <p style={{ fontSize: 15, color: '#64748b', lineHeight: 1.65, margin: '0 0 16px' }}>{props.body}</p>
      <span style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 14, fontWeight: 700, color: props.accent }}>{props.cta} →</span>
    </a>
  )
}

function Step({ num, title, body, filled }: { num: string; title: string; body: string; filled?: boolean }) {
  return (
    <div style={{
      position: 'relative', overflow: 'hidden', borderRadius: 20, padding: 26,
      background: filled ? '#B4530A' : '#FDF9F3',
      border: filled ? 'none' : '1px solid #F2E7D8',
      boxShadow: filled ? '0 2px 6px rgba(15,23,42,0.08), 0 18px 36px -20px rgba(180,83,10,0.7)' : 'none',
    }}>
      <div style={{ position: 'absolute', top: 18, right: 24, fontSize: 40, fontWeight: 800, fontFamily: "'Plus Jakarta Sans', sans-serif", color: filled ? 'rgba(255,255,255,0.22)' : '#EBD9C2' }}>{num}</div>
      <h3 style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 700, fontSize: 18, color: filled ? '#fff' : '#0f172a', margin: '52px 0 8px' }}>{title}</h3>
      <p style={{ fontSize: 14, color: filled ? 'rgba(255,255,255,0.86)' : '#6B6B60', lineHeight: 1.7, margin: 0 }}>{body}</p>
    </div>
  )
}

function BillCard({ title, body }: { title: string; body: string }) {
  return (
    <div className="lift" style={{ background: '#fff', borderRadius: 20, padding: 26, border: '1px solid #DFF1E4', boxShadow: '0 1px 2px rgba(15,23,42,0.04), 0 10px 24px -18px rgba(22,163,74,0.5)' }}>
      <h3 style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 700, fontSize: 17, color: '#0f172a', margin: '0 0 8px' }}>{title}</h3>
      <p style={{ fontSize: 14.5, color: '#64748b', lineHeight: 1.7, margin: 0 }}>{body}</p>
    </div>
  )
}

/** The artefact itself — what lands on the client's phone. */
function QuoteDocument() {
  return (
    <div style={{ background: '#fff', borderRadius: 18, border: '1px solid #EFE4D4', boxShadow: '0 2px 6px rgba(15,23,42,0.05), 0 26px 52px -26px rgba(180,83,10,0.55)', overflow: 'hidden' }}>
      <div style={{ padding: '20px 22px', borderBottom: '1px solid #F1EDE6', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 40, height: 40, borderRadius: 9, background: '#1D5B4C', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ color: '#fff', fontSize: 15, fontWeight: 700, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>SP</span>
          </div>
          <div>
            <p style={{ fontSize: 14, fontWeight: 700, color: '#1A1A17', margin: 0, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Sipho Plumbing</p>
            <p style={{ fontSize: 12, color: '#6F6F63', margin: 0 }}>Plumbing · Sipho Ndlovu</p>
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <p style={{ fontSize: 16, fontWeight: 800, color: '#B4530A', margin: 0, fontFamily: "'Plus Jakarta Sans', sans-serif", letterSpacing: '-0.02em' }}>Quotation</p>
          <p style={{ fontSize: 12, color: '#1A1A17', margin: 0 }}>QUO-0001</p>
        </div>
      </div>

      <div style={{ padding: '14px 22px', borderBottom: '1px solid #F1EDE6', background: '#FDFBF8' }}>
        <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', color: '#B4530A', margin: '0 0 4px', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>QUOTE FOR</p>
        <p style={{ fontSize: 14, fontWeight: 600, color: '#1A1A17', margin: 0 }}>Mrs Naidoo</p>
        <p style={{ fontSize: 12.5, color: '#6F6F63', margin: 0 }}>12 Oak Road, Sandton</p>
      </div>

      <div style={{ padding: '14px 22px', display: 'flex', flexDirection: 'column', gap: 9 }}>
        <Row label="Paint bedrooms" note="3 × R850.00" value="R2,550.00" />
        <Row label="Materials" value="R1,200.00" />
      </div>

      <div style={{ padding: '12px 22px', borderTop: '1px solid #F1EDE6', display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: '#B4530A', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Total</span>
        <span style={{ fontSize: 22, fontWeight: 800, color: '#B4530A', fontFamily: "'Plus Jakarta Sans', sans-serif", letterSpacing: '-0.02em' }}>R3,750.00</span>
      </div>

      <div style={{ padding: '14px 22px 18px', borderTop: '1px solid #F1EDE6', background: '#FDFBF8' }}>
        <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', color: '#B4530A', margin: '0 0 7px', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>PAY BY EFT</p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '7px 16px' }}>
          {[['Bank', 'Capitec'], ['Account', '1234567890'], ['Branch', '470010'], ['Reference', 'QUO-0001']].map(([k, v]) => (
            <div key={k}>
              <p style={{ fontSize: 10, color: '#6F6F63', margin: 0 }}>{k}</p>
              <p style={{ fontSize: 12.5, fontWeight: 600, color: '#1A1A17', margin: 0 }}>{v}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
