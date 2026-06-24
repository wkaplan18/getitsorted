'use client'

import { useState, useEffect } from 'react'
import type { Bill } from '@/lib/supabase'

type View = 'login' | 'otp' | 'dashboard'
type Tab = 'pending' | 'paid' | 'senders'

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
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [tab, setTab] = useState<Tab>('pending')
  const [senders, setSenders] = useState<TrustedSender[]>([])
  const [newNumber, setNewNumber] = useState('')
  const [newLabel, setNewLabel] = useState('')
  const [addingsender, setAddingSender] = useState(false)

  useEffect(() => {
    const saved = localStorage.getItem('sorted_phone')
    if (saved) { setPhone(saved); fetchBills(saved) }
  }, [])

  async function sendOTP() {
    setLoading(true); setError('')
    const clean = phone.replace(/\D/g, '').replace(/^0/, '27')
    const res = await fetch('/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: clean })
    })
    setLoading(false)
    if (res.ok) { setPhone(clean); setView('otp') }
    else setError('Could not send code. Check your number.')
  }

  async function verifyOTP() {
    setLoading(true); setError('')
    const res = await fetch('/api/auth', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, otp })
    })
    setLoading(false)
    if (res.ok) {
      localStorage.setItem('sorted_phone', phone)
      await fetchBills(phone)
    } else setError('Invalid or expired code.')
  }

  async function fetchBills(p: string) {
    setView('dashboard')
    const [billsRes, sendersRes] = await Promise.all([
      fetch(`/api/bills?phone=${p}`),
      fetch(`/api/trusted-senders?phone=${p}`)
    ])
    const billsData = await billsRes.json()
    const sendersData = await sendersRes.json()
    setBills(billsData.bills || [])
    setSenders(sendersData.senders || [])
  }

  async function addSender() {
    if (!newNumber.trim()) return
    setAddingSender(true)
    await fetch('/api/trusted-senders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, trustedNumber: newNumber, label: newLabel })
    })
    const res = await fetch(`/api/trusted-senders?phone=${phone}`)
    const data = await res.json()
    setSenders(data.senders || [])
    setNewNumber(''); setNewLabel(''); setAddingSender(false)
  }

  async function removeSender(trustedNumber: string) {
    await fetch(`/api/trusted-senders?phone=${phone}&trustedNumber=${trustedNumber}`, { method: 'DELETE' })
    setSenders(prev => prev.filter(s => s.whatsapp_number !== trustedNumber))
  }

  async function markPaid(id: string) {
    await fetch('/api/bills', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status: 'paid' })
    })
    setBills(prev => prev.map(b => b.id === id ? { ...b, status: 'paid' } : b))
  }

  async function deleteBill(id: string) {
    await fetch(`/api/bills?id=${id}`, { method: 'DELETE' })
    setBills(prev => prev.filter(b => b.id !== id))
  }

  async function payViaStitch(billId: string) {
    const res = await fetch('/api/pay', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ billId, phone })
    })
    const data = await res.json()
    if (data.redirectUrl) window.location.href = data.redirectUrl
    else alert(data.error ?? 'Could not initiate payment')
  }

  function saveBankDetails(billId: string, details: Partial<Bill>) {
    fetch('/api/bills', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: billId, ...details })
    })
    setBills(prev => prev.map(b => b.id === billId ? { ...b, ...details } : b))
  }

  function logout() {
    localStorage.removeItem('sorted_phone')
    setPhone(''); setBills([]); setView('login')
  }

  const pending = bills.filter(b => b.status === 'pending')
  const paid = bills.filter(b => b.status === 'paid')
  const incomplete = pending.filter(b => !b.account_number)
  const totalDue = pending.reduce((s, b) => s + b.amount, 0)

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
          disabled={loading}
          className="w-full text-white rounded-xl py-3 text-sm font-semibold disabled:opacity-50"
          style={{ background: 'linear-gradient(135deg, #22c55e 0%, #10b981 50%, #06b6d4 100%)' }}
        >
          {loading ? 'Sending...' : 'Send WhatsApp Code'}
        </button>
      </div>
    </div>
  )

  if (view === 'otp') return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'linear-gradient(135deg, #f0fdf4 0%, #e0f2fe 100%)' }}>
      <div className="bg-white rounded-3xl p-8 w-full max-w-sm" style={{ boxShadow: '0 20px 60px rgba(16,185,129,0.12), 0 4px 16px rgba(0,0,0,0.06)' }}>
        <div className="flex items-center gap-3 mb-7">
          <SortedLogo size={42} />
          <div>
            <h1 className="text-xl font-bold text-gray-900" style={{ letterSpacing: '-0.03em' }}>Check WhatsApp</h1>
            <p className="text-gray-400 text-xs">Code sent to {phone}</p>
          </div>
        </div>
        <input
          className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm mb-3 outline-none focus:border-emerald-400 text-center text-2xl tracking-widest"
          placeholder="000000"
          maxLength={6}
          value={otp}
          onChange={e => setOtp(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && verifyOTP()}
        />
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
    <div className="min-h-screen" style={{ background: '#f8fafc' }}>
      {/* Header */}
      <div className="bg-white border-b border-gray-100 sticky top-0 z-10" style={{ boxShadow: '0 1px 12px rgba(0,0,0,0.04)' }}>
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
          <div className="bg-white rounded-2xl p-4 border border-gray-100" style={{ boxShadow: '0 2px 12px rgba(0,0,0,0.04)' }}>
            <p className="text-xs text-gray-400 mb-1 font-medium">Total Due</p>
            <p className="text-xl font-bold text-gray-900" style={{ letterSpacing: '-0.02em' }}>R{totalDue.toFixed(0)}</p>
          </div>
          <div className="bg-white rounded-2xl p-4 border border-gray-100" style={{ boxShadow: '0 2px 12px rgba(0,0,0,0.04)' }}>
            <p className="text-xs text-gray-400 mb-1 font-medium">Pending</p>
            <p className="text-xl font-bold text-gray-900">{pending.length}</p>
          </div>
          <div className={`rounded-2xl p-4 border ${incomplete.length > 0 ? 'bg-amber-50 border-amber-100' : 'bg-white border-gray-100'}`} style={{ boxShadow: '0 2px 12px rgba(0,0,0,0.04)' }}>
            <p className="text-xs text-gray-400 mb-1 font-medium">Need Details</p>
            <p className={`text-xl font-bold ${incomplete.length > 0 ? 'text-amber-500' : 'text-gray-900'}`}>{incomplete.length}</p>
          </div>
        </div>

        {/* WhatsApp banner */}
        <div className="rounded-2xl p-4 mb-5 flex items-center gap-3" style={{ background: 'linear-gradient(135deg, #f0fdf4, #e0f2fe)', border: '1px solid #d1fae5' }}>
          <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'linear-gradient(135deg, #22c55e, #06b6d4)' }}>
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </div>
          <p className="text-gray-600 text-xs">Forward any invoice to <strong className="text-gray-900">{process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || 'your Sorted number'}</strong></p>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-gray-100 rounded-2xl p-1 mb-5">
          {(['pending', 'paid', 'senders'] as Tab[]).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all duration-150 capitalize"
              style={tab === t
                ? { background: '#fff', color: '#111', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }
                : { color: '#9ca3af', background: 'transparent' }}
            >
              {t === 'pending' && <>Pending {pending.length > 0 && <span className="ml-1 text-xs bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full">{pending.length}</span>}</>}
              {t === 'paid' && <>Paid {paid.length > 0 && <span className="ml-1 text-xs bg-gray-200 text-gray-500 px-1.5 py-0.5 rounded-full">{paid.length}</span>}</>}
              {t === 'senders' && 'Senders'}
            </button>
          ))}
        </div>

        {/* Bill list */}
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
                onPaid={() => markPaid(bill.id)}
                onDelete={() => deleteBill(bill.id)}
                onPayStitch={() => payViaStitch(bill.id)}
                onSaveBankDetails={details => saveBankDetails(bill.id, details)}
              />
            ))}
          </div>
        )}

        {tab === 'paid' && (
          <div className="space-y-3">
            {paid.length === 0 && (
              <div className="text-center py-16 text-gray-400">
                <p className="text-sm font-medium">No paid bills yet</p>
              </div>
            )}
            {paid.map(bill => (
              <BillCard key={bill.id} bill={bill} onDelete={() => deleteBill(bill.id)} />
            ))}
          </div>
        )}

        {tab === 'senders' && (
          <div>
            <p className="text-xs text-gray-400 mb-4">Add a WhatsApp number (e.g. your partner&apos;s) and their forwarded invoices will appear in your dashboard automatically.</p>

            {/* Add form */}
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

            {/* Sender list */}
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
                  <button
                    onClick={() => removeSender(s.whatsapp_number)}
                    className="text-gray-300 hover:text-red-400 transition-colors p-1 rounded-lg hover:bg-red-50"
                  >
                    <svg width="14" height="14" fill="none" viewBox="0 0 24 24"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  </button>
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
  onPaid?: () => void
  onPayStitch?: () => void
  onDelete?: () => void
  onSaveBankDetails?: (details: Partial<Bill>) => void
}

function BillCard({ bill, onPaid, onPayStitch, onDelete, onSaveBankDetails }: BillCardProps) {
  const [copied, setCopied] = useState<string | null>(null)
  const [showBankForm, setShowBankForm] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [bankFields, setBankFields] = useState({
    bank_name: bill.bank_name ?? '',
    account_number: bill.account_number ?? '',
    branch_code: bill.branch_code ?? '',
    reference: bill.reference ?? '',
  })

  const isPaid = bill.status === 'paid'
  const isIncomplete = !bill.account_number && !isPaid

  function copy(val: string, label: string) {
    navigator.clipboard.writeText(val)
    setCopied(label)
    setTimeout(() => setCopied(null), 1500)
  }

  const dueLabel = bill.due_date
    ? new Date(bill.due_date).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' })
    : 'No due date'

  const receivedLabel = new Date(bill.created_at).toLocaleString('en-ZA', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
  })

  return (
    <div className={`bg-white rounded-2xl p-4 border transition-all ${
      isPaid ? 'opacity-60 border-gray-100' :
      isIncomplete ? 'border-amber-200' :
      'border-gray-100'
    }`} style={{ boxShadow: '0 2px 12px rgba(0,0,0,0.04)' }}>

      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-semibold text-gray-900">{bill.payee}</p>
            {isIncomplete && <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">Needs details</span>}
            {isPaid && <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-medium">Paid</span>}
          </div>
          <p className="text-xs text-gray-300 mt-0.5">Received {receivedLabel}</p>
        </div>
        <div className="flex items-center gap-2 ml-3 flex-shrink-0">
          <p className="text-lg font-bold text-gray-900">R{bill.amount.toFixed(0)}</p>
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
        <div className="rounded-xl p-3 text-xs space-y-1.5 mb-3" style={{ background: '#f8fafc' }}>
          {bill.bank_name && <DetailRow label="Bank" value={bill.bank_name} />}
          <DetailRow label="Account" value={bill.account_number} onCopy={() => copy(bill.account_number!, 'account')} copied={copied === 'account'} />
          {bill.branch_code && <DetailRow label="Branch" value={bill.branch_code} onCopy={() => copy(bill.branch_code!, 'branch')} copied={copied === 'branch'} />}
          {bill.reference && <DetailRow label="Reference" value={bill.reference} onCopy={() => copy(bill.reference!, 'ref')} copied={copied === 'ref'} />}
        </div>
      )}

      {isIncomplete && showBankForm && (
        <div className="bg-amber-50 rounded-xl p-3 mb-3 space-y-2">
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
          {isIncomplete ? (
            <button
              onClick={() => setShowBankForm(v => !v)}
              className="flex-1 border border-amber-300 text-amber-700 text-xs font-semibold py-2.5 rounded-xl hover:bg-amber-50 transition-colors"
            >
              {showBankForm ? 'Cancel' : '+ Add bank details'}
            </button>
          ) : (
            <>
              <button
                onClick={onPayStitch}
                className="flex-1 text-white text-xs font-semibold py-2.5 rounded-xl hover:opacity-90 transition-opacity"
                style={{ background: 'linear-gradient(135deg, #22c55e, #06b6d4)' }}
              >
                Pay via Stitch
              </button>
              <button
                onClick={onPaid}
                className="border border-gray-200 text-gray-500 text-xs font-medium py-2.5 px-4 rounded-xl hover:bg-gray-50 transition-colors"
              >
                Mark paid
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}

function DetailRow({ label, value, onCopy, copied }: { label: string; value: string; onCopy?: () => void; copied?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-gray-400">{label}</span>
      <div className="flex items-center gap-2">
        <span className="font-mono text-gray-700">{value}</span>
        {onCopy && (
          <button onClick={onCopy} className="text-xs font-semibold transition-colors" style={{ color: copied ? '#22c55e' : '#06b6d4' }}>
            {copied ? '✓ Copied' : 'Copy'}
          </button>
        )}
      </div>
    </div>
  )
}
