'use client'

import { useMemo } from 'react'
import { Play } from 'lucide-react'

import { KaraokeTranscript } from '@/components/audio-enriched/KaraokeTranscript'
import { SceneWhiteboardWithConcepts } from '@/components/audio-enriched/SceneWhiteboardWithConcepts'
import { useAudio } from '@/context/AudioContext'
import { useEnrichedTimeline } from '@/hooks/useEnrichedTimeline'
import {
  getActiveOrLastScene,
  getActiveScene,
  getConceptsForScene,
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

  // Carton titre affiché avant la première scène (displayedScene null).
  startCardFormationTitle?: string
  startCardSequenceLabel?: string
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
  startCardFormationTitle,
  startCardSequenceLabel,
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
  // Regroupement « scène active + ses concepts » : UNE seule scène est
  // affichée à l'instant t (stricte si `currentTime ∈ [start_sec, end_sec]`,
  // sinon la dernière connue via `getActiveOrLastScene` pour les gaps
  // inter-scènes / post-dernière-scène). On ne bascule plus en mode
  // "concepts seuls dans les gaps" : les concepts sont désormais rattachés à
  // leur scène et rendus EN DESSOUS du whiteboard (cf. `sceneConcepts`).
  const displayedScene = useMemo(() => {
    if (!timeline) return null
    const strict = getActiveScene(state.currentTime, timeline.scenes)
    if (strict) return strict
    return getActiveOrLastScene(state.currentTime, timeline.scenes)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [Math.floor(state.currentTime * 2), timeline])

  // Concepts rattachés à la scène affichée (arbitrage 2A : tous d'un coup,
  // pas de filtre `at_sec ≤ currentTime`). Le rattachement est dérivé via
  // `getConceptsForScene` (règle de continuité par `at_sec`). Indépendant de
  // `currentTime` à scène constante ⇒ ne dépend que de `displayedScene`.
  const sceneConcepts: DisplayableConcept[] = useMemo(
    () =>
      timeline && displayedScene
        ? getConceptsForScene(displayedScene, timeline.concepts, timeline.scenes)
        : [],
    [timeline, displayedScene]
  )

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

  // Audio seul mobile : cover-vinyle lanceur (remplace la carte legacy).
  const isAudioOnly = activeTab === 'audio_only'
  const vinylSpinning = isCurrentTrack && state.isPlaying

  return (
    <div className="w-full">
      {/* Player audio — INCHANGÉ. Aucune prop modifiée. */}
      {!hideLegacyCard && (
        <div className={isAudioOnly ? 'hidden md:block' : undefined}>
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
        </div>
      )}

      {/* Audio seul mobile : cover-vinyle lanceur (md:hidden -> desktop garde la carte) */}
      {isAudioOnly && !error && (
        <div className="md:hidden flex justify-center mt-2 mb-4">
          <button
            type="button"
            onClick={isCurrentTrack ? undefined : onPlayRequest}
            className="relative w-44 h-44 rounded-full overflow-hidden shadow-2xl active:scale-[0.98] transition-transform"
            style={{ transform: 'translateZ(0)', WebkitTransform: 'translateZ(0)' }}
            aria-label={isCurrentTrack ? 'Lecture en cours' : 'Demarrer la lecture audio'}
          >
            {/* couche tournante : cover, ou degrade de repli si pas de cover */}
            <span
              className={`absolute inset-0 ${vinylSpinning ? 'animate-vinyl-spin' : ''}`}
              style={
                coverImageUrl
                  ? undefined
                  : { background: `linear-gradient(135deg, ${accentColor ?? '#2D1B96'}, ${accentColorSecondary ?? '#00D1C1'})` }
              }
            >
              {coverImageUrl && (
                <img src={coverImageUrl} alt="" className="w-full h-full object-cover" />
              )}
            </span>
            {/* trou central vinyle (fixe) */}
            <span
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-6 h-6 rounded-full"
              style={{ background: '#0F0F0F', border: '2px solid rgba(255,255,255,0.25)' }}
            />
            {/* overlay play tant que la piste n'est pas lancee (fixe) */}
            {!isCurrentTrack && (
              <span className="absolute inset-0 flex items-center justify-center bg-black/35">
                <span className="w-14 h-14 rounded-full bg-white/90 flex items-center justify-center">
                  <Play size={26} fill="#0F0F0F" className="text-[#0F0F0F] ml-0.5" />
                </span>
              </span>
            )}
          </button>
        </div>
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
                sceneConcepts={sceneConcepts}
                timeline={timeline}
                highlightTime={state.currentTime}
                startCardFormationTitle={startCardFormationTitle}
                startCardSequenceLabel={startCardSequenceLabel}
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
              <div className="order-1 md:order-2 flex-1 md:min-h-0 md:overflow-y-auto">
                <WhiteboardOrCover
                  displayedScene={displayedScene}
                  sceneConcepts={sceneConcepts}
                  timeline={timeline}
                  highlightTime={state.currentTime}
                  startCardFormationTitle={startCardFormationTitle}
                  startCardSequenceLabel={startCardSequenceLabel}
                />
              </div>
              <div className="order-2 md:order-1 md:min-h-0 md:overflow-y-auto">
                <KaraokeTranscript
                  transcript={timeline.transcript}
                  currentTime={state.currentTime}
                  variant="single"
                  concepts={timeline.concepts ?? []}
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
// Sous-composant : whiteboard de la scène affichée (active ou en
// extension via getActiveOrLastScene) + SES concepts regroupés
// EN DESSOUS. Placeholder texte (3 dots) seulement pour le gap
// initial avant la première scène (displayedScene === null).
// T7.3.1 : la cover image n'est plus rendue ici car `<AudioPlayer>`
// affiche déjà la cover (mobile au-dessus de la carte gradient,
// desktop à gauche), ce qui produisait une duplication visible en
// flow user (cf. dette D7-13 résolue T7.3.1).
// ──────────────────────────────────────────────────────────────

interface WhiteboardOrCoverProps {
  displayedScene: Scene | null
  sceneConcepts: DisplayableConcept[]
  timeline: NonNullable<ReturnType<typeof useEnrichedTimeline>['timeline']>
  // Lot 2 : temps audio réel (state.currentTime, lecture seule) pour la
  // surbrillance dynamique des items — simple plomberie de prop, séparée du
  // mécanisme figé start_sec + 0.5 de sélection de scène.
  highlightTime?: number
  startCardFormationTitle?: string
  startCardSequenceLabel?: string
}

function WhiteboardOrCover({
  displayedScene,
  sceneConcepts,
  timeline,
  highlightTime,
  startCardFormationTitle,
  startCardSequenceLabel,
}: WhiteboardOrCoverProps) {
  if (displayedScene) {
    // Rendu « scène + concepts en dessous » extrait dans un composant
    // présentationnel partagé, réutilisé à l'identique par la preview de
    // l'éditeur de timeline admin (`TimelinePreviewPanel`).
    return (
      <SceneWhiteboardWithConcepts
        displayedScene={displayedScene}
        sceneConcepts={sceneConcepts}
        scenes={timeline.scenes}
        highlightTime={highlightTime}
      />
    )
  }
  // Carton titre avant la première scène — remplace les 3 dots si les labels
  // sont fournis. Repli : 3 dots si aucun label disponible.
  if (startCardSequenceLabel || startCardFormationTitle) {
    return (
      <div className="bg-[color:var(--color-bg-card)]/30 rounded-xl p-6 flex flex-col items-center justify-center min-h-[240px] gap-2 text-center">
        {startCardFormationTitle && (
          <p className="text-xs uppercase tracking-widest text-accent font-medium">
            {startCardFormationTitle}
          </p>
        )}
        {startCardSequenceLabel && (
          <p className="text-2xl font-semibold text-white leading-snug">
            {startCardSequenceLabel}
          </p>
        )}
      </div>
    )
  }
  // Fallback 3 dots (pas de labels fournis).
  return (
    <div className="bg-[color:var(--color-bg-card)]/30 rounded-xl p-6 flex items-center justify-center min-h-[240px]">
      <div className="flex items-center gap-2 text-white/55" role="status" aria-label="Visualisation à venir">
        <span className="w-2 h-2 rounded-full bg-current opacity-40 animate-pulse" />
        <span className="w-2 h-2 rounded-full bg-current opacity-40 animate-pulse" style={{ animationDelay: '200ms' }} />
        <span className="w-2 h-2 rounded-full bg-current opacity-40 animate-pulse" style={{ animationDelay: '400ms' }} />
      </div>
    </div>
  )
}
