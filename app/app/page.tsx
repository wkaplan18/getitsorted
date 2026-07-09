'use client'

import { useState, useEffect } from 'react'
import confetti from 'canvas-confetti'
import type { Bill, Reminder } from '@/lib/supabase'

type View = 'login' | 'otp' | 'dashboard'
type Tab = 'pending' | 'paid' | 'reminders' | 'senders'

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
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [tab, setTab] = useState<Tab>('pending')
  const [senders, setSenders] = useState<TrustedSender[]>([])
  const [newNumber, setNewNumber] = useState('')
  const [newLabel, setNewLabel] = useState('')
  const [addingsender, setAddingSender] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const [keepLoggedIn, setKeepLoggedIn] = useState(true)

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
    const [billsRes, sendersRes, remindersRes] = await Promise.all([
      fetch(`/api/bills?phone=${p}`, { headers: authHeaders() }),
      fetch(`/api/trusted-senders?phone=${p}`, { headers: authHeaders() }),
      fetch(`/api/reminder-notes?phone=${p}`, { headers: authHeaders() }),
    ])
    // Expired or missing session — back to login
    if (billsRes.status === 401) { logout(); return }
    const billsData = await billsRes.json()
    const sendersData = await sendersRes.json()
    const remindersData = await remindersRes.json()
    setBills(billsData.bills || [])
    setSenders(sendersData.senders || [])
    setReminders(remindersData.reminders || [])
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

  function logout() {
    localStorage.removeItem('sorted_phone')
    localStorage.removeItem('sorted_token')
    sessionStorage.removeItem('sorted_token')
    setPhone(''); setBills([]); setReminders([]); setView('login')
  }

  const pending = bills.filter(b => b.status === 'pending')
  const paid = bills.filter(b => b.status === 'paid')
  const incomplete = pending.filter(b => !b.account_number)
  const totalDue = pending.reduce((s, b) => s + b.amount, 0)
  const activeReminders = reminders.filter(r => !r.dismissed)

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
        <button onClick={() => setView('login')} className="w-full mt-2 text-gray-400 text-xs py-2">Back</button>
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
          <button onClick={logout} className="text-gray-400 text-xs hover:text-gray-600 transition-colors">Logout</button>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 pt-6 pb-12">

        {/* Summary cards */}
        <div className="grid grid-cols-3 gap-3 mb-5">
          <div className="bg-white rounded-2xl p-4 border border-gray-100" style={{ boxShadow: '0 2px 12px rgba(0,0,0,0.04)', borderLeft: '3px solid #22c55e' }}>
            <p className="text-xs text-gray-600 mb-1 font-medium">Total Due</p>
            <p className="text-xl font-bold" style={{ color: '#16a34a', letterSpacing: '-0.02em' }}>R{totalDue.toFixed(0)}</p>
          </div>
          <div className="bg-white rounded-2xl p-4 border border-gray-100" style={{ boxShadow: '0 2px 12px rgba(0,0,0,0.04)', borderLeft: '3px solid #f59e0b' }}>
            <p className="text-xs text-gray-600 mb-1 font-medium">Pending</p>
            <p className="text-xl font-bold" style={{ color: '#d97706', letterSpacing: '-0.02em' }}>{pending.length}</p>
          </div>
          <div className="bg-white rounded-2xl p-4 border border-gray-100" style={{ boxShadow: '0 2px 12px rgba(0,0,0,0.04)', borderLeft: `3px solid ${incomplete.length > 0 ? '#f59e0b' : '#e5e7eb'}` }}>
            <p className="text-xs text-gray-600 mb-1 font-medium">Needs Info</p>
            <p className="text-xl font-bold" style={{ color: incomplete.length > 0 ? '#d97706' : '#d1d5db', letterSpacing: '-0.02em' }}>{incomplete.length}</p>
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
          {(['pending', 'paid', 'reminders', 'senders'] as Tab[]).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
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
                      className="text-gray-300 hover:text-red-400 transition-colors p-1 rounded-lg hover:bg-red-50"
                    >
                      <svg width="14" height="14" fill="none" viewBox="0 0 24 24"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
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
}

function BillCard({ bill, senderLabel, onPaid, onUnpaid, onPayStitch, onDelete, onRepeat, onSaveBankDetails, onConfirm }: BillCardProps) {
  const [copied, setCopied] = useState<string | null>(null)
  const [showBankForm, setShowBankForm] = useState(false)
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

  const borderColor = isPaid ? '#d1fae5' : isUnconfirmed ? '#93c5fd' : isIncomplete ? '#fcd34d' : '#a7f3d0'
  const cardBg = isPaid ? 'rgba(240,253,244,0.6)' : isUnconfirmed ? 'rgba(239,246,255,0.8)' : isIncomplete ? 'rgba(255,251,235,0.8)' : '#ffffff'

  return (
    <div className="rounded-2xl p-4 border-l-4 transition-all"
      style={{
        background: cardBg,
        borderLeft: `4px solid ${borderColor}`,
        border: `1px solid ${isPaid ? '#d1fae5' : isUnconfirmed ? '#bfdbfe' : isIncomplete ? '#fde68a' : '#e5e7eb'}`,
        borderLeftWidth: '4px',
        borderLeftColor: borderColor,
        boxShadow: isPaid
          ? '0 2px 12px rgba(16,185,129,0.06)'
          : isUnconfirmed
          ? '0 2px 12px rgba(59,130,246,0.1)'
          : isIncomplete
          ? '0 2px 12px rgba(245,158,11,0.1)'
          : '0 2px 16px rgba(34,197,94,0.07)',
      }}>

      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-semibold text-gray-900">{bill.payee}</p>
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
              <button onClick={() => setConfirmDelete(false)} className="text-xs text-gray-400 px-1">✕</button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmDelete(true)}
              className="text-gray-300 hover:text-red-400 transition-colors p-1 rounded-lg hover:bg-red-50"
            >
              <svg width="14" height="14" fill="none" viewBox="0 0 24 24"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </button>
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
    <div className="rounded-2xl p-4 border-l-4 transition-all"
      style={{
        background: reminder.dismissed ? 'rgba(240,253,244,0.6)' : '#fffbeb',
        borderLeftWidth: '4px',
        borderLeftColor: reminder.dismissed ? '#d1fae5' : '#fcd34d',
        border: `1px solid ${reminder.dismissed ? '#d1fae5' : '#fde68a'}`,
        boxShadow: '0 2px 12px rgba(0,0,0,0.04)',
      }}>
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-semibold text-gray-900">{senderLabel || 'You'}</p>
            {reminder.dismissed && (
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: '#dcfce7', color: '#15803d' }}>Dismissed</span>
            )}
          </div>
          <p className="text-xs text-gray-500 mt-0.5">Received {receivedLabel}</p>
        </div>
        {confirmDelete ? (
          <div className="flex items-center gap-1 flex-shrink-0">
            <button onClick={onDelete} className="text-xs text-red-500 font-semibold px-2 py-1 rounded-lg bg-red-50 hover:bg-red-100 transition-colors">Delete</button>
            <button onClick={() => setConfirmDelete(false)} className="text-xs text-gray-400 px-1">✕</button>
          </div>
        ) : (
          <button onClick={() => setConfirmDelete(true)} className="text-gray-300 hover:text-red-400 transition-colors p-1 rounded-lg hover:bg-red-50 flex-shrink-0">
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </button>
        )}
      </div>
      <p className="text-sm text-gray-700 mb-3">{reminder.message}</p>
      <button
        onClick={onDismiss}
        className="text-xs font-semibold py-2 px-3 rounded-xl transition-colors"
        style={reminder.dismissed
          ? { border: '1px solid #fde68a', color: '#b45309', background: '#fffbeb' }
          : { border: '1px solid #d1fae5', color: '#16a34a', background: '#f0fdf4' }}
      >
        {reminder.dismissed ? 'Mark active' : 'Dismiss'}
      </button>
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
