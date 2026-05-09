'use client'

import { useMemo } from 'react'

import { KaraokeTranscript } from '@/components/audio-enriched/KaraokeTranscript'
import { StructuredWhiteboard } from '@/components/audio-enriched/StructuredWhiteboard'
import { useAudio } from '@/context/AudioContext'
import { useEnrichedTimeline } from '@/hooks/useEnrichedTimeline'
import { getActiveScene } from '@/lib/timeline/getActiveScene'

import AudioPlayer from './AudioPlayer'

/**
 * <EnrichedAudioPlayer> — POC-T7.2.
 *
 * Wrapper *non invasif* autour de <AudioPlayer> existant. Rend l'AudioPlayer
 * inchangé puis, en sibling vertical, un panneau enrichi (karaoké +
 * whiteboard structuré) synchronisé sur `state.currentTime` exposé par
 * `useAudio()`.
 *
 * Contraintes (cf. matrice T7) :
 *  - Q3   : layout panneau enrichi *sous* AudioPlayer (mobile + desktop).
 *  - Q5   : lecture seule stricte sur AudioContext — aucun seekTo/playAudio
 *           appelé depuis ce composant ou ses enfants.
 *  - Q6   : fallback gracieux. Si `timeline_url == null`, `timeline_published
 *           !== true`, fetch timeline KO ou activeTab === 'audio_only', le
 *           panneau enrichi est masqué silencieusement (aucun toast user).
 *  - Q7.4 : `timeline_published === false` ⇒ pas d'enrichissement.
 *  - Q7.7 : `state.audioUrl !== src` ⇒ panneau enrichi masqué (cas où une
 *           autre piste joue dans le MiniPlayer global).
 *
 * En T7.2 ce composant est rendu uniquement par la page démo
 * `/admin/poc/enriched-player/[type]/[id]`. Son intégration dans
 * `SequencePlayer.tsx` est le ticket T7.3.
 */

export type EnrichedPlayerTab = 'combined' | 'whiteboard' | 'audio_only'

interface EnrichedAudioPlayerProps {
  // Inputs primaires (= ce que SequencePlayer passe déjà à <AudioPlayer>).
  src: string
  duration: number
  sequenceId: string
  onComplete: () => void
  onProgress: (percent: number) => void
  accentColor?: string
  accentColorSecondary?: string
  sequenceTitle?: string
  formationTitle?: string
  learningObjectives?: string[] | null
  coverImageUrl?: string | null
  userId?: string

  // Métadonnées d'enrichissement (Q7.3).
  timelineUrl: string | null
  timelinePublished: boolean

  // Mode d'affichage du panneau enrichi (Q2). Le wrapper dérive
  // `enrichmentEnabled` de `activeTab`.
  activeTab: EnrichedPlayerTab
}

export default function EnrichedAudioPlayer({
  src,
  duration,
  sequenceId,
  onComplete,
  onProgress,
  accentColor,
  accentColorSecondary,
  sequenceTitle,
  formationTitle,
  learningObjectives,
  coverImageUrl,
  userId,
  timelineUrl,
  timelinePublished,
  activeTab,
}: EnrichedAudioPlayerProps) {
  // Lecture seule — Q5. Aucune méthode d'écriture du context n'est extraite.
  const { state } = useAudio()

  // Q7.7 : la piste qui joue dans l'AudioContext doit être celle de cette
  // séquence pour que le karaoké/whiteboard ait un sens.
  const isCurrentTrack = state.audioUrl === src

  // Q4 : panneau enrichi masqué quand l'utilisateur a sélectionné "Audio
  // seul". Équivaut à `enrichmentEnabled = false`.
  const enrichmentEnabled = activeTab !== 'audio_only'

  const hasTimeline =
    typeof timelineUrl === 'string' &&
    timelineUrl.length > 0 &&
    timelinePublished === true

  // Le hook gère son propre cache mémoire et son cycle de vie. On ne fetch
  // que si on a effectivement besoin du panneau enrichi pour cette piste.
  const shouldFetchTimeline = enrichmentEnabled && hasTimeline && isCurrentTrack
  const { timeline, isLoading, error } = useEnrichedTimeline(
    shouldFetchTimeline ? timelineUrl : null
  )

  // Q6 (gap avant scène 1 / entre scènes / après dernière scène) :
  // `getActiveScene` retourne null hors fenêtre, on rend la cover dans ce
  // cas plutôt que le placeholder texte natif du whiteboard. Throttle 2 Hz.
  const activeScene = useMemo(
    () => (timeline ? getActiveScene(state.currentTime, timeline.scenes) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [Math.floor(state.currentTime * 2), timeline]
  )

  // Décision finale d'affichage du panneau enrichi (Q6 + Q7.4 + Q7.7).
  const showEnrichedPanel =
    enrichmentEnabled &&
    hasTimeline &&
    isCurrentTrack &&
    !error &&
    !isLoading &&
    timeline !== null

  return (
    <div className="w-full">
      {/* Player audio — INCHANGÉ. Aucune prop modifiée. */}
      <AudioPlayer
        src={src}
        duration={duration}
        sequenceId={sequenceId}
        onComplete={onComplete}
        onProgress={onProgress}
        accentColor={accentColor}
        accentColorSecondary={accentColorSecondary}
        sequenceTitle={sequenceTitle}
        formationTitle={formationTitle}
        learningObjectives={learningObjectives}
        coverImageUrl={coverImageUrl}
        userId={userId}
      />

      {showEnrichedPanel && timeline && (
        <div className="mt-6">
          {activeTab === 'whiteboard' ? (
            <div className="w-full">
              <WhiteboardOrCover
                hasActiveScene={Boolean(activeScene)}
                timeline={timeline}
                currentTime={state.currentTime}
                coverImageUrl={coverImageUrl}
                title={sequenceTitle}
              />
            </div>
          ) : (
            // Tab "combined" — desktop : grid 2 colonnes (karaoké à gauche,
            // whiteboard à droite). Mobile : stack vertical, whiteboard en
            // haut, karaoké en bas (Q3).
            <div className="flex flex-col gap-6 md:grid md:grid-cols-2 md:items-start md:gap-6">
              <div className="order-1 md:order-2">
                <WhiteboardOrCover
                  hasActiveScene={Boolean(activeScene)}
                  timeline={timeline}
                  currentTime={state.currentTime}
                  coverImageUrl={coverImageUrl}
                  title={sequenceTitle}
                />
              </div>
              <div className="order-2 md:order-1">
                <KaraokeTranscript
                  transcript={timeline.transcript}
                  currentTime={state.currentTime}
                />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ──────────────────────────────────────────────────────────────
// Sous-composant : whiteboard quand une scène est active, cover
// sinon (Q6 — gap avant scène 1 / entre scènes / après dernière).
// ──────────────────────────────────────────────────────────────

interface WhiteboardOrCoverProps {
  hasActiveScene: boolean
  timeline: NonNullable<ReturnType<typeof useEnrichedTimeline>['timeline']>
  currentTime: number
  coverImageUrl?: string | null
  title?: string
}

function WhiteboardOrCover({
  hasActiveScene,
  timeline,
  currentTime,
  coverImageUrl,
  title,
}: WhiteboardOrCoverProps) {
  if (hasActiveScene) {
    return (
      <StructuredWhiteboard
        scenes={timeline.scenes}
        currentTime={currentTime}
      />
    )
  }
  return (
    <div className="bg-[color:var(--color-bg-card)]/30 rounded-xl p-6 flex items-center justify-center min-h-[240px]">
      {coverImageUrl ? (
        <img
          src={coverImageUrl}
          alt={title ?? 'Cover'}
          className="max-h-[240px] w-auto rounded-lg object-contain"
        />
      ) : (
        <p className="text-sm italic text-[color:var(--color-text-muted)]">
          Visualisation suivante à venir…
        </p>
      )}
    </div>
  )
}
