# Rapport d'inspection POC-T7.0

> Inspection silencieuse du flux audio user — base de cadrage pour POC-T7.2
> (composant `<EnrichedAudioPlayer>`).
>
> Posture : lecture seule. Aucune modification de code. Toutes les références
> de ligne pointent vers `main` à la date du rapport.

---

## 1. AudioContext — signature exposée par `useAudio()`

Fichier : `src/context/AudioContext.tsx`.

### 1.1 Type de retour de `useAudio()`

```ts
interface AudioContextValue {
  state: AudioState
  playAudio: (params: PlayAudioParams) => void
  pauseAudio: () => void
  resumeAudio: () => void
  seekTo: (seconds: number) => void
  closePlayer: () => void
}
```

(défini ligne 49-56, exposé via `Provider value={{ state, playAudio, pauseAudio, resumeAudio, seekTo, closePlayer }}` ligne 384.)

### 1.2 `AudioState` (lignes 23-34)

```ts
interface AudioState {
  isPlaying: boolean
  currentTime: number
  duration: number
  sequenceTitle: string
  formationTitle: string
  audioUrl: string
  accentColor: string
  sequenceId: string
  userId: string
  coverImageUrl: string
}
```

`defaultState` (lignes 58-69) initialise tout à 0 / chaîne vide / `'#2D1B96'` pour l'accent.

### 1.3 `PlayAudioParams` (lignes 36-47)

```ts
interface PlayAudioParams {
  audioUrl: string
  sequenceTitle: string
  formationTitle: string
  accentColor: string
  sequenceId: string
  userId: string
  duration?: number
  coverImageUrl?: string
  onComplete?: () => void
  onProgress?: (percent: number) => void
}
```

### 1.4 `PlaybackEvent` (lignes 17-21)

```ts
interface PlaybackEvent {
  time: number
  action: 'play' | 'pause' | 'complete'
  timestamp: string // ISO
}
```

### 1.5 useState / useRef / useEffect du provider

- `useState<AudioState>(defaultState)` ligne 79 — *seul* state React.
- `useRef<HTMLAudioElement | null>(null)` ligne 78 — `audioRef`, conteneur de
  l'élément `<audio>` JS (jamais monté dans le DOM).
- Refs DPC (lignes 82-89) : `startedAtRef`, `pauseCountRef`,
  `playbackEventsRef`, `realListenSecondsRef`, `lastTickRef`,
  `maxReachedTimeRef`, `logIdRef`, `isCompletedRef`.
- Refs callbacks (lignes 92-93) : `onCompleteRef`, `onProgressRef`.
- `useEffect` (lignes 96-110) : tick 1 Hz qui incrémente
  `realListenSecondsRef` quand `state.isPlaying === true`. Mesure le temps
  d'écoute *réel* (≠ position lecture).

---

## 2. AudioContext — flux DPC

### 2.1 Écriture `course_watch_logs`

Trois moments d'écriture distincts :

**(a) INSERT au démarrage** — `insertWatchLog()` lignes 153-186, appelé par
`playAudio()` ligne 307 si `!startedAtRef.current`.

Champs insérés :
```
user_id, sequence_id, started_at, ended_at: null,
total_duration_seconds: 0, watched_percent: 0, pause_count: 0,
playback_events: [{ time: 0, action: 'play', timestamp: now }],
completed: false
```
Le `id` retourné est stocké dans `logIdRef.current`.

**(b) UPDATE à la pause** — `updateWatchLogOnPause()` lignes 189-206, appelé
par `pauseAudio()` (ligne 327), par `playAudio()` lors d'un changement de
piste (ligne 270) et par `closePlayer()` (ligne 366).

Champs modifiés :
```
ended_at: <now ISO>,
total_duration_seconds: round(realListenSecondsRef),
watched_percent: floor((maxReachedTimeRef / duration) * 100),  // clamp ≤100
pause_count: pauseCountRef,
playback_events: playbackEventsRef
```

**(c) UPDATE à la fin** — `handleAudioEnded()` lignes 209-258, listener
`'ended'` du `<audio>` natif (attaché ligne 145-147).

Champs modifiés (ou insertion fallback si `logIdRef` vide, lignes 240-252) :
```
ended_at, total_duration_seconds, watched_percent: 100,
pause_count, playback_events, completed: <listenedRatio ≥ 0.8>
```
`listenedRatio = realListenSecondsRef / duration` (ligne 223).

### 2.2 Logique d'agrégation `playback_events`

`playbackEventsRef.current.push(...)` est appelé à 4 endroits :
- au début dans `insertWatchLog` (`{ time:0, action:'play' }`, ligne 176, mais
  c'est un seed inline — pas un push) ;
- dans `playAudio` après `setState` (ligne 304) : `{ time: audio.currentTime,
  action: 'play' }`.
- dans `pauseAudio` (lignes 320-324) : `{ time: audio.currentTime, action:
  'pause' }`.
- dans `resumeAudio` (lignes 335-339) : `{ time: audio.currentTime, action:
  'play' }`.
- dans `handleAudioEnded` (lignes 216-220) : `{ time: duration, action:
  'complete' }`.

Le tableau est *réinitialisé à `[]`* lors d'un changement de piste
(`playAudio` ligne 276) et lors de `closePlayer` (ligne 372).

### 2.3 Anti-skip — implémentation et comportement

**DEUX mécanismes superposés**, tous deux gardiens de
`maxReachedTimeRef.current` (la position max jamais atteinte par l'auditeur).

#### (a) Garde dans le listener `'timeupdate'` natif (lignes 118-136)

```ts
audioRef.current.addEventListener('timeupdate', () => {
  const audio = audioRef.current
  if (!audio) return
  const time = audio.currentTime
  const dur = audio.duration && isFinite(audio.duration) ? audio.duration : 0

  // DPC: prevent skipping forward
  if (time <= maxReachedTimeRef.current + 2) {
    maxReachedTimeRef.current = Math.max(maxReachedTimeRef.current, time)
  } else {
    audio.currentTime = maxReachedTimeRef.current
    return
  }
  ...
})
```

Comportement exact :
- Tolérance de **+2 s** au-delà de `maxReached` (probablement pour absorber
  les micro-jumps natifs / buffering).
- Au-delà : `audio.currentTime = maxReachedTimeRef.current` ramène la
  position au max atteint, puis `return` (le `setState` n'est pas appelé,
  donc `state.currentTime` reflétera la position corrigée au prochain
  `timeupdate`).
- Aucun toast / pas de log console / pas de callback : **silent no-op** côté
  utilisateur. Le seek se "rétracte" visuellement.
- Pas de flag conditionnel — l'anti-skip est **toujours actif**, sur tout
  audio joué via cet AudioContext, pour tous les utilisateurs et tous les
  rôles.

#### (b) Garde dans le wrapper `seekTo()` (lignes 346-354)

```ts
const seekTo = useCallback((seconds: number) => {
  const audio = audioRef.current
  if (!audio) return
  // DPC: can only seek backward or to maxReachedTime
  const clampedTime = Math.min(seconds, maxReachedTimeRef.current)
  audio.currentTime = Math.max(0, clampedTime)
  setState(prev => ({ ...prev, currentTime: Math.max(0, clampedTime) }))
}, [])
```

Comportement :
- `seek(t)` est *clampé* à `min(t, maxReached)` puis `max(0, …)`.
- → Seek arrière libre, seek avant impossible (absorbé silencieusement).
- Utilisé exclusivement par **`MiniPlayer.tsx`** (handlers `handleSeekBack`
  et `handleSeekForward` lignes 33-39 : ±15 s).

#### Conclusion anti-skip

Les **deux mécanismes sont indépendants** et se renforcent : même si un
nouveau composant (T7) accédait directement au `<audio>` (ce qu'il ne doit
PAS faire), le listener `timeupdate` corrigerait. Comme T7.2 sera *purement
consommateur* de `state.currentTime`, le double dispositif rend
l'implémentation 100 % safe par construction.

### 2.4 `watched_percent` et `pause_count`

- `watched_percent` est calculé **uniquement à partir de
  `maxReachedTimeRef.current / duration`** (lignes 132 et 194), jamais à
  partir de `currentTime` brut. Conséquence : si un user écoute en boucle, le
  pourcentage ne dépasse jamais le max. Avec anti-skip ON, `maxReached`
  croît monotonement avec la lecture réelle.
- `pause_count` est `pauseCountRef.current`, incrémenté de 1 dans `pauseAudio`
  (ligne 319). Pas réinitialisé sur `resumeAudio`. Réinitialisé sur changement
  de piste et `closePlayer`.

### 2.5 ENV vars / config

- Aucune variable d'environnement, aucun feature flag, aucune condition
  `process.env.*` dans `AudioContext.tsx`.
- Le seul accès Supabase est via `createClient()` de
  `@/lib/supabase/client`, qui consomme `NEXT_PUBLIC_SUPABASE_URL` et
  `NEXT_PUBLIC_SUPABASE_ANON_KEY` (vu dans `.env.local.example`).
- Pas de `localStorage` / `sessionStorage` dans `AudioContext.tsx` ni dans
  `formation/AudioPlayer.tsx` (vérifié par grep).

---

## 3. AudioPlayer — signature et dépendances

Fichier : `src/components/formation/AudioPlayer.tsx`.

### 3.1 Props (lignes 11-24)

```ts
interface AudioPlayerProps {
  src: string
  duration: number // en secondes (depuis course_duration_seconds)
  sequenceId: string
  onComplete: () => void
  onProgress: (percent: number) => void
  accentColor?: string                // défaut '#2D1B96'
  accentColorSecondary?: string       // défaut '#00D1C1'
  sequenceTitle?: string              // défaut 'Cours audio'
  formationTitle?: string              // défaut ''
  learningObjectives?: string[] | null
  coverImageUrl?: string | null
  userId?: string                      // défaut ''
}
```

### 3.2 Hooks consommés

- `useAudio()` ligne 56 — destructure `{ state, playAudio, pauseAudio }`.
  C'est le **seul** hook consommé. Pas de `useState`, pas de `useEffect`, pas
  de `useRef` côté React. AudioPlayer est purement présentationnel.

### 3.3 Élément `<audio>` HTML — où est-il rendu ?

**Nulle part dans le DOM React.** L'élément est créé impérativement dans
`AudioContext.getAudio()` ligne 115 (`new Audio()`), stocké dans
`audioRef.current`, et reste **headless** (jamais inséré dans le document).
La lecture passe par `audio.play()` direct.

→ Conséquence pour T7.2 : impossible d'accrocher un MutationObserver ou un
ref DOM sur l'élément. Toute synchronisation passe nécessairement par
`state.currentTime` exposé via `useAudio()`.

### 3.4 Controls UI exposés par AudioPlayer

Vue (JSX lignes 84-194) :
- Image cover (mobile 160×160, desktop 280×280, lignes 88-114).
- Titre / formation (lignes 121-128).
- Liste objectifs pédagogiques (lignes 131-148).
- Pill timer `{currentPos} / {currentDuration}` (lignes 153-159).
- Barre de progression (largeur = `progressPercent`, ligne 162-167).
- Bouton unique **Écouter / Reprendre / Pause** (lignes 170-189) qui
  bascule via `handleToggle` ligne 61 :
  - si `isPlaying` → `pauseAudio()` ;
  - sinon → `playAudio({...})` avec tous les params.

Pas de slider de seek, pas de contrôle volume, pas de skip ±15s, pas de
vitesse de lecture. **L'utilisateur ne peut que play/pause** sur cette UI.
Le seek ±15s n'existe que dans `MiniPlayer.tsx`.

### 3.5 LocalStorage / SessionStorage

Confirmé : aucune dépendance. Grep `localStorage|sessionStorage` dans
`src/components/formation/` et `src/context/AudioContext.tsx` → 0 hits.

---

## 4. SequencePlayer — point d'intégration AudioPlayer

Fichier : `src/components/formation/SequencePlayer.tsx` (1393 lignes).

### 4.1 Signature props (lignes 32-38)

```ts
interface SequencePlayerProps {
  sequence: Sequence
  categoryGradient: { from: string; to: string }
  coverImageUrl?: string | null
  onBack: () => void
  onComplete: (score: number, totalPoints: number) => void
}
```

Le type `Sequence` vient de `@/lib/supabase` (lignes 19-24). Voir §4.4 pour
les conséquences.

### 4.2 Variables clés (lignes 232-235)

```ts
const hasMedia  = !!sequence.course_media_url
const hasPdf    = !!sequence.infographic_url
const mediaType = sequence.course_media_type || 'video' // défaut vidéo
const isAudio   = mediaType === 'audio'
```

### 4.3 Deux points d'invocation `<AudioPlayer>`

#### (a) Branche "intro audio sans questions" (lignes 556-571)

Active si `questions.length === 0 && hasMedia` (ligne 544).

```tsx
{isAudio && sequence.course_media_url && (
  <div className="mb-6">
    <AudioPlayer
      src={sequence.course_media_url}
      duration={sequence.course_duration_seconds || 0}
      sequenceId={sequence.id}
      sequenceTitle={sequence.title}
      learningObjectives={sequence.learning_objectives}
      coverImageUrl={coverImageUrl}
      onComplete={() => {}}
      onProgress={() => {}}
      accentColor={categoryGradient.from}
      accentColorSecondary={categoryGradient.to}
    />
  </div>
)}
```

#### (b) Branche "step video/audio dans une séquence avec quiz" (lignes 637-652)

Active si `playerStep === 'video'` (la `PlayerStep` est `'video' | 'quiz' |
'pdf' | 'results'`, ligne 40 — note : `'video'` est ici un nom historique qui
couvre **aussi** l'audio).

```tsx
{mediaType === 'audio' && sequence.course_media_url && (
  <div className="mb-6">
    <AudioPlayer
      src={sequence.course_media_url}
      duration={sequence.course_duration_seconds || 0}
      sequenceId={sequence.id}
      sequenceTitle={sequence.title}
      learningObjectives={sequence.learning_objectives}
      coverImageUrl={coverImageUrl}
      onComplete={() => setCourseCompleted(true)}
      onProgress={(percent) => setCourseProgress(percent)}
      accentColor={categoryGradient.from}
      accentColorSecondary={categoryGradient.to}
    />
  </div>
)}
```

### 4.4 Comment `course_media_url` est passé

Toujours via `sequence.course_media_url` directement (la prop `src`).
La prop `userId` n'est *pas* passée par SequencePlayer → AudioPlayer la
reçoit donc en `''` (défaut), et `AudioContext.insertWatchLog()` la résout
via `supabase.auth.getUser()` (ligne 162-165).

### 4.5 Comment l'objet `sequence` complet est utilisé

Seules les colonnes suivantes sont lues par SequencePlayer dans le contexte
audio (grep `sequence\.` ciblé) :
- `sequence.id`
- `sequence.title`
- `sequence.course_media_url`
- `sequence.course_media_type`
- `sequence.course_duration_seconds`
- `sequence.learning_objectives`
- `sequence.infographic_url`

**Aucune lecture de `sequence.timeline_url` ou `sequence.timeline_published`
côté user** (confirmé en §5.1).

---

## 5. Surface de réutilisation pour T7.2

### 5.1 État actuel `timeline_url` / `timeline_published`

Grep exhaustif (`src/`) sur `timeline_url` et `timeline_published` :

- **Côté admin** : présents dans `src/app/admin/timelines/...`,
  `src/app/admin/poc/karaoke/page.tsx`, `src/app/admin/poc/extract-scenes/...`,
  `src/app/api/admin/timelines/...`, `src/lib/timeline/admin-table-resolver.ts`,
  `src/components/admin/timeline-editor/...`.
- **Côté user** : **0 référence**. Confirmé : ni dans `src/components/formation/`,
  ni dans `src/lib/supabase/types.ts` (le type `Sequence` ligne 36-54
  n'inclut PAS `timeline_url` ni `timeline_published`), ni dans
  `src/types/database.ts`.

→ Conséquence T7.2 : la séquence côté user devra soit (a) être enrichie au
fetch côté serveur pour exposer `timeline_url` / `timeline_published`, soit
(b) être étendue dans le type `Sequence` partagé. Question ouverte (§7).

### 5.2 Hooks T3 réutilisables

#### `useEnrichedTimeline(timelineUrl)` — `src/hooks/useEnrichedTimeline.ts`

```ts
export type UseEnrichedTimelineResult = {
  timeline: Timeline | null
  isLoading: boolean
  error: Error | null
}

export function useEnrichedTimeline(
  timelineUrl: string | null | undefined
): UseEnrichedTimelineResult
```

Caractéristiques :
- Cache mémoire module-level (Map URL → Timeline).
- `fetch(url, { cache: 'no-store' })` puis parse Zod via `TimelineSchema`.
- Annulation si l'URL change pendant un fetch en cours (flag `isStale`).
- Pas de persistance localStorage.

#### `useCurrentWord(flatWords, currentTime)` — `src/hooks/useCurrentWord.ts`

```ts
export function useCurrentWord(
  flatWords: FlatWord[],
  currentTime: number
): FlatWord | null
```

Throttle 4 Hz via bucket `Math.floor(currentTime * 4)`.

`flatWords` est obtenu par `flattenTranscript(transcript)` exporté depuis
`@/lib/timeline/findCurrentWord`.

### 5.3 Composants T3/T4 réutilisables

#### `KaraokeTranscript` — `src/components/audio-enriched/KaraokeTranscript.tsx`

```ts
interface KaraokeTranscriptProps {
  transcript: Timeline['transcript']
  currentTime: number
  onSeek?: (sec: number) => void
  autoScroll?: boolean        // défaut true
  className?: string
}
```

Notes :
- Composant **purement présentationnel**, contrôlé par `currentTime`.
- `onSeek` est **optionnel** : si non fourni, le clic sur un mot ne fait
  rien. Pour T7, on **ne passera PAS** `onSeek` (puisque l'anti-skip
  empêcherait de seeker en avant et la spec POC §5.4 l'exclut).
- Auto-scroll : `scrollIntoView({ behavior:'smooth', block:'center' })`
  quand le segment actif change. Suspendu 5 s après un scroll manuel
  (wheel/touchmove).
- Cas vide : retourne un placeholder "Pas de transcript disponible." si
  `!transcript || !transcript.segments.length`.
- Container : `mx-auto max-w-3xl space-y-6 py-4` + `className` props.

#### `StructuredWhiteboard` — `src/components/audio-enriched/StructuredWhiteboard.tsx`

```ts
interface StructuredWhiteboardProps {
  scenes: Scene[]
  currentTime: number
  className?: string
}
```

Notes :
- Throttle 2 Hz (`Math.floor(currentTime * 2)`).
- N'utilise **pas** `useAudio` (commentaire ligne 21 : isolé volontairement
  de l'AudioContext).
- Animation entrée/sortie framer-motion (durée 0.4s/0.3s).
- Container : `bg-[color:var(--color-bg-card)]/30 rounded-xl p-6` +
  `className`. **Pas de `max-width` interne** — la largeur est imposée par
  le parent.
- Templates supportés : `grid`, `figures`, `flowchart`, `comparison`,
  `timeline`, `causal` (via `SceneRenderer` lignes 102-136).

### 5.4 Référence d'intégration existante (admin POC)

`src/app/admin/poc/karaoke/KaraokePOCClient.tsx` montre déjà une intégration
*sans* AudioContext (un `<audio>` HTML natif visible + ref + state local
`currentTime`). C'est un **patron de référence** pour T7.2, à transposer en
remplaçant le `<audio>` natif par la lecture passive de `state.currentTime`
issu de `useAudio()`.

> ⚠️ Cette page admin documente un bug `POC-T3-D4` (commentaire lignes
> 17-37) : seek JS sur le MP3 pilote met à jour `currentTime` mais le flux
> audio reste à l'ancienne position. Cause probable : header Xing/LAME
> manquant après concaténation Python ElevenLabs. **Sans impact T7.2** car
> on n'effectue aucun seek, mais à garder en tête pour les tests visuels —
> si le karaoké semble "désynchronisé" après un play/pause sur certains
> MP3 pilotes, ça vient probablement de là.

---

## 6. Risques identifiés pour T7.2

### 6.1 Risque très faible (par construction)

- **Anti-skip**. Double dispositif : (a) listener `timeupdate` natif sur le
  `<audio>` headless, (b) wrapper `seekTo()`. Le composant T7.2 ne touchera
  ni au `<audio>` (il n'y accède pas), ni à `seekTo()` (il n'en a pas
  besoin). **Aucune surface d'attaque.**
- **Course aux logs DPC**. T7.2 ne fera *aucun* `INSERT/UPDATE` sur
  `course_watch_logs`. Le seul endroit où ces écritures sont déclenchées
  reste `AudioContext`.
- **`state.currentTime` est déjà la "single source of truth"**. Mis à jour
  par le listener `timeupdate` (~250 ms côté navigateur). Les hooks T3
  (`useCurrentWord` 4 Hz, `getActiveScene` 2 Hz) appliquent leur propre
  throttling, donc la fréquence brute est suffisante.

### 6.2 Risque modéré — type `Sequence` à enrichir

Le type `Sequence` dans `src/lib/supabase/types.ts` n'expose pas
`timeline_url` / `timeline_published`. Or :

- L'admin POC karaoké requête explicitement `'id, title, timeline_url,
  timeline_published'` (page.tsx ligne 36) — donc les colonnes existent
  bien en BDD.
- Le `Sequence` user n'a pas ces champs → la requête de récupération de la
  séquence côté user devra être étendue, et le type également.

→ Décision à prendre en T7.2 (ou avant) : modifier le type partagé OU créer
un type étendu `EnrichedSequence` côté user.

### 6.3 Risque modéré — synchronisation de piste (track-switch)

`AudioContext.state.audioUrl` change quand l'utilisateur lance une autre
piste. AudioPlayer gère ça via la condition `isThisTrack = state.audioUrl
=== src` (ligne 58). **T7.2 doit faire la même chose** : si la séquence
courante n'est pas celle qui joue dans `state`, il faut soit ne pas afficher
le karaoké, soit afficher un état "en attente de lecture", sinon le karaoké
synchronisera sur le `currentTime` d'une autre piste.

### 6.4 Risque modéré — sources timeline divergentes vs audio

`timeline_url` pointe vers un JSON généré côté admin à partir d'un
`audio_url` qui peut être *différent* de `course_media_url` actuel (ex :
admin a régénéré un MP3 mais pas relancé le pipeline T2). Le schéma
`Timeline` contient un champ `audio_url` (ligne 250 du schéma). T7.2
gagnera probablement à logger un warning console si
`timeline.audio_url !== sequence.course_media_url`.

### 6.5 Risque faible — branche "intro audio sans questions"

Deux call-sites d'`<AudioPlayer>` dans `SequencePlayer` (§4.3). Si T7.2
remplace l'un sans l'autre, le comportement diverge. Question ouverte
§7.2.

### 6.6 Risque très faible — mais à confirmer — bug seek MP3 pilote

Le commentaire `POC-T3-D4` (KaraokePOCClient ligne 17-37) signale qu'un
seek JS sur le MP3 pilote ne déplace pas le flux audio. Côté user, le
seek-arrière de `MiniPlayer` (`seekTo(currentTime - 15)`) pourrait être
affecté. Ce n'est *pas* un risque pour T7.2 (qui ne seek pas), mais ça peut
parasiter les tests visuels (mot surligné qui ne correspond pas à ce qu'on
entend). À garder en tête lors de la recette T7.2.

### 6.7 Risque faible — playbackEvents et changement de piste

Quand un user change de piste via `playAudio` (track-switch), `AudioContext`
appelle `updateWatchLogOnPause()` *avant* de reset les refs (ligne 270).
C'est volontaire pour ne pas perdre l'état du log précédent. T7.2 n'est pas
concerné mais c'est utile à savoir : un événement `'pause'` n'est pas
forcément poussé dans `playback_events` lors d'un track-switch (le code
push uniquement sur `pauseAudio()`/`resumeAudio()`/`handleAudioEnded()` —
voir §2.2).

---

## 7. Questions ouvertes à remonter à Dr Fantin

### 7.1 Position du `<EnrichedAudioPlayer>` dans l'arbre

Trois options possibles, à trancher avant T7.2 :

(a) Wrapper *autour* d'`<AudioPlayer>` : `<EnrichedAudioPlayer>` rend
`<AudioPlayer>` puis ajoute karaoké + whiteboard en dessous. Avantage :
zéro risque de régression sur la card audio. Inconvénient : couplage props.

(b) `<EnrichedAudioPlayer>` *à côté* d'`<AudioPlayer>` dans `SequencePlayer`
(deux sibling). Avantage : découplage total. Inconvénient : SequencePlayer
doit décider de l'orchestration.

(c) Substitution : `<EnrichedAudioPlayer>` remplace `<AudioPlayer>` quand
`timeline_url` existe et `timeline_published === true`. Avantage : un seul
chemin user. Inconvénient : risque de régression silencieuse si la
substitution casse la card audio.

→ La spec POC §5.4 et §10 Ticket 7 parlent d'un *wrap* — donc option (a)
semble cible. À confirmer.

### 7.2 Périmètre des deux call-sites SequencePlayer

Faut-il aussi enrichir l'audio du chemin "intro sans questions" (§4.3.a) ?
Probablement oui pour cohérence, mais à confirmer.

### 7.3 Source des champs `timeline_url` / `timeline_published` côté user

- Étendre le type `Sequence` global (impact : tous les imports).
- Créer un type étendu `EnrichedSequence` strictement côté user.
- Enrichir au fetch côté serveur (`SequencePlayer` reçoit déjà `sequence:
  Sequence` — d'où vient-il ? À retracer en amont, hors scope T7.0).

### 7.4 Comportement quand `timeline_published === false`

La spec POC parle de "lecture seule sur AudioContext". On déduit que T7.2
ne s'active *que* si `timeline_published === true`. À confirmer pour les
cas `timeline_url !== null && timeline_published === false` (admin a publié
puis dépublié).

### 7.5 Mode démo (`demoMode = true` dans SequencePlayer ligne 238)

Le code actuel a un flag `demoMode` hard-codé `true` (commentaire
"Mettre à false en production"). Sans impact direct T7.2, mais à
clarifier pour la recette : la condition `hasMedia && !courseCompleted &&
!demoMode` (ligne 682) ne déclenche jamais en démo, donc le bouton "Passer
au Quiz" est toujours actif même sans avoir écouté. Ce n'est PAS un risque
T7.2 mais ça affecte le scénario de test.

### 7.6 `userId` non passé par SequencePlayer

`SequencePlayer` ne passe pas `userId` à `<AudioPlayer>` ; c'est
`AudioContext.insertWatchLog()` qui résout via
`supabase.auth.getUser()`. T7.2 doit-il avoir besoin de `userId` pour
quelque chose ? Probablement non (lecture seule), mais à confirmer si la
spec demande un audit-log côté T7.

### 7.7 Cycle de vie `closePlayer` vs déménagement T7.2

`MiniPlayer.closePlayer` reset entièrement l'état audio. Si T7.2 est rendu
dans la page séquence et que l'utilisateur ferme le `MiniPlayer` (X), la
séquence reste à l'écran mais `state.audioUrl === ''` → la condition
`isThisTrack` devient fausse. Comportement attendu : afficher un état "pas
de lecture en cours" ou cacher karaoké/whiteboard. À spécifier.

---

## Annexe A — Inventaire grep

| Pattern | Hits user | Hits admin/api | Hits types/lib |
|---|---|---|---|
| `useAudio` (formation) | 4 (`AudioPlayer`, `MiniPlayer`, `AudioContext`) | 0 | 0 |
| `useAudioPlayer` (news) | 4 (`news/page`, `JournalWeekCard`, `JournalDetailModal`, `AudioQueuePlayer`) | 0 | `AudioPlayerContext` |
| `course_media_url` | 12 (`SequencePlayer`, `FormationDetail`) | 13 (admin pages) | 2 (`types/database`, `supabase/types`) |
| `course_watch_logs` | 4 (`AudioContext` insert/update ×3 + close) | 1 (`/api/tenant/analytics`) | migrations supabase |
| `timeline_url` | **0 user** | nombreuses (`/admin/timelines`, `/admin/poc/*`, `/api/admin/timelines/*`) | `admin-table-resolver` |
| `timeline_published` | **0 user** | nombreuses (mêmes endroits) | `admin-table-resolver` |

## Annexe B — Source de vérité pour `currentTime`

Chaîne de propagation :
1. Élément `Audio` natif (jamais monté DOM) émet `timeupdate` (~250 ms).
2. Listener (`AudioContext.tsx` ligne 118) lit `audio.currentTime`.
3. Applique l'anti-skip.
4. `setState({...prev, currentTime: time})` ligne 135.
5. Provider re-render → tous les consommateurs `useAudio()` reçoivent le
   nouveau `state.currentTime`.
6. Throttling additionnel côté T3/T4 :
   - `useCurrentWord` 4 Hz (250 ms).
   - `StructuredWhiteboard.useMemo` 2 Hz (500 ms).

→ T7.2 n'a *aucun* throttling supplémentaire à ajouter.

## Annexe C — Liste exhaustive des call-sites `useAudio()`

(`grep -rn "useAudio" src/` — hors AudioPlayerContext qui est un autre flux
"news" indépendant)

```
src/components/MiniPlayer.tsx:6,14
src/components/formation/AudioPlayer.tsx:5,56
src/context/AudioContext.tsx:394
```

→ T7.2 sera donc le **3ᵉ consommateur** de l'AudioContext formation.

---

*Fin du rapport. Aucune action de code n'a été entreprise. La suite est
T7.2 — implémentation du composant `<EnrichedAudioPlayer>` selon spec POC
§5.4 et §10 Ticket 7.*
