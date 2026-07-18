'use client'

import { useState } from 'react'
import { Download, ClipboardList, Calendar, Target, Loader2 } from 'lucide-react'
import { downloadEppActionPlan, type EppActionPlan } from '@/lib/hooks/useEppActionPlans'
import { axeHex } from '@/lib/cp/axeColors'

interface Props {
  plan: EppActionPlan
  /** 'compact' : utilisé dans un EppAuditGroupCard, masque le bandeau/titre déjà affichés au niveau du groupe. */
  variant?: 'standalone' | 'compact'
}

export function EppActionPlanCard({ plan, variant = 'standalone' }: Props) {
  const [downloading, setDownloading] = useState(false)
  const isCompact = variant === 'compact'

  const nbAxes = Object.values(plan.planActions).filter(
    (e) => (e?.text && e.text.trim().length > 0) || (e?.checked_suggestion_ids?.length ?? 0) > 0
  ).length

  const formatDate = (iso: string | null) =>
    iso
      ? new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })
      : '—'

  const handleDownload = async () => {
    setDownloading(true)
    try {
      await downloadEppActionPlan(plan)
    } catch (err) {
      console.error('Download plan error:', err)
      alert('Impossible de generer le PDF du plan d\'actions. Veuillez reessayer.')
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
            <ClipboardList className="w-4 h-4" />
            <span className="text-xs font-semibold uppercase tracking-wide">
              Plan d&apos;actions EPP
            </span>
          </div>
        </div>
      )}

      {/* Corps */}
      <div className={isCompact ? 'p-3 space-y-2' : 'p-4 space-y-3'}>
        <div>
          <h3 className={isCompact ? 'text-xs font-semibold uppercase tracking-wide text-white/55' : 'font-bold text-white text-[15px] leading-tight'}>
            {isCompact ? "Plan d'actions" : plan.auditTitle}
          </h3>
          <p className="text-xs text-white/55 mt-0.5">Tour 1 — Actions d&apos;amelioration</p>
        </div>

        <div className="flex flex-wrap gap-3 text-xs">
          <div className="flex items-center gap-1 text-white/70">
            <Calendar className="w-3.5 h-3.5" />
            <span>{formatDate(plan.completedAt)}</span>
          </div>
          {plan.scoreGlobal !== null && (
            <div className="flex items-center gap-1 text-white/70">
              <Target className="w-3.5 h-3.5" />
              <span>Score T1 {plan.scoreGlobal}%</span>
            </div>
          )}
          {nbAxes > 0 && (
            <div className="flex items-center gap-1 text-emerald-400 font-medium">
              <ClipboardList className="w-3.5 h-3.5" />
              <span>{nbAxes} axe{nbAxes > 1 ? 's' : ''} d&apos;amelioration</span>
            </div>
          )}
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
                <span>Telecharger le plan (PDF)</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
