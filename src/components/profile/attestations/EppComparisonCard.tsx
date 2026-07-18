'use client'

import { useState } from 'react'
import { Download, TrendingUp, Calendar, Loader2 } from 'lucide-react'
import { downloadEppComparison, type EppComparison } from '@/lib/hooks/useEppComparisons'
import { axeHex } from '@/lib/cp/axeColors'

interface Props {
  comparison: EppComparison
  /** 'compact' : utilisé dans un EppAuditGroupCard, masque le bandeau/titre déjà affichés au niveau du groupe. */
  variant?: 'standalone' | 'compact'
}

export function EppComparisonCard({ comparison, variant = 'standalone' }: Props) {
  const [downloading, setDownloading] = useState(false)
  const isCompact = variant === 'compact'

  const scoreT1 = comparison.scoreT1 ?? 0
  const scoreT2 = comparison.scoreT2 ?? 0
  const delta = scoreT2 - scoreT1

  const formatDate = (iso: string | null) =>
    iso
      ? new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })
      : '—'

  const handleDownload = async () => {
    setDownloading(true)
    try {
      await downloadEppComparison(comparison)
    } catch (err) {
      console.error('Download comparison error:', err)
      alert('Impossible de generer le PDF du comparatif. Veuillez reessayer.')
    } finally {
      setDownloading(false)
    }
  }

  const cardClass = isCompact
    ? 'transition-premium'
    : 'glass-card transition-premium rounded-2xl overflow-hidden'

  return (
    <div className={cardClass}>
      {/* Header — masque en mode compact, redondant avec l'en-tete du groupe */}
      {!isCompact && (
        <div className="px-4 py-3" style={{ backgroundImage: `linear-gradient(135deg, ${axeHex(2)}, #0a5f54)` }}>
          <div className="flex items-center gap-2 text-white">
            <TrendingUp className="w-4 h-4" />
            <span className="text-xs font-semibold uppercase tracking-wide">
              Comparatif T1 / T2
            </span>
          </div>
        </div>
      )}

      {/* Corps */}
      <div className={isCompact ? 'p-3 space-y-2' : 'p-4 space-y-3'}>
        <div>
          <h3 className={isCompact ? 'text-xs font-semibold uppercase tracking-wide text-white/55' : 'font-bold text-white text-[15px] leading-tight'}>
            {isCompact ? 'Comparatif T1 / T2' : comparison.auditTitle}
          </h3>
          <p className="text-xs text-white/55 mt-0.5">EPP complète — Tour 1 et Tour 2</p>
        </div>

        <div className="flex flex-wrap gap-3 text-xs">
          <div className="flex items-center gap-1 text-white/70">
            <Calendar className="w-3.5 h-3.5" />
            <span>{formatDate(comparison.t2CompletedAt)}</span>
          </div>
          <div className="flex items-center gap-1 text-white/70">
            <span>T1 {scoreT1.toFixed(0)}%</span>
          </div>
          <div className="flex items-center gap-1 text-white/70">
            <span>T2 {scoreT2.toFixed(0)}%</span>
          </div>
          <div className={`flex items-center gap-1 font-medium ${delta >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            <TrendingUp className="w-3.5 h-3.5" />
            <span>{delta >= 0 ? '+' : ''}{delta.toFixed(0)}%</span>
          </div>
        </div>

        {/* Action */}
        <div className="pt-1">
          <button
            onClick={handleDownload}
            disabled={downloading}
            className="w-full flex items-center justify-center gap-2 bg-white text-gray-900 hover:bg-neutral-100 px-4 py-2.5 rounded-xl text-sm font-semibold transition-premium disabled:opacity-50"
          >
            {downloading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Generation…</span>
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                <span>Telecharger le comparatif (PDF)</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
