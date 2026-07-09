'use client'

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'

function PaySuccessContent() {
  const params = useSearchParams()
  const router = useRouter()
  const billId = params.get('bill_id')
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')

  useEffect(() => {
    if (!billId) { setStatus('error'); return }

    const token = localStorage.getItem('sorted_token') ?? sessionStorage.getItem('sorted_token')
    if (!token) { router.push('/'); return }

    fetch('/api/bills', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ id: billId, status: 'paid' })
    })
      .then(r => r.ok ? setStatus('success') : setStatus('error'))
      .catch(() => setStatus('error'))
  }, [billId, router])

  if (status === 'loading') return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-gray-400">Confirming payment...</p>
    </div>
  )

  if (status === 'error') return (
    <div className="min-h-screen flex items-center justify-center p-4 text-center">
      <div>
        <p className="text-2xl mb-2">Something went wrong</p>
        <p className="text-gray-400 text-sm mb-4">If your payment went through, mark the bill as paid manually.</p>
        <button onClick={() => router.push('/')} className="text-blue-500 underline text-sm">Back to dashboard</button>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen flex items-center justify-center p-4 text-center">
      <div>
        <div className="text-5xl mb-4">✓</div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Payment submitted</h1>
        <p className="text-gray-400 text-sm mb-6">Your bill has been marked as paid.</p>
        <button
          onClick={() => router.push('/')}
          className="bg-gray-900 text-white px-6 py-3 rounded-xl text-sm font-medium"
        >
          Back to Sorted
        </button>
      </div>
    </div>
  )
}

export default function PaySuccess() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-400">Loading...</p>
      </div>
    }>
      <PaySuccessContent />
    </Suspense>
  )
}
