'use client'

import { ShieldCheck } from 'lucide-react'
import { useValidationStatus } from '@/lib/hooks/useEditorialValidations'

interface ValidationBadgeNewsProps {
  episodeId: string | null
}

function formatDateFR(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

export function ValidationBadgeNews({ episodeId }: ValidationBadgeNewsProps) {
  const { status } = useValidationStatus('news_episode', episodeId)

  if (!status?.validated || status.is_stale) return null
  if (!status.validated_at) return null

  return (
    <div className="flex items-center gap-1.5 text-xs text-emerald-400 mt-0.5">
      <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
      <span className="truncate">
        Validée par notre comité éditorial le {formatDateFR(status.validated_at)}
      </span>
    </div>
  )
}
