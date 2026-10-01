'use client'

import { useState } from 'react'
import { useAudioPlayer } from '@/context/AudioPlayerContext'
import { HomeFeedCard } from './HomeFeedCard'
import { JournalDetailModal } from './JournalDetailModal'
import type { JournalEpisode } from '@/types/news'

interface Props {
  journal: JournalEpisode | null
}

// Libellé fixe depuis le 01/10/2026, au lieu de « Semaine {N} » dérivé de
// week_iso. Le numéro de semaine affiché est celui de l'épisode, pas celui du
// jour : dès que la publication prend du retard, la carte annonce une semaine
// passée et paraît cassée. Pire, l'aligner sur la semaine courante
// présenterait un épisode ancien comme l'actualité de cette semaine, ce qui
// serait faux pour le praticien. Un libellé sans date ne promet rien et reste
// juste dans les deux cas. La date réelle de publication reste disponible en
// base (week_iso, published_at) et dans l'admin.
const JOURNAL_LABEL = 'Journal de la semaine'

export function JournalWeekCard({ journal }: Props) {
  const [showModal, setShowModal] = useState(false)
  const { playTrack } = useAudioPlayer()

  const icon = (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/images/sophie-certily-journal.webp"
      alt=""
      aria-hidden
      className="h-full w-full object-cover"
    />
  )

  if (!journal) {
    return (
      <HomeFeedCard
        accent="amber"
        eyebrow="Journal"
        title="Bientot disponible"
        icon={icon}
        onClick={() => {}}
        ariaLabel="Journal hebdo — bientot disponible"
        disabled
      />
    )
  }

  return (
    <>
      <HomeFeedCard
        accent="amber"
        eyebrow="Journal"
        title={JOURNAL_LABEL}
        icon={icon}
        onClick={() =>
          playTrack({
            url: journal.audio_url,
            title: JOURNAL_LABEL,
            duration_s: journal.duration_s,
            type: 'journal',
            episodeId: journal.id,
          })
        }
        ariaLabel="Ecouter le journal de la semaine"
        infoAction={{
          onClick: () => setShowModal(true),
          ariaLabel: 'Details du journal',
        }}
      />

      {showModal && (
        <JournalDetailModal journal={journal} onClose={() => setShowModal(false)} />
      )}
    </>
  )
}
