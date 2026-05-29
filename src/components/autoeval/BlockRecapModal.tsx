'use client'

import type { BlockRecap, CbiBand, Palier } from '@/lib/autoeval/types'
import ResourceCard from './ResourceCard'

interface Props {
  recap: BlockRecap
  isLast: boolean
  onContinue: () => void
}

const BAND_COLOR: Record<CbiBand, string> = {
  low: 'text-emerald-400',
  moderate: 'text-amber-400',
  high: 'text-red-400',
}
const BAND_DOT: Record<CbiBand, string> = {
  low: 'bg-emerald-400',
  moderate: 'bg-amber-400',
  high: 'bg-red-400',
}
const PALIER_COLOR: Record<Palier, string> = {
  vert: 'text-emerald-400',
  orange: 'text-amber-400',
  rouge: 'text-red-400',
}
const PALIER_DOT: Record<Palier, string> = {
  vert: 'bg-emerald-400',
  orange: 'bg-amber-400',
  rouge: 'bg-red-400',
}
const PALIER_LABEL: Record<Palier, string> = {
  vert: 'Équilibre',
  orange: 'Vigilance',
  rouge: 'À surveiller',
}

/**
 * Recap affiché après chaque bloc. Enveloppe modale (rounded-3xl) cohérente avec
 * le player de séquence. AUCUN score « X/4 », aucun feedback bon/mauvais.
 */
export default function BlockRecapModal({ recap, isLast, onContinue }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 sm:items-center sm:p-4">
      <div className="flex max-h-[88vh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl bg-[#1a1a1a] sm:rounded-3xl">
        {/* Header */}
        <div className="bg-gradient-to-br from-[#EC4899] to-[#A78BFA] px-5 py-4">
          <p className="text-xs font-semibold text-white/80">Point d'étape</p>
          <h3 className="text-lg font-black text-white">{recap.titre}</h3>
        </div>

        {/* Body scrollable */}
        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-5">
          {recap.cbi?.map((sub) => (
            <div key={sub.key}>
              <div className="flex items-center gap-2">
                <span className={`h-2.5 w-2.5 rounded-full ${BAND_DOT[sub.band]}`} />
                <span className="text-sm font-bold text-white">{sub.label}</span>
                <span className={`ml-auto text-xs font-bold ${BAND_COLOR[sub.band]}`}>
                  {sub.bandLabel}
                </span>
              </div>
              {sub.message && (
                <p className="mt-1 pl-[18px] text-xs leading-relaxed text-[#d4d4d4]">{sub.message}</p>
              )}
            </div>
          ))}

          {recap.reflexif && (
            <div>
              <div className="flex items-center gap-2">
                <span className={`h-2.5 w-2.5 rounded-full ${PALIER_DOT[recap.reflexif.palier]}`} />
                <span className="text-sm font-bold text-white">État</span>
                <span className={`ml-auto text-xs font-bold ${PALIER_COLOR[recap.reflexif.palier]}`}>
                  {PALIER_LABEL[recap.reflexif.palier]}
                </span>
              </div>
              {recap.reflexif.message && (
                <p className="mt-1 text-xs leading-relaxed text-[#d4d4d4]">{recap.reflexif.message}</p>
              )}
            </div>
          )}

          {recap.substancesNeutralMessage && (
            <p className="rounded-2xl border border-[#333] bg-[#0F0F0F] p-3.5 text-xs italic leading-relaxed text-[#d4d4d4]">
              {recap.substancesNeutralMessage}
            </p>
          )}

          {recap.cards.length > 0 && (
            <div className="space-y-3 border-t border-[#2a2a2a] pt-4">
              {recap.cards.map((card) => (
                <ResourceCard key={card.key} card={card} />
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-[#2a2a2a] px-5 py-4">
          <button
            type="button"
            onClick={onContinue}
            className="w-full rounded-2xl bg-[#EC4899] py-3.5 text-sm font-bold text-white transition-opacity hover:opacity-90"
          >
            {isLast ? 'Voir ma synthèse' : 'Continuer'}
          </button>
        </div>
      </div>
    </div>
  )
}
