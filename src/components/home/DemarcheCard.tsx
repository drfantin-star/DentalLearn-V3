import React from 'react'
import type { DemarcheEnCours } from '@/lib/hooks/useDemarches'
import { getEppStatusBadgeLabel } from '@/lib/epp/eppTourStatus'
import Badge from '@/components/ui/Badge'
import FormationCardOverlay from '@/components/home/FormationCardOverlay'
import MediaCard from '@/components/home/MediaCard'
import type { MediaCardSize } from '@/components/home/MediaCard'
import EppCardBackground from '@/components/home/EppCardBackground'

interface DemarcheCardProps {
  demarche: DemarcheEnCours
  size?: MediaCardSize
}

// Pastille CTA — meme degrade teal que la carte EPP de "Reprendre"
// (cf. EppCardBackground), pour rester dans la meme famille visuelle.
const EPP_CTA_GRADIENT = 'linear-gradient(135deg, #0F766E, #2DD4BF)'

export default function DemarcheCard({ demarche, size = 'default' }: DemarcheCardProps) {
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

  // EPP card — meme gabarit que la tuile formation voisine (MediaCard,
  // taille par defaut : FormationCardOverlay ignore de toute facon son
  // prop `size`, cf. commentaire du fichier). Fond teal constant, badge de
  // statut en surimpression (seul endroit ou l'accent vert "valide"
  // apparait), CTA en pastille en bas — anatomie identique aux autres
  // tuiles media de l'app (NewsCardItem, etc.).
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

  return (
    <MediaCard
      onClick={() => { window.location.href = demarche.ctaUrl }}
      ariaLabel={demarche.title}
      aspect="landscape"
      fallback={<EppCardBackground />}
      topLeft={
        <Badge variant={isValidated ? 'success' : 'epp'} size="md">
          {badgeLabel}
        </Badge>
      }
    >
      <p
        style={{
          fontSize: '13px',
          fontWeight: 700,
          color: 'white',
          lineHeight: 1.25,
          textShadow: '0 2px 6px rgba(0,0,0,0.7)',
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
        }}
      >
        {demarche.title}
      </p>
      <div
        style={{
          background: EPP_CTA_GRADIENT,
          color: 'white',
          fontSize: '11px',
          fontWeight: 600,
          textAlign: 'center',
          padding: '5px 7px',
          borderRadius: '10px',
        }}
      >
        {demarche.ctaLabel}
      </div>
    </MediaCard>
  )
}
