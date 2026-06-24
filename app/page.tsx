import Link from 'next/link'

export default function Home() {
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Inter:wght@400;500&display=swap');
        * { box-sizing: border-box; }
        body { font-family: 'Inter', sans-serif; color: #0f172a; background: #fff; -webkit-font-smoothing: antialiased; margin: 0; }
        h1, h2, h3, h4, .font-heading { font-family: 'Plus Jakarta Sans', sans-serif; }

        .grain::after {
          content: '';
          position: absolute;
          inset: 0;
          background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.04'/%3E%3C/svg%3E");
          pointer-events: none;
          border-radius: inherit;
        }

        .hero-bg {
          background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 40%, #fff 70%);
          position: relative;
          overflow: hidden;
        }
        .hero-bg::before {
          content: '';
          position: absolute;
          top: -120px;
          right: -120px;
          width: 500px;
          height: 500px;
          border-radius: 50%;
          background: radial-gradient(circle, rgba(34,197,94,0.12) 0%, transparent 70%);
          pointer-events: none;
        }

        .wa-bubble {
          background: #dcfce7;
          border-radius: 12px 12px 12px 2px;
          font-size: 13px;
          line-height: 1.5;
          padding: 10px 14px;
          max-width: 220px;
          box-shadow: 0 1px 3px rgba(0,0,0,0.08);
        }
        .wa-bubble-right {
          background: #fff;
          border-radius: 12px 12px 2px 12px;
          margin-left: auto;
        }

        .feature-card {
          transition: transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.2s ease;
        }
        .feature-card:hover {
          transform: translateY(-3px);
          box-shadow: 0 12px 40px rgba(22,163,74,0.12), 0 2px 8px rgba(0,0,0,0.04);
        }

        @keyframes pulse-green {
          0%, 100% { box-shadow: 0 0 0 0 rgba(34,197,94,0.4); }
          50% { box-shadow: 0 0 0 8px rgba(34,197,94,0); }
        }
        .btn-primary:hover { animation: pulse-green 1.5s ease infinite; }

        html { scroll-behavior: smooth; }

        .nav-link { color: #64748b; text-decoration: none; font-size: 14px; font-weight: 500; transition: color 0.15s; }
        .nav-link:hover { color: #0f172a; }

        .section-label { color: #16a34a; font-weight: 600; font-size: 13px; text-transform: uppercase; letter-spacing: 0.1em; font-family: 'Plus Jakarta Sans', sans-serif; margin-bottom: 12px; display: block; }
        .section-title { font-family: 'Plus Jakarta Sans', sans-serif; font-weight: 800; letter-spacing: -0.03em; color: #0f172a; }

        @media (max-width: 768px) {
          .hide-mobile { display: none !important; }
          .hero-grid { grid-template-columns: 1fr !important; }
          .phone-col { display: none; }
          .steps-grid { grid-template-columns: 1fr !important; }
          .features-grid { grid-template-columns: 1fr !important; }
          .who-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>

      {/* NAV */}
      <nav style={{ position: 'sticky', top: 0, zIndex: 50, background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(12px)', borderBottom: '1px solid #f1f5f9' }}>
        <div style={{ maxWidth: 1152, margin: '0 auto', padding: '0 32px', height: 64, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <a href="#" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
            <svg width="34" height="34" viewBox="0 0 40 40" fill="none"><defs><linearGradient id="lg1" x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse"><stop offset="0%" stopColor="#22C55E"/><stop offset="50%" stopColor="#10B981"/><stop offset="100%" stopColor="#06B6D4"/></linearGradient><linearGradient id="lg2" x1="8" y1="20" x2="32" y2="20" gradientUnits="userSpaceOnUse"><stop offset="0%" stopColor="#FFFFFF"/><stop offset="100%" stopColor="#E0FFF8"/></linearGradient></defs><rect width="40" height="40" rx="11" fill="url(#lg1)"/><rect width="40" height="40" rx="11" fill="white" fillOpacity="0.08"/><ellipse cx="20" cy="8" rx="14" ry="6" fill="white" fillOpacity="0.15"/><path d="M9 20.5L16.5 28L31 13" stroke="url(#lg2)" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            <span style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 800, fontSize: 20, color: '#0f172a', letterSpacing: '-0.03em' }}>Sorted</span>
          </a>
          <div className="hide-mobile" style={{ display: 'flex', gap: 32 }}>
            <a href="#how" className="nav-link">How it works</a>
            <a href="#features" className="nav-link">Features</a>
            <a href="#who" className="nav-link">Who it&apos;s for</a>
          </div>
          <Link href="/app" className="btn-primary" style={{ background: '#0f172a', color: '#fff', fontSize: 14, fontWeight: 600, padding: '10px 20px', borderRadius: 12, textDecoration: 'none', fontFamily: "'Plus Jakarta Sans', sans-serif", transition: 'background 0.2s' }}>
            Open app →
          </Link>
        </div>
      </nav>

      {/* HERO */}
      <section className="hero-bg">
        <div className="hero-grid" style={{ maxWidth: 1152, margin: '0 auto', padding: '80px 32px 96px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 48, alignItems: 'center' }}>

          {/* Left */}
          <div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: '#f0fdf4', border: '1px solid #dcfce7', color: '#15803d', fontSize: 12, fontWeight: 600, padding: '6px 14px', borderRadius: 999, marginBottom: 24, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e', display: 'inline-block' }}></span>
              Built for South African parents
            </div>
            <h1 style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 'clamp(40px, 6vw, 60px)', fontWeight: 800, letterSpacing: '-0.04em', lineHeight: 1.05, color: '#0f172a', marginBottom: 20 }}>
              All your bills.<br/>
              <span style={{ color: '#22c55e' }}>Finally sorted.</span>
            </h1>
            <p style={{ fontSize: 18, color: '#64748b', lineHeight: 1.7, marginBottom: 32, maxWidth: 420 }}>
              Forward invoices to WhatsApp. AI reads the amount, due date, and banking details automatically. Pay from your dashboard with one tap.
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 40 }}>
              <Link href="/app" className="btn-primary" style={{ background: '#22c55e', color: '#fff', fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 700, fontSize: 16, padding: '14px 24px', borderRadius: 12, textDecoration: 'none', transition: 'background 0.2s' }}>
                Get started →
              </Link>
              <a href="#how" style={{ background: '#fff', color: '#334155', fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 600, fontSize: 16, padding: '14px 24px', borderRadius: 12, border: '1px solid #e2e8f0', textDecoration: 'none', transition: 'border-color 0.2s' }}>
                See how it works
              </a>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {['Works on WhatsApp', 'All SA banks', 'EFT ready', 'No app to download'].map(t => (
                <span key={t} style={{ fontSize: 12, background: '#fff', border: '1px solid #e2e8f0', color: '#64748b', padding: '6px 12px', borderRadius: 999 }}>{t}</span>
              ))}
            </div>
          </div>

          {/* Right: phone mockup */}
          <div className="phone-col" style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <div style={{ position: 'relative' }}>
              <div style={{ position: 'relative', background: '#0f172a', borderRadius: 48, padding: 12, boxShadow: '0 40px 80px rgba(15,23,42,0.25), 0 8px 20px rgba(15,23,42,0.15)', width: 288 }}>
                <div style={{ background: '#f8fafc', borderRadius: 40, overflow: 'hidden' }}>
                  <div style={{ background: '#fff', padding: '20px 20px 12px', display: 'flex', alignItems: 'center', gap: 8, borderBottom: '1px solid #f1f5f9' }}>
                    <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#22c55e', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 8L6.5 11.5L13 5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    </div>
                    <div>
                      <p style={{ fontSize: 12, fontWeight: 600, color: '#0f172a', margin: 0, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Sorted</p>
                      <p style={{ fontSize: 12, color: '#22c55e', margin: 0 }}>● Online</p>
                    </div>
                  </div>
                  <div style={{ background: '#f8fafc', padding: '16px 12px', minHeight: 256, display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div>
                      <p style={{ fontSize: 11, color: '#94a3b8', textAlign: 'center', marginBottom: 8 }}>Forwarded from Cape Town Swim</p>
                      <div className="wa-bubble">
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, paddingBottom: 8, borderBottom: '1px solid #bbf7d0' }}>
                          <div style={{ width: 24, height: 24, background: '#22c55e', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <svg width="12" height="12" fill="white" viewBox="0 0 20 20"><path d="M4 4h12v12H4z" opacity=".3"/><path d="M6 2v2H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-2V2h-2v2H8V2H6zm0 8h8v2H6v-2zm0 4h5v2H6v-2z"/></svg>
                          </div>
                          <span style={{ fontSize: 12, fontWeight: 600, color: '#14532d' }}>Invoice_June.pdf</span>
                        </div>
                        <p style={{ fontSize: 12, color: '#14532d', margin: 0 }}>Swimming lessons — R850<br/>Due: 25 June 2026</p>
                      </div>
                      <p style={{ fontSize: 11, color: '#94a3b8', marginTop: 4, marginLeft: 4 }}>09:14</p>
                    </div>
                    <div>
                      <div className="wa-bubble wa-bubble-right">
                        <p style={{ fontSize: 12, fontWeight: 600, color: '#15803d', marginBottom: 4 }}>✓ Got it!</p>
                        <p style={{ fontSize: 12, color: '#334155', margin: 0 }}>R850 to <strong>CT Swim Academy</strong><br/>Due 25 June · FNB 6281234567<br/>Ref: SMITH-JUN</p>
                        <p style={{ fontSize: 11, color: '#94a3b8', marginTop: 6 }}>I&apos;ll remind you 3 days before.</p>
                      </div>
                      <p style={{ fontSize: 11, color: '#94a3b8', textAlign: 'right', marginRight: 4, marginTop: 4 }}>09:14</p>
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'center', marginTop: 8 }}>
                  <div style={{ width: 96, height: 4, background: 'rgba(255,255,255,0.3)', borderRadius: 999 }}></div>
                </div>
              </div>

              {/* Floating dashboard card */}
              <div style={{ position: 'absolute', right: -40, bottom: -24, background: '#fff', borderRadius: 16, padding: 16, boxShadow: '0 8px 32px rgba(15,23,42,0.12)', border: '1px solid #f1f5f9', width: 208 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                  <p style={{ fontSize: 12, fontWeight: 600, color: '#64748b', margin: 0, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>This month</p>
                  <span style={{ fontSize: 11, background: '#fef3c7', color: '#b45309', padding: '2px 8px', borderRadius: 999, fontWeight: 600 }}>3 pending</span>
                </div>
                <p style={{ fontSize: 24, fontWeight: 800, color: '#0f172a', margin: '0 0 4px', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>R4,250</p>
                <p style={{ fontSize: 12, color: '#94a3b8', margin: 0 }}>due across 3 bills</p>
                <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ flex: 1, height: 6, background: '#f1f5f9', borderRadius: 999, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: '33%', background: '#22c55e', borderRadius: 999 }}></div>
                  </div>
                  <p style={{ fontSize: 12, color: '#94a3b8', margin: 0 }}>1 paid</p>
                </div>
              </div>

              {/* Floating due badge */}
              <div style={{ position: 'absolute', left: -32, top: 64, background: '#fff', borderRadius: 12, padding: '8px 12px', boxShadow: '0 4px 20px rgba(15,23,42,0.1)', border: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 28, height: 28, background: '#fef3c7', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <svg width="14" height="14" fill="none" viewBox="0 0 20 20"><path d="M10 2a8 8 0 100 16A8 8 0 0010 2zm0 2a6 6 0 110 12A6 6 0 0110 4zm-.75 2.75v4l3.5 2-.5.87-4-2.37V6.75h1z" fill="#F59E0B"/></svg>
                </div>
                <div>
                  <p style={{ fontSize: 12, fontWeight: 600, color: '#0f172a', margin: 0, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Due Friday</p>
                  <p style={{ fontSize: 11, color: '#94a3b8', margin: 0 }}>Dog grooming · R350</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* BANK BAR */}
      <div style={{ background: '#f8fafc', borderTop: '1px solid #f1f5f9', borderBottom: '1px solid #f1f5f9', padding: '20px 32px' }}>
        <div style={{ maxWidth: 960, margin: '0 auto' }}>
          <p style={{ textAlign: 'center', fontSize: 11, color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 16, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Works with every SA bank</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '12px 32px', alignItems: 'center' }}>
            {['FNB', 'Standard Bank', 'ABSA', 'Nedbank', 'Capitec', 'Investec', 'TymeBank'].map((b, i, arr) => (
              <span key={b} style={{ display: 'flex', alignItems: 'center', gap: 32 }}>
                <span style={{ color: '#94a3b8', fontWeight: 600, fontSize: 14 }}>{b}</span>
                {i < arr.length - 1 && <span style={{ width: 1, height: 16, background: '#e2e8f0', display: 'inline-block' }}></span>}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* HOW IT WORKS */}
      <section id="how" style={{ padding: '96px 32px', background: '#fff' }}>
        <div style={{ maxWidth: 960, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 64 }}>
            <span className="section-label">How it works</span>
            <h2 className="section-title" style={{ fontSize: 'clamp(28px, 4vw, 40px)', margin: '0 0 16px' }}>Three steps to sorted</h2>
            <p style={{ color: '#64748b', fontSize: 18, lineHeight: 1.7, maxWidth: 480, margin: '0 auto' }}>No new apps. No behaviour change for service providers. Just forward and forget.</p>
          </div>
          <div className="steps-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 32 }}>
            {[
              { num: '01', color: '#22c55e', icon: <svg width="22" height="22" fill="none" viewBox="0 0 24 24"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6A19.79 19.79 0 012.12 4.18 2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>, title: 'Forward on WhatsApp', body: 'Your swim coach sends a PDF. Your dog groomer sends a photo. Your wife texts "pay vet R2000." Forward anything to your Sorted number.', dark: false },
              { num: '02', color: '#fbbf24', icon: <svg width="22" height="22" fill="none" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke="white" strokeWidth="2"/><path d="M12 6v6l4 2" stroke="white" strokeWidth="2" strokeLinecap="round"/></svg>, title: 'AI reads it instantly', body: 'Claude AI extracts the amount, due date, and bank details — from PDFs, photos, or plain text. Payee bank details are remembered forever after the first time.', dark: false },
              { num: '03', color: '#22c55e', icon: <svg width="22" height="22" fill="none" viewBox="0 0 24 24"><path d="M20 7H4a2 2 0 00-2 2v10a2 2 0 002 2h16a2 2 0 002-2V9a2 2 0 00-2-2zM16 16a2 2 0 110-4 2 2 0 010 4z" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><path d="M1 7l1.5-3h19L23 7" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>, title: 'Pay. Get sorted.', body: 'Your dashboard shows everything due. Copy EFT details with one tap. WhatsApp reminder 3 days before every due date.', dark: true },
            ].map(step => (
              <div key={step.num} style={{ position: 'relative', background: step.dark ? step.color : '#f8fafc', borderRadius: 20, padding: 28, border: step.dark ? 'none' : '1px solid #f1f5f9', overflow: 'hidden' }}>
                <div style={{ position: 'absolute', top: 0, right: 0, width: 96, height: 96, borderBottomLeftRadius: '100%', background: step.dark ? 'rgba(255,255,255,0.1)' : `${step.color}12` }}></div>
                <div style={{ width: 48, height: 48, background: step.dark ? 'rgba(255,255,255,0.2)' : step.color, borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
                  {step.icon}
                </div>
                <div style={{ position: 'absolute', top: 24, right: 28, fontSize: 40, fontWeight: 800, fontFamily: "'Plus Jakarta Sans', sans-serif", color: step.dark ? 'rgba(255,255,255,0.2)' : `${step.color}30` }}>{step.num}</div>
                <h3 style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 700, fontSize: 18, color: step.dark ? '#fff' : '#0f172a', marginBottom: 8 }}>{step.title}</h3>
                <p style={{ fontSize: 14, color: step.dark ? 'rgba(255,255,255,0.8)' : '#64748b', lineHeight: 1.7, margin: 0 }}>{step.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section id="features" style={{ padding: '96px 32px', background: '#f8fafc' }}>
        <div style={{ maxWidth: 960, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 64 }}>
            <span className="section-label">Features</span>
            <h2 className="section-title" style={{ fontSize: 'clamp(28px, 4vw, 40px)', margin: 0 }}>Everything you need.<br/>Nothing you don&apos;t.</h2>
          </div>
          <div className="features-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 20 }}>
            {[
              { bg: '#dcfce7', icon: '#16a34a', title: 'WhatsApp native', body: 'No app to download. You already use WhatsApp. Service providers change nothing.', svg: <svg width="18" height="18" fill="none" viewBox="0 0 24 24"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" stroke="#16a34a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg> },
              { bg: '#fef3c7', icon: '#f59e0b', title: 'Reads anything', body: 'PDF invoices, photos of paper bills, forwarded WhatsApp messages — AI handles all formats.', svg: <svg width="18" height="18" fill="none" viewBox="0 0 24 24"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg> },
              { bg: '#dcfce7', icon: '#16a34a', title: 'Payee memory', body: 'Enter your swim coach\'s bank details once. Sorted remembers them forever for every future invoice.', svg: <svg width="18" height="18" fill="none" viewBox="0 0 24 24"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" stroke="#16a34a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg> },
              { bg: '#dbeafe', icon: '#3b82f6', title: 'Copy EFT details', body: 'Tap to copy account number, branch code, and reference. No typing, no errors, no forgotten payments.', svg: <svg width="18" height="18" fill="none" viewBox="0 0 24 24"><rect x="1" y="4" width="22" height="16" rx="2" ry="2" stroke="#3b82f6" strokeWidth="2"/><path d="M1 10h22" stroke="#3b82f6" strokeWidth="2"/></svg> },
              { bg: '#fef3c7', icon: '#f59e0b', title: 'Smart reminders', body: 'WhatsApp reminder 3 days before every due date. Bank details included, ready to copy.', svg: <svg width="18" height="18" fill="none" viewBox="0 0 24 24"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg> },
              { bg: '#dcfce7', icon: '#16a34a', title: 'Secure by design', body: 'Login via WhatsApp OTP. No passwords. Your data is yours, never shared or sold.', svg: <svg width="18" height="18" fill="none" viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" stroke="#16a34a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg> },
            ].map(f => (
              <div key={f.title} className="feature-card" style={{ background: '#fff', borderRadius: 20, padding: 24, border: '1px solid #f1f5f9' }}>
                <div style={{ width: 40, height: 40, background: f.bg, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
                  {f.svg}
                </div>
                <h3 style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 700, color: '#0f172a', marginBottom: 8, fontSize: 16 }}>{f.title}</h3>
                <p style={{ fontSize: 14, color: '#64748b', lineHeight: 1.6, margin: 0 }}>{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* WHO IT'S FOR */}
      <section id="who" style={{ padding: '96px 32px', background: '#fff' }}>
        <div style={{ maxWidth: 960, margin: '0 auto' }}>
          <div className="who-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 64, alignItems: 'center' }}>
            <div>
              <span className="section-label">Who it&apos;s for</span>
              <h2 className="section-title" style={{ fontSize: 'clamp(28px, 4vw, 40px)', margin: '0 0 20px' }}>Every SA parent juggling too many payments</h2>
              <p style={{ color: '#64748b', fontSize: 18, lineHeight: 1.7, marginBottom: 32 }}>
                If you&apos;re paying for kids&apos; activities, tutoring, sports clubs, pet services, and trying to track it all in your head — Sorted is for you.
              </p>
              <Link href="/app" className="btn-primary" style={{ display: 'inline-block', background: '#22c55e', color: '#fff', fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 700, fontSize: 16, padding: '14px 24px', borderRadius: 12, textDecoration: 'none' }}>
                Get started →
              </Link>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {[
                { emoji: '🏊', title: 'Swimming lessons', desc: "Coach emails a PDF invoice monthly. AI reads it, saves their FNB details once." },
                { emoji: '⚽', title: 'Soccer club fees', desc: "Team manager sends WhatsApp message with bank details. Forward it. Done." },
                { emoji: '🐕', title: '"Pay vet R2000"', desc: "Wife texts you on WhatsApp. Forward it to Sorted. Reminder set. Crisis averted." },
                { emoji: '🎸', title: 'Music / art / drama', desc: "Private teacher sends a photo of a handwritten invoice. AI reads it, no problem." },
              ].map(item => (
                <div key={item.title} style={{ display: 'flex', alignItems: 'flex-start', gap: 16, background: '#f8fafc', borderRadius: 16, padding: 16, border: '1px solid #f1f5f9' }}>
                  <div style={{ width: 36, height: 36, background: '#fff', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 18, border: '1px solid #f1f5f9' }}>{item.emoji}</div>
                  <div>
                    <p style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 600, color: '#0f172a', fontSize: 14, margin: '0 0 4px' }}>{item.title}</p>
                    <p style={{ color: '#94a3b8', fontSize: 13, margin: 0 }}>{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section style={{ padding: '96px 32px', background: '#22c55e', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: -64, right: -64, width: 256, height: 256, borderRadius: '50%', background: 'rgba(74,222,128,0.4)' }}></div>
        <div style={{ position: 'absolute', bottom: -64, left: -64, width: 192, height: 192, borderRadius: '50%', background: 'rgba(22,163,74,0.3)' }}></div>
        <div style={{ maxWidth: 640, margin: '0 auto', textAlign: 'center', position: 'relative' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(255,255,255,0.2)', color: '#fff', fontSize: 12, fontWeight: 600, padding: '6px 14px', borderRadius: 999, marginBottom: 24, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#fff', display: 'inline-block' }}></span>
            Now live
          </div>
          <h2 style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 'clamp(32px, 5vw, 48px)', fontWeight: 800, letterSpacing: '-0.03em', color: '#fff', marginBottom: 16 }}>
            Stop forgetting.<br/>Start getting sorted.
          </h2>
          <p style={{ color: 'rgba(255,255,255,0.8)', fontSize: 18, lineHeight: 1.7, marginBottom: 40 }}>
            Forward any invoice to WhatsApp and see it appear on your dashboard in seconds.
          </p>
          <Link href="/app" className="btn-primary" style={{ display: 'inline-block', background: '#0f172a', color: '#fff', fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 700, fontSize: 18, padding: '16px 32px', borderRadius: 14, textDecoration: 'none' }}>
            Open Sorted →
          </Link>
          <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13, marginTop: 16 }}>Login with your WhatsApp number. No password needed.</p>
        </div>
      </section>

      {/* FOOTER */}
      <footer style={{ background: '#0f172a', padding: '40px 32px' }}>
        <div style={{ maxWidth: 960, margin: '0 auto', display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <svg width="28" height="28" viewBox="0 0 40 40" fill="none"><defs><linearGradient id="lg3" x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse"><stop offset="0%" stopColor="#22C55E"/><stop offset="50%" stopColor="#10B981"/><stop offset="100%" stopColor="#06B6D4"/></linearGradient><linearGradient id="lg4" x1="8" y1="20" x2="32" y2="20" gradientUnits="userSpaceOnUse"><stop offset="0%" stopColor="#FFFFFF"/><stop offset="100%" stopColor="#E0FFF8"/></linearGradient></defs><rect width="40" height="40" rx="11" fill="url(#lg3)"/><rect width="40" height="40" rx="11" fill="white" fillOpacity="0.08"/><ellipse cx="20" cy="8" rx="14" ry="6" fill="white" fillOpacity="0.15"/><path d="M9 20.5L16.5 28L31 13" stroke="url(#lg4)" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            <span style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 800, color: '#fff', fontSize: 18, letterSpacing: '-0.03em' }}>Sorted</span>
          </div>
          <p style={{ color: '#475569', fontSize: 14, margin: 0 }}>Built in South Africa 🇿🇦 · <a href="mailto:hello@kaplan.co.za" style={{ color: '#64748b', textDecoration: 'none' }}>hello@kaplan.co.za</a></p>
          <p style={{ color: '#334155', fontSize: 13, margin: 0 }}>© 2026 Sorted</p>
        </div>
      </footer>
    </>
  )
}
