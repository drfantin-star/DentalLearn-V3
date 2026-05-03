'use client'

import { Play, Info } from 'lucide-react'
import { useState } from 'react'
import { useAudioPlayer } from '@/context/AudioPlayerContext'
import { JournalDetailModal } from './JournalDetailModal'
import type { JournalEpisode } from '@/types/news'

interface Props {
  journal: JournalEpisode | null
}

function getWeekNumber(week_iso: string): string {
  // "2026-W19" → "19"
  return week_iso.split('-W')[1] ?? ''
}

function formatDuration(seconds: number): string {
  if (!seconds) return ''
  const m = Math.round(seconds / 60)
  return `${m} min`
}

export function JournalWeekCard({ journal }: Props) {
  const [showModal, setShowModal] = useState(false)
  const { playTrack } = useAudioPlayer()

  // État vide — pas de journal publié
  if (!journal) {
    return (
      <div
        className="flex-1 aspect-square rounded-2xl bg-gray-800/60 border border-gray-700/50 flex flex-col items-center justify-center gap-1 p-3"
      >
        <span className="text-2xl">🎙️</span>
        <p className="text-xs text-gray-400 font-semibold text-center">
          Journal
        </p>
        <p className="text-[10px] text-gray-500 text-center leading-tight">
          Bientôt disponible
        </p>
      </div>
    )
  }

  const weekNum = getWeekNumber(journal.week_iso)
  const durationLabel = formatDuration(journal.duration_s)

  return (
    <>
      <div className="flex-1 aspect-square rounded-2xl bg-gradient-to-br from-[#0D9488] to-[#0F766E] flex flex-col justify-between p-3 shadow-md">
        <div>
          <span className="text-xs font-bold text-teal-100 uppercase tracking-wide">
            🎙️ Journal
          </span>
          <p className="text-white font-bold text-sm mt-1 leading-tight">
            Semaine {weekNum}
          </p>
          <p className="text-teal-200 text-[11px] mt-0.5">
            {journal.syntheses.length} articles
            {durationLabel ? ` · ${durationLabel}` : ''}
          </p>
        </div>

        <div className="flex gap-1.5">
          <button
            type="button"
            onClick={() =>
              playTrack({
                url: journal.audio_url,
                title: `Journal S${weekNum}`,
                duration_s: journal.duration_s,
                type: 'journal',
                episodeId: journal.id,
              })
            }
            className="flex-1 bg-white/20 hover:bg-white/30 active:bg-white/40 rounded-xl py-1.5 flex items-center justify-center gap-1 text-white text-xs font-bold transition-colors"
          >
            <Play size={11} fill="white" className="shrink-0" />
            Écouter
          </button>

          <button
            type="button"
            onClick={() => setShowModal(true)}
            className="bg-white/20 hover:bg-white/30 active:bg-white/40 rounded-xl px-2.5 flex items-center justify-center transition-colors"
            aria-label="Détails du journal"
          >
            <Info size={13} className="text-white" />
          </button>
        </div>
      </div>

      {showModal && (
        <JournalDetailModal
          journal={journal}
          onClose={() => setShowModal(false)}
        />
      )}
    </>
  )
}
