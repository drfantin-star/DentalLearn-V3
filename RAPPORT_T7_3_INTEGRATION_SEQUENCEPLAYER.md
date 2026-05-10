# Rapport POC-T7.3 — Intégration `<EnrichedAudioPlayer>` dans `SequencePlayer.tsx`

> Branchement du wrapper enrichi (livré T7.2) au flow user réel, **call-site
> (b) uniquement** de `src/components/formation/SequencePlayer.tsx`.
>
> Branche : `claude/integrate-enriched-audio-player-9tqQP`.
> Date : 10/05/2026.
> Périmètre : T7.3 selon prompt initial. Hors scope : T7.4 (hardening +
> smoke prod), tab selector UI, fix D7-7.

---

## §1. Périmètre & non-périmètre

### 1.1 Inclus

- **Modification du seul call-site (b) de `SequencePlayer.tsx`** (lignes
  637-652 de l'état pré-T7.3) : substitution du `<AudioPlayer>` par
  `<EnrichedAudioPlayer>` avec passage des nouvelles props
  `timelineUrl`, `timelinePublished`, `activeTab`.
- Ajout de l'import `EnrichedAudioPlayer` en tête de fichier.
- Investigation lecture seule de la dette **D7-7** (`demoMode` hardcoded
  ligne 238). Aucun fix.
- Inspection de l'ancestor layout user-side (`(app)/layout.tsx` +
  `app/layout.tsx`) pour détecter le pattern **D7-10**
  (`<main className="overflow-auto">` qui casse les sticky enfants).
- Documentation du périmètre, du diff, et des étapes restantes pour T7.4.

### 1.2 Exclus

- ❌ Modification du call-site (a) intro audio (lignes 556-571 de
  SequencePlayer.tsx) — reste en `<AudioPlayer>` legacy mot pour mot.
- ❌ Modification de `src/context/AudioContext.tsx` (vérifié `git diff` =
  vide).
- ❌ Modification de `src/components/formation/AudioPlayer.tsx` (vérifié
  `git diff` = vide).
- ❌ Modification de `src/components/formation/EnrichedAudioPlayer.tsx`
  (vérifié `git diff` = vide).
- ❌ Fix de la dette D7-7 (`demoMode` hardcoded). Investigation seule.
- ❌ Fix éventuel de la dette D7-10 si détectée.
- ❌ Smoke prod sur Vercel preview (= T7.4).
- ❌ Tab selector UI (Combiné / Whiteboard / Audio seul). En T7.3
  l'`activeTab` est hardcodé à `"combined"` côté call-site (b) — la
  conception et l'ajout du segmented control / dropdown sont reportés
  à T7.4 hardening (cf. §10 RAPPORT_T7_2 point 4).

---

## §2. Diff appliqué

### 2.1 Fichier modifié

**`src/components/formation/SequencePlayer.tsx`** : +6 / −2 (8 lignes
touchées au total, 2 substitutions + 1 import + 3 props nouvelles).

```diff
@@ -23,6 +24,7 @@ import {
   type Question,
 } from '@/lib/supabase'
 import AudioPlayer from './AudioPlayer'
+import EnrichedAudioPlayer from './EnrichedAudioPlayer'
 import TreasureChest from '@/components/sequences/TreasureChest'

@@ -633,10 +634,10 @@ export default function SequencePlayer({
         {/* COURS (VIDEO ou AUDIO) */}
         {playerStep === 'video' && (
           <div className="text-center py-6">
-            {/* ─── AudioPlayer ─── */}
+            {/* ─── AudioPlayer enrichi (POC-T7.3) ─── */}
             {mediaType === 'audio' && sequence.course_media_url && (
               <div className="mb-6">
-                <AudioPlayer
+                <EnrichedAudioPlayer
                   src={sequence.course_media_url}
                   duration={sequence.course_duration_seconds || 0}
                   sequenceId={sequence.id}
@@ -647,6 +648,9 @@ export default function SequencePlayer({
                   onProgress={(percent) => setCourseProgress(percent)}
                   accentColor={categoryGradient.from}
                   accentColorSecondary={categoryGradient.to}
+                  timelineUrl={sequence.timeline_url ?? null}
+                  timelinePublished={sequence.timeline_published ?? false}
+                  activeTab="combined"
                 />
               </div>
             )}
```

### 2.2 Vérification fichiers protégés (diff vs `origin/main`)

| Fichier | Diff |
|---|---|
| `src/context/AudioContext.tsx` | 0 ligne |
| `src/components/formation/AudioPlayer.tsx` | 0 ligne |
| `src/components/formation/EnrichedAudioPlayer.tsx` | 0 ligne |
| `src/components/formation/SequencePlayer.tsx` | +6 / −2 |

Vérifié :

```bash
git diff --stat origin/main -- \
  src/context/AudioContext.tsx \
  src/components/formation/AudioPlayer.tsx \
  src/components/formation/EnrichedAudioPlayer.tsx
# Output: (vide, aucune ligne modifiée)
```

### 2.3 Choix de design pour `activeTab`

`activeTab` est une prop **requise** de `<EnrichedAudioPlayer>` (signature
`'combined' | 'whiteboard' | 'audio_only'`). En T7.3, valeur **hardcodée
à `"combined"`** au call-site. Justification :

- **Diff minimal exigé** par le prompt (`uniquement call-site (b) +
  imports nécessaires`).
- L'ajout d'un `useState<EnrichedPlayerTab>('combined')` + segmented
  control / dropdown est listé comme prochaine étape T7.3 dans le rapport
  T7.2 §10 point 4 mais avec la mention « UI de tab à designer […]
  décision Dr Fantin ». Aucune spec de design retenue avant T7.3 →
  reporté T7.4 sans bloquer l'intégration.
- Conséquence user T7.3 : tous les users qui ouvrent une séquence audio
  pilote (`timeline_published === true`) voient le mode Combiné
  (whiteboard + karaoké). Pas d'option « Audio seul » exposée. Le
  fallback Q6 (timeline absente/non publiée/KO) masque le panneau
  enrichi → comportement identique à l'`<AudioPlayer>` legacy.

### 2.4 Choix `?? null` / `?? false` sur les nouvelles props

Le type `Sequence` (cf. `src/lib/supabase/types.ts` lignes 52-56)
expose `timeline_url?: string | null` et `timeline_published?: boolean`
en additif (extension T7.2). En BDD, la colonne `timeline_published` est
`NOT NULL` avec `default false` (vérifié §3) ; `timeline_url` est
nullable.

Comme la requête de récupération côté user passe par `select('*')` (cf.
§4), les deux colonnes sont **toujours retournées** par Supabase. Le
fallback `?? null` / `?? false` couvre uniquement le cas où une nouvelle
requête fetch écrirait un projection partielle dans le futur sans ces
champs. Sans coût runtime, et sécurise contre une future régression.

---

## §3. Vérification BDD via MCP Supabase

### 3.1 Schéma colonnes `sequences`

Requête exécutée :

```sql
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'sequences' AND table_schema = 'public'
ORDER BY column_name;
```

Extrait pertinent :

| column_name | data_type | is_nullable | column_default |
|---|---|---|---|
| `timeline_url` | `text` | YES | NULL |
| `timeline_published` | `boolean` | NO | `false` |

→ Colonnes confirmées présentes (ajoutées en T7.2). `timeline_published`
est `NOT NULL` avec default `false` (cohérent avec le commentaire JSDoc
du type `Sequence`).

### 3.2 État de la séquence pilote (`e8dfa6b8-…`)

Requête exécutée :

```sql
SELECT id, title, timeline_url, timeline_published,
       course_media_url, course_duration_seconds
FROM sequences
WHERE id = 'e8dfa6b8-ef34-4454-a198-e6f973f466de';
```

Résultat :

| Champ | Valeur |
|---|---|
| `id` | `e8dfa6b8-ef34-4454-a198-e6f973f466de` |
| `title` | "La communication non verbale au fauteuil" |
| `timeline_url` | `https://dxybsuhfkwuemapqrvgz.supabase.co/storage/v1/object/public/audio-timelines/formation/e8dfa6b8-…/2026-05-09T07-38-27-896Z.json` |
| `timeline_published` | **`true`** |
| `course_media_url` | `…/sequence_02_non_verbale-1778057695.mp3` (Xing-fixed T7.1) |
| `course_duration_seconds` | `538` |

⚠️ **Écart vs prompt T7.3 §3** : le prompt indiquait que
`timeline_published` était encore à `false` en BDD et qu'il fallait le
basculer manuellement avant le smoke local. **Constaté en BDD : déjà à
`true`** (vraisemblablement bascule manuelle déjà effectuée par Dr
Fantin pendant la session de smoke T7.2 demo, cohérent avec la note
`§9 RAPPORT_T7_2` ligne 283 : « `timeline_published` actuel : `true`
post-smoke »). Aucune action de bascule n'a donc été nécessaire de mon
côté avant le code ; la bascule reste **un acte produit explicite** côté
admin et n'a jamais été automatisée.

---

## §4. Sequence fetch côté user — propagation de `timeline_url` /
`timeline_published`

Vérifié que les hooks de fetch user-side récupèrent **toutes** les
colonnes :

| Hook / page | Sélection | Fichier |
|---|---|---|
| `useFormationWithSequences` | `.from('sequences').select('*')` ligne 100 | `src/lib/supabase/hooks.ts:99-102` |
| `useFormationBySlug` | `.from('sequences').select('*')` ligne 154 | `src/lib/supabase/hooks.ts:153-156` |

→ `select('*')` retourne `timeline_url` et `timeline_published`
automatiquement, même si le type `Sequence` ne les exposait pas avant
T7.2 (extension additive). **Aucune modification de query nécessaire
en T7.3.**

`SequencePlayer` reçoit un `sequence: Sequence` de
`/(app)/formation/page.tsx` ligne 150 et `/(app)/formation/[theme]/page.tsx`
ligne 259, où l'objet provient toujours du résultat des hooks ci-dessus.

---

## §5. Investigation D7-7 — `demoMode` hardcoded ligne 238 (lecture seule)

### 5.1 Git blame

```bash
git blame -L 235,242 src/components/formation/SequencePlayer.tsx
```

Résultat (extrait pertinent) :

```
^7aea5c4 (drfantin-star 2026-04-26 22:16:32) 237  // Mode démo : toujours afficher les 3 étapes pour tester l'interface
^7aea5c4 (drfantin-star 2026-04-26 22:16:32) 238  const demoMode = true // Mettre à false en production
^7aea5c4 (drfantin-star 2026-04-26 22:16:32) 239  const showVideo = demoMode || hasMedia
^7aea5c4 (drfantin-star 2026-04-26 22:16:32) 240  const showPdf = demoMode || hasPdf
```

Commit `7aea5c4` est **le commit initial du dépôt** ("Create Recap
session ticket3 news", 26 avril 2026, 6 727 fichiers ajoutés). Donc
`demoMode = true` est un **flag de démo posé dès le bootstrap du repo**,
hérité du prototype HTML de la page Sequence. Pas un ajout récent ni
post-DPC.

### 5.2 Usages dans le composant

```bash
grep -n "demoMode" src/components/formation/SequencePlayer.tsx
```

| Ligne | Usage | Effet quand `demoMode = true` (état actuel) | Effet hypothétique si `demoMode = false` |
|---|---|---|---|
| 238 | déclaration | — | — |
| 239 | `showVideo = demoMode \|\| hasMedia` | `showVideo` toujours `true`, étape `'video'` toujours générée dans `steps[]` (ligne 277). | `showVideo = hasMedia` — étape `'video'` n'apparaît que si la séquence a un `course_media_url`. |
| 240 | `showPdf = demoMode \|\| hasPdf` | `showPdf` toujours `true` (mais utilisé seulement pour debug — pas trouvé d'usage downstream qui change le comportement quiz). | `showPdf = hasPdf` — n'aurait d'effet que si une étape `'pdf'` existait dans `steps[]` (actuellement absente, cf. ligne 280 `s.push('quiz')` sans `'pdf'`). Effet pratique : ~0. |
| 682 | `{hasMedia && !courseCompleted && !demoMode ? (…) : (…)}` | Branche `else` toujours prise → bouton **« Passer au Quiz »** toujours actif/visible, même sans avoir écouté l'audio. | Branche `if` prise tant que `hasMedia && !courseCompleted` → bouton désactivé tant que l'audio n'a pas atteint 100 % (DPC). |

### 5.3 Synthèse pour T7.4

`demoMode = true` court-circuite **deux** comportements de production :

1. **Affichage de l'étape 'video' même sans média** (ligne 239). En
   pratique, sans média le composant tombe immédiatement sur la branche
   "Pas de contenu média" (lignes 678-680) — donc bénin.
2. **Désactivation du gating "écouter 100 % avant quiz"** (ligne 682).
   C'est la conséquence visible et la plus impactante : un user peut
   skipper l'audio et accéder directement au quiz, ce qui invalide
   l'utilité pédagogique mesurée par `course_watch_logs.completed`.

→ Recommandation T7.4 : passer `demoMode` à `false` en mémoire et
ouvrir un toggle d'admin / un flag d'env pour le pilotage.

**Aucune modification de code en T7.3.** Conformément au prompt §
"Périmètre T7.3 (strict)", investigation seule.

---

## §6. Inspection ancestor layout (D7-10)

### 6.1 Pattern recherché

`<main className="… overflow-auto …">` ou équivalent dans un parent
direct du composant `<EnrichedAudioPlayer>` créerait un scroll container
intermédiaire qui invaliderait le `position: sticky` mobile (cf. dette
D7-10 documentée dans T7.2 sur `/admin/*`).

### 6.2 Layouts ancêtres user-side

| Fichier | Wrapping pertinent | Présence `overflow-*` |
|---|---|---|
| `src/app/layout.tsx` (`RootLayout`) | `<html><body className="antialiased">` | **Aucun overflow.** |
| `src/app/(app)/layout.tsx` | `<AudioProvider><AudioPlayerProvider><div className="min-h-screen pb-24">` | **Aucun overflow.** |
| `src/app/(app)/formation/page.tsx` | rend `<SequencePlayer />` directement | n/a |
| `src/app/(app)/formation/[theme]/page.tsx` | rend `<SequencePlayer />` directement | n/a |
| `src/app/(app)/patient/page.tsx` | rend `<SequencePlayer />` directement | n/a |

→ **Aucun ancêtre user-side n'introduit de pattern D7-10.** Le `<body>`
et la racine `<div>` du `(app)` layout n'imposent ni
`overflow-auto/hidden/scroll`, ni hauteur fixe. Le scroll naturel mobile
revient au document HTML / au viewport — ce qui est ce dont
`position: sticky` a besoin.

### 6.3 Cas spécial : SequencePlayer interne

`SequencePlayer.tsx` ligne 633 enveloppe son contenu dans :

```tsx
<div className="flex-1 p-4 overflow-auto pb-24">
```

C'est un scroll container **interne au composant** (et non pas un layout
ancêtre). Le `<EnrichedAudioPlayer>` du call-site (b) est rendu *à
l'intérieur* de ce div. Conséquence pour la Variante A mobile (sticky
top-0 du whiteboard, cf. T7.2 D2) :

- Sur mobile, le sticky se calera sur ce div `overflow-auto` plutôt
  que sur le viewport. Comme c'est ce même div qui scrolle quand le
  user descend dans la page, le **comportement attendu reste équivalent**
  : le whiteboard reste collé en haut de la zone scrollable.
- Le `MiniPlayer` global (rendu par `(app)/layout.tsx` ligne 33) reste
  positionné en *fixed bottom* via sa propre logique CSS, indépendante
  du scroll container. Donc la prise de relais "AudioPlayer hors viewport
  → MiniPlayer affiché" fonctionne par construction.

→ Conclusion : **D7-10 n'est PAS présent dans la chaîne ancêtre user**.
La Variante A mobile telle que validée en T7.2 sur la page démo admin
devrait fonctionner identiquement (voire mieux) côté user. À valider au
smoke local par Dr Fantin (cf. §8).

---

## §7. Conformité aux contraintes architecturales

| Contrainte | Statut | Preuve |
|---|---|---|
| `src/context/AudioContext.tsx` non modifié | ✅ | `git diff origin/main -- src/context/AudioContext.tsx` = vide |
| `src/components/formation/AudioPlayer.tsx` non modifié | ✅ | `git diff origin/main -- src/components/formation/AudioPlayer.tsx` = vide |
| `src/components/formation/EnrichedAudioPlayer.tsx` non modifié | ✅ | `git diff origin/main -- src/components/formation/EnrichedAudioPlayer.tsx` = vide |
| Call-site (a) intro audio (lignes 559-570 post-T7.3) inchangé | ✅ | `<AudioPlayer>` toujours présent, mêmes props legacy ; cf. §1.1 et lecture lignes 555-572 dans le diff context |
| DPC `course_watch_logs` write path immuable | ✅ | Aucune écriture nouvelle. Le seul write path passe par `useAudio()` interne (cf. T7.0 §2.1). À confirmer par smoke local §8. |
| Anti-skip jamais contourné | ✅ | Aucun appel à `seekTo`/`audio.currentTime` depuis SequencePlayer ni EnrichedAudioPlayer. Le double dispositif AudioContext (timeupdate listener + `seekTo()` wrapper) reste en place. À confirmer par smoke local §8. |
| Lecture seule sur AudioContext depuis `<EnrichedAudioPlayer>` | ✅ | Le composant T7.2 destructure `{ state }` uniquement (cf. T7.2 §8 row 7) ; aucun changement T7.3. |
| Pas de `localStorage` / `sessionStorage` | ✅ | `grep -n "localStorage\|sessionStorage"` sur SequencePlayer.tsx → 0 hit. |
| Modèle LLM `claude-sonnet-4-6` | n/a | Pas d'appel LLM en T7.3. |
| Seul write path `user_points` = `useSubmitSequenceResult` | n/a | Pas touché en T7.3. |
| Enum `point_reason` jamais `'sequence_completed'` | n/a | Pas touché en T7.3. |

---

## §8. Smoke local — plan de vérification

### 8.1 Prérequis (à exécuter par Dr Fantin avant le smoke)

1. Vérifier en BDD via MCP Supabase ou dashboard que :
   - `timeline_published = true` sur la séquence pilote
     `e8dfa6b8-ef34-4454-a198-e6f973f466de` (état actuel constaté §3.2 :
     déjà `true`).
   - `timeline_url` non null (idem, déjà rempli).
2. Avoir un compte user **non super_admin** (= contexte user réel) qui
   peut accéder à la formation parente
   `99b270dd-c411-40e0-b865-1930e59464f1` ("Écoute active &
   Communication bienveillante"). Ne **pas** utiliser le compte admin
   de Dr Fantin, sinon les écritures `course_watch_logs` ne reflètent
   pas le scénario user.
3. Lancer le dev server :
   ```bash
   npm run dev
   ```
   Attendre `Ready in …`.

### 8.2 État attendu de `course_watch_logs` AVANT smoke

```sql
SELECT * FROM course_watch_logs
WHERE user_id = '<test_user_id>'
  AND sequence_id = 'e8dfa6b8-ef34-4454-a198-e6f973f466de'
ORDER BY created_at DESC;
-- Attendu: 0 ligne (ou état connu, à snapshot avant le test)
```

### 8.3 Cas de smoke (7)

| # | Cas | Action | Attendu |
|---|---|---|---|
| 1 | **Lecture nominale** | Naviguer vers la séquence pilote, cliquer "Écouter" | Audio démarre. Whiteboard scène 1 affichée à droite (desktop) / sticky top (mobile). Karaoké défile à gauche (desktop) / dessous (mobile). Mots du transcript surlignés au passage. |
| 2 | **Pause / reprise** | Pause après ~10 s, reprise immédiate | Lecture s'arrête, karaoké et whiteboard se figent. Reprise reprend exactement où la pause a eu lieu. |
| 3 | **Close (X MiniPlayer)** | Pendant la lecture, cliquer X dans le MiniPlayer global (en bas de l'écran) | Audio s'arrête, `state.audioUrl` se reset. Le panneau enrichi `<EnrichedAudioPlayer>` masque automatiquement le karaoké/whiteboard (Q7.7, condition `isCurrentTrack = state.audioUrl === src` devient `false`). L'`<AudioPlayer>` interne reste affiché (cover + bouton "Écouter" prêt à relancer). |
| 4 | **Anti-skip natif** | Tenter un seek en avant via clic mot futur dans karaoké | Aucun effet (le composant T7.2 `<KaraokeTranscript>` ne reçoit pas de `onSeek` depuis `<EnrichedAudioPlayer>`, donc le clic est no-op par construction). Le double dispositif anti-skip de l'AudioContext reste actif en backup. |
| 5 | **Anti-skip MiniPlayer** | Cliquer le bouton +15s du MiniPlayer global | Le seek avant est silencieusement clampé à `maxReachedTimeRef.current` (cf. T7.0 §2.3.b). Pas de toast user. La position visible ne dépasse pas le max atteint. |
| 6 | **Fallback OFF** | En BDD : `UPDATE sequences SET timeline_published = false WHERE id = 'e8dfa6b8-…';` puis recharger la page user | `<EnrichedAudioPlayer>` calcule `hasTimeline = false` → panneau enrichi masqué. Seul l'`<AudioPlayer>` interne reste rendu. Aucun toast d'erreur. Aucune dégradation fonctionnelle (DPC inchangé, lecture audio normale). |
| 7 | **Fallback ON** | En BDD : `UPDATE sequences SET timeline_published = true WHERE id = 'e8dfa6b8-…';` puis recharger la page user | Panneau enrichi réapparaît (whiteboard + karaoké). Comportement identique au cas 1. |

### 8.4 Vérification `course_watch_logs` PENDANT / APRÈS smoke

Pendant le cas 1 (au démarrage de la lecture) :

```sql
SELECT id, started_at, ended_at, total_duration_seconds, watched_percent,
       pause_count, completed
FROM course_watch_logs
WHERE user_id = '<test_user_id>'
  AND sequence_id = 'e8dfa6b8-ef34-4454-a198-e6f973f466de'
ORDER BY started_at DESC LIMIT 1;
-- Attendu: 1 ligne, ended_at = NULL, total_duration_seconds = 0,
--          watched_percent = 0, pause_count = 0, completed = false
```

Après le cas 2 (pause + reprise + 10 s écoute totale) :

```sql
-- Mêmes colonnes
-- Attendu: ended_at = ISO timestamp pause, total_duration_seconds ≈ 10,
--          watched_percent ≈ 1-2, pause_count = 1, completed = false
```

Après le cas 3 (close MiniPlayer) :

```sql
-- Mêmes colonnes
-- Attendu: ended_at = ISO timestamp close,
--          total_duration_seconds = somme du temps réellement écouté,
--          watched_percent = floor((maxReachedTime / 538) * 100),
--          pause_count incrémenté du nombre total de pauses,
--          completed = false (sauf si listenedRatio ≥ 0.8)
```

**Critères de succès DPC** :
- 1 INSERT au cas 1 (`logIdRef.current` non vide après `playAudio`).
- N UPDATEs aux cas 2/3 (à chaque pause + close), reflétant le
  comportement observé en pré-T7.3 sur l'`<AudioPlayer>` legacy.
- `playback_events` (jsonb) contient bien la séquence
  `[{play, t=0}, {pause, t≈10}, {play, t≈10}, …, {pause, t≈Xc}]`
  selon les actions du cas.
- Aucune écriture parasite déclenchée par le panneau enrichi
  (vérification : `<EnrichedAudioPlayer>` consomme `useAudio().state`
  uniquement, ne déclenche aucun `playAudio/pauseAudio`).

### 8.5 Snapshot des résultats — à compléter par Dr Fantin

| # | Cas | Statut | Notes |
|---|---|---|---|
| 1 | Lecture nominale | ⏳ | À tester |
| 2 | Pause / reprise | ⏳ | À tester |
| 3 | Close MiniPlayer | ⏳ | À tester |
| 4 | Anti-skip natif | ⏳ | À tester |
| 5 | Anti-skip MiniPlayer | ⏳ | À tester |
| 6 | Fallback OFF | ⏳ | À tester |
| 7 | Fallback ON | ⏳ | À tester |
| DPC | INSERT + UPDATEs course_watch_logs | ⏳ | Requêtes SQL §8.4 à coller dans le rapport finalisé |

---

## §9. `npm run build` — vérification

```bash
npm run build
```

Sortie pertinente :

```
 ✓ Compiled successfully
   Linting and checking validity of types ...
   Collecting page data ...
   Generating static pages (0/63) …
```

→ **Compilation TypeScript clean, aucun nouveau warning lié au patch
T7.3.** Le linting passe également (`Linting and checking validity of
types` complète sans error).

⚠️ Les erreurs `prerender-error` qui suivent sont **pré-existantes**
(pages `/login`, `/register`, `/admin/*`, `/(app)/formation`,
`/(app)/patient`, etc.) et causées par l'absence des variables
d'environnement Supabase dans la sandbox d'exécution. Ces erreurs sont
documentées en T7.2 §8 row 15 et n'affectent pas la PR T7.3 (les pages
en question utilisent `dynamic = 'force-dynamic'` ou ne sont pas
prerenderable de toute façon en preview Vercel avec env vars).

---

## §10. Banc de test pilote (rappel T7.2 §9)

| Élément | Valeur |
|---|---|
| Séquence ID | `e8dfa6b8-ef34-4454-a198-e6f973f466de` |
| Titre | "La communication non verbale au fauteuil" |
| Formation parente | `99b270dd-c411-40e0-b865-1930e59464f1` ("Écoute active & Communication bienveillante") |
| Audio | `…/sequence_02_non_verbale-1778057695.mp3` (Xing-fixed T7.1, 8 630 901 octets, 538.45 s) |
| Timeline JSON | `…/audio-timelines/formation/e8dfa6b8-…/2026-05-09T07-38-27-896Z.json` |
| `timeline_url` BDD | rempli (cf. §3.2) |
| `timeline_published` BDD | `true` (cf. §3.2) |
| `course_duration_seconds` BDD | `538` |

---

## §11. Restant T7.4

1. **Smoke local** (§8) — à exécuter par Dr Fantin sur compte user non
   super_admin, snapshot des 7 cas + vérification SQL `course_watch_logs`.
2. **Smoke preview Vercel** sur la même branche après push de la PR.
3. **Tab selector UI** — concevoir et brancher un segmented control /
   dropdown pour `activeTab` (Combiné / Whiteboard / Audio seul).
   Rappel T7.2 next steps point 4.
4. **Fix D7-7** (`demoMode = true` ligne 238) — à arbitrer : passer à
   `false` en dur, exposer via flag d'admin, ou via env var. Cf. §5.3.
5. **Validation MiniPlayer mobile** — vérifier que la prise de relais
   "AudioPlayer hors viewport → MiniPlayer flottant" fonctionne sur la
   page séquence user (différent du contexte démo `/admin/*` où le
   MiniPlayer n'est pas monté). Cf. T7.2 D2.
6. **Logger D7-11** (fenêtre karaoké fixe Spotify-like mobile) à
   l'arbitrage — cf. T7.2 §5.
7. **Recap final T7** — fusionner T7.0 + T7.1 + T7.2 + T7.3 + smoke
   prod en un document hand-off pour T8/T9.

---

## §12. Critères d'acceptation T7.3 — checklist

| # | Critère | Statut |
|---|---|---|
| 1 | Diff minimal sur SequencePlayer.tsx (call-site b + import) | ✅ +6/−2 lignes (cf. §2) |
| 2 | Call-site (a) lignes 556-571 inchangé | ✅ Vérifié visuellement (cf. §1.1, §7) |
| 3 | AudioContext.tsx, AudioPlayer.tsx, EnrichedAudioPlayer.tsx : 0 ligne diff | ✅ Vérifié `git diff` (cf. §2.2, §7) |
| 4 | `npm run build` clean (compilation + linting) | ✅ Compiled successfully + Linting valid (cf. §9) |
| 5 | Investigation D7-7 documentée, sans fix | ✅ §5 |
| 6 | Inspection ancestor layout D7-10 documentée | ✅ §6, conclusion : non présent côté user |
| 7 | Schéma BDD vérifié (`timeline_url`, `timeline_published`) | ✅ §3.1 |
| 8 | État pilote BDD documenté | ✅ §3.2 |
| 9 | Plan de smoke local détaillé (7 cas + vérif DPC) | ✅ §8 |
| 10 | Branche `claude/integrate-enriched-audio-player-9tqQP` conservée | ✅ |
| 11 | Rapport T7.3 rédigé à la racine | ✅ Ce document |

Cases de smoke local (§8.5) : à compléter par Dr Fantin après exécution.

---

*Fin du rapport T7.3. Prochaine étape : push de la branche
`claude/integrate-enriched-audio-player-9tqQP`, smoke local Dr Fantin
sur les 7 cas, ouverture PR.*
