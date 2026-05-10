'use client'

import { useMemo } from 'react'

import { KaraokeTranscript } from '@/components/audio-enriched/KaraokeTranscript'
import { StructuredWhiteboard } from '@/components/audio-enriched/StructuredWhiteboard'
import { useAudio } from '@/context/AudioContext'
import { useEnrichedTimeline } from '@/hooks/useEnrichedTimeline'
import { getActiveOrLastScene } from '@/lib/timeline/getActiveScene'
import type { Scene } from '@/lib/timeline/schema'

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

  // Continuité visuelle (décision produit Dr Fantin, T7.2 itération
  // post-smoke) : on étend la dernière scène connue à travers les gaps
  // inter-scènes et au-delà de la dernière scène jusqu'à la fin de l'audio.
  // Seul le gap initial avant la première scène déclenche l'affichage de
  // la cover (Q6 cas 5). Cf. `getActiveOrLastScene` dans
  // `src/lib/timeline/getActiveScene.ts`. Throttle 2 Hz inchangé.
  const displayedScene = useMemo(
    () => (timeline ? getActiveOrLastScene(state.currentTime, timeline.scenes) : null),
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
                displayedScene={displayedScene}
                timeline={timeline}
              />
            </div>
          ) : (
            // Tab "combined" — desktop : grid 2 colonnes (karaoké à gauche,
            // whiteboard à droite). Mobile : stack vertical, whiteboard en
            // haut, karaoké en bas (Q3).
            //
            // Le `<main className="flex-1 overflow-auto">` du admin layout
            // global crée un scroll container qui casse `position: sticky`
            // (cf. dette D7-10 dans le rapport T7.2). Stratégie alternative
            // adoptée : cap la hauteur du grid à `100vh - 32rem` (≈ DemoHeader
            // + TabSelector + AudioPlayer + paddings), activer un scroll
            // interne sur la colonne karaoké, garder la colonne whiteboard
            // overflow-hidden pour qu'elle reste intégralement visible.
            // `md:min-h-0` est obligatoire pour que `overflow-y-auto` fonctionne
            // dans un grid item (sinon `min-height: auto` impose la hauteur
            // du contenu et neutralise l'overflow).
            //
            // Mobile (variante A) : whiteboard sticky top-0 (le sticky se cale
            // sur le `<main overflow-auto>` admin, qui est le scroll container
            // effectif sur mobile). `md:static` neutralise le sticky sur
            // desktop pour préserver le internal-scroll layout. `bg-…` opaque
            // obligatoire — sans ça, le karaoké défilerait visiblement
            // derrière le whiteboard sticky.
            <div className="flex flex-col gap-6 md:grid md:grid-cols-2 md:gap-6 md:h-[calc(100vh-32rem)]">
              <div className="order-1 md:order-2 sticky top-0 z-10 bg-[color:var(--color-bg)] md:static md:min-h-0 md:overflow-hidden">
                <WhiteboardOrCover
                  displayedScene={displayedScene}
                  timeline={timeline}
                />
              </div>
              <div className="order-2 md:order-1 md:min-h-0 md:overflow-y-auto">
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
// Sous-composant : whiteboard quand une scène doit être affichée
// (active ou en extension via getActiveOrLastScene), placeholder
// texte sinon (uniquement le gap initial avant la première scène
// — Q6 cas 5). T7.3.1 : la cover image n'est plus rendue ici car
// `<AudioPlayer>` affiche déjà la cover (mobile au-dessus de la
// carte gradient, desktop à gauche), ce qui produisait une
// duplication visible en flow user (cf. dette D7-13 résolue T7.3.1).
// ──────────────────────────────────────────────────────────────

interface WhiteboardOrCoverProps {
  displayedScene: Scene | null
  timeline: NonNullable<ReturnType<typeof useEnrichedTimeline>['timeline']>
}

function WhiteboardOrCover({
  displayedScene,
  timeline,
}: WhiteboardOrCoverProps) {
  if (displayedScene) {
    // `<StructuredWhiteboard>` consomme `currentTime` uniquement pour
    // recalculer sa propre `getActiveScene` interne. Pour l'amener à
    // afficher la scène voulue (y compris pendant un gap où le vrai
    // `currentTime` audio ne tomberait dans aucune fenêtre), on lui
    // passe une valeur calée à l'intérieur de la fenêtre de la scène.
    // Pattern `start_sec + 0.5` déjà utilisé dans
    // `src/components/admin/timeline-editor/TimelinePreviewPanel.tsx`.
    const lockedCurrentTime = displayedScene.start_sec + 0.5
    return (
      <StructuredWhiteboard
        scenes={timeline.scenes}
        currentTime={lockedCurrentTime}
      />
    )
  }
  // POC-T7.4a-E — gap initial : 3 dots pulsants staggered (validation Dr Fantin).
  return (
    <div className="bg-[color:var(--color-bg-card)]/30 rounded-xl p-6 flex items-center justify-center min-h-[240px]">
      <div className="flex items-center gap-2 text-[color:var(--color-text-muted)]" role="status" aria-label="Visualisation à venir">
        <span className="w-2 h-2 rounded-full bg-current opacity-40 animate-pulse" />
        <span className="w-2 h-2 rounded-full bg-current opacity-40 animate-pulse" style={{ animationDelay: '200ms' }} />
        <span className="w-2 h-2 rounded-full bg-current opacity-40 animate-pulse" style={{ animationDelay: '400ms' }} />
      </div>
    </div>
  )
}
