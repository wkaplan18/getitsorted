'use client'

import { useState, useEffect, Fragment } from 'react'

type UserRow = {
  id: string
  whatsapp_number: string
  name: string | null
  business_name: string | null
  trade: string | null
  has_logo: boolean
  vat_registered: boolean
  language: string | null
  onboarded_at: string | null
  created_at: string
  bills: number
  billsPending: number
  billsPaid: number
  quotes: number
  invoices: number
  quotedValue: number
  paidValue: number
  lastActivity: string | null
}

type Stats = {
  total: number
  newThisWeek: number
  onboarded: number
  quoting: number
  activeThisMonth: number
  quotes: number
  invoices: number
  quotedValue: number
  paidValue: number
  bills: number
}

type QuoteRow = {
  id: string
  number: string
  doc_type: 'quote' | 'invoice'
  status: string
  total: number
  created_at: string
  public_token: string
  customer_name: string | null
}

const rand = (n: number) => 'R' + Math.round(n).toLocaleString('en-ZA')

const day = (iso: string) => new Date(iso).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: '2-digit' })

/** How long since they last did anything — the fastest read on whether a signup stuck. */
function sinceLabel(iso: string | null): string {
  if (!iso) return 'never'
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)
  if (days <= 0) return 'today'
  if (days === 1) return 'yesterday'
  if (days < 31) return `${days}d ago`
  return `${Math.floor(days / 30)}mo ago`
}

/**
 * Where a signup got to. Most people who stall do it at a specific step, and
 * the whole point of this page is seeing which step that was.
 */
function stage(u: UserRow): { label: string; cls: string } {
  if (u.quotes + u.invoices > 0) return { label: 'Quoting', cls: 'text-emerald-700 bg-emerald-50' }
  if (u.onboarded_at) return { label: 'Set up', cls: 'text-amber-700 bg-amber-50' }
  if (u.bills > 0) return { label: 'Bills only', cls: 'text-sky-700 bg-sky-50' }
  return { label: 'Signed up', cls: 'text-gray-500 bg-gray-100' }
}

type Invoice = {
  id: string
  payee: string
  amount: number
  status: 'pending' | 'paid' | 'overdue'
  due_date: string | null
  created_at: string
  sender: { number: string | null; label: string | null; isOwner: boolean }
}

function senderLabel(sender: Invoice['sender']) {
  if (sender.isOwner) return `${sender.number} (self)`
  if (sender.label) return `${sender.label} (${sender.number})`
  return sender.number || 'Unknown'
}

function statusColor(status: Invoice['status']) {
  if (status === 'paid') return 'text-emerald-600 bg-emerald-50'
  if (status === 'overdue') return 'text-red-600 bg-red-50'
  return 'text-amber-600 bg-amber-50'
}

function Stat({ label, value, note, accent }: { label: string; value: string; note?: string; accent?: string }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="text-2xl font-semibold tabular-nums" style={{ color: accent ?? '#1f2937' }}>{value}</p>
      {note && <p className="text-xs text-gray-400 mt-0.5">{note}</p>}
    </div>
  )
}

function SortedLogo({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="logoGrad" x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#22C55E" />
          <stop offset="50%" stopColor="#10B981" />
          <stop offset="100%" stopColor="#06B6D4" />
        </linearGradient>
        <linearGradient id="checkGrad" x1="8" y1="20" x2="32" y2="20" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="100%" stopColor="#E0FFF8" />
        </linearGradient>
      </defs>
      <rect width="40" height="40" rx="11" fill="url(#logoGrad)" />
      <rect width="40" height="40" rx="11" fill="white" fillOpacity="0.08" />
      <ellipse cx="20" cy="8" rx="14" ry="6" fill="white" fillOpacity="0.15" />
      <path d="M9 20.5L16.5 28L31 13" stroke="url(#checkGrad)" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export default function AdminPage() {
  const [token, setToken] = useState<string | null>(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [users, setUsers] = useState<UserRow[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null)
  const [invoicesByUser, setInvoicesByUser] = useState<Record<string, Invoice[]>>({})
  const [quotesByUser, setQuotesByUser] = useState<Record<string, QuoteRow[]>>({})
  const [invoicesLoading, setInvoicesLoading] = useState<string | null>(null)

  useEffect(() => {
    const saved = localStorage.getItem('sorted_admin_token')
    if (saved) {
      setToken(saved)
      fetchStats(saved)
    }
  }, [])

  async function login() {
    setError('')
    setLoading(true)
    const res = await fetch('/api/admin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })
    const data = await res.json()
    setLoading(false)
    if (!res.ok) {
      setError(data.error || 'Login failed')
      return
    }
    localStorage.setItem('sorted_admin_token', data.token)
    setToken(data.token)
    fetchStats(data.token)
  }

  async function fetchStats(t: string) {
    setLoading(true)
    const res = await fetch('/api/admin', { headers: { Authorization: `Bearer ${t}` } })
    setLoading(false)
    if (!res.ok) {
      localStorage.removeItem('sorted_admin_token')
      setToken(null)
      setError('Session expired — please log in again.')
      return
    }
    const data = await res.json()
    setUsers(data.users || [])
    setStats(data.stats ?? null)
  }

  function logout() {
    localStorage.removeItem('sorted_admin_token')
    setToken(null)
    setUsers([])
  }

  async function toggleUser(userId: string) {
    if (expandedUserId === userId) {
      setExpandedUserId(null)
      return
    }
    setExpandedUserId(userId)
    if (quotesByUser[userId] || !token) return
    setInvoicesLoading(userId)
    const res = await fetch(`/api/admin?userId=${userId}`, { headers: { Authorization: `Bearer ${token}` } })
    setInvoicesLoading(null)
    if (!res.ok) return
    const data = await res.json()
    setInvoicesByUser((prev) => ({ ...prev, [userId]: data.invoices || [] }))
    setQuotesByUser((prev) => ({ ...prev, [userId]: data.quotes || [] }))
  }

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="w-full max-w-sm bg-white rounded-2xl shadow-lg p-8 border border-gray-100">
          <div className="flex items-center gap-2 mb-6">
            <SortedLogo />
            <span className="text-lg font-semibold text-gray-800">Sorted Admin</span>
          </div>
          <div className="space-y-3">
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
            />
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && login()}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
            />
            {error && <p className="text-sm text-red-500">{error}</p>}
            <button
              onClick={login}
              disabled={loading}
              className="w-full bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg py-2 text-sm font-medium disabled:opacity-50"
            >
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen px-4 py-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <SortedLogo />
            <span className="text-lg font-semibold text-gray-800">Sorted Admin</span>
          </div>
          <button onClick={logout} className="text-sm text-gray-500 hover:text-gray-700">
            Log out
          </button>
        </div>

        {/* Signups is a vanity number on its own. What matters is how far down
            the funnel they got: signed up → set up → actually quoting. */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
          <Stat label="Businesses" value={String(stats?.total ?? users.length)} note={`${stats?.newThisWeek ?? 0} new this week`} />
          <Stat label="Set up" value={String(stats?.onboarded ?? 0)} note="finished onboarding" />
          <Stat label="Quoting" value={String(stats?.quoting ?? 0)} note="sent at least one" accent="#16a34a" />
          <Stat label="Active this month" value={String(stats?.activeThisMonth ?? 0)} note="did anything at all" />
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <Stat label="Quotes" value={String(stats?.quotes ?? 0)} note={`${stats?.invoices ?? 0} invoices`} />
          <Stat label="Value quoted" value={rand(stats?.quotedValue ?? 0)} note="excl. cancelled" accent="#b4530a" />
          <Stat label="Value paid" value={rand(stats?.paidValue ?? 0)} note="marked or card" accent="#16a34a" />
          <Stat label="Bills tracked" value={String(stats?.bills ?? 0)} note="money-out side" />
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-left">
              <tr>
                <th className="px-4 py-3 font-medium">Business</th>
                <th className="px-4 py-3 font-medium">WhatsApp</th>
                <th className="px-4 py-3 font-medium">Joined</th>
                <th className="px-4 py-3 font-medium">Stage</th>
                <th className="px-4 py-3 font-medium text-right">Docs</th>
                <th className="px-4 py-3 font-medium text-right">Quoted</th>
                <th className="px-4 py-3 font-medium text-right">Paid</th>
                <th className="px-4 py-3 font-medium text-right">Last seen</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <Fragment key={u.id}>
                  <tr
                    onClick={() => toggleUser(u.id)}
                    className="border-t border-gray-100 cursor-pointer hover:bg-gray-50"
                  >
                    <td className="px-4 py-3 text-gray-800">
                      <span className="inline-block mr-1 text-gray-400 transition-transform" style={{ transform: expandedUserId === u.id ? 'rotate(90deg)' : 'none' }}>
                        ›
                      </span>
                      <span className="font-medium">{u.business_name || u.name || 'Not set up yet'}</span>
                      <span className="block ml-4 text-xs text-gray-400">
                        {[u.trade, u.name && u.business_name ? u.name : null].filter(Boolean).join(' · ') || '—'}
                        {u.vat_registered ? ' · VAT' : ''}
                        {u.has_logo ? ' · logo' : ''}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{u.whatsapp_number}</td>
                    <td className="px-4 py-3 text-gray-600">{day(u.created_at)}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${stage(u).cls}`}>{stage(u).label}</span>
                    </td>
                    <td className="px-4 py-3 text-right text-gray-800 font-medium">
                      {u.quotes + u.invoices || '—'}
                      {u.invoices > 0 && <span className="text-xs text-gray-400"> ({u.invoices} inv)</span>}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-800 tabular-nums">{u.quotedValue ? rand(u.quotedValue) : '—'}</td>
                    <td className="px-4 py-3 text-right tabular-nums" style={{ color: u.paidValue ? '#16a34a' : '#9ca3af' }}>
                      {u.paidValue ? rand(u.paidValue) : '—'}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-600">{sinceLabel(u.lastActivity)}</td>
                  </tr>
                  {expandedUserId === u.id && (
                    <tr className="border-t border-gray-100 bg-gray-50/60">
                      <td colSpan={8} className="px-4 py-4">
                        {invoicesLoading === u.id && <p className="text-sm text-gray-400">Loading…</p>}

                        {invoicesLoading !== u.id && (
                          <div className="mb-5">
                            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">Quotes &amp; invoices</p>
                            {(quotesByUser[u.id]?.length ?? 0) === 0 ? (
                              <p className="text-sm text-gray-400">None yet.</p>
                            ) : (
                              <table className="w-full text-sm">
                                <thead className="text-gray-400 text-left">
                                  <tr>
                                    <th className="px-2 py-1 font-medium">Number</th>
                                    <th className="px-2 py-1 font-medium">Client</th>
                                    <th className="px-2 py-1 font-medium text-right">Total</th>
                                    <th className="px-2 py-1 font-medium">Status</th>
                                    <th className="px-2 py-1 font-medium">Sent</th>
                                    <th className="px-2 py-1 font-medium">Link</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {quotesByUser[u.id].map((q) => (
                                    <tr key={q.id} className="border-t border-gray-100">
                                      <td className="px-2 py-2 text-gray-800">
                                        {q.number}
                                        {q.doc_type === 'invoice' && <span className="ml-1 text-xs text-gray-400">inv</span>}
                                      </td>
                                      <td className="px-2 py-2 text-gray-600">{q.customer_name || '—'}</td>
                                      <td className="px-2 py-2 text-right text-gray-800 tabular-nums">{rand(q.total)}</td>
                                      <td className="px-2 py-2">
                                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${q.status === 'paid' ? 'text-emerald-600 bg-emerald-50' : 'text-amber-600 bg-amber-50'}`}>
                                          {q.status}
                                        </span>
                                      </td>
                                      <td className="px-2 py-2 text-gray-600">{day(q.created_at)}</td>
                                      <td className="px-2 py-2">
                                        <a
                                          href={`/q/${q.public_token}`}
                                          target="_blank"
                                          rel="noreferrer"
                                          onClick={(e) => e.stopPropagation()}
                                          className="text-xs font-medium text-[#b4530a] hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#b4530a] rounded"
                                        >
                                          open
                                        </a>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            )}
                          </div>
                        )}

                        {invoicesLoading !== u.id && (invoicesByUser[u.id]?.length ?? 0) > 0 && (
                          <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">Bills they owe</p>
                        )}

                        {invoicesLoading !== u.id && (invoicesByUser[u.id]?.length ?? 0) > 0 && (
                          <table className="w-full text-sm">
                            <thead className="text-gray-400 text-left">
                              <tr>
                                <th className="px-2 py-1 font-medium">Payee</th>
                                <th className="px-2 py-1 font-medium text-right">Amount</th>
                                <th className="px-2 py-1 font-medium">Status</th>
                                <th className="px-2 py-1 font-medium">Due</th>
                                <th className="px-2 py-1 font-medium">Sent</th>
                                <th className="px-2 py-1 font-medium">Sent by</th>
                              </tr>
                            </thead>
                            <tbody>
                              {invoicesByUser[u.id].map((inv) => (
                                <tr key={inv.id} className="border-t border-gray-100">
                                  <td className="px-2 py-2 text-gray-800">{inv.payee}</td>
                                  <td className="px-2 py-2 text-right text-gray-800">R{inv.amount.toFixed(2)}</td>
                                  <td className="px-2 py-2">
                                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColor(inv.status)}`}>
                                      {inv.status}
                                    </span>
                                  </td>
                                  <td className="px-2 py-2 text-gray-600">{inv.due_date ? new Date(inv.due_date).toLocaleDateString() : '—'}</td>
                                  <td className="px-2 py-2 text-gray-600">{new Date(inv.created_at).toLocaleDateString()}</td>
                                  <td className="px-2 py-2 text-gray-600">{senderLabel(inv.sender)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
              {users.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-gray-400">
                    Nobody has signed up yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
