'use client'

import { useMemo } from 'react'
import { Play } from 'lucide-react'

import { ConceptCard } from '@/components/audio-enriched/ConceptCard'
import { KaraokeTranscript } from '@/components/audio-enriched/KaraokeTranscript'
import { StructuredWhiteboard } from '@/components/audio-enriched/StructuredWhiteboard'
import { useAudio } from '@/context/AudioContext'
import { useEnrichedTimeline } from '@/hooks/useEnrichedTimeline'
import {
  getActiveConcept,
  getActiveOrLastScene,
  getActiveScene,
  type DisplayableConcept,
} from '@/lib/timeline/getActiveScene'
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

  // POC-T7.4-UX-B (D-UX-2) : si true, masque la card gros player legacy
  // (`<AudioPlayer>`) quand le panneau enrichi est censé s'afficher. Le
  // MiniPlayer global (`(app)/layout.tsx`) prend alors le relais une fois
  // la lecture lancée. Fallback legacy préservé : non-enriched (audio_only
  // tab), pas de timeline, ou erreur fetch ⇒ card legacy reste visible.
  hideLegacyCardWhenEnriched?: boolean

  // POC-T7.4-UX-FAB (Q-stop-1) : callback de demande de lecture. Q5 reste
  // strictement respecté (le wrapper ne fait pas l'appel `playAudio` lui-même
  // — c'est le parent SequencePlayer qui détient `useAudio().playAudio` et
  // décide). Le wrapper rend un FAB Play overlay quand le legacy est masqué
  // et que la track n'a pas encore démarré. Une fois `state.audioUrl === src`,
  // le FAB disparaît et le panneau enrichi prend le relais.
  onPlayRequest?: () => void
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
  hideLegacyCardWhenEnriched = false,
  onPlayRequest,
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
  //
  // T7-bis (mode hybride) : priorité concept sur extension de scène. Quand
  // on n'est pas dans une fenêtre [start_sec, end_sec] stricte d'une scène
  // mais qu'un concept "passé" (at_sec ≤ currentTime) est disponible,
  // on affiche `<ConceptCard>` plutôt que d'étendre la dernière scène.
  // L'extension `getActiveOrLastScene` ne s'applique que si aucun concept
  // n'est disponible — préserve le fallback T7.2 pour timelines T2 sans
  // concepts (`concepts[]` vide ou tous incomplets).
  const strictActiveScene = useMemo(
    () => (timeline ? getActiveScene(state.currentTime, timeline.scenes) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [Math.floor(state.currentTime * 2), timeline]
  )

  const activeConcept: DisplayableConcept | null = useMemo(
    () =>
      timeline && !strictActiveScene
        ? getActiveConcept(state.currentTime, timeline.concepts)
        : null,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [Math.floor(state.currentTime * 2), timeline, strictActiveScene]
  )

  const displayedScene = useMemo(() => {
    if (!timeline) return null
    if (strictActiveScene) return strictActiveScene
    if (activeConcept) return null
    return getActiveOrLastScene(state.currentTime, timeline.scenes)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [Math.floor(state.currentTime * 2), timeline, strictActiveScene, activeConcept])

  // Décision finale d'affichage du panneau enrichi (Q6 + Q7.4 + Q7.7).
  const showEnrichedPanel =
    enrichmentEnabled &&
    hasTimeline &&
    isCurrentTrack &&
    !error &&
    !isLoading &&
    timeline !== null

  // POC-T7.4-UX-B (D-UX-2) : la card gros player est masquée optimistiquement
  // dès qu'on est en mode enriched avec timeline disponible et sans erreur.
  // L'erreur ⇒ fallback legacy (Q6). audio_only tab ⇒ enrichmentEnabled=false
  // ⇒ card visible (D-UX-4). isLoading inclus dans hasTimeline-non-fetched-yet
  // pour éviter un flash legacy → enriched.
  const hideLegacyCard =
    hideLegacyCardWhenEnriched && enrichmentEnabled && hasTimeline && !error

  // POC-T7.4-UX-FAB : pre-play state. Quand le legacy est masqué et que la
  // track n'a pas démarré (state.audioUrl !== src), on rend un FAB Play pour
  // que l'user puisse lancer la lecture. Une fois lancée, MiniPlayer global
  // prend le relais (couvre pause/play/seek). Le FAB est aussi visible si
  // une autre track joue dans le MiniPlayer (Q7.7) — permet de switcher vers
  // cette séquence.
  const showPrePlayState = hideLegacyCard && !isCurrentTrack

  return (
    <div className="w-full">
      {/* Player audio — INCHANGÉ. Aucune prop modifiée. */}
      {!hideLegacyCard && (
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
      )}

      {/* POC-T7.4-UX-FAB : pre-play state — large FAB Play centré dans une
          zone de la taille du futur whiteboard. Pattern YouTube tap-to-play.
          Disparaît dès `state.audioUrl === src` (la track démarre, le panneau
          enrichi prend le relais et le MiniPlayer global affiche les controls). */}
      {showPrePlayState && (
        <div className="mt-2 md:mt-6">
          <button
            type="button"
            onClick={onPlayRequest}
            className="w-full rounded-2xl flex flex-col items-center justify-center gap-3 transition-transform active:scale-[0.98] hover:bg-white/[0.02]"
            style={{
              background: '#1a1a1a',
              border: '0.5px solid #2a2a2a',
              minHeight: '300px',
            }}
            aria-label="Démarrer la lecture audio"
          >
            <span
              className="w-20 h-20 rounded-full flex items-center justify-center shadow-2xl"
              style={{
                background: `linear-gradient(135deg, ${accentColor ?? '#2D1B96'}, ${accentColorSecondary ?? '#00D1C1'})`,
              }}
            >
              <Play size={36} fill="white" className="text-white ml-1" />
            </span>
            <span className="text-sm font-medium" style={{ color: '#a3a3a3' }}>
              Toucher pour démarrer
            </span>
          </button>
        </div>
      )}

      {showEnrichedPanel && timeline && (
        <div className="mt-6">
          {activeTab === 'whiteboard' ? (
            <div className="w-full">
              <WhiteboardOrCover
                displayedScene={displayedScene}
                activeConcept={activeConcept}
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
            // POC-T7.4-UX-F (Option F1) : Variante A T7.2 mobile sticky
            // simplifiée en flex-col plein écran. Le combo T7.4-UX-B (legacy
            // hidden) + T7.4-UX-G fenêtre karaoké 180px + pb-40 wrapper
            // (SequencePlayer.tsx) tient en 1 viewport sans scroll de page,
            // donc le sticky devient redondant. Si T7.5/T8 ajoutent du
            // contenu scrollable sous le karaoké, le sticky pourra revenir.
            // Desktop : Variante A T7.2 préservée intacte (md:grid 2 cols
            // karaoké|whiteboard avec internal-scroll). `md:flex-initial`
            // implicite via md:grid qui reset le flex behavior.
            <div className="flex flex-col gap-6 md:grid md:grid-cols-2 md:gap-6 md:h-[calc(100vh-32rem)]">
              <div className="order-1 md:order-2 flex-1 md:min-h-0 md:overflow-hidden">
                <WhiteboardOrCover
                  displayedScene={displayedScene}
                  activeConcept={activeConcept}
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
  activeConcept: DisplayableConcept | null
  timeline: NonNullable<ReturnType<typeof useEnrichedTimeline>['timeline']>
}

function WhiteboardOrCover({
  displayedScene,
  activeConcept,
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
  // T7-bis : flow continu — quand aucune scène n'est strictement active et
  // qu'un concept "passé" est disponible, on affiche sa carte définitionnelle
  // dans le whiteboard plutôt que le placeholder.
  if (activeConcept) {
    return (
      <ConceptCard
        term={activeConcept.term}
        definition={activeConcept.definition}
      />
    )
  }
  // POC-T7.4a-E — gap initial sans concept disponible : 3 dots pulsants
  // staggered (validation Dr Fantin). Couvre le cas où la timeline n'a pas
  // de concepts T5 (T2 pur) ou aucun n'est encore passé à `currentTime`.
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
