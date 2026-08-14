'use client'

import { useState, useEffect } from 'react'
import confetti from 'canvas-confetti'
import type { Bill, Reminder } from '@/lib/supabase'

type View = 'login' | 'otp' | 'dashboard'

// The two halves of the product, kept apart on purpose: money in (what you've
// quoted and invoiced) and money out (what you owe). They answer different
// questions and were previously interleaved in one row of five tabs.
type Section = 'quotes' | 'bills'
type BillTab = 'pending' | 'paid' | 'reminders' | 'senders'
/** Which documents the quotes list is showing. */
type QuoteFilter = 'all' | 'quote' | 'invoice' | 'unpaid' | 'paid'

type QuoteItemRow = {
  description: string
  quantity: number
  unit_price: number
  line_total: number
}

// Money-in side. Mirrors the shape /api/quotes returns.
type QuoteRow = {
  id: string
  number: string
  doc_type: 'quote' | 'invoice'
  status: 'draft' | 'sent' | 'viewed' | 'accepted' | 'paid' | 'cancelled'
  subtotal: number
  vat_amount: number
  total: number
  public_token: string
  created_at: string
  sent_at: string | null
  viewed_at: string | null
  paid_at: string | null
  paystack_reference: string | null
  notes: string | null
  customer_name: string | null
  customer_address: string | null
  items: QuoteItemRow[]
}

type BusinessProfile = {
  business_name: string | null
  trade: string | null
  logo_url: string | null
  vat_number: string | null
  bank_name: string | null
  account_number: string | null
  branch_code: string | null
  language: string | null
}

// Session token issued by /api/auth — sent as a Bearer header on every API call.
// Lives in localStorage when "Keep me logged in" was ticked (survives closing the
// browser), otherwise in sessionStorage (cleared when the browser closes).
function getToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem('sorted_token') ?? sessionStorage.getItem('sorted_token')
}

function authHeaders(): Record<string, string> {
  const t = getToken()
  return t ? { Authorization: `Bearer ${t}` } : {}
}

type TrustedSender = {
  id: string
  whatsapp_number: string
  label: string | null
}

function SortedLogo({ size = 36 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="logoGrad" x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#22C55E"/>
          <stop offset="50%" stopColor="#10B981"/>
          <stop offset="100%" stopColor="#06B6D4"/>
        </linearGradient>
        <linearGradient id="checkGrad" x1="8" y1="20" x2="32" y2="20" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FFFFFF"/>
          <stop offset="100%" stopColor="#E0FFF8"/>
        </linearGradient>
      </defs>
      <rect width="40" height="40" rx="11" fill="url(#logoGrad)"/>
      <rect width="40" height="40" rx="11" fill="white" fillOpacity="0.08"/>
      <ellipse cx="20" cy="8" rx="14" ry="6" fill="white" fillOpacity="0.15"/>
      <path d="M9 20.5L16.5 28L31 13" stroke="url(#checkGrad)" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

export default function Home() {
  const [view, setView] = useState<View>('login')
  const [phone, setPhone] = useState('')
  const [otp, setOtp] = useState('')
  const [bills, setBills] = useState<Bill[]>([])
  const [reminders, setReminders] = useState<Reminder[]>([])
  const [quotes, setQuotes] = useState<QuoteRow[]>([])
  const [profile, setProfile] = useState<BusinessProfile | null>(null)
  const [savingProfile, setSavingProfile] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  // Quotes first: this is a quoting product that also tracks bills, and the
  // first thing on screen should be what the user came to make money with.
  const [section, setSection] = useState<Section>('quotes')
  const [tab, setTab] = useState<BillTab>('pending')
  const [quoteFilter, setQuoteFilter] = useState<QuoteFilter>('all')
  const [senders, setSenders] = useState<TrustedSender[]>([])
  const [myName, setMyName] = useState('')
  const [savingName, setSavingName] = useState(false)
  const [newNumber, setNewNumber] = useState('')
  const [newLabel, setNewLabel] = useState('')
  const [addingsender, setAddingSender] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const [keepLoggedIn, setKeepLoggedIn] = useState(true)
  const [confirmClearDone, setConfirmClearDone] = useState(false)

  useEffect(() => {
    const saved = localStorage.getItem('sorted_phone')
    if (saved && getToken()) { setPhone(saved); fetchAll(saved) }
    setIsMobile(/Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent))
  }, [])

  const sortedNumberDigits = (process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || '').replace(/\D/g, '')
  const whatsappLoginUrl = `https://wa.me/${sortedNumberDigits}?text=${encodeURIComponent('LOGIN')}`

  function openWhatsApp() {
    window.location.href = whatsappLoginUrl
  }

  function sendOTP() {
    setError('')
    const clean = phone.replace(/\D/g, '').replace(/^0/, '27')
    if (!clean) { setError('Enter your WhatsApp number.'); return }
    setPhone(clean)
    setView('otp')
    // On mobile this reliably opens the WhatsApp app. On desktop it can pop open an
    // unexpected WhatsApp Web QR screen for anyone who hasn't linked it — so there we
    // just show plain instructions instead and let them open WhatsApp Web on their own terms.
    if (isMobile) openWhatsApp()
  }

  function celebrateLogin() {
    const colors = ['#22C55E', '#10B981', '#06B6D4', '#F59E0B', '#EC4899']
    confetti({ particleCount: 120, spread: 100, origin: { y: 0.6 }, colors })
    confetti({ particleCount: 80, angle: 60, spread: 80, origin: { x: 0, y: 0.7 }, colors })
    confetti({ particleCount: 80, angle: 120, spread: 80, origin: { x: 1, y: 0.7 }, colors })
  }

  async function verifyOTP() {
    setLoading(true); setError('')
    const res = await fetch('/api/auth', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, otp, remember: keepLoggedIn })
    })
    setLoading(false)
    if (res.ok) {
      const data = await res.json()
      localStorage.setItem('sorted_phone', phone)
      if (data.token) {
        localStorage.removeItem('sorted_token')
        sessionStorage.removeItem('sorted_token')
        const store = keepLoggedIn ? localStorage : sessionStorage
        store.setItem('sorted_token', data.token)
      }
      await fetchAll(phone)
      celebrateLogin()
    } else setError('Invalid or expired code.')
  }

  async function fetchAll(p: string) {
    setView('dashboard')
    const [billsRes, sendersRes, remindersRes, authRes, quotesRes] = await Promise.all([
      fetch(`/api/bills?phone=${p}`, { headers: authHeaders() }),
      fetch(`/api/trusted-senders?phone=${p}`, { headers: authHeaders() }),
      fetch(`/api/reminder-notes?phone=${p}`, { headers: authHeaders() }),
      fetch('/api/auth', { headers: authHeaders() }),
      fetch('/api/quotes', { headers: authHeaders() }),
    ])
    // Expired or missing session — back to login
    if (billsRes.status === 401) { logout(); return }
    const billsData = await billsRes.json()
    const sendersData = await sendersRes.json()
    const remindersData = await remindersRes.json()
    const authData = await authRes.json()
    setBills(billsData.bills || [])
    setSenders(sendersData.senders || [])
    setReminders(remindersData.reminders || [])
    setMyName(authData.name || '')

    // Quotes are additive — if the migration hasn't run yet this 500s, and the
    // bills dashboard must still load. Never let the new half break the old one.
    if (quotesRes.ok) {
      const quotesData = await quotesRes.json()
      setQuotes(quotesData.quotes || [])
      setProfile(quotesData.profile || null)
    }
  }

  async function saveProfile(updates: Partial<BusinessProfile>) {
    setSavingProfile(true)
    await fetch('/api/quotes', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify(updates),
    })
    setProfile(p => (p ? { ...p, ...updates } : p))
    setSavingProfile(false)
  }

  async function saveName() {
    setSavingName(true)
    await fetch('/api/auth', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ name: myName })
    })
    setSavingName(false)
  }

  async function dismissReminder(id: string, dismissed: boolean) {
    await fetch('/api/reminder-notes', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ id, dismissed })
    })
    setReminders(prev => prev.map(r => r.id === id ? { ...r, dismissed } : r))
  }

  async function deleteReminder(id: string) {
    await fetch(`/api/reminder-notes?id=${id}`, { method: 'DELETE', headers: authHeaders() })
    setReminders(prev => prev.filter(r => r.id !== id))
  }

  async function clearDoneReminders() {
    setConfirmClearDone(false)
    await fetch('/api/reminder-notes?dismissed=true', { method: 'DELETE', headers: authHeaders() })
    setReminders(prev => prev.filter(r => !r.dismissed))
  }

  async function addSender() {
    if (!newNumber.trim()) return
    setAddingSender(true)
    await fetch('/api/trusted-senders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ trustedNumber: newNumber, label: newLabel })
    })
    const res = await fetch(`/api/trusted-senders?phone=${phone}`, { headers: authHeaders() })
    const data = await res.json()
    setSenders(data.senders || [])
    setNewNumber(''); setNewLabel(''); setAddingSender(false)
  }

  async function removeSender(trustedNumber: string) {
    await fetch(`/api/trusted-senders?trustedNumber=${trustedNumber}`, { method: 'DELETE', headers: authHeaders() })
    setSenders(prev => prev.filter(s => s.whatsapp_number !== trustedNumber))
  }

  async function confirmBill(id: string) {
    await fetch('/api/bills', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ id, unconfirmed: false })
    })
    setBills(prev => prev.map(b => b.id === id ? { ...b, unconfirmed: false } : b))
  }

  async function markPaid(id: string) {
    await fetch('/api/bills', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ id, status: 'paid' })
    })
    const now = new Date().toISOString()
    setBills(prev => prev.map(b => b.id === id ? { ...b, status: 'paid', paid_at: now } : b))
  }

  /**
   * A quote or invoice settled outside Paystack — an EFT into the account on
   * the PDF, or cash on the day. Updated locally as well as on the server so
   * the totals move under the user's thumb instead of after a round trip.
   */
  async function markQuotePaid(token: string, paid: boolean) {
    const res = await fetch(`/api/quotes/${token}/paid`, {
      method: paid ? 'POST' : 'DELETE',
      headers: authHeaders(),
    })
    if (!res.ok) return
    const now = new Date().toISOString()
    setQuotes(prev => prev.map(q => {
      if (q.public_token !== token) return q
      return paid
        ? { ...q, status: 'paid', paid_at: now }
        : { ...q, status: q.viewed_at ? 'viewed' : 'sent', paid_at: null }
    }))
  }

  async function markUnpaid(id: string) {
    await fetch('/api/bills', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ id, status: 'pending' })
    })
    setBills(prev => prev.map(b => b.id === id ? { ...b, status: 'pending', paid_at: null } : b))
  }

  async function deleteBill(id: string) {
    await fetch(`/api/bills?id=${id}`, { method: 'DELETE', headers: authHeaders() })
    setBills(prev => prev.filter(b => b.id !== id))
  }

  async function payViaStitch(billId: string) {
    const res = await fetch('/api/pay', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ billId })
    })
    const data = await res.json()
    if (data.redirectUrl) window.location.href = data.redirectUrl
    else alert(data.error ?? 'Could not initiate payment')
  }

  async function repeatBill(bill: Bill) {
    const res = await fetch('/api/bills', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({
        payee: bill.payee,
        amount: bill.amount,
        bank_name: bill.bank_name,
        account_number: bill.account_number,
        branch_code: bill.branch_code,
        reference: bill.reference,
      })
    })
    const data = await res.json()
    if (data.bill) {
      setBills(prev => [data.bill, ...prev])
      setTab('pending')
    }
  }

  function saveBankDetails(billId: string, details: Partial<Bill>) {
    fetch('/api/bills', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ id: billId, ...details })
    })
    setBills(prev => prev.map(b => b.id === billId ? { ...b, ...details } : b))
  }

  // Corrections to what the AI extracted — payee, amount, due date
  async function saveBillEdits(billId: string, edits: { payee: string; amount: number; due_date: string | null }) {
    const res = await fetch('/api/bills', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ id: billId, ...edits })
    })
    if (res.ok) setBills(prev => prev.map(b => b.id === billId ? { ...b, ...edits } : b))
    return res.ok
  }

  function logout() {
    localStorage.removeItem('sorted_phone')
    localStorage.removeItem('sorted_token')
    sessionStorage.removeItem('sorted_token')
    setPhone(''); setBills([]); setReminders([]); setView('login')
  }

  // Overdue bills are still unpaid — they live in the pending tab with a red badge
  const pending = bills.filter(b => b.status === 'pending' || b.status === 'overdue')
  const paid = bills.filter(b => b.status === 'paid')
  const incomplete = pending.filter(b => !b.account_number)
  const totalDue = pending.reduce((s, b) => s + b.amount, 0)
  const activeReminders = reminders.filter(r => !r.dismissed)
  const doneReminders = reminders.filter(r => r.dismissed)

  if (view === 'login') return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'linear-gradient(135deg, #f0fdf4 0%, #e0f2fe 100%)' }}>
      <div className="bg-white rounded-3xl p-8 w-full max-w-sm" style={{ boxShadow: '0 20px 60px rgba(16,185,129,0.12), 0 4px 16px rgba(0,0,0,0.06)' }}>
        <div className="flex items-center gap-3 mb-7">
          <SortedLogo size={42} />
          <div>
            <h1 className="text-xl font-bold text-gray-900" style={{ letterSpacing: '-0.03em' }}>Sorted</h1>
            <p className="text-gray-400 text-xs">Forward bills. Get sorted.</p>
          </div>
        </div>
        <input
          className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm mb-3 outline-none focus:border-emerald-400 transition-colors"
          placeholder="082 123 4567"
          value={phone}
          onChange={e => setPhone(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && sendOTP()}
        />
        {error && <p className="text-red-500 text-xs mb-3">{error}</p>}
        <button
          onClick={sendOTP}
          className="w-full text-white rounded-xl py-3 text-sm font-semibold disabled:opacity-50"
          style={{ background: 'linear-gradient(135deg, #22c55e 0%, #10b981 50%, #06b6d4 100%)' }}
        >
          Get Code via WhatsApp
        </button>
      </div>
    </div>
  )

  if (view === 'otp') return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'linear-gradient(135deg, #f0fdf4 0%, #e0f2fe 100%)' }}>
      <div className="bg-white rounded-3xl p-8 w-full max-w-sm" style={{ boxShadow: '0 20px 60px rgba(16,185,129,0.12), 0 4px 16px rgba(0,0,0,0.06)' }}>
        <div className="flex items-center gap-3 mb-5">
          <SortedLogo size={42} />
          <div>
            <h1 className="text-xl font-bold text-gray-900" style={{ letterSpacing: '-0.03em' }}>Check WhatsApp</h1>
            <p className="text-gray-400 text-xs">Send the message, then enter the code you get back</p>
          </div>
        </div>

        {isMobile ? (
          <p className="text-gray-500 text-xs mb-4">
            We opened WhatsApp for you — hit send there, then come back and enter the code below.
          </p>
        ) : (
          <div className="rounded-xl p-3 mb-4 bg-gray-50 border border-gray-100">
            <p className="text-gray-600 text-xs mb-2">
              On your phone, open WhatsApp and send <strong className="text-gray-900">LOGIN</strong> to <strong className="text-gray-900">{process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || 'the Sorted number'}</strong>.
            </p>
            <button
              onClick={openWhatsApp}
              className="text-emerald-600 text-xs font-semibold hover:text-emerald-700"
            >
              Or open WhatsApp Web instead →
            </button>
          </div>
        )}

        <input
          className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm mb-3 outline-none focus:border-emerald-400 text-center text-2xl tracking-widest"
          placeholder="000000"
          maxLength={6}
          value={otp}
          onChange={e => setOtp(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && verifyOTP()}
        />
        <label className="flex items-center gap-2 mb-3 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={keepLoggedIn}
            onChange={e => setKeepLoggedIn(e.target.checked)}
            className="h-4 w-4 rounded border-gray-300 accent-emerald-500"
          />
          <span className="text-gray-600 text-xs">Keep me logged in on this device</span>
        </label>
        {error && <p className="text-red-500 text-xs mb-3">{error}</p>}
        <button
          onClick={verifyOTP}
          disabled={loading}
          className="w-full text-white rounded-xl py-3 text-sm font-semibold disabled:opacity-50"
          style={{ background: 'linear-gradient(135deg, #22c55e 0%, #10b981 50%, #06b6d4 100%)' }}
        >
          {loading ? 'Verifying...' : 'Verify'}
        </button>
        <button onClick={() => setView('login')} className="w-full mt-2 text-gray-600 hover:text-gray-900 transition-colors text-xs py-2">Back</button>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(160deg, #f0fdf4 0%, #f8fafc 45%, #e0f2fe 100%)' }}>
      {/* Header */}
      <div className="sticky top-0 z-10" style={{ background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(12px)', borderBottom: '1px solid rgba(34,197,94,0.12)', boxShadow: '0 1px 20px rgba(16,185,129,0.06)' }}>
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <SortedLogo size={30} />
            <span className="font-bold text-gray-900" style={{ letterSpacing: '-0.03em' }}>Sorted</span>
          </div>
          <button onClick={logout} className="text-gray-600 text-xs hover:text-gray-900 transition-colors">Logout</button>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 pt-6 pb-12">

        {/* The two halves of the product. A single switch at the top rather
            than five interleaved tabs: money in and money out answer different
            questions, and mixing them made every screen half-irrelevant. */}
        <div className="flex gap-1 rounded-2xl p-1 mb-5" style={{ background: 'rgba(0,0,0,0.05)' }}>
          {([
            ['quotes', 'Quotes & invoices', '#b4530a'],
            ['bills', 'Bills I owe', '#16a34a'],
          ] as const).map(([key, label, accent]) => (
            <button
              key={key}
              onClick={() => { setSection(key); setConfirmClearDone(false) }}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200"
              style={section === key
                ? { background: '#fff', color: accent, boxShadow: '0 1px 4px rgba(0,0,0,0.08)', borderBottom: `2px solid ${accent}` }
                : { color: '#6b7280', background: 'transparent' }}
            >
              {label}
            </button>
          ))}
        </div>

        {section === 'quotes' && (
          <QuotesSection
            quotes={quotes}
            profile={profile}
            savingProfile={savingProfile}
            onSaveProfile={saveProfile}
            filter={quoteFilter}
            onFilter={setQuoteFilter}
            onPaid={markQuotePaid}
          />
        )}

        {section === 'bills' && (<>

        {/* Summary cards */}
        <div className="grid grid-cols-3 gap-3 mb-5">
          {/* The value's own colour carries the status here — a coloured left
              border would be a second encoding of the same fact. Depth comes
              from a layered shadow tinted with the card's hue instead. */}
          <div className="bg-white rounded-2xl p-4 border border-gray-100" style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 8px 20px -12px rgba(34,197,94,0.35)' }}>
            <p className="text-xs text-gray-600 mb-1 font-medium">Total Due</p>
            <p className="text-xl font-bold" style={{ color: '#16a34a', letterSpacing: '-0.02em' }}>R{totalDue.toFixed(0)}</p>
          </div>
          <div className="bg-white rounded-2xl p-4 border border-gray-100" style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 8px 20px -12px rgba(245,158,11,0.35)' }}>
            <p className="text-xs text-gray-600 mb-1 font-medium">Pending</p>
            <p className="text-xl font-bold" style={{ color: '#d97706', letterSpacing: '-0.02em' }}>{pending.length}</p>
          </div>
          <div className="bg-white rounded-2xl p-4 border border-gray-100" style={{ boxShadow: incomplete.length > 0 ? '0 1px 2px rgba(0,0,0,0.04), 0 8px 20px -12px rgba(245,158,11,0.35)' : '0 1px 2px rgba(0,0,0,0.04)' }}>
            <p className="text-xs text-gray-600 mb-1 font-medium">Needs Info</p>
            <p className="text-xl font-bold" style={{ color: incomplete.length > 0 ? '#d97706' : '#9ca3af', letterSpacing: '-0.02em' }}>{incomplete.length}</p>
          </div>
        </div>

        {/* WhatsApp banner */}
        <div className="rounded-2xl p-4 mb-5 flex items-center gap-3" style={{ background: 'linear-gradient(135deg, #f0fdf4, #e0f2fe)', border: '1px solid #bbf7d0' }}>
          <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'linear-gradient(135deg, #22c55e, #06b6d4)' }}>
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </div>
          <p className="text-gray-600 text-xs flex-1">Forward any invoice to <strong className="text-gray-900">{process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || 'your Sorted number'}</strong></p>
          {process.env.NEXT_PUBLIC_WHATSAPP_NUMBER && (
            <a
              href={`https://wa.me/${process.env.NEXT_PUBLIC_WHATSAPP_NUMBER.replace(/\D/g, '')}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-white text-xs font-semibold"
              style={{ background: '#25D366', boxShadow: '0 2px 8px rgba(37,211,102,0.4)' }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
              Open
            </a>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 rounded-2xl p-1 mb-5" style={{ background: 'rgba(0,0,0,0.05)' }}>
          {(['pending', 'paid', 'reminders', 'senders'] as BillTab[]).map(t => (
            <button
              key={t}
              onClick={() => { setTab(t); setConfirmClearDone(false) }}
              className="flex-1 py-2.5 rounded-xl text-xs font-semibold transition-all duration-200 capitalize"
              style={tab === t
                ? { background: '#fff', color: '#16a34a', boxShadow: '0 1px 4px rgba(0,0,0,0.08)', borderBottom: '2px solid #22c55e' }
                : { color: '#6b7280', background: 'transparent' }}
            >
              {t === 'pending' && <>Pending {pending.length > 0 && <span className="ml-1 text-xs px-1.5 py-0.5 rounded-full" style={{ background: '#dcfce7', color: '#16a34a' }}>{pending.length}</span>}</>}
              {t === 'paid' && <>Paid {paid.length > 0 && <span className="ml-1 text-xs px-1.5 py-0.5 rounded-full" style={{ background: '#e5e7eb', color: '#6b7280' }}>{paid.length}</span>}</>}
              {t === 'reminders' && <>Reminders {activeReminders.length > 0 && <span className="ml-1 text-xs px-1.5 py-0.5 rounded-full" style={{ background: '#fef3c7', color: '#b45309' }}>{activeReminders.length}</span>}</>}
              {t === 'senders' && 'Senders'}
            </button>
          ))}
        </div>

        {/* Pending bills */}
        {tab === 'pending' && (
          <div className="space-y-3">
            {pending.length === 0 && (
              <div className="text-center py-16 text-gray-400">
                <div className="w-14 h-14 rounded-2xl mx-auto mb-4 flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #f0fdf4, #e0f2fe)' }}>
                  <svg width="24" height="24" fill="none" viewBox="0 0 24 24"><path d="M20 7H4a2 2 0 00-2 2v10a2 2 0 002 2h16a2 2 0 002-2V9a2 2 0 00-2-2z" stroke="#22c55e" strokeWidth="2"/></svg>
                </div>
                <p className="text-sm font-semibold text-gray-500">All clear</p>
                <p className="text-xs mt-1">Forward an invoice on WhatsApp to get started</p>
              </div>
            )}
            {pending.map(bill => (
              <BillCard
                key={bill.id}
                bill={bill}
                senderLabel={senders.find(s => s.whatsapp_number === bill.sent_by)?.label ?? null}
                onPaid={() => markPaid(bill.id)}
                onDelete={() => deleteBill(bill.id)}
                onPayStitch={() => payViaStitch(bill.id)}
                onSaveBankDetails={details => saveBankDetails(bill.id, details)}
                onConfirm={() => confirmBill(bill.id)}
                onEdit={edits => saveBillEdits(bill.id, edits)}
              />
            ))}
          </div>
        )}

        {/* Paid bills */}
        {tab === 'paid' && (
          <div className="space-y-3">
            {paid.length === 0 && (
              <div className="text-center py-16 text-gray-400">
                <p className="text-sm font-medium">No paid bills yet</p>
              </div>
            )}
            {paid.map(bill => (
              <BillCard
                key={bill.id}
                bill={bill}
                onDelete={() => deleteBill(bill.id)}
                onRepeat={() => repeatBill(bill)}
                onUnpaid={() => markUnpaid(bill.id)}
              />
            ))}
          </div>
        )}

        {/* Reminders */}
        {tab === 'reminders' && (
          <div className="space-y-3">
            {doneReminders.length > 0 && (
              <div className="flex items-center justify-between px-1">
                <p className="text-xs text-gray-400">{doneReminders.length} done</p>
                {confirmClearDone ? (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={clearDoneReminders}
                      className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-red-50 text-red-500 hover:bg-red-100 transition-colors"
                    >
                      Clear {doneReminders.length} done?
                    </button>
                    <button onClick={() => setConfirmClearDone(false)} aria-label="Cancel" className="text-xs text-gray-600 hover:text-gray-900 transition-colors px-2 py-1 rounded-lg">✕</button>
                  </div>
                ) : (
                  <button
                    onClick={() => setConfirmClearDone(true)}
                    className="text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
                    style={{ border: '1px solid #d1fae5', color: '#16a34a', background: '#f0fdf4' }}
                  >
                    Clear done
                  </button>
                )}
              </div>
            )}
            {reminders.length === 0 && (
              <div className="text-center py-16 text-gray-400">
                <div className="w-14 h-14 rounded-2xl mx-auto mb-4 flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #fffbeb, #f0fdf4)' }}>
                  <svg width="24" height="24" fill="none" viewBox="0 0 24 24"><path d="M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0" stroke="#d97706" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </div>
                <p className="text-sm font-semibold text-gray-500">No reminders yet</p>
                <p className="text-xs mt-1">Trusted senders can text a nudge (no invoice needed) and it&apos;ll show up here</p>
              </div>
            )}
            {reminders.map(reminder => (
              <ReminderCard
                key={reminder.id}
                reminder={reminder}
                senderLabel={senders.find(s => s.whatsapp_number === reminder.sent_by)?.label ?? reminder.sender_label}
                onDismiss={() => dismissReminder(reminder.id, !reminder.dismissed)}
                onDelete={() => deleteReminder(reminder.id)}
              />
            ))}
          </div>
        )}

        {/* Senders */}
        {tab === 'senders' && (
          <div>
            <p className="text-xs text-gray-400 mb-4">Add a WhatsApp number (e.g. your partner&apos;s) and their forwarded invoices will appear in your dashboard automatically.</p>
            <div className="bg-white rounded-2xl p-4 border border-gray-100 mb-4" style={{ boxShadow: '0 2px 12px rgba(0,0,0,0.04)' }}>
              <p className="text-sm font-semibold text-gray-900 mb-1">Your name</p>
              <p className="text-xs text-gray-400 mb-3">Shown to trusted senders in the WhatsApp message they get when you add them.</p>
              <div className="flex gap-2">
                <input
                  className="flex-1 border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-emerald-400 transition-colors"
                  placeholder="e.g. Warren"
                  value={myName}
                  onChange={e => setMyName(e.target.value)}
                  onBlur={saveName}
                />
                <button
                  onClick={saveName}
                  disabled={savingName}
                  className="text-white rounded-xl px-4 text-sm font-semibold disabled:opacity-50"
                  style={{ background: 'linear-gradient(135deg, #22c55e 0%, #10b981 50%, #06b6d4 100%)' }}
                >
                  {savingName ? '...' : 'Save'}
                </button>
              </div>
            </div>
            <div className="bg-white rounded-2xl p-4 border border-gray-100 mb-4" style={{ boxShadow: '0 2px 12px rgba(0,0,0,0.04)' }}>
              <p className="text-sm font-semibold text-gray-900 mb-3">Add trusted sender</p>
              <input
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm mb-2 outline-none focus:border-emerald-400 transition-colors"
                placeholder="082 123 4567"
                value={newNumber}
                onChange={e => setNewNumber(e.target.value)}
              />
              <input
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm mb-3 outline-none focus:border-emerald-400 transition-colors"
                placeholder="Label (e.g. Wife, Partner) — optional"
                value={newLabel}
                onChange={e => setNewLabel(e.target.value)}
              />
              <button
                onClick={addSender}
                disabled={addingsender || !newNumber.trim()}
                className="w-full text-white rounded-xl py-2.5 text-sm font-semibold disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg, #22c55e 0%, #10b981 50%, #06b6d4 100%)' }}
              >
                {addingsender ? 'Adding...' : 'Add sender'}
              </button>
            </div>
            {senders.length === 0 && (
              <p className="text-center text-gray-400 text-sm py-8">No trusted senders yet</p>
            )}
            <div className="space-y-2">
              {senders.map(s => (
                <div key={s.id} className="bg-white rounded-2xl px-4 py-3 border border-gray-100 flex items-center justify-between" style={{ boxShadow: '0 2px 12px rgba(0,0,0,0.04)' }}>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{s.label || s.whatsapp_number}</p>
                    {s.label && <p className="text-xs text-gray-400">{s.whatsapp_number}</p>}
                  </div>
                  <div className="flex items-center gap-2">
                    <a
                      href={`https://wa.me/${s.whatsapp_number.replace(/\D/g, '')}?text=${encodeURIComponent(`Hi! Forward your bills to ${process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || 'our Sorted number'} on WhatsApp and they'll appear on my Sorted dashboard automatically.`)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-white text-xs font-semibold"
                      style={{ background: '#25D366' }}
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                      Send
                    </a>
                    <button
                      onClick={() => removeSender(s.whatsapp_number)}
                      className="text-gray-500 hover:text-red-600 transition-colors p-1 rounded-lg hover:bg-red-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600"
                    >
                      <svg width="14" height="14" fill="none" viewBox="0 0 24 24"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        </>)}
      </div>
    </div>
  )
}

type BillCardProps = {
  bill: Bill
  senderLabel?: string | null
  onPaid?: () => Promise<void> | void
  onUnpaid?: () => Promise<void> | void
  onPayStitch?: () => void
  onDelete?: () => void
  onRepeat?: () => void
  onSaveBankDetails?: (details: Partial<Bill>) => void
  onConfirm?: () => Promise<void> | void
  onEdit?: (edits: { payee: string; amount: number; due_date: string | null }) => Promise<boolean>
}

function BillCard({ bill, senderLabel, onPaid, onUnpaid, onPayStitch, onDelete, onRepeat, onSaveBankDetails, onConfirm, onEdit }: BillCardProps) {
  const [copied, setCopied] = useState<string | null>(null)
  const [showBankForm, setShowBankForm] = useState(false)
  const [showEditForm, setShowEditForm] = useState(false)
  const [savingEdit, setSavingEdit] = useState(false)
  const [editFields, setEditFields] = useState({
    payee: bill.payee,
    amount: String(bill.amount),
    due_date: bill.due_date ?? '',
  })
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [repeating, setRepeating] = useState(false)
  const [markingPaid, setMarkingPaid] = useState(false)
  const [markingUnpaid, setMarkingUnpaid] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [bankFields, setBankFields] = useState({
    bank_name: bill.bank_name ?? '',
    account_number: bill.account_number ?? '',
    branch_code: bill.branch_code ?? '',
    reference: bill.reference ?? '',
  })

  const isPaid = bill.status === 'paid'
  const isIncomplete = !bill.account_number && !isPaid
  const isUnconfirmed = bill.unconfirmed && !isPaid
  // The cron flips status to 'overdue' daily, but check the date too so a bill
  // that went past due since the last cron run still shows the badge immediately.
  const isOverdue = !isPaid && (bill.status === 'overdue' ||
    (!!bill.due_date && bill.due_date < new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Johannesburg' }).format(new Date())))

  async function saveEdit() {
    if (!onEdit || savingEdit) return
    const amount = Number(editFields.amount)
    if (!editFields.payee.trim() || !Number.isFinite(amount) || amount <= 0) return
    setSavingEdit(true)
    const ok = await onEdit({ payee: editFields.payee.trim(), amount, due_date: editFields.due_date || null })
    setSavingEdit(false)
    if (ok) setShowEditForm(false)
  }

  function copy(val: string, label: string) {
    navigator.clipboard.writeText(val)
    setCopied(label)
    setTimeout(() => setCopied(null), 1500)
  }

  async function handleRepeat() {
    setRepeating(true)
    await onRepeat?.()
    setRepeating(false)
  }

  async function handleConfirm() {
    if (confirming) return
    setConfirming(true)
    await onConfirm?.()
    setConfirming(false)
  }

  async function handleMarkPaid() {
    if (markingPaid) return
    setMarkingPaid(true)
    await onPaid?.()
    setMarkingPaid(false)
  }

  async function handleMarkUnpaid() {
    if (markingUnpaid) return
    setMarkingUnpaid(true)
    await onUnpaid?.()
    setMarkingUnpaid(false)
  }

  const paidLabel = bill.paid_at
    ? new Date(bill.paid_at).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' })
    : null

  const receivedLabel = new Date(bill.created_at).toLocaleString('en-ZA', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
  })

  // Status is already carried three ways on this card — the pill badge, the
  // tinted background, and the tinted shadow. The 4px coloured left border was
  // a fourth encoding of the same fact; dropping it loses no information.
  const borderColor = isPaid ? '#d1fae5' : isOverdue ? '#fca5a5' : isUnconfirmed ? '#bfdbfe' : isIncomplete ? '#fde68a' : '#e5e7eb'
  const cardBg = isPaid ? 'rgba(240,253,244,0.6)' : isOverdue ? 'rgba(254,242,242,0.8)' : isUnconfirmed ? 'rgba(239,246,255,0.8)' : isIncomplete ? 'rgba(255,251,235,0.8)' : '#ffffff'

  return (
    <div className="rounded-2xl p-4"
      style={{
        background: cardBg,
        border: `1px solid ${borderColor}`,
        boxShadow: isPaid
          ? '0 1px 2px rgba(0,0,0,0.03), 0 8px 20px -14px rgba(16,185,129,0.4)'
          : isOverdue
          ? '0 1px 2px rgba(0,0,0,0.03), 0 8px 20px -14px rgba(239,68,68,0.45)'
          : isUnconfirmed
          ? '0 1px 2px rgba(0,0,0,0.03), 0 8px 20px -14px rgba(59,130,246,0.45)'
          : isIncomplete
          ? '0 1px 2px rgba(0,0,0,0.03), 0 8px 20px -14px rgba(245,158,11,0.45)'
          : '0 1px 2px rgba(0,0,0,0.03), 0 8px 20px -14px rgba(34,197,94,0.4)',
      }}>

      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-semibold text-gray-900">{bill.payee}</p>
            {isOverdue && (
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: '#fee2e2', color: '#b91c1c' }}>
                Overdue{bill.due_date ? ` · was due ${new Date(bill.due_date).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' })}` : ''}
              </span>
            )}
            {isUnconfirmed && (
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: '#dbeafe', color: '#1d4ed8' }}>Unconfirmed</span>
            )}
            {isIncomplete && (
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: '#fef3c7', color: '#b45309' }}>Needs details</span>
            )}
            {isPaid && (
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: '#dcfce7', color: '#15803d' }}>Paid</span>
            )}
          </div>
          {isPaid && paidLabel ? (
            <p className="text-xs font-semibold mt-0.5" style={{ color: '#16a34a' }}>Paid {paidLabel}</p>
          ) : (
            <p className="text-xs text-gray-500 mt-0.5">
              Received {receivedLabel}{senderLabel ? ` · via ${senderLabel}` : ''}
              {!isOverdue && bill.due_date ? ` · due ${new Date(bill.due_date).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' })}` : ''}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 ml-3 flex-shrink-0">
          <p className="text-lg font-bold" style={{ color: isPaid ? '#6b7280' : '#111827', letterSpacing: '-0.02em' }}>R{bill.amount.toFixed(0)}</p>
          {confirmDelete ? (
            <div className="flex items-center gap-1">
              <button
                onClick={() => { onDelete?.(); setConfirmDelete(false) }}
                className="text-xs text-red-500 font-semibold px-2 py-1 rounded-lg bg-red-50 hover:bg-red-100 transition-colors"
              >
                Delete
              </button>
              <button onClick={() => setConfirmDelete(false)} aria-label="Cancel" className="text-xs text-gray-600 hover:text-gray-900 transition-colors px-2 py-1 rounded-lg">✕</button>
            </div>
          ) : (
            <>
              {!isPaid && onEdit && (
                <button
                  onClick={() => setShowEditForm(v => !v)}
                  aria-label="Edit bill"
                  className="text-gray-500 hover:text-cyan-700 transition-colors p-1 rounded-lg hover:bg-cyan-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-700"
                >
                  <svg width="14" height="14" fill="none" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </button>
              )}
              <button
                onClick={() => setConfirmDelete(true)}
                className="text-gray-500 hover:text-red-600 transition-colors p-1 rounded-lg hover:bg-red-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600"
              >
                <svg width="14" height="14" fill="none" viewBox="0 0 24 24"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </button>
            </>
          )}
        </div>
      </div>

      {bill.account_number && (
        <div className="rounded-xl p-3 text-xs space-y-1.5 mb-3" style={{ background: 'linear-gradient(135deg, rgba(240,253,244,0.8), rgba(224,242,254,0.8))', border: '1px solid rgba(34,197,94,0.12)' }}>
          {bill.bank_name && <DetailRow label="Bank" value={bill.bank_name} />}
          <DetailRow label="Account" value={bill.account_number} onCopy={() => copy(bill.account_number!.replace(/\D/g, ''), 'account')} copied={copied === 'account'} />
          {bill.branch_code && <DetailRow label="Branch" value={bill.branch_code} onCopy={() => copy(bill.branch_code!, 'branch')} copied={copied === 'branch'} />}
          {bill.reference && <DetailRow label="Reference" value={bill.reference} onCopy={() => copy(bill.reference!, 'ref')} copied={copied === 'ref'} />}
        </div>
      )}

      {isUnconfirmed && (
        <div className="rounded-xl p-3 mb-3 text-xs" style={{ background: '#eff6ff', border: '1px solid #bfdbfe', color: '#1e40af' }}>
          {senderLabel || 'This sender'} is trusted by more than one Sorted account, so we couldn&apos;t tell whose bill this is. Confirm it&apos;s yours before paying it.
        </div>
      )}

      {showEditForm && !isPaid && (
        <div className="rounded-xl p-3 mb-3 space-y-2" style={{ background: '#ecfeff', border: '1px solid #a5f3fc' }}>
          <input
            className="w-full border border-cyan-200 rounded-lg px-3 py-2 text-xs outline-none focus:border-cyan-400 bg-white"
            placeholder="Payee"
            value={editFields.payee}
            onChange={e => setEditFields(prev => ({ ...prev, payee: e.target.value }))}
          />
          <input
            className="w-full border border-cyan-200 rounded-lg px-3 py-2 text-xs outline-none focus:border-cyan-400 bg-white"
            placeholder="Amount (e.g. 850)"
            inputMode="decimal"
            value={editFields.amount}
            onChange={e => setEditFields(prev => ({ ...prev, amount: e.target.value }))}
          />
          <input
            type="date"
            className="w-full border border-cyan-200 rounded-lg px-3 py-2 text-xs outline-none focus:border-cyan-400 bg-white text-gray-700"
            value={editFields.due_date}
            onChange={e => setEditFields(prev => ({ ...prev, due_date: e.target.value }))}
          />
          <div className="flex gap-2">
            <button
              onClick={saveEdit}
              disabled={savingEdit || !editFields.payee.trim() || !(Number(editFields.amount) > 0)}
              className="flex-1 text-white text-xs py-2 rounded-lg font-semibold disabled:opacity-50"
              style={{ background: 'linear-gradient(135deg, #06b6d4, #0891b2)' }}
            >
              {savingEdit ? 'Saving…' : 'Save changes'}
            </button>
            <button onClick={() => setShowEditForm(false)} className="text-gray-400 text-xs px-3">Cancel</button>
          </div>
        </div>
      )}

      {isIncomplete && showBankForm && (
        <div className="rounded-xl p-3 mb-3 space-y-2" style={{ background: '#fffbeb', border: '1px solid #fde68a' }}>
          {(['bank_name', 'account_number', 'branch_code', 'reference'] as const).map(field => (
            <input
              key={field}
              className="w-full border border-amber-200 rounded-lg px-3 py-2 text-xs outline-none focus:border-amber-400 bg-white"
              placeholder={{ bank_name: 'Bank name (e.g. FNB)', account_number: 'Account number', branch_code: 'Branch code', reference: 'Payment reference' }[field]}
              value={bankFields[field]}
              onChange={e => setBankFields(prev => ({ ...prev, [field]: e.target.value }))}
            />
          ))}
          <div className="flex gap-2">
            <button
              onClick={() => { onSaveBankDetails?.(bankFields); setShowBankForm(false) }}
              className="flex-1 text-white text-xs py-2 rounded-lg font-semibold"
              style={{ background: 'linear-gradient(135deg, #22c55e, #06b6d4)' }}
            >
              Save
            </button>
            <button onClick={() => setShowBankForm(false)} className="text-gray-400 text-xs px-3">Cancel</button>
          </div>
        </div>
      )}

      {!isPaid && (
        <div className="flex gap-2">
          {isUnconfirmed ? (
            <>
              <button
                onClick={handleConfirm}
                disabled={confirming}
                className="flex-1 text-white text-xs font-semibold py-2.5 rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg, #3b82f6, #06b6d4)', boxShadow: '0 2px 8px rgba(59,130,246,0.3)' }}
              >
                {confirming ? 'Confirming…' : '✓ This is mine'}
              </button>
              <button
                onClick={onDelete}
                className="text-xs font-medium py-2.5 px-4 rounded-xl transition-colors"
                style={{ border: '1px solid #fecaca', color: '#dc2626', background: '#fef2f2' }}
              >
                Not mine
              </button>
            </>
          ) : isIncomplete ? (
            <button
              onClick={() => setShowBankForm(v => !v)}
              className="flex-1 text-xs font-semibold py-2.5 rounded-xl transition-colors"
              style={{ background: showBankForm ? '#fef3c7' : '#fffbeb', color: '#b45309', border: '1px solid #fcd34d' }}
            >
              {showBankForm ? 'Cancel' : '+ Add bank details'}
            </button>
          ) : (
            <>
              <button
                onClick={onPayStitch}
                className="flex-1 text-white text-xs font-semibold py-2.5 rounded-xl hover:opacity-90 transition-opacity"
                style={{ background: 'linear-gradient(135deg, #22c55e, #06b6d4)', boxShadow: '0 2px 8px rgba(34,197,94,0.3)' }}
              >
                Pay via Stitch
              </button>
              <button
                onClick={handleMarkPaid}
                disabled={markingPaid}
                className="text-xs font-medium py-2.5 px-4 rounded-xl transition-colors disabled:opacity-50"
                style={{ border: '1px solid #d1fae5', color: '#16a34a', background: '#f0fdf4' }}
              >
                {markingPaid ? 'Saving…' : 'Mark paid'}
              </button>
            </>
          )}
        </div>
      )}

      {isPaid && (
        <div className="flex gap-2">
          {onRepeat && (
            <button
              onClick={handleRepeat}
              disabled={repeating}
              className="flex-1 text-xs font-semibold py-2.5 rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5"
              style={{ background: 'linear-gradient(135deg, rgba(240,253,244,1), rgba(224,242,254,1))', color: '#0e7490', border: '1px solid #a5f3fc' }}
            >
              <svg width="12" height="12" fill="none" viewBox="0 0 24 24"><path d="M1 4v6h6M23 20v-6h-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><path d="M20.49 9A9 9 0 005.64 5.64L1 10M23 14l-4.64 4.36A9 9 0 013.51 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
              {repeating ? 'Adding...' : 'Pay again'}
            </button>
          )}
          {onUnpaid && (
            <button
              onClick={handleMarkUnpaid}
              disabled={markingUnpaid}
              className="text-xs font-medium py-2.5 px-4 rounded-xl transition-colors disabled:opacity-50"
              style={{ border: '1px solid #fde68a', color: '#b45309', background: '#fffbeb' }}
            >
              {markingUnpaid ? 'Saving…' : 'Mark unpaid'}
            </button>
          )}
        </div>
      )}
    </div>
  )
}


function ReminderCard({ reminder, senderLabel, onDismiss, onDelete }: { reminder: Reminder; senderLabel: string | null; onDismiss: () => void; onDelete: () => void }) {
  const [confirmDelete, setConfirmDelete] = useState(false)

  const receivedLabel = new Date(reminder.created_at).toLocaleString('en-ZA', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
  })

  return (
    <div className="rounded-2xl p-4"
      style={{
        background: reminder.dismissed ? 'rgba(240,253,244,0.6)' : '#fffbeb',
        border: `1px solid ${reminder.dismissed ? '#d1fae5' : '#fde68a'}`,
        boxShadow: reminder.dismissed
          ? '0 1px 2px rgba(0,0,0,0.03)'
          : '0 1px 2px rgba(0,0,0,0.03), 0 8px 20px -14px rgba(245,158,11,0.45)',
        opacity: reminder.dismissed ? 0.75 : 1,
      }}>
      <div className="flex items-start gap-3">
        <button
          onClick={onDismiss}
          aria-label={reminder.dismissed ? 'Mark as not done' : 'Mark as done'}
          className="flex-shrink-0 rounded-full flex items-center justify-center transition-colors mt-0.5"
          style={{
            width: '32px', height: '32px',
            border: reminder.dismissed ? '2px solid #22c55e' : '2px solid #d1d5db',
            background: reminder.dismissed ? '#22c55e' : '#ffffff',
          }}
        >
          {reminder.dismissed && (
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24"><path d="M5 13l4 4L19 7" stroke="#ffffff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/></svg>
          )}
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between mb-1">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="font-semibold text-gray-900">{senderLabel || 'You'}</p>
                {reminder.dismissed && (
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: '#dcfce7', color: '#15803d' }}>Done</span>
                )}
              </div>
              <p className="text-xs text-gray-500 mt-0.5">
                Received {receivedLabel}
                {reminder.remind_at && !reminder.dismissed ? ` · ⏰ nudge ${new Date(reminder.remind_at).toLocaleString('en-ZA', { timeZone: 'Africa/Johannesburg', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}` : ''}
              </p>
            </div>
            {confirmDelete ? (
              <div className="flex items-center gap-1 flex-shrink-0">
                <button onClick={onDelete} className="text-xs text-red-500 font-semibold px-2 py-1 rounded-lg bg-red-50 hover:bg-red-100 transition-colors">Delete</button>
                <button onClick={() => setConfirmDelete(false)} className="text-xs text-gray-400 px-1">✕</button>
              </div>
            ) : (
              <button onClick={() => setConfirmDelete(true)} className="text-gray-500 hover:text-red-600 transition-colors p-1 rounded-lg hover:bg-red-50 flex-shrink-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600">
                <svg width="14" height="14" fill="none" viewBox="0 0 24 24"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </button>
            )}
          </div>
          <p className={`text-sm ${reminder.dismissed ? 'text-gray-400 line-through' : 'text-gray-700'}`}>{reminder.message}</p>
        </div>
      </div>
    </div>
  )
}

function DetailRow({ label, value, onCopy, copied }: { label: string; value: string; onCopy?: () => void; copied?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-gray-500 font-medium">{label}</span>
      <div className="flex items-center gap-2">
        <span className="font-mono text-gray-700">{value}</span>
        {onCopy && (
          <button
            onClick={onCopy}
            className="text-xs font-semibold px-2 py-0.5 rounded-lg transition-all"
            style={copied
              ? { background: '#dcfce7', color: '#16a34a' }
              : { background: '#cffafe', color: '#0e7490' }}
          >
            {copied ? '✓ Copied' : 'Copy'}
          </button>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Money-in cards
// ---------------------------------------------------------------------------

const QUOTE_STATUS: Record<QuoteRow['status'], { label: string; bg: string; fg: string }> = {
  draft:     { label: 'Draft',     bg: '#f3f4f6', fg: '#6b7280' },
  sent:      { label: 'Sent',      bg: '#fdecd9', fg: '#b4530a' },
  viewed:    { label: 'Opened',    bg: '#e0f2fe', fg: '#0369a1' },
  accepted:  { label: 'Accepted',  bg: '#dcfce7', fg: '#16a34a' },
  paid:      { label: 'Paid',      bg: '#dcfce7', fg: '#16a34a' },
  cancelled: { label: 'Cancelled', bg: '#f3f4f6', fg: '#9ca3af' },
}

const rand = (n: number) =>
  'R' + Number(n).toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

/** Cancelled documents are excluded from every total — nobody was ever going to pay them. */
const counts = (q: QuoteRow) => q.status !== 'cancelled' && q.status !== 'draft'

/**
 * The money-in half: a record of every quote and invoice, with the totals that
 * turn a list of documents into an answer to "what have I made?".
 *
 * Read-only by design. Quotes are made on WhatsApp, on site, on a phone — this
 * is where the tradesperson comes afterwards to look at what he sent, what was
 * opened and what actually got paid.
 */
function QuotesSection({
  quotes, profile, savingProfile, onSaveProfile, filter, onFilter, onPaid,
}: {
  quotes: QuoteRow[]
  profile: BusinessProfile | null
  savingProfile: boolean
  onSaveProfile: (updates: Partial<BusinessProfile>) => void
  filter: QuoteFilter
  onFilter: (f: QuoteFilter) => void
  onPaid: (token: string, paid: boolean) => void
}) {
  const live = quotes.filter(counts)
  const paidDocs = live.filter(q => q.status === 'paid')
  const owedDocs = live.filter(q => q.status !== 'paid')

  const paidTotal = paidDocs.reduce((sum, q) => sum + Number(q.total), 0)
  const owedTotal = owedDocs.reduce((sum, q) => sum + Number(q.total), 0)

  // "This month" counts what was sent this month, not what was paid — it is the
  // answer to "how much work did I put out", which is the number a tradesperson
  // actually tracks.
  const now = new Date()
  const thisMonthTotal = live
    .filter(q => {
      const d = new Date(q.created_at)
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
    })
    .reduce((sum, q) => sum + Number(q.total), 0)

  const shown = quotes.filter(q => {
    switch (filter) {
      case 'quote':   return q.doc_type === 'quote'
      case 'invoice': return q.doc_type === 'invoice'
      case 'unpaid':  return counts(q) && q.status !== 'paid'
      case 'paid':    return q.status === 'paid'
      default:        return true
    }
  })

  // Grouped by month so the record reads as a history rather than a flat feed,
  // and so each month carries its own subtotal.
  const months: Array<{ key: string; label: string; rows: QuoteRow[]; total: number }> = []
  for (const q of shown) {
    const d = new Date(q.created_at)
    const key = `${d.getFullYear()}-${d.getMonth()}`
    let group = months.find(m => m.key === key)
    if (!group) {
      group = {
        key,
        label: d.toLocaleDateString('en-ZA', { month: 'long', year: 'numeric' }),
        rows: [],
        total: 0,
      }
      months.push(group)
    }
    group.rows.push(q)
    if (counts(q)) group.total += Number(q.total)
  }

  const FILTERS: Array<[QuoteFilter, string]> = [
    ['all', 'All'],
    ['quote', 'Quotes'],
    ['invoice', 'Invoices'],
    ['unpaid', 'Unpaid'],
    ['paid', 'Paid'],
  ]

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white rounded-2xl p-4 border border-gray-100" style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 8px 20px -12px rgba(22,163,74,0.35)' }}>
          <p className="text-xs text-gray-600 mb-1 font-medium">Paid to you</p>
          <p className="text-lg font-bold tabular-nums" style={{ color: '#16a34a', letterSpacing: '-0.02em' }}>{rand(paidTotal)}</p>
        </div>
        <div className="bg-white rounded-2xl p-4 border border-gray-100" style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 8px 20px -12px rgba(180,83,10,0.35)' }}>
          <p className="text-xs text-gray-600 mb-1 font-medium">Still owed</p>
          <p className="text-lg font-bold tabular-nums" style={{ color: '#b4530a', letterSpacing: '-0.02em' }}>{rand(owedTotal)}</p>
        </div>
        <div className="bg-white rounded-2xl p-4 border border-gray-100" style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
          <p className="text-xs text-gray-600 mb-1 font-medium">Sent this month</p>
          <p className="text-lg font-bold tabular-nums" style={{ color: '#0f172a', letterSpacing: '-0.02em' }}>{rand(thisMonthTotal)}</p>
        </div>
      </div>

      <BusinessProfileCard profile={profile} saving={savingProfile} onSave={onSaveProfile} />

      {quotes.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <div className="w-14 h-14 rounded-2xl mx-auto mb-4 flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #fdecd9, #fdf6ec)' }}>
            <svg width="24" height="24" fill="none" viewBox="0 0 24 24"><path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h6l6 6v11a2 2 0 01-2 2z" stroke="#b4530a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </div>
          <p className="text-sm font-semibold text-gray-500">No quotes yet</p>
          <p className="text-xs mt-1">
            WhatsApp a job to Sorted — e.g. &ldquo;Quote for Mrs Naidoo, paint 3 bedrooms R850 each&rdquo;
          </p>
        </div>
      ) : (
        <>
          <div className="flex gap-1.5 overflow-x-auto pb-1">
            {FILTERS.map(([key, label]) => (
              <button
                key={key}
                onClick={() => onFilter(key)}
                className="flex-shrink-0 text-xs font-semibold px-3 py-1.5 rounded-full transition-transform duration-150 ease-out hover:-translate-y-px active:translate-y-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#b4530a]"
                style={filter === key
                  ? { background: '#b4530a', color: '#fff' }
                  : { background: '#fff', color: '#6b7280', border: '1px solid #e5e7eb' }}
              >
                {label}
              </button>
            ))}
          </div>

          {shown.length === 0 && (
            <p className="text-center text-gray-400 text-sm py-10">Nothing under that filter.</p>
          )}

          {months.map(month => (
            <div key={month.key} className="space-y-3">
              <div className="flex items-baseline justify-between px-1 pt-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">{month.label}</p>
                <p className="text-xs font-semibold tabular-nums text-gray-500">{rand(month.total)}</p>
              </div>
              {month.rows.map(q => (
                <QuoteCard key={q.id} quote={q} onPaid={paid => onPaid(q.public_token, paid)} />
              ))}
            </div>
          ))}
        </>
      )}
    </div>
  )
}

function QuoteCard({ quote, onPaid }: { quote: QuoteRow; onPaid: (paid: boolean) => void }) {
  const [open, setOpen] = useState(false)
  const status = QUOTE_STATUS[quote.status] ?? QUOTE_STATUS.sent
  const isInvoice = quote.doc_type === 'invoice'
  const isPaid = quote.status === 'paid'
  // Card payments aren't ours to un-say — the money actually moved.
  const byCard = isPaid && Boolean(quote.paystack_reference)
  const created = new Date(quote.created_at).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' })

  const stamp = (iso: string | null) =>
    iso ? new Date(iso).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' }) : null

  // The document's own history, in the order it happened.
  const timeline: Array<[string, string]> = []
  if (stamp(quote.sent_at)) timeline.push(['Sent', stamp(quote.sent_at)!])
  if (stamp(quote.viewed_at)) timeline.push(['Opened by client', stamp(quote.viewed_at)!])
  if (stamp(quote.paid_at)) timeline.push(['Paid', stamp(quote.paid_at)!])

  return (
    <div className="bg-white rounded-2xl p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_8px_20px_-12px_rgba(180,83,10,0.25)]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span
              className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded"
              style={isInvoice
                ? { background: '#1f2937', color: '#fff' }
                : { background: '#fdecd9', color: '#b4530a' }}
            >
              {isInvoice ? 'Invoice' : 'Quote'}
            </span>
            <p className="font-semibold text-gray-900 truncate">
              {quote.customer_name ?? 'No customer name'}
            </p>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            {quote.number} · {created}
          </p>
        </div>
        <div className="text-right flex-shrink-0">
          <p className="font-semibold text-gray-900 tabular-nums">{rand(quote.total)}</p>
          <span
            className="inline-block mt-1 text-xs px-2 py-0.5 rounded-full font-medium"
            style={{ background: status.bg, color: status.fg }}
          >
            {status.label}
          </span>
        </div>
      </div>

      {open && (
        <div className="mt-3 pt-3 border-t border-gray-100 space-y-3">
          {quote.customer_address && (
            <p className="text-xs text-gray-500">{quote.customer_address}</p>
          )}

          <div className="space-y-1.5">
            {quote.items.map((item, i) => (
              <div key={i} className="flex items-baseline justify-between gap-3 text-sm">
                <span className="text-gray-700 min-w-0">
                  {item.description}
                  {Number(item.quantity) !== 1 && (
                    <span className="text-gray-400"> · {Number(item.quantity)} × {rand(item.unit_price)}</span>
                  )}
                </span>
                <span className="text-gray-900 tabular-nums flex-shrink-0">{rand(item.line_total)}</span>
              </div>
            ))}
          </div>

          {Number(quote.vat_amount) > 0 && (
            <div className="pt-2 border-t border-gray-100 space-y-1 text-xs text-gray-500">
              <div className="flex justify-between"><span>Subtotal</span><span className="tabular-nums">{rand(quote.subtotal)}</span></div>
              <div className="flex justify-between"><span>VAT (15%)</span><span className="tabular-nums">{rand(quote.vat_amount)}</span></div>
            </div>
          )}

          {timeline.length > 0 && (
            <div className="pt-2 border-t border-gray-100 space-y-1">
              {timeline.map(([label, when]) => (
                <div key={label} className="flex justify-between text-xs">
                  <span className="text-gray-400">{label}</span>
                  <span className="text-gray-600">{when}</span>
                </div>
              ))}
            </div>
          )}

          {quote.notes && <p className="text-xs text-gray-500 italic">{quote.notes}</p>}
        </div>
      )}

      {/* Settling up. Paystack marks its own quotes paid, so this only appears
          where nothing else will ever say so: an EFT into the account on the
          PDF, or cash on the day. */}
      {isPaid ? (
        <div className="flex items-center justify-between gap-2 mt-3 pt-3 border-t border-gray-100">
          <p className="text-xs text-gray-500">
            {byCard ? 'Paid by card' : 'Marked paid'}
            {stamp(quote.paid_at) ? ` · ${stamp(quote.paid_at)}` : ''}
          </p>
          {!byCard && (
            <button
              onClick={() => onPaid(false)}
              className="text-xs font-semibold text-gray-400 hover:text-gray-700 transition-colors px-2 py-1 rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-400"
            >
              Undo
            </button>
          )}
        </div>
      ) : quote.status !== 'cancelled' && quote.status !== 'draft' ? (
        <button
          onClick={() => onPaid(true)}
          className="w-full mt-3 py-2.5 rounded-xl text-xs font-semibold text-white transition-transform duration-150 ease-out hover:-translate-y-px active:translate-y-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#16a34a]"
          style={{ background: '#16a34a', boxShadow: '0 1px 2px rgba(15,23,42,0.08), 0 8px 18px -10px rgba(22,163,74,0.6)' }}
        >
          Mark as paid
        </button>
      ) : null}

      <div className="flex gap-2 mt-3 pt-3 border-t border-gray-100">
        <button
          onClick={() => setOpen(o => !o)}
          className="flex-1 text-center text-xs font-semibold py-2 rounded-xl text-gray-600 bg-gray-100 transition-transform duration-150 ease-out hover:-translate-y-px active:translate-y-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-400"
        >
          {open ? 'Hide' : 'Details'}
        </button>
        <a
          href={`/q/${quote.public_token}`}
          target="_blank"
          rel="noreferrer"
          className="flex-1 text-center text-xs font-semibold py-2 rounded-xl text-[#b4530a] bg-[#fdf6ec] transition-transform duration-150 ease-out hover:-translate-y-px active:translate-y-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#b4530a]"
        >
          View
        </a>
        <a
          href={`/api/quotes/${quote.public_token}/pdf`}
          target="_blank"
          rel="noreferrer"
          className="flex-1 text-center text-xs font-semibold py-2 rounded-xl text-gray-600 bg-gray-100 transition-transform duration-150 ease-out hover:-translate-y-px active:translate-y-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-400"
        >
          PDF
        </a>
      </div>
    </div>
  )
}

// The details that appear on every quote and PDF. Collapsed by default — the
// tradesperson sets this up once during WhatsApp onboarding and rarely returns.
function BusinessProfileCard({
  profile, saving, onSave,
}: {
  profile: BusinessProfile | null
  saving: boolean
  onSave: (updates: Partial<BusinessProfile>) => void
}) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<Partial<BusinessProfile>>({})

  if (!profile) return null

  const value = (field: keyof BusinessProfile) =>
    (draft[field] ?? profile[field] ?? '') as string

  const set = (field: keyof BusinessProfile) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setDraft(d => ({ ...d, [field]: e.target.value }))

  const FIELDS: Array<{ key: keyof BusinessProfile; label: string; mode?: string }> = [
    { key: 'business_name',  label: 'Business name' },
    { key: 'trade',          label: 'What work you do' },
    { key: 'bank_name',      label: 'Bank' },
    { key: 'account_number', label: 'Account number', mode: 'numeric' },
    { key: 'branch_code',    label: 'Branch code', mode: 'numeric' },
    { key: 'vat_number',     label: 'VAT number (only if registered)' },
  ]

  return (
    <div className="bg-white rounded-2xl p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#b4530a] rounded-lg"
      >
        <div className="flex items-center gap-3 min-w-0">
          {profile.logo_url ? (
            // Same reason as the quote page: a square box shrinks a wide logo
            // to fit its width. Height fixed, width free, capped so it can't
            // push the business name off a phone screen.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={profile.logo_url} alt="" className="h-10 w-auto max-w-[120px] object-contain object-left flex-shrink-0" />
          ) : (
            <div className="w-10 h-10 rounded-lg flex-shrink-0 flex items-center justify-center" style={{ background: '#fdecd9' }}>
              <span className="text-sm font-bold" style={{ color: '#b4530a' }}>
                {(profile.business_name ?? '?').charAt(0).toUpperCase()}
              </span>
            </div>
          )}
          <div className="min-w-0">
            <p className="font-semibold text-gray-900 truncate">
              {profile.business_name ?? 'Set up your business'}
            </p>
            <p className="text-xs text-gray-500 truncate">
              {profile.business_name ? 'Shown on every quote you send' : 'Needed before you can send a quote'}
            </p>
          </div>
        </div>
        <span className="text-xs font-semibold text-[#b4530a] flex-shrink-0 ml-2">
          {open ? 'Close' : 'Edit'}
        </span>
      </button>

      {open && (
        <div className="mt-4 pt-4 border-t border-gray-100 space-y-3">
          {FIELDS.map(field => (
            <div key={field.key}>
              <label htmlFor={`bp-${field.key}`} className="block text-xs font-semibold text-gray-600 mb-1">
                {field.label}
              </label>
              <input
                id={`bp-${field.key}`}
                type="text"
                inputMode={field.mode as 'numeric' | undefined}
                value={value(field.key)}
                onChange={set(field.key)}
                className="w-full px-3 py-2 rounded-xl border border-gray-200 text-gray-900 focus-visible:border-[#b4530a] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#b4530a]/30"
              />
            </div>
          ))}

          <div>
            <p className="block text-xs font-semibold text-gray-600 mb-1">Sorted replies to you in</p>
            <div className="flex gap-2">
              {([['en', 'English'], ['zu', 'isiZulu'], ['af', 'Afrikaans']] as const).map(([code, name]) => {
                const active = (draft.language ?? profile.language ?? 'en') === code
                return (
                  <button
                    key={code}
                    onClick={() => setDraft(d => ({ ...d, language: code }))}
                    className="flex-1 text-xs font-semibold py-2 rounded-xl transition-transform duration-150 ease-out hover:-translate-y-px active:translate-y-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#b4530a]"
                    style={active
                      ? { background: '#b4530a', color: '#fff' }
                      : { background: '#f3f4f6', color: '#6b7280' }}
                  >
                    {name}
                  </button>
                )
              })}
            </div>
          </div>

          <button
            onClick={() => { onSave(draft); setDraft({}); setOpen(false) }}
            disabled={saving || Object.keys(draft).length === 0}
            className="w-full py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-40 transition-transform duration-150 ease-out hover:-translate-y-px active:translate-y-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#b4530a]"
            style={{ background: '#b4530a' }}
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      )}
    </div>
  )
}
