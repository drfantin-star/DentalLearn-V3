'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Award, Loader2, AlertCircle } from 'lucide-react'

interface Props {
  type: 'formation_online' | 'epp'
  sourceId: string
  label?: string
  className?: string
  onGenerated?: (attestationId: string) => void
}

export function GenerateAttestationButton({
  type,
  sourceId,
  label,
  className,
  onGenerated,
}: Props) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [rppsMissing, setRppsMissing] = useState(false)
  const router = useRouter()

  const handleClick = async () => {
    setLoading(true)
    setError(null)
    setRppsMissing(false)

    try {
      const res = await fetch('/api/attestations/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, source_id: sourceId }),
      })

      const data = await res.json()

      if (!res.ok) {
        if (data.error === 'RPPS_MISSING') {
          setRppsMissing(true)
          return
        }
        throw new Error(data.message || data.error || 'Erreur inconnue')
      }

      if (data.success || data.already_exists) {
        onGenerated?.(data.attestation_id)
        router.push('/profil/attestations')
      }
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  if (rppsMissing) {
    return (
      <div className="bg-amber-900/20 border border-amber-700/40 rounded-xl p-4 space-y-3">
        <div className="flex items-start gap-2 text-amber-300">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold">N° RPPS requis</p>
            <p className="text-xs text-amber-200/80 mt-1">
              Votre numéro RPPS est nécessaire pour générer votre attestation officielle.
              Complétez votre profil pour continuer.
            </p>
          </div>
        </div>
        <button
          onClick={() => router.push('/profil/edit')}
          className="w-full bg-amber-600 hover:bg-amber-500 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
        >
          Compléter mon profil
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <button
        onClick={handleClick}
        disabled={loading}
        className={
          className ??
          'w-full flex items-center justify-center gap-2 bg-white text-[#0a0a0a] hover:bg-[#e5e5e5] px-4 py-3 rounded-xl text-sm font-semibold transition-colors disabled:opacity-60'
        }
      >
        {loading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Génération en cours…</span>
          </>
        ) : (
          <>
            <Award className="w-4 h-4" />
            <span>{label ?? 'Obtenir mon attestation'}</span>
          </>
        )}
      </button>
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  )
}
