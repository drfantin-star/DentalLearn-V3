'use client'

import { useState } from 'react'
import { Check, X, Loader2 } from 'lucide-react'

interface QuestionApprovalButtonProps {
  questionId: string
  initialApproved: boolean
  onChange?: (newValue: boolean) => void
  size?: 'sm' | 'md'
}

export function QuestionApprovalButton({
  questionId,
  initialApproved,
  onChange,
  size = 'md',
}: QuestionApprovalButtonProps) {
  const [approved, setApproved] = useState(initialApproved)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const toggle = async () => {
    setLoading(true)
    setError(null)
    const newValue = !approved
    try {
      const res = await fetch(
        `/api/admin/news/questions/${questionId}/approve`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ is_daily_quiz_eligible: newValue }),
        }
      )
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || `Erreur ${res.status}`)
      }
      setApproved(newValue)
      onChange?.(newValue)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur')
    } finally {
      setLoading(false)
    }
  }

  const sizeClasses =
    size === 'sm' ? 'px-2 py-1 text-xs' : 'px-3 py-1.5 text-sm'

  const stateClasses = approved
    ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={toggle}
        disabled={loading}
        title={approved ? 'Cliquer pour désapprouver' : 'Cliquer pour approuver'}
        className={`inline-flex items-center gap-1.5 rounded-full font-medium transition-colors disabled:opacity-50 ${sizeClasses} ${stateClasses}`}
      >
        {loading ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : approved ? (
          <Check className="w-3.5 h-3.5" />
        ) : (
          <X className="w-3.5 h-3.5" />
        )}
        {approved ? 'Approuvée' : 'En attente'}
      </button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  )
}
