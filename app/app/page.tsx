'use client'

import { useState, useEffect } from 'react'
import type { Bill } from '@/lib/supabase'

type View = 'login' | 'otp' | 'dashboard'

export default function Home() {
  const [view, setView] = useState<View>('login')
  const [phone, setPhone] = useState('')
  const [otp, setOtp] = useState('')
  const [bills, setBills] = useState<Bill[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

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
    const res = await fetch(`/api/bills?phone=${p}`)
    const data = await res.json()
    setBills(data.bills || [])
  }

  async function markPaid(id: string) {
    await fetch('/api/bills', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status: 'paid' })
    })
    setBills(prev => prev.map(b => b.id === id ? { ...b, status: 'paid' } : b))
  }

  async function payViaStitch(billId: string) {
    const res = await fetch('/api/pay', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ billId, phone })
    })
    const data = await res.json()
    if (data.redirectUrl) {
      window.location.href = data.redirectUrl
    } else {
      alert(data.error ?? 'Could not initiate payment')
    }
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
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-lg p-8 w-full max-w-sm">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Sorted</h1>
        <p className="text-gray-500 text-sm mb-6">Forward your bills. Get sorted.</p>
        <input
          className="w-full border border-gray-200 rounded-lg px-4 py-3 text-sm mb-3 outline-none focus:border-gray-400"
          placeholder="082 123 4567"
          value={phone}
          onChange={e => setPhone(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && sendOTP()}
        />
        {error && <p className="text-red-500 text-xs mb-3">{error}</p>}
        <button
          onClick={sendOTP}
          disabled={loading}
          className="w-full bg-gray-900 text-white rounded-lg py-3 text-sm font-medium disabled:opacity-50"
        >
          {loading ? 'Sending...' : 'Send WhatsApp Code'}
        </button>
      </div>
    </div>
  )

  if (view === 'otp') return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-lg p-8 w-full max-w-sm">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Check WhatsApp</h1>
        <p className="text-gray-500 text-sm mb-6">We sent a 6-digit code to {phone}</p>
        <input
          className="w-full border border-gray-200 rounded-lg px-4 py-3 text-sm mb-3 outline-none focus:border-gray-400 text-center text-xl tracking-widest"
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
          className="w-full bg-gray-900 text-white rounded-lg py-3 text-sm font-medium disabled:opacity-50"
        >
          {loading ? 'Verifying...' : 'Verify'}
        </button>
        <button onClick={() => setView('login')} className="w-full mt-2 text-gray-400 text-xs py-2">Back</button>
      </div>
    </div>
  )

  return (
    <div className="max-w-2xl mx-auto p-4 pt-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Sorted</h1>
          <p className="text-gray-400 text-xs mt-0.5">{phone}</p>
        </div>
        <button onClick={logout} className="text-gray-400 text-xs hover:text-gray-600">Logout</button>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <p className="text-xs text-gray-400 mb-1">Total Due</p>
          <p className="text-xl font-bold text-gray-900">R{totalDue.toFixed(2)}</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <p className="text-xs text-gray-400 mb-1">Pending</p>
          <p className="text-xl font-bold text-gray-900">{pending.length}</p>
        </div>
        <div className={`rounded-xl p-4 shadow-sm ${incomplete.length > 0 ? 'bg-amber-50' : 'bg-white'}`}>
          <p className="text-xs text-gray-400 mb-1">Need Details</p>
          <p className={`text-xl font-bold ${incomplete.length > 0 ? 'text-amber-600' : 'text-gray-900'}`}>{incomplete.length}</p>
        </div>
      </div>

      <div className="bg-green-50 border border-green-100 rounded-xl p-4 mb-6 text-sm text-green-800">
        Forward any invoice on WhatsApp to <strong>{process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || 'your Sorted number'}</strong>
      </div>

      <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">Pending</h2>
      {pending.length === 0 && <p className="text-gray-400 text-sm mb-6">No pending bills.</p>}
      <div className="space-y-3 mb-8">
        {pending.map(bill => (
          <BillCard
            key={bill.id}
            bill={bill}
            onPaid={() => markPaid(bill.id)}
            onPayStitch={() => payViaStitch(bill.id)}
            onSaveBankDetails={details => saveBankDetails(bill.id, details)}
          />
        ))}
      </div>

      {paid.length > 0 && (
        <>
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">Paid</h2>
          <div className="space-y-3">
            {paid.map(bill => <BillCard key={bill.id} bill={bill} />)}
          </div>
        </>
      )}
    </div>
  )
}

type BillCardProps = {
  bill: Bill
  onPaid?: () => void
  onPayStitch?: () => void
  onSaveBankDetails?: (details: Partial<Bill>) => void
}

function BillCard({ bill, onPaid, onPayStitch, onSaveBankDetails }: BillCardProps) {
  const [copied, setCopied] = useState<string | null>(null)
  const [showBankForm, setShowBankForm] = useState(false)
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

  return (
    <div className={`bg-white rounded-xl p-4 shadow-sm border ${isPaid ? 'opacity-50 border-gray-100' : isIncomplete ? 'border-amber-200' : 'border-gray-100'}`}>
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="flex items-center gap-2">
            <p className="font-semibold text-gray-900">{bill.payee}</p>
            {isIncomplete && <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">Needs details</span>}
          </div>
          <p className="text-xs text-gray-400 mt-0.5">Due {dueLabel}</p>
        </div>
        <p className="text-lg font-bold text-gray-900">R{bill.amount.toFixed(2)}</p>
      </div>

      {bill.account_number && (
        <div className="bg-gray-50 rounded-lg p-3 text-xs space-y-1.5 mb-3">
          {bill.bank_name && <DetailRow label="Bank" value={bill.bank_name} />}
          <DetailRow label="Account" value={bill.account_number} onCopy={() => copy(bill.account_number!, 'account')} copied={copied === 'account'} />
          {bill.branch_code && <DetailRow label="Branch" value={bill.branch_code} onCopy={() => copy(bill.branch_code!, 'branch')} copied={copied === 'branch'} />}
          {bill.reference && <DetailRow label="Reference" value={bill.reference} onCopy={() => copy(bill.reference!, 'ref')} copied={copied === 'ref'} />}
        </div>
      )}

      {isIncomplete && showBankForm && (
        <div className="bg-amber-50 rounded-lg p-3 mb-3 space-y-2">
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
            <button onClick={() => { onSaveBankDetails?.(bankFields); setShowBankForm(false) }} className="flex-1 bg-gray-900 text-white text-xs py-2 rounded-lg">Save</button>
            <button onClick={() => setShowBankForm(false)} className="text-gray-400 text-xs px-3">Cancel</button>
          </div>
        </div>
      )}

      {!isPaid && (
        <div className="flex gap-2">
          {isIncomplete ? (
            <button
              onClick={() => setShowBankForm(v => !v)}
              className="flex-1 border border-amber-300 text-amber-700 text-xs font-medium py-2 rounded-lg"
            >
              {showBankForm ? 'Cancel' : 'Add bank details'}
            </button>
          ) : (
            <>
              <button
                onClick={onPayStitch}
                className="flex-1 bg-gray-900 text-white text-xs font-medium py-2 rounded-lg"
              >
                Pay via Stitch
              </button>
              <button
                onClick={onPaid}
                className="border border-gray-200 text-gray-500 text-xs font-medium py-2 px-3 rounded-lg"
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
          <button onClick={onCopy} className="text-blue-500 underline text-xs">
            {copied ? 'Copied!' : 'Copy'}
          </button>
        )}
      </div>
    </div>
  )
}
