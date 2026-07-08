'use client'

import { useState } from 'react'
import { useAudioPlayer } from '@/context/AudioPlayerContext'
import { HomeFeedCard } from './HomeFeedCard'
import { JournalDetailModal } from './JournalDetailModal'
import type { JournalEpisode } from '@/types/news'

interface Props {
  journal: JournalEpisode | null
}

function getWeekNumber(week_iso: string): string {
  // "2026-W19" → "19"
  return week_iso.split('-W')[1] ?? ''
}

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

  const weekNum = getWeekNumber(journal.week_iso)

  return (
    <>
      <HomeFeedCard
        accent="amber"
        eyebrow="Journal"
        title={`Semaine ${weekNum}`}
        icon={icon}
        onClick={() =>
          playTrack({
            url: journal.audio_url,
            title: `Journal S${weekNum}`,
            duration_s: journal.duration_s,
            type: 'journal',
            episodeId: journal.id,
          })
        }
        ariaLabel={`Ecouter le journal de la semaine ${weekNum}`}
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
