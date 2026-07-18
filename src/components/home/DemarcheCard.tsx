import React from 'react'
import { ArrowRight } from 'lucide-react'
import type { DemarcheEnCours } from '@/lib/hooks/useDemarches'
import { getEppStatusBadgeLabel } from '@/lib/epp/eppTourStatus'
import { axeBannerStyle } from '@/lib/cp/axeColors'
import FormationCardOverlay from '@/components/home/FormationCardOverlay'
import { mediaCardSizeStyle } from '@/components/home/MediaCard'
import type { MediaCardSize } from '@/components/home/MediaCard'

interface DemarcheCardProps {
  demarche: DemarcheEnCours
  size?: MediaCardSize
  /** 'carousel' (defaut) : largeur fixe (Mes demarches en cours). 'grid' : remplit sa cellule (page thematique). */
  layout?: 'carousel' | 'grid'
}

export default function DemarcheCard({ demarche, size = 'default', layout = 'carousel' }: DemarcheCardProps) {
  // --- Formation cards: landscape ---
  if (demarche.type === 'formation') {
    const formation = {
      id: demarche.id,
      title: demarche.title,
      category: demarche.category ?? '',
      cover_image_url: demarche.coverImageUrl ?? null,
      slug: demarche.ctaUrl.split('/').pop() ?? '',
    } as any

    const progress = {
      isStarted: true,
      isCompleted: demarche.subtitle?.includes('Terminé') || false,
    }

    return (
      <FormationCardOverlay
        formation={formation}
        progress={progress}
        aspect="landscape"
        size={size}
        onClick={() => { window.location.href = demarche.ctaUrl }}
      />
    )
  }

  // EPP card — modele "carte home" (badge de statut / titre dominant qui
  // remplit / CTA pleine largeur en bas), identique sur toutes les surfaces.
  // Etat derive en priorite de `eppStatus` (source unique de verite, cf.
  // src/lib/epp/eppTourStatus.ts) ; repli sur le texte du subtitle si un
  // appelant ne le fournit pas encore.
  const eppStatus = demarche.eppStatus
  const isValidated = eppStatus
    ? eppStatus === 'completed'
    : demarche.subtitle?.includes('validé') || false
  const badgeLabel = eppStatus
    ? getEppStatusBadgeLabel(eppStatus)
    : demarche.subtitle || 'Audit EPP'

  // Fond : couleur d'axe existante (axe 2 = EPP) pour les etats en cours,
  // classes Tailwind emerald (deja la convention "valide" du reste de
  // l'app) pour l'etat complete — aucun nouveau litteral hex.
  const outerStyle: React.CSSProperties = layout === 'carousel'
    ? { ...mediaCardSizeStyle('landscape', size), aspectRatio: undefined, minHeight: 190 }
    : {}
  if (!isValidated) {
    outerStyle.background = axeBannerStyle(2)
  }

  return (
    <div
      className={[
        'relative flex flex-col min-w-0 rounded-2xl p-4 shadow-md overflow-hidden',
        layout === 'carousel' ? 'flex-shrink-0 snap-start' : 'w-full h-full min-h-[190px]',
        isValidated ? 'bg-gradient-to-br from-emerald-600 to-emerald-500' : '',
      ].join(' ')}
      style={{ border: '0.5px solid #333', ...outerStyle }}
    >
      <p className="text-xs font-bold uppercase tracking-widest text-white/70">
        {badgeLabel}
      </p>
      <div className="flex flex-1 items-center">
        <h3 className="text-2xl font-semibold leading-tight text-white line-clamp-2">
          {demarche.title}
        </h3>
      </div>
      <button
        type="button"
        onClick={() => { window.location.href = demarche.ctaUrl }}
        className="w-full rounded-xl flex items-center justify-center gap-1.5 font-bold transition-colors py-3 text-sm bg-white/20 text-white hover:bg-white/30 active:bg-white/40"
      >
        {demarche.ctaLabel}
        <ArrowRight size={16} />
      </button>
    </div>
  )
}
