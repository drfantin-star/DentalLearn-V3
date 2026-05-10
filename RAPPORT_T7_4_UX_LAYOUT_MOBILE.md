# RAPPORT POC-T7.4-UX — Layout mobile compact + drawer Objectifs + FAB Play + fix D7-14

**Branche** : `claude/verify-miniplayer-ditqh`
**Date** : 2026-05-10
**Statut** : ✅ Sous-tâches B/D/E/FAB/F livrées, T7.4-UX-C annulée (D7-14 résolu implicitement par B), build clean, type-check 0 erreur.
**Décisions ad hoc T7.4-UX appliquées** : D-UX-1 à D-UX-5, Q-stop-1 (FAB Play overlay whiteboard), Q-stop-2 (pb-40 wrapper), Option α (icône ⓘ header compact), Option F1 (flexbox plein écran).

---

## §1. Pré-flight T7.4-UX-A

### 1.1 MiniPlayer global confirmé monté

| Élément | Valeur |
|---|---|
| Fichier composant | `src/components/MiniPlayer.tsx` |
| Mount | `src/app/(app)/layout.tsx:33` (inconditionnel dans le sous-arbre `(app)`) |
| Context consommé | `useAudio()` depuis `AudioContext` (= **même contexte** que `<AudioPlayer>` et `<EnrichedAudioPlayer>`) ✅ |
| Hidden paths | `['/login', '/register', '/admin']` — `/formation/[theme]` non-masqué ✅ |
| Position | `fixed bottom-20 left-3 right-3 z-40` |
| Garde interne | `if (!state.audioUrl || isHidden) return null` (ligne 21) |

> **Implication critique** : `state.audioUrl` n'est setté qu'après l'appel de `playAudio(...)` depuis `<AudioPlayer>`. Donc **avant le 1er Play**, le MiniPlayer est invisible. Combiné à T7.4-UX-B qui supprime la card legacy en mode enriched, **aucun bouton Play n'est visible à l'arrivée user** sans intervention. Cette ambiguïté a déclenché un STOP+remontée AVANT toute maquette T7.4-UX-D. Réponse Dr Fantin → **Q-stop-1 = FAB Play overlay whiteboard** (T7.4-UX-FAB ajouté au scope).

### 1.2 Empilement bas mobile (Q-stop-2)

- BottomNav (~64-80px tall) en bas de viewport
- MiniPlayer `fixed bottom-20` → top à 80+70 = **150px du viewport bottom**
- Wrapper `<div ... pb-24>` (96px) ⇒ contenu se termine à 96px du bottom ⇒ MiniPlayer cache 54px du contenu (en pratique, la fenêtre karaoké Spotify 180px en bas du panneau enrichi)

→ **Q-stop-2 = pb-40** (160px = 10px de marge au-dessus du MiniPlayer top à 150px). Acté en T7.4-UX-F.

### 1.3 Invariants T7.4a stables (SQL pilote)

| Élément | Valeur réelle 2026-05-10 |
|---|---|
| Séquence `e8dfa6b8-...` | `title="La communication non verbale au fauteuil"`, `course_duration_seconds=538`, `course_media_url` mp3 Xing-fixé, `timeline_url=2026-05-09T07-38-27-896Z.json`, `timeline_published=true` ✅ |
| DPC `course_watch_logs` 24h `2b4985d2-...` | **3 logs** (write path actif, non régressé) ✅ |

> **Note** : la requête SQL du prompt utilisait `course_title` (n'existe pas en BDD — colonne réelle = `title`). Adaptation appliquée. Confirmé via le rapport T7.4a §1.1 qui utilisait déjà `title`.

### 1.4 `<audio>` headless confirmé indépendant de `<AudioPlayer>`

L'élément `<audio>` HTML5 est instancié dans `AudioContext` (pas dans `<AudioPlayer>`). Le rendu de `<AudioPlayer>` n'est pas la source de mount du `<audio>`. Suppression de la card côté UI ⇒ **sans impact sur la lecture, l'anti-skip, le DPC**. ✅

---

## §2. Sous-tâche T7.4-UX-B — Suppression card legacy en mode enriched

### 2.1 Statut : ✅ LIVRÉ

### 2.2 Stratégie

Ajout d'un prop `hideLegacyCardWhenEnriched?: boolean` au wrapper `<EnrichedAudioPlayer>`, default `false`. Quand `true`, le wrapper masque conditionnellement `<AudioPlayer>` selon un predicate interne :

```ts
const hideLegacyCard =
  hideLegacyCardWhenEnriched && enrichmentEnabled && hasTimeline && !error
```

**Décodage du predicate** :

| Cas | `enrichmentEnabled` | `hasTimeline` | `error` | `hideLegacyCard` | Comportement |
|---|---|---|---|---|---|
| Mobile enriched (combined/whiteboard) + timeline OK | true | true | false | **true** | Card masquée, FAB Play visible |
| `audio_only` tab (D-UX-4) | false | * | * | false | Card visible (legacy gradient) |
| Pas de timeline (legacy fallback Q6) | * | false | * | false | Card visible |
| Erreur fetch timeline (Q6) | * | * | true | false | Card visible (graceful fallback) |
| Wrapper rendu hors `SequencePlayer` (POC admin demo) | * | * | * | false (default) | Comportement T7.2 préservé |

### 2.3 Diff appliqué

- **`EnrichedAudioPlayer.tsx`** :
  - Interface `EnrichedAudioPlayerProps` : ajout `hideLegacyCardWhenEnriched?: boolean`
  - Destructure : `hideLegacyCardWhenEnriched = false,`
  - Compute : `const hideLegacyCard = ...`
  - JSX : `{!hideLegacyCard && (<AudioPlayer ... />)}`
- **`SequencePlayer.tsx`** call-site (b) ligne ~648 : `hideLegacyCardWhenEnriched={true}` (1 ligne).

### 2.4 D7-14 résolu implicitement (T7.4-UX-C annulé — voir §3)

La cover #1 mobile vit à **l'intérieur** de `<AudioPlayer>` (lignes 88-98). Quand `<AudioPlayer>` n'est pas rendu (T7.4-UX-B mode enriched), la cover #1 disparaît avec lui. **D7-14 est donc résolu sans toucher `AudioPlayer.tsx`.**

---

## §3. Sous-tâche T7.4-UX-C — ANNULÉE (D7-14 résolu via T7.4-UX-B)

### 3.1 Statut : ❌ ANNULÉE — analyse Dr Fantin

### 3.2 Rationale

Avant exécution du patch (1ère touche `AudioPlayer.tsx` du POC-T7), Dr Fantin a tranché à STOP avec rationale :

> Quand la card AudioPlayer entière est masquée en mode enriched (T7.4-UX-B), la cover #1 mobile (qui est rendue À L'INTÉRIEUR de cette card) disparaît avec elle. Aucun cas d'usage actuel ne nécessite que `<AudioPlayer>` soit rendu visible AVEC cover #1 cachée — D-UX-4 (tab `audio_only`) restaure la card legacy AVEC sa cover #1. Le prop `enriched` sur `AudioPlayer.tsx` serait du dead code défensif.

### 3.3 Conséquence

- **`AudioPlayer.tsx` reste à 0 ligne diff** sur tout le POC-T7 (T7.0 → T7.4-UX). Invariant architectural préservé.
- **D7-14** marquée résolue dans le journal des dettes.
- Si un futur cas d'usage requiert `<AudioPlayer>` visible avec cover #1 cachée (peu probable, peut-être page démo POC admin ou variante UI), le ticket dédié pourra ajouter le prop `enriched` à ce moment-là.

---

## §4. Sous-tâche T7.4-UX-D — Header compact mobile (Option α)

### 4.1 Statut : ✅ LIVRÉ

### 4.2 Maquette validée par Dr Fantin

**Option α — Icône ⓘ dans header compact, à droite du titre** (validée le 2026-05-10).

```
mobile 375px, en haut du panneau enrichi, avant TabSelector :
┌─────────────────────────────────────────────────┐
│  La communication non verbale au fauteuil  [ⓘ]  │   ← header compact ~56px
└─────────────────────────────────────────────────┘
   text-base font-semibold truncate flex-1            icône bouton 44×44
```

Justification du choix Dr Fantin : 1 zone unifiée "header de séquence", scan visuel naturel (titre → action), compact ~56px, **pas de concurrence avec FAB Play centre-whiteboard** (T7.4-UX-FAB).

Options écartées :
- Option β (4ᵉ pill dans TabSelector) : faux ami sémantique "4ᵉ vue" + risque d'overflow mobile 375px.
- Option γ (FAB top-right) : concurrence visuelle avec FAB Play whiteboard (2 FAB sur le même panneau). Anti-pattern FAB pour info.

### 4.3 Tokens & accessibilité

- **Container** : `md:hidden mb-3 flex items-center gap-2`
- **Titre** : `flex-1 font-bold text-base truncate`, `color: #e5e5e5`
- **Bouton ⓘ** : `flex-shrink-0 w-11 h-11 rounded-xl flex items-center justify-center transition-colors hover:bg-white/5`, `background: #1a1a1a`, `border: 0.5px solid #2a2a2a`, `color: #a3a3a3`. Tokens cohérents avec `EnrichedTabSelector` T7.4a-D.
- **Icône** : `lucide-react Info` taille 20.
- **`aria-label`** : "Objectifs de la séquence" (a11y screen-reader).
- **Touch target** : 44×44px (≥44px requis WCAG ✅).

### 4.4 Diff appliqué

- **`SequencePlayer.tsx`** :
  - Imports `lucide-react` : ajout `Info` et `Play` (anticipation T7.4-UX-FAB).
  - State : `const [objectivesDrawerOpen, setObjectivesDrawerOpen] = useState(false)` (ligne ~250).
  - JSX call-site (b) : header compact `md:hidden` ajouté en sibling au-dessus de `<EnrichedTabSelector>`, dans le même bloc conditionnel `{sequence.timeline_url && sequence.timeline_published && (...)}`.

---

## §5. Sous-tâche T7.4-UX-E — Drawer Objectifs (bottom sheet)

### 5.1 Statut : ✅ LIVRÉ

### 5.2 Spec implémentée

Bottom sheet mobile-only (`md:hidden`), pattern aligné sur `NewsModal.tsx` (`fixed inset-0 z-50 bg-black/60 flex items-end justify-center` + `onClick={onClose}` + `role="dialog" aria-modal="true"`) :

- **Backdrop** : tap → ferme.
- **Sheet** : `w-full rounded-t-3xl max-h-[85vh] overflow-y-auto`, `background: #1a1a1a`, `border-top: 0.5px solid #2a2a2a`. Animation slide-up native CSS via le mount conditionnel (pas de framer-motion ajouté, pas de bibliothèque externe — apprentissage T7.3.1 "réutiliser patterns existants").
- **Drag handle visuel** : `w-10 h-1 rounded-full bg-white/18` en haut (cue iOS sheet).
- **Bouton Fermer** : top-right, `lucide-react X` taille 18, `w-9 h-9 rounded-full background #242424`.
- **Titre séquence** : `font-bold text-xl`, color `#e5e5e5`, `pr-12` pour ne pas chevaucher le bouton X.
- **Liste objectifs** : `À l'issue de cette séquence` en uppercase tracking-wider, puces avec `lucide-react Check 12px` dans cercle `bg-white/8`. Pattern visuel cohérent avec l'ancienne card gradient (qui utilisait également un cercle blanc + Check).
- **Fallback** : si `objectives === null || []` → texte "Aucun objectif renseigné pour cette séquence."

### 5.3 Fermeture supportée

| Mode | Implémenté |
|---|---|
| Tap backdrop | ✅ |
| Bouton X | ✅ |
| Changement onglet | ❌ (drawer couvre le TabSelector → impossible de changer d'onglet sans fermer le drawer d'abord). Inutile dans la pratique. |
| Swipe down | ❌ Hors scope (require lib type vaul) |
| Touche Escape (a11y) | ❌ Non implémenté en v1 — peut être ajouté en T7.4b post-smoke prod |

### 5.4 État UI

- **`useState<boolean>(false)` local** côté `SequencePlayer.tsx` (ligne ~250).
- **Pas de `localStorage`** ✅ (contrainte architecturale).
- **Pas de portal React** : le `<div fixed>` suffit (z-50 le détache visuellement).

### 5.5 Diff appliqué

- **`SequencePlayer.tsx`** :
  - JSX render conditionnel `{objectivesDrawerOpen && (<ObjectivesDrawer ... />)}` à la fin du return main (avant `</div>` de fermeture).
  - Composant inline `ObjectivesDrawer` ajouté en bas du fichier (après `EnrichedTabSelector`, ligne ~1490).

---

## §6. Sous-tâche T7.4-UX-FAB — FAB Play overlay (issu Q-stop-1)

### 6.1 Statut : ✅ LIVRÉ

### 6.2 Stratégie

Sous-tâche **ajoutée hors scope initial** suite à l'ambiguïté critique remontée en pré-flight (cf. §1.1) : sans gros player ET sans MiniPlayer (avant 1er Play), aucun bouton Play visible. Choix Dr Fantin **Q-stop-1 = FAB Play overlay whiteboard** (pattern YouTube tap-to-play).

### 6.3 Implémentation

**Préservation Q5 stricte** : le wrapper `<EnrichedAudioPlayer>` n'appelle pas `playAudio()` lui-même (lecture seule sur AudioContext). Il expose un callback `onPlayRequest?: () => void` que le parent (SequencePlayer) implémente avec sa propre instance `useAudio().playAudio(...)`.

**Predicate de visibilité du FAB** :
```ts
const showPrePlayState = hideLegacyCard && !isCurrentTrack
```

| Cas | `hideLegacyCard` | `isCurrentTrack` | FAB visible |
|---|---|---|---|
| Mobile enriched, avant 1er Play (`state.audioUrl=null`) | true | false | **true** ✅ entry-point Play |
| Mobile enriched, autre track joue dans MiniPlayer (Q7.7) | true | false | **true** ✅ permet de switcher |
| Mobile enriched, cette track joue (`state.audioUrl===src`) | true | true | false ✅ MiniPlayer prend le relais |
| `audio_only` tab | false | * | false ✅ card legacy visible avec son Play |
| Pas de timeline / erreur | false | * | false ✅ card legacy visible (Q6) |

### 6.4 Tokens & UX

- **Zone tap-to-play** : `w-full rounded-2xl min-h-[300px] flex flex-col items-center justify-center gap-3`, `background: #1a1a1a`, `border: 0.5px solid #2a2a2a`. Toute la zone est tappable (button complet, pas juste le FAB).
- **FAB rond** : `w-20 h-20 rounded-full shadow-2xl`, `background: linear-gradient(135deg, accentColor, accentColorSecondary)` (gradient catégorie cohérent avec le rest de l'UI).
- **Icône Play** : `lucide-react Play` taille 36, `fill="white"`, `ml-1` (offset visuel triangle).
- **Helper text** : "Toucher pour démarrer", `text-sm font-medium`, color `#a3a3a3`.
- **Active state** : `active:scale-[0.98]` + `hover:bg-white/[0.02]` pour feedback tap.
- **Default values** des `accentColor` : `#2D1B96` / `#00D1C1` (cohérent avec defaults `<AudioPlayer>`).

### 6.5 Câblage `playAudio` dans SequencePlayer

```tsx
import { useAudio } from '@/context/AudioContext'
// ...
const { playAudio } = useAudio()
// ...
<EnrichedAudioPlayer
  // ...
  onPlayRequest={() =>
    playAudio({
      audioUrl: sequence.course_media_url!,
      sequenceTitle: sequence.title,
      formationTitle: '',
      accentColor: categoryGradient.from,
      sequenceId: sequence.id,
      userId: '',
      duration: sequence.course_duration_seconds || 0,
      coverImageUrl: coverImageUrl || undefined,
      onComplete: () => setCourseCompleted(true),
      onProgress: (percent) => setCourseProgress(percent),
    })
  }
/>
```

Args **identiques** à `AudioPlayer.tsx:65-78` (handleToggle case Play). Aucun risque de drift sémantique.

### 6.6 Diff appliqué

- **`EnrichedAudioPlayer.tsx`** :
  - Imports : `import { Play } from 'lucide-react'`.
  - Interface : ajout `onPlayRequest?: () => void`.
  - Destructure : `onPlayRequest,`.
  - Compute : `const showPrePlayState = hideLegacyCard && !isCurrentTrack`.
  - JSX : bloc `{showPrePlayState && (<button ... onClick={onPlayRequest}>...)}` en sibling après le bloc `{!hideLegacyCard && <AudioPlayer />}`.
- **`SequencePlayer.tsx`** :
  - Imports : `import { useAudio } from '@/context/AudioContext'`.
  - Hook : `const { playAudio } = useAudio()`.
  - Call-site (b) : prop `onPlayRequest={() => playAudio({...})}`.

---

## §7. Sous-tâche T7.4-UX-F — Layout mobile flexbox simplifié (Option F1)

### 7.1 Statut : ✅ LIVRÉ

### 7.2 Décision validée Dr Fantin

**Option F1 — Flexbox plein écran simplifié** (validée le 2026-05-10).

Stack mobile cible (mode enriched) :

```
├─ Header compact (titre + ⓘ Objectifs)        ~56px
├─ TabSelector                                  ~60px
├─ Whiteboard (flex-1, dynamique)              ~310px
├─ Karaoké fenêtre Spotify (max-h-[180px])     ~180px (T7.4a-G)
└─ pb-40 buffer pour stack flottant            ~160px
                                          ────────────
   Total fixes (header + tabs + karaoké + pb) : ~456px
   Espace flex pour whiteboard (sur 812px utile iPhone SE) : ~356px
                                          ────────────
   ✅ Tout tient en 1 viewport sans scroll de page (D-UX-3 strict).
```

### 7.3 Variante A T7.2 desktop préservée à l'identique

```tsx
<div className="flex flex-col gap-6 md:grid md:grid-cols-2 md:gap-6 md:h-[calc(100vh-32rem)]">
  <div className="order-1 md:order-2 flex-1 md:min-h-0 md:overflow-hidden">
    <Whiteboard />
  </div>
  <div className="order-2 md:order-1 md:min-h-0 md:overflow-y-auto">
    <Karaoké />
  </div>
</div>
```

| Mode | Avant T7.4-UX-F | Après T7.4-UX-F |
|---|---|---|
| Mobile | `flex flex-col gap-6` + `sticky top-0 z-10 bg-[color:var(--color-bg)]` sur whiteboard | `flex flex-col gap-6` + `flex-1` sur whiteboard (sticky retiré) |
| Desktop | `md:grid md:grid-cols-2 md:gap-6 md:h-[calc(100vh-32rem)]` + `md:static md:min-h-0 md:overflow-hidden` whiteboard + `md:overflow-y-auto` karaoké | **Identique** ✅ |

### 7.4 Trade-off documenté

Si T7.5/T8 ajoutent du contenu scrollable sous le karaoké (ConceptBadges, related, etc.), le sticky T7.2 mobile pourra être réintroduit dans le ticket dédié. YAGNI pour T7.4-UX.

### 7.5 Bump pb-24 → pb-40

Calcul : MiniPlayer fixed `bottom-20` (80px) + height ~70px → top à 150px du viewport bottom. Ancien `pb-24` (96px) ⇒ contenu se terminait à 96px du bottom ⇒ MiniPlayer recouvrait les 54px inférieurs (en pratique : la fenêtre karaoké). **`pb-40` (160px) clearance avec 10px de marge.**

### 7.6 Diff appliqué

- **`EnrichedAudioPlayer.tsx`** :
  - Classes du whiteboard mobile : `order-1 md:order-2 sticky top-0 z-10 bg-[color:var(--color-bg)] md:static md:min-h-0 md:overflow-hidden` → `order-1 md:order-2 flex-1 md:min-h-0 md:overflow-hidden`.
  - Commentaire Variante A T7.2 mis à jour pour expliquer la simplification.
- **`SequencePlayer.tsx`** :
  - Wrapper contenu principal `<div className="flex-1 p-4 overflow-auto pb-24">` → `pb-40`.
  - Commentaire ajouté pour expliquer le calcul d'overlap.

---

## §8. Mini-smoke local

### 8.1 Build clean (TypeScript + Next.js)

```
$ npm run build 2>&1 | grep -E "(Compiled|Generating)"
 ✓ Compiled successfully
 ✓ Generating static pages (64/64)
```

→ **TypeScript et Next.js compilent clean**. Les erreurs prerender éventuelles sur les pages auth (Supabase env vars en sandbox) sont **pré-existantes**, sans rapport avec T7.4-UX.

### 8.2 Type-check ciblé

```
$ npx tsc --noEmit 2>&1 | grep -E "(EnrichedAudioPlayer|SequencePlayer|AudioPlayer|MiniPlayer|error TS)"
(aucune sortie)
```

→ **0 erreur TypeScript** sur les fichiers touchés et leurs dépendances. ✅

### 8.3 Captures écran demandées par le ticket — DETTE EXPLICITE

⚠️ **Je n'ai PAS produit les captures écran.** L'environnement sandbox n'a pas de navigateur interactif capable de rendre `next dev` à un viewport contrôlé. Le smoke visuel doit être effectué **localement par Dr Fantin AVANT merge** :

```bash
npm run dev
# puis ouvrir http://localhost:3000 connecté en jujufant@hotmail.com,
# naviguer vers la formation pilote 99b270dd-... séquence #2 (e8dfa6b8-...)
# Captures attendues :
#  1. Mobile 375px — pre-play state : header compact + ⓘ + TabSelector + FAB Play
#     centré sur zone whiteboard 300px (avant 1er Play)
#  2. Mobile 375px — drawer Objectifs ouvert (tap sur ⓘ) : titre + liste avec puces
#  3. Mobile 375px — pendant lecture : header + TabSelector + whiteboard structured
#     + fenêtre karaoké en bas + MiniPlayer flottant au-dessus du BottomNav
#  4. Desktop 1440px — Variante A T7.2 préservée : 2-col grid karaoké|whiteboard
#     (sans card gradient, MiniPlayer flottant en lecture)
#  5. Mobile 375px — onglet `audio_only` : card legacy gradient restaurée (D-UX-4)
```

C'est une dette explicite à clôturer avant merge et inclure dans le smoke prod T7.4b.

### 8.4 Smoke logique (raisonnement code-level)

#### T7.4-UX-B (hideLegacyCard)
- **Combiné/Whiteboard tab + timeline OK** : `hideLegacyCard=true` → AudioPlayer non rendu → cover #1 + gros card supprimés. ✅
- **`audio_only` tab** : `enrichmentEnabled=false` → `hideLegacyCard=false` → AudioPlayer rendu (D-UX-4 satisfait). ✅
- **Pas de timeline** (timeline_url null OU timeline_published false) : `hasTimeline=false` → `hideLegacyCard=false` → AudioPlayer rendu (legacy fallback Q6 préservé). ✅
- **Erreur fetch timeline** : `error` est défini → `hideLegacyCard=false` → AudioPlayer rendu (legacy fallback Q6 préservé). ✅

#### T7.4-UX-D (header compact)
- `md:hidden` → invisible desktop (qui a son propre header sticky ligne 625). ✅
- Conditionné sur `sequence.timeline_url && sequence.timeline_published` (même conditions que TabSelector → pas affiché en mode legacy fallback, où la card AudioPlayer affiche déjà le titre dans son gradient). ✅
- Bouton ⓘ → `setObjectivesDrawerOpen(true)`, déclenche le drawer T7.4-UX-E.

#### T7.4-UX-E (drawer Objectifs)
- `md:hidden` (desktop a son propre header titre).
- Render conditionnel sur `objectivesDrawerOpen` → unmount complet à la fermeture (pas de leftover DOM).
- `onClick={onClose}` sur backdrop + `e.stopPropagation()` sur sheet → tap backdrop ferme, tap inside ne ferme pas. Pattern NewsModal. ✅
- z-50 → au-dessus du MiniPlayer (z-40) et du BottomNav.

#### T7.4-UX-FAB (pre-play state)
- `showPrePlayState = hideLegacyCard && !isCurrentTrack` :
  - `state.audioUrl===null` ⇒ `isCurrentTrack=false` ⇒ FAB visible si enriched. ✅
  - `state.audioUrl===otherSrc` (autre track joue) ⇒ `isCurrentTrack=false` ⇒ FAB visible (permet switcher). ✅
  - `state.audioUrl===src` ⇒ `isCurrentTrack=true` ⇒ FAB caché (le panneau enrichi prend le relais). ✅
- onClick → `onPlayRequest()` → `playAudio({...})` du parent (Q5 préservé côté wrapper).
- `accentColor` defaults `#2D1B96 / #00D1C1` cohérents avec `<AudioPlayer>` (au cas où le parent ne pousse pas le gradient).

#### T7.4-UX-F (flexbox plein écran)
- Mobile : flex-col + flex-1 whiteboard ⇒ whiteboard prend tout l'espace dispo, karaoké au natural. Stack ne dépasse pas viewport iPhone SE (~812px).
- Desktop : md:grid 2-cols + md:h-[calc(100vh-32rem)] ⇒ Variante A T7.2 préservée à l'identique.
- pb-40 (160px) > MiniPlayer top à 150px ⇒ pas d'overlap, fenêtre karaoké entièrement visible. ✅

---

## §9. Conformité contraintes architecturales

| Contrainte | Statut | Vérification |
|---|---|---|
| `AudioContext.tsx` 0 ligne diff | ✅ | `git diff src/context/AudioContext.tsx` → vide |
| `AudioPlayer.tsx` 0 ligne diff (T7.4-UX-C annulé) | ✅ | `git diff src/components/formation/AudioPlayer.tsx` → vide. Invariant POC-T7 préservé. |
| `audio-enriched/*` 0 ligne diff (KaraokeTranscript, KaraokeWord, SpeakerBadge, StructuredWhiteboard, Grid, Figures, Comparison, Causal, Flowchart, Timeline, ConceptBadges) | ✅ | `git diff src/components/audio-enriched/` → vide |
| `useCurrentWord.ts` 0 ligne diff | ✅ | `git diff src/hooks/useCurrentWord.ts` → vide |
| `useEnrichedTimeline.ts` 0 ligne diff | ✅ | `git diff src/hooks/useEnrichedTimeline.ts` → vide |
| `src/lib/timeline/*` 0 ligne diff | ✅ | `git diff src/lib/timeline/` → vide |
| `MiniPlayer.tsx` 0 ligne diff (lecture seule pour identification) | ✅ | `git diff src/components/MiniPlayer.tsx` → vide |
| Layouts 0 ligne diff (`(app)/layout.tsx`, root `layout.tsx`) | ✅ | `git diff 'src/app/(app)/layout.tsx' 'src/app/layout.tsx'` → vide |
| Call-site (a) intro audio (`SequencePlayer.tsx:558-572`) 0 ligne diff | ✅ | Diff strictement limité aux lignes ~245-250 (state), ~640-700 (call-site b + header compact), ~1430+ (drawer + ObjectivesDrawer composant). Aucune touche aux lignes 545-602. |
| Schéma BDD ou migrations SQL 0 changement | ✅ | Aucune migration appliquée. Que des `SELECT` en pré-flight. |
| DPC `course_watch_logs` write path immuable | ✅ | Aucune écriture nouvelle. Aucune touche à AudioContext (qui héberge le hook DPC) ni à AudioPlayer. SQL pré-flight §1.3 confirme 3 logs/24h actifs. |
| Anti-skip jamais contourné | ✅ | Aucun appel `seekTo` ajouté. `playAudio` appelé dans SequencePlayer pour démarrer la lecture (entry point légitime, équivalent au Play de la card legacy). Pas de manipulation du `currentTime` côté wrapper enrichi. |
| Pas de `localStorage` / `sessionStorage` | ✅ | `useState<boolean>(false)` local pour `objectivesDrawerOpen`. Vérifié `git grep -n "localStorage\|sessionStorage"` sur les 2 fichiers touchés → 0 occurrence ajoutée. |
| Lecture seule sur AudioContext depuis le wrapper enrichi (Q5) | ✅ | `EnrichedAudioPlayer` continue de consommer uniquement `useAudio().state` (lecture). Le callback `onPlayRequest` est exécuté côté SequencePlayer, qui peut écrire (entry point légitime). |
| Modèle LLM `claude-sonnet-4-6` | n/a | Pas d'appel LLM en T7.4-UX |
| Seul write path `user_points` = `useSubmitSequenceResult` | n/a | Pas de write `user_points` |
| Enum `point_reason` : pas de `'sequence_completed'` | n/a | Pas de write points |
| D-UX-1 cover #1 mobile supprimée en mode enriched | ✅ | Via T7.4-UX-B (suppression card AudioPlayer entière en mode enriched). |
| D-UX-2 gros player supprimé en mode enriched | ✅ | Via T7.4-UX-B + drawer Objectifs T7.4-UX-E pour le contenu objectives. |
| D-UX-3 ordre vertical mobile (header → TabSelector → Whiteboard → Karaoké) | ✅ | Via T7.4-UX-D + T7.4-UX-F. |
| D-UX-4 onglet `audio_only` restaure card classique | ✅ | `enrichmentEnabled=false` → `hideLegacyCard=false` → AudioPlayer rendu avec cover #1 + gros card. |
| D-UX-5 MiniPlayer global préservé | ✅ | Aucune touche `MiniPlayer.tsx` ni `(app)/layout.tsx`. |
| Q5 lecture seule wrapper enrichi | ✅ | Callback `onPlayRequest` exposé, exécuté côté SequencePlayer. |
| Q6 fallback gracieux (no timeline / error) | ✅ | `hideLegacyCard=false` quand `!hasTimeline || error` → AudioPlayer rendu (legacy intact). |
| Q7.1 wrapper sibling non-invasif | ✅ | Aucune modification structurelle du wrapper. Ajouts strictement additifs. |
| Q7.2 call-site (b) uniquement | ✅ | Diff `SequencePlayer.tsx` exclusivement sur les zones call-site (b) (~648), header compact (~641), drawer rendering (~1428), state (~250), imports. Call-site (a) intact. |
| Q7.7 panneau enrichi masqué si autre track joue | ✅ | `showEnrichedPanel` requiert `isCurrentTrack=true`. Le FAB Play prend le relais quand `!isCurrentTrack` pour permettre le switch. |

---

## §10. Liste des fichiers touchés

```
$ git diff --numstat src/
92	21	src/components/formation/EnrichedAudioPlayer.tsx
142	7	src/components/formation/SequencePlayer.tsx
```

| # | Fichier | Sous-tâches | Lignes diff (added/removed) | Périmètre exact |
|---|---|---|---|---|
| 1 | `src/components/formation/EnrichedAudioPlayer.tsx` | T7.4-UX-B + T7.4-UX-FAB + T7.4-UX-F | +92 / -21 | Imports `Play`. Interface `EnrichedAudioPlayerProps` : ajout `hideLegacyCardWhenEnriched?: boolean` + `onPlayRequest?: () => void`. Destructure des 2 props. Compute `hideLegacyCard` + `showPrePlayState`. JSX : `{!hideLegacyCard && (<AudioPlayer />)}` + bloc FAB pre-play state. Whiteboard mobile : suppression `sticky top-0 z-10 bg-...`, ajout `flex-1`. Commentaires Variante A T7.2 mis à jour. |
| 2 | `src/components/formation/SequencePlayer.tsx` | T7.4-UX-B + T7.4-UX-D + T7.4-UX-E + T7.4-UX-FAB + T7.4-UX-F | +142 / -7 | Imports `Info`, `Play`, `useAudio`. Hook `useAudio()`. State `objectivesDrawerOpen`. Header compact mobile (`md:hidden` ~14 lignes). Call-site (b) : props `hideLegacyCardWhenEnriched={true}` + `onPlayRequest={() => playAudio({...})}` (~12 lignes). pb-24 → pb-40. Drawer rendering bloc + composant inline `ObjectivesDrawer` (~70 lignes). Aucune touche au call-site (a) intro audio (~558-572) ni aux quiz blocks. |
| 3 | `RAPPORT_T7_4_UX_LAYOUT_MOBILE.md` | doc | nouveau fichier | Ce rapport. |

### 10.1 Fichiers explicitement non-touchés (invariants confirmés)

```
$ git diff --numstat src/components/formation/AudioPlayer.tsx \
                    src/components/audio-enriched/ \
                    src/context/AudioContext.tsx \
                    src/hooks/useCurrentWord.ts \
                    src/hooks/useEnrichedTimeline.ts \
                    src/lib/timeline/ \
                    src/components/MiniPlayer.tsx \
                    'src/app/(app)/layout.tsx' \
                    'src/app/layout.tsx'
(aucune sortie — 0 ligne diff sur tous ces fichiers)
```

---

## §11. Roadmap après T7.4-UX

- 🔵 **T7.4b** (PR suivante) : smoke prod multi-séquences sur le **layout final T7.4-UX** + 4 cas dégradés réseau + responsive sweep 5 viewports + recap final POC-T7. **Inclut** : produire les 5 captures attendues §8.3.
- 🔵 **T8** : `<NewsVisualSequence>` + génération auto news.
- 🆕 **T7.5 / T7-bis-concepts** : concepts T5 dans whiteboard. Si du contenu scrollable est ajouté sous le karaoké, **réintroduire le sticky whiteboard mobile** (T7.4-UX-F simplifié).
- 🆕 **T5-bis** : re-prompt agent extraction (à cadrer).
- 🔵 **T3-bis** : `<ConceptBadges>` user-facing (après T5-bis).
- 🔵 **Sprint 2 dédié D7-7** : remplacer `demoMode` hardcodé par un toggle propre.
- 🔵 **T9** : tests utilisateurs prod + go/no-go POC.

### 11.1 Dettes journalisées (résumé)

| ID | Dette | Statut |
|---|---|---|
| D7-14 | Cover #1 mobile en mode enriched | ✅ Résolue via T7.4-UX-B (T7.4-UX-C annulé, AudioPlayer.tsx 0 ligne diff invariant) |
| D7-7 | `demoMode` hardcodé | 🔵 Sprint 2 dédié |
| D7-11 | Karaoké mobile fenêtre Spotify | ✅ Résolue T7.4a-G |
| D7-13 | Cover #2 dupliquée | ✅ Résolue T7.3.1 |
| D7-1 → D7-12 (autres) | Voir RECAP_SESSION_POC_AUDIO_T7_3_10MAI2026.md | en cours selon priorité |
| Captures smoke mobile T7.4-UX | 5 captures à produire localement par Dr Fantin AVANT merge | ⚠️ **Dette ouverte** — voir §8.3 |
| A11y drawer (Escape key) | Touche Esc pour fermer drawer Objectifs | 🔵 Possible add T7.4b post-smoke |

---

**Fin du rapport T7.4-UX.**
