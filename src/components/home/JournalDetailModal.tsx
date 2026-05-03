'use client'

import { X, Play, ExternalLink } from 'lucide-react'
import { useAudioPlayer } from '@/context/AudioPlayerContext'
import { NEWS_SPECIALITE_LABELS } from '@/lib/constants/news'
import type { JournalEpisode } from '@/types/news'

interface Props {
  journal: JournalEpisode
  onClose: () => void
}

function getWeekNumber(week_iso: string): string {
  return week_iso.split('-W')[1] ?? ''
}

function formatDuration(seconds: number): string {
  if (!seconds) return ''
  const m = Math.round(seconds / 60)
  return `${m} min`
}

export function JournalDetailModal({ journal, onClose }: Props) {
  const { playTrack } = useAudioPlayer()
  const weekNum = getWeekNumber(journal.week_iso)
  const durationLabel = formatDuration(journal.duration_s)

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-gray-900 rounded-t-3xl sm:rounded-3xl w-full max-w-2xl max-h-[85vh] overflow-y-auto p-6 pb-8"
        onClick={(e) => e.stopPropagation()}
      >
        {/* En-tête */}
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-teal-400 text-sm font-bold">🎙️ Journal de la semaine</span>
            </div>
            <h2 className="text-white font-bold text-xl leading-tight">
              Semaine {weekNum}
            </h2>
            <p className="text-gray-400 text-sm mt-1">
              {journal.syntheses.length} articles
              {durationLabel ? ` · ${durationLabel}` : ''}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors ml-4 shrink-0"
            aria-label="Fermer"
          >
            <X size={22} />
          </button>
        </div>

        {/* Sommaire */}
        <div className="mb-5">
          <h3 className="text-gray-300 text-xs font-bold uppercase tracking-wider mb-3">
            Au sommaire
          </h3>
          <div className="space-y-2">
            {journal.syntheses.map((s) => (
              <div key={s.position} className="flex items-start gap-3">
                <span className="text-teal-400 font-bold text-sm shrink-0 w-4">
                  {s.position}.
                </span>
                <div className="flex-1 min-w-0">
                  {s.specialite && (
                    <span className="text-[10px] font-bold text-teal-300 bg-teal-900/40 rounded-full px-2 py-0.5 mr-2">
                      {NEWS_SPECIALITE_LABELS[s.specialite] ?? s.specialite}
                    </span>
                  )}
                  <p className="text-gray-200 text-sm mt-0.5 leading-snug">
                    {s.display_title ?? '(sans titre)'}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Résumé du premier article comme accroche */}
        {journal.syntheses[0]?.summary_fr && (
          <div className="mb-5">
            <h3 className="text-gray-300 text-xs font-bold uppercase tracking-wider mb-2">
              À la une
            </h3>
            <p className="text-gray-300 text-sm leading-relaxed line-clamp-4">
              {journal.syntheses[0].summary_fr}
            </p>
          </div>
        )}

        {/* Sources */}
        {journal.syntheses.some((s) => s.source_url || s.journal_name) && (
          <div className="mb-6">
            <h3 className="text-gray-300 text-xs font-bold uppercase tracking-wider mb-2">
              Sources
            </h3>
            <div className="space-y-1">
              {journal.syntheses.map((s) =>
                s.source_url || s.journal_name ? (
                  <div key={s.position} className="flex items-center gap-2">
                    <span className="text-gray-500 text-xs w-4 shrink-0">{s.position}.</span>
                    {s.source_url ? (
                      <a
                        href={s.source_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-teal-400 text-xs hover:text-teal-300 flex items-center gap-1"
                      >
                        {s.journal_name ?? s.source_url}
                        <ExternalLink size={10} />
                      </a>
                    ) : (
                      <span className="text-gray-400 text-xs">{s.journal_name}</span>
                    )}
                  </div>
                ) : null,
              )}
            </div>
          </div>
        )}

        {/* Player audio HTML5 — pas de contrôle vitesse (contrainte produit) */}
        <div className="mb-6">
          <audio
            controls
            src={journal.audio_url}
            className="w-full"
            style={{ height: '40px' }}
          />
        </div>

        {/* Boutons */}
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => {
              playTrack({
                url: journal.audio_url,
                title: `Journal S${weekNum}`,
                duration_s: journal.duration_s,
                type: 'journal',
                episodeId: journal.id,
              })
              onClose()
            }}
            className="flex-1 bg-teal-600 hover:bg-teal-500 text-white font-bold py-3 rounded-2xl flex items-center justify-center gap-2 transition-colors"
          >
            <Play size={16} fill="white" />
            Écouter le journal
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-3 rounded-2xl border border-gray-600 text-gray-300 hover:border-gray-400 transition-colors text-sm font-medium"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  )
}
