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

const JOURNAL_GRADIENT = '#0F766E'
const JOURNAL_COVER = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/ui-assets/home-card-journal-hebdo.webp`

export function JournalWeekCard({ journal }: Props) {
  const [showModal, setShowModal] = useState(false)
  const { playTrack } = useAudioPlayer()

  // Etat vide — pas de journal publie
  if (!journal) {
    return (
      <HomeHeroCard
        surface="gradient"
        gradient={JOURNAL_GRADIENT}
        backgroundImage={JOURNAL_COVER}
        imageAnimation="sway"
        imageGlowClass="glow-accent"
        icon={<Mic size={26} />}
        eyebrow="Journal"
        title="Bientot disponible"
        compact
        cta={{
          label: 'Ecouter',
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
        backgroundImage={JOURNAL_COVER}
        imageAnimation="sway"
        imageGlowClass="glow-accent"
        icon={<Mic size={26} />}
        eyebrow="Journal"
        title={`Semaine ${weekNum}`}
        compact
        cta={{
          label: 'Ecouter',
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
          ariaLabel: 'Details du journal',
        }}
      />

      {showModal && (
        <JournalDetailModal journal={journal} onClose={() => setShowModal(false)} />
      )}
    </>
  )
}
