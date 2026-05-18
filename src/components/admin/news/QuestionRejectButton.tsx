'use client'

import { useState } from 'react'
import { Trash2, Loader2 } from 'lucide-react'

interface QuestionRejectButtonProps {
  questionId: string
  onDeleted?: () => void
  size?: 'sm' | 'md'
}

export function QuestionRejectButton({
  questionId,
  onDeleted,
  size = 'md',
}: QuestionRejectButtonProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const reject = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/admin/news/questions/${questionId}`, {
        method: 'DELETE',
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || `Erreur ${res.status}`)
      }
      onDeleted?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur')
      setLoading(false)
    }
  }

  const sizeClasses =
    size === 'sm' ? 'px-2 py-1 text-xs' : 'px-3 py-1.5 text-sm'

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={reject}
        disabled={loading}
        title="Rejeter et supprimer définitivement la question"
        className={`inline-flex items-center gap-1.5 rounded-full font-medium transition-colors disabled:opacity-50 bg-red-100 text-red-700 hover:bg-red-200 ${sizeClasses}`}
      >
        {loading ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : (
          <Trash2 className="w-3.5 h-3.5" />
        )}
        Rejeter
      </button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  )
}
