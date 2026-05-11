'use client'

import { ShieldCheck } from 'lucide-react'
import { useValidationStatus } from '@/lib/hooks/useEditorialValidations'

interface ValidationFooterProps {
  formationId: string | null
}

const EDITORIAL_MENTION =
  'Production éditoriale Dentalschool — comité scientifique avec assistance IA'

function formatDateFR(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

export function ValidationFooter({ formationId }: ValidationFooterProps) {
  const { status, loading } = useValidationStatus('formation', formationId)

  // Pendant le chargement : on n'affiche rien (évite le flash)
  if (loading) return null

  // Si pas validé du tout (ou status null pour cause d'erreur) : silence total
  if (!status?.validated) return null

  const showBadge = status.is_stale !== true
  const validatedAt = status.validated_at ?? null

  return (
    <div className="mt-8 p-4 rounded-2xl border border-emerald-200 bg-emerald-50/40">
      <div className="flex items-start gap-3">
        <div className="shrink-0 mt-0.5">
          <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center">
            <ShieldCheck className="w-5 h-5 text-emerald-700" />
          </div>
        </div>
        <div className="flex-1 min-w-0">
          {showBadge && validatedAt && (
            <p className="text-sm font-semibold text-emerald-900">
              Validée par le conseil scientifique le {formatDateFR(validatedAt)}
            </p>
          )}
          <p className="text-xs text-gray-600 mt-1 leading-relaxed">
            {EDITORIAL_MENTION}
          </p>
        </div>
      </div>
    </div>
  )
}
