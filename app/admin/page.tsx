'use client'

import { useState, useEffect, Fragment } from 'react'

type UserRow = {
  id: string
  whatsapp_number: string
  name: string | null
  created_at: string
  total: number
  pending: number
  paid: number
  overdue: number
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
  const [totalInvoices, setTotalInvoices] = useState(0)
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null)
  const [invoicesByUser, setInvoicesByUser] = useState<Record<string, Invoice[]>>({})
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
    setTotalInvoices(data.totalInvoices || 0)
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
    if (invoicesByUser[userId] || !token) return
    setInvoicesLoading(userId)
    const res = await fetch(`/api/admin?userId=${userId}`, { headers: { Authorization: `Bearer ${token}` } })
    setInvoicesLoading(null)
    if (!res.ok) return
    const data = await res.json()
    setInvoicesByUser((prev) => ({ ...prev, [userId]: data.invoices || [] }))
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

        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
            <p className="text-xs text-gray-500">Registered users</p>
            <p className="text-2xl font-semibold text-gray-800">{users.length}</p>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
            <p className="text-xs text-gray-500">Invoices sent</p>
            <p className="text-2xl font-semibold text-gray-800">{totalInvoices}</p>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-left">
              <tr>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">WhatsApp number</th>
                <th className="px-4 py-3 font-medium">Registered</th>
                <th className="px-4 py-3 font-medium text-right">Invoices</th>
                <th className="px-4 py-3 font-medium text-right">Pending</th>
                <th className="px-4 py-3 font-medium text-right">Paid</th>
                <th className="px-4 py-3 font-medium text-right">Overdue</th>
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
                      {u.name || '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{u.whatsapp_number}</td>
                    <td className="px-4 py-3 text-gray-600">{new Date(u.created_at).toLocaleDateString()}</td>
                    <td className="px-4 py-3 text-right text-gray-800 font-medium">{u.total}</td>
                    <td className="px-4 py-3 text-right text-gray-600">{u.pending}</td>
                    <td className="px-4 py-3 text-right text-gray-600">{u.paid}</td>
                    <td className="px-4 py-3 text-right text-gray-600">{u.overdue}</td>
                  </tr>
                  {expandedUserId === u.id && (
                    <tr className="border-t border-gray-100 bg-gray-50/60">
                      <td colSpan={7} className="px-4 py-4">
                        {invoicesLoading === u.id && <p className="text-sm text-gray-400">Loading invoices…</p>}
                        {invoicesLoading !== u.id && (invoicesByUser[u.id]?.length ?? 0) === 0 && (
                          <p className="text-sm text-gray-400">No invoices yet.</p>
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
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-400">
                    No registered users yet.
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
