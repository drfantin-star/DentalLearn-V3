'use client'

import { useState } from 'react'
import { Mic, Headphones } from 'lucide-react'
import { useAudioPlayer } from '@/context/AudioPlayerContext'
import { HomeHeroCard } from './HomeHeroCard'
import { JournalDetailModal } from './JournalDetailModal'
import type { JournalEpisode } from '@/types/news'

interface Props {
  journal: JournalEpisode | null
}

function getWeekNumber(week_iso: string): string {
  // "2026-W19" → "19"
  return week_iso.split('-W')[1] ?? ''
}

// Gradient teal du Journal — conservé (non concerné par les couleurs interdites).
const JOURNAL_GRADIENT = 'linear-gradient(160deg, #0F766E, #0D9488)'

export function JournalWeekCard({ journal }: Props) {
  const [showModal, setShowModal] = useState(false)
  const { playTrack } = useAudioPlayer()

  // État vide — pas de journal publié
  if (!journal) {
    return (
      <HomeHeroCard
        surface="gradient"
        gradient={JOURNAL_GRADIENT}
        icon={<Mic size={26} />}
        eyebrow="Journal"
        title="Bientôt disponible"
        cta={{
          label: 'Écouter',
          icon: <Headphones size={15} />,
          onClick: () => {},
          disabled: true,
        }}
      />
    )
  }

  const weekNum = getWeekNumber(journal.week_iso)

  return (
    <>
      <HomeHeroCard
        surface="gradient"
        gradient={JOURNAL_GRADIENT}
        icon={<Mic size={26} />}
        eyebrow="Journal"
        title={`Semaine ${weekNum}`}
        cta={{
          label: 'Écouter',
          icon: <Headphones size={15} />,
          onClick: () =>
            playTrack({
              url: journal.audio_url,
              title: `Journal S${weekNum}`,
              duration_s: journal.duration_s,
              type: 'journal',
              episodeId: journal.id,
            }),
        }}
        infoAction={{
          onClick: () => setShowModal(true),
          ariaLabel: 'Détails du journal',
        }}
      />

      {showModal && (
        <JournalDetailModal journal={journal} onClose={() => setShowModal(false)} />
      )}
    </>
  )
}
