'use client'

import { useState } from 'react'
import { RefreshCw, Loader2, CheckCircle, AlertCircle } from 'lucide-react'

interface RetryButtonProps {
  synthesisId: string
  onSuccess?: () => void
}

type Result =
  | { type: 'success'; message: string }
  | { type: 'error'; message: string }

export function RetryButton({ synthesisId, onSuccess }: RetryButtonProps) {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<Result | null>(null)

  const handleRetry = async () => {
    if (loading) return
    if (result?.type === 'success') return

    setLoading(true)
    setResult(null)
    try {
      const res = await fetch(
        `/api/admin/news/syntheses/${synthesisId}/retry`,
        { method: 'POST' }
      )
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || `Erreur ${res.status}`)
      }
      setResult({ type: 'success', message: data.message || 'Reset effectué' })
      onSuccess?.()
    } catch (err) {
      setResult({
        type: 'error',
        message: err instanceof Error ? err.message : 'Erreur',
      })
    } finally {
      setLoading(false)
    }
  }

  if (result?.type === 'success') {
    return (
      <div
        className="inline-flex items-center gap-2 px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-lg text-sm"
        title={result.message}
      >
        <CheckCircle className="w-4 h-4" />
        <span className="font-medium">Reset effectué</span>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <button
        onClick={handleRetry}
        disabled={loading}
        className="inline-flex items-center gap-2 px-3 py-1.5 bg-[#2D1B96] hover:bg-[#231575] text-white rounded-lg text-sm font-medium disabled:opacity-50 transition-colors"
      >
        {loading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <RefreshCw className="w-4 h-4" />
        )}
        {loading ? 'Reset…' : 'Retry'}
      </button>
      {result?.type === 'error' && (
        <div className="inline-flex items-start gap-1.5 text-xs text-red-600">
          <AlertCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
          <span>{result.message}</span>
        </div>
      )}
    </div>
  )
}
