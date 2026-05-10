# RAPPORT POC-T7.4a — Patches UI (karaoké mobile + reskin tabs + reskin placeholder) + investigation D7-14

**Branche** : `claude/patches-ui-karaoke-FTgjT`
**Date** : 2026-05-10
**Statut** : ✅ Patches G+D+E livrés, F documentée (sans patch), build clean.
**Décisions ad hoc T7.4 appliquées** : Q-T7.4-1=C (D7-7 reporté), Q-T7.4-2=B (D7-14 investigation seule), Q-T7.4-3=YES (D7-11 inclus).

---

## §1. Pré-flight SQL

Les 4 requêtes spécifiées dans le ticket ont été exécutées via `mcp__a0c4bed3.execute_sql` sur le projet `dxybsuhfkwuemapqrvgz`. Résultats :

### 1.1 Séquence pilote `e8dfa6b8-...`

| Champ | Valeur |
|---|---|
| `id` | `e8dfa6b8-ef34-4454-a198-e6f973f466de` |
| `title` | "La communication non verbale au fauteuil" |
| `course_media_url` | `https://…/sequence_02_non_verbale-1778057695.mp3` (Xing fixé T7.1) |
| `course_duration_seconds` | `538` |
| `timeline_url` | `https://…/audio-timelines/formation/e8dfa6b8-…/2026-05-09T07-38-27-896Z.json` |
| `timeline_published` | `true` |
| `formation_id` | `99b270dd-c411-40e0-b865-1930e59464f1` |

> **Note de divergence avec le prompt** : le ticket cite `2026-05-08T12-56-44-142Z.json` pour la timeline, la valeur réelle en BDD est `2026-05-09T07-38-27-896Z.json`. La timeline a donc été régénérée entre le drafting du ticket et l'exécution. Pas de blocker (timeline_published reste `true`, le payload est servi normalement par le wrapper `useEnrichedTimeline`).

### 1.2 Compte test `2b4985d2-...`

| Champ | Valeur |
|---|---|
| `id` | `2b4985d2-4967-4ab8-ba3e-163cde22d88d` |
| `email` | `jujufant@hotmail.com` |
| `last_sign_in_at` | `2026-05-10 17:28:24+00` |

### 1.3 Accès formation pilote

| `user_id` | `formation_id` | `access_type` | `current_sequence` |
|---|---|---|---|
| `2b4985d2-...` | `99b270dd-...` | `full` | `2` |

> **Note de divergence avec le prompt** : le ticket cite `current_sequence=15`, la valeur réelle est `2`. Probablement effet d'un reset partiel de la progression entre le drafting et l'exécution. `access_type='full'` reste OK donc la séquence pilote `e8dfa6b8-…` (sequence #2 de la formation) est bien accessible — pas un blocker.

### 1.4 DPC `course_watch_logs` (24h)

| `nb_logs_24h` |
|---|
| `2` |

→ **DPC write path non régressé** : 2 logs présents sur les dernières 24h, le hook DPC continue d'écrire. ✅

---

## §2. Sous-tâche T7.4a-G — Karaoké mobile fenêtre Spotify (D7-11)

### 2.1 Statut : ✅ LIVRÉ

### 2.2 Stratégie

Refonte du karaoké mobile en **fenêtre fixe** (~3 lignes visibles, scroll interne au mot actif), tout en préservant intégralement la Variante A T7.2 sur desktop (whiteboard sticky top + karaoké scroll naturel via le wrapper grid externe `EnrichedAudioPlayer`).

**Détection automatique du mode "fenêtre"** via `containerEl.scrollHeight > containerEl.clientHeight + 1`. Plus stable et plus simple que matchMedia : suit l'élément réel et n'introduit pas de re-render React. Conséquence directe :

- Sur **mobile** (`max-h-[180px] overflow-y-auto`) → mode fenêtre actif, auto-scroll **mot-level**.
- Sur **desktop** (`md:max-h-none md:overflow-visible`) → mode fenêtre inactif, auto-scroll **segment-level** existant inchangé.

### 2.3 Garde-fous critiques

1. **`getBoundingClientRect()` du mot vs fenêtre du container** : on ne déclenche le scroll QUE si `wordTopInContainer < 0 || wordBottomInContainer > clientHeight`. Pas de scroll à chaque tick 4Hz → pas d'effet "scroll permanent" gênant.
2. **`containerEl.scrollTo({top, behavior:'smooth'})`** au lieu de `scrollIntoView` : le scroll est INTERNE au container karaoké uniquement, pas de remontée dans la chaîne d'ancêtres (qui scrollerait le `<main>` admin layout ou le viewport mobile).
3. **Pause manuelle 5s** (apprentissage T3) : `manualScrollAtRef.current` réutilisé tel quel, listeners `wheel` + `touchmove` inchangés.
4. **Throttle 4Hz `useCurrentWord`** : 0 ligne diff (le hook reste tel quel).
5. **`<KaraokeWord>` non touché** (interdit en T7.4a — `audio-enriched/`). On contourne en **wrappant** chaque `<KaraokeWord>` dans un `<span data-word-key="X-Y">` inline porteur d'un sélecteur DOM ; ce wrapper est `display: inline` par défaut → aucun impact sur le line-wrap du `<p>` parent.

### 2.4 Diff

**Fichier touché** : `src/components/audio-enriched/KaraokeTranscript.tsx` uniquement
**Stat** : `+86 / -10` (1 fichier modifié).

Trois changements :

1. **Nouvelle helper `isWindowedMode(el)`** (3 lignes) — détection mode fenêtre.
2. **Effect segment-level neutralisé en mode fenêtre** : early-return si `isWindowedMode(containerEl)` après mise à jour de `lastScrolledSegmentRef`. Sur desktop, comportement inchangé ; sur mobile, l'effect mot-level prend la main.
3. **Nouvel effect mot-level** (~30 lignes) : déclenché sur `[autoScroll, activeSegmentIndex, activeWordIndex]` (donc ~4×/sec via le throttle de `useCurrentWord`), avec garde-fou bounding-rect avant tout `scrollTo`.
4. **Classe container** : `mx-auto max-w-3xl space-y-6 py-4 max-h-[180px] overflow-y-auto md:max-h-none md:overflow-visible`.
5. **Wrap `data-word-key`** sur chaque KaraokeWord.

### 2.5 Hauteur 180px — choix

Avec `text-base leading-relaxed` (~26px par ligne) + `p-4` du segment + speaker badge ~24px, la fenêtre `max-h-[180px]` affiche **~3 lignes confortables** dont une centrée, ce qui correspond au repère "fenêtre Spotify" du ticket. Valeur arbitrable post-smoke réel par Dr Fantin (un seul nombre à modifier ligne 180).

---

## §3. Sous-tâche T7.4a-D — Reskin TabSelector

### 3.1 Statut : ✅ LIVRÉ

### 3.2 Maquette validée par Dr Fantin

**Maquette 1 — Segmented control dark + accent gradient catégorie** (validée le 2026-05-10).

```
  ┌──────────────────────────────────────────┐
  │ [ Combiné ][ Whiteboard ][ Audio seul ] │   ← container #1a1a1a rounded-full p-1
  └──────────────────────────────────────────┘     border 0.5px #2a2a2a
          ▲
          tab actif: bg gradient (categoryGradient.from→to) text-white
          tab inactif: text-#a3a3a3 hover:text-#e5e5e5 hover:bg-white/5
```

Justification : design désormais **cohérent** avec l'`<AudioPlayer>` card juste en dessous (qui utilise déjà `linear-gradient(135deg, ${accentColor}, ${accentColorSecondary})` = même gradient catégorie). L'ancien design (`bg-ds-turquoise text-[#0F0F0F]`, copié de la démo POC admin) était stylistiquement déconnecté du flow user.

### 3.3 Tokens & accessibilité

- **Container** : `inline-flex items-center gap-1 rounded-full p-1`, `style={{ background: '#1a1a1a', border: '0.5px solid #2a2a2a' }}`, `role="tablist"`.
- **Item actif** : `text-white shadow-sm` + `style={{ background: linear-gradient(135deg, from, to) }}`, `aria-selected={true}`.
- **Item inactif** : `text-[#a3a3a3] hover:text-[#e5e5e5] hover:bg-white/5`.
- **Padding** : `px-5 py-2.5` → touch target ≈ 44-46px sur mobile (≥44px requis WCAG ✅).
- **role/aria** : `role="tab"` + `aria-selected={isActive}` ajoutés (gain accessibilité par rapport à l'ancien design).

### 3.4 Périmètre

- **Composant gardé inline** dans SequencePlayer.tsx (Option A T7.3.1, pas d'extraction).
- **Nouvelle prop** `categoryGradient: { from: string; to: string }` ajoutée à la signature (cohérent avec ce que SequencePlayer passe déjà à `<EnrichedAudioPlayer>` aux props `accentColor`/`accentColorSecondary`).
- **Diff** : `+~40 / -~14` lignes net dans `SequencePlayer.tsx`, exclusivement sur `EnrichedTabSelector` (lignes 1406-1465 nouvelles) + 1 ligne sur le call-site (b) pour passer la prop.

---

## §4. Sous-tâche T7.4a-E — Reskin placeholder WhiteboardOrCover

### 4.1 Statut : ✅ LIVRÉ

### 4.2 Wording validé par Dr Fantin

**Option 3 — Pas de texte, 3 points pulsants staggered** (validée le 2026-05-10).

```
  ┌──────────────────────────────────────┐
  │                                       │
  │             ·  ·  ·                  │  ← 3 dots staggered animate-pulse
  │                                       │     opacity-40, delays 0/200/400ms
  └──────────────────────────────────────┘
     min-h-[240px] (inchangé)
     bg-card/30 (inchangé)
```

Justification : minimaliste, zero jargon, cohérent avec un pattern "loading" moderne. L'ancien wording `Visualisation suivante à venir…` était trop technique pour un dentiste user final.

### 4.3 Diff

**Fichier touché** : `src/components/formation/EnrichedAudioPlayer.tsx`, **uniquement le sous-composant `WhiteboardOrCover`**.
**Stat** : `+6 / -3` (9 lignes diff total) → **largement sous la limite ≤15 ligne du ticket**. ✅

Périmètre strict du diff :
- Supprime le `<p>` `Visualisation suivante à venir…`.
- Insère un `<div role="status" aria-label="Visualisation à venir">` contenant 3 `<span>` `w-2 h-2 rounded-full bg-current opacity-40 animate-pulse` (couleur héritée via `text-[color:var(--color-text-muted)]` puis `bg-current`).
- Animations délays `0ms / 200ms / 400ms` via `style={{ animationDelay: '...ms' }}`.
- 1 commentaire 1 ligne pour traçabilité T7.4a-E.

**Aucun autre changement** dans `EnrichedAudioPlayer.tsx` : interface props inchangée, layout grid inchangé, condition `showEnrichedPanel` inchangée, helper `getActiveOrLastScene` inchangé, etc.

---

## §5. Sous-tâche T7.4a-F — Investigation D7-14 cover #1 mobile (PAS DE FIX)

### 5.1 Statut : ✅ DOCUMENTÉE — 0 patch

Conforme à la décision **Q-T7.4-2 = Option B (investigation seule)**. Aucune modification de `AudioPlayer.tsx`, `SequencePlayer.tsx` parent, ni layouts. Vérifié via `git diff` final §7 ci-dessous : ces 3 zones ont `0 ligne diff`.

### 5.2 Diagnostic complet — fichier coupable

| Fichier | Position dans le rendu | Code | Conclusion |
|---|---|---|---|
| `src/components/formation/AudioPlayer.tsx` | **lignes 88-98** (`md:hidden`) | `<div className="md:hidden mx-auto mb-3 rounded-2xl overflow-hidden" style={{ width: '160px', height: '160px', background: '#1a1a1a' }}> <img src={coverImageUrl} ... /> </div>` | **Source confirmée — Cas A (cover rendue par le composant `<AudioPlayer>` lui-même).** |
| `src/components/formation/AudioPlayer.tsx` | lignes 104-114 (`hidden md:flex`) | Variante desktop 280×280 collée à gauche du card gradient | Pas la source mobile. |
| `src/components/formation/SequencePlayer.tsx` | parent du call-site (b), lignes 622-663 | Aucun `<img>` rendu directement, seul un `coverImageUrl` est forwardé à `<AudioPlayer>` (call-site a) et `<EnrichedAudioPlayer>` (call-site b) | Pas la source. |
| `src/app/(app)/formation/page.tsx` | viewMode `'sequence'`, lignes 147-156 | Rend uniquement `<SequencePlayer>`, aucun wrapper `<img>` au-dessus | Pas la source. |
| `src/app/(app)/formation/page.tsx` | viewMode `'home'`, lignes 220-247 | `<img>` ligne 231 = grid des catégories (page d'accueil formation), pas le rendu d'une séquence | Pas la source. |
| `src/app/(app)/layout.tsx` + root `layout.tsx` | wrappers globaux | Aucune cover rendue côté layout user | Pas la source. |

→ **Confirmation** du diagnostic déjà documenté dans `RAPPORT_T7_3_1_ADDENDUM_FIX_TABS_COVER.md` §3.1 (T7.3.1 avait identifié cette cover comme **« cover #1 légitime, héritage pré-T7.3 »** quand T7.3.1 a supprimé la cover #2 dupliquée par `WhiteboardOrCover`). La cover #1 mobile **n'a pas été touchée** par T7.3.1 et reste sur le call-site (b) du flow user.

### 5.3 Stratégie de fix recommandée pour le ticket UX dédié post-T7.4

Le ticket UX dédié devrait évaluer **3 options** :

#### Option A — Retirer la cover #1 mobile complètement
- **Diff cible** : `AudioPlayer.tsx` lignes 88-98, supprimer le bloc entier.
- **Conséquence** : sur mobile, seul le card gradient subsiste. Plus épuré, design "Spotify-like" recentré sur le contenu.
- **Risque** : perte de l'identité visuelle de la séquence (si la cover était distinctive).

#### Option B — Inline la cover dans le card gradient mobile (recommandé)
- **Diff cible** : `AudioPlayer.tsx` lignes 88-98, supprimer le bloc séparé. Lignes 117-128 : insérer un `<img>` thumbnail (~64×64) au-dessus du `<p>` titre dans le card gradient, avec une bordure blanche subtile.
- **Conséquence** : design intégré, la cover devient un élément du card unique (pas un bloc séparé). Aligné avec le pattern Spotify "now playing".
- **Risque** : néant si bien dimensionné. Recommandé.

#### Option C — Conserver mais réduire (160 → 100, marge négative)
- **Diff cible** : `AudioPlayer.tsx` ligne 90 : `width: '100px', height: '100px'`. Ligne 89 : `mb-[-32px]` pour superposer légèrement le card gradient.
- **Conséquence** : effet "headphones cover" Spotify-like, garde la cover en frontale.
- **Risque** : peut paraître fragile selon les tailles d'écran.

→ **Recommandation** pour le ticket UX dédié : **Option B**, à valider visuellement avec une mini-démo Figma ou un patch jetable testé sur device réel avant merge.

### 5.4 Aucun patch appliqué — vérification

```
$ git diff src/components/formation/AudioPlayer.tsx
$ git diff src/components/formation/SequencePlayer.tsx | grep -E "^\+|^\-" | grep -v "EnrichedTabSelector\|categoryGradient" | head
$ git diff src/app/\(app\)/layout.tsx
$ git diff src/app/\(app\)/formation/page.tsx
```

→ Tous vides ou ne contenant que les modifications T7.4a-D documentées en §3 (qui sont strictement dans `EnrichedTabSelector` + 1 ligne au call-site (b) pour `categoryGradient`). ✅ AudioPlayer.tsx **0 ligne diff** comme prévu.

---

## §6. Mini-smoke local

### 6.1 Build clean (TypeScript + Next)

```
$ npm run build 2>&1 | grep -E "(Compiled|✓|✗|Failed|error TS)"
 ✓ Compiled successfully
```

→ **TypeScript et Next.js compilent clean**. Les erreurs prerender qui suivent (`Error: Your project's URL and Key are required to create a Supabase client!`) sont liées à l'absence de variables d'env Supabase dans la sandbox, **pré-existantes**, sans rapport avec T7.4a (issue déjà connue, ne bloque pas le déploiement Vercel/CI où les env vars sont fournies).

### 6.2 Type-check ciblé

```
$ npx tsc --noEmit 2>&1 | grep -E "(KaraokeTranscript|EnrichedAudioPlayer|SequencePlayer)"
(aucune sortie)
```

→ **0 erreur TypeScript** dans mes 3 fichiers touchés. ✅

### 6.3 Captures écran demandées par le ticket — TRANSPARENCE

Le ticket demande **3 captures** : mobile 375px karaoké, mobile 375px tabs, desktop 1440px combiné.

⚠️ **Je n'ai PAS produit ces captures.** L'environnement sandbox dans lequel je tourne n'a pas de navigateur interactif capable de rendre `next dev` à un viewport contrôlé pour produire des screenshots. Le smoke visuel doit donc être effectué **localement par Dr Fantin** :

```
npm run dev
# puis ouvrir http://localhost:3000 connecté en jujufant@hotmail.com,
# naviguer vers la formation pilote 99b270dd-... séquence #2 (e8dfa6b8-...)
# Tester :
#  - mobile 375px : fenêtre karaoké visible (~3 lignes), mot actif centré,
#    scroll auto fluide hors-fenêtre uniquement
#  - mobile 375px : tabs avec gradient catégorie sur tab actif
#  - desktop 1440px : Variante A T7.2 préservée (whiteboard sticky droite, karaoké
#    gauche scrollable, segment-level auto-scroll)
#  - tous : pause 5s active si scroll manuel
#  - tous : transitions onglets Combiné↔Whiteboard↔Audio seul
```

C'est une dette explicite à clôturer avant merge. Le rapport et les diff sont sains, le code compile, les invariants architecturaux sont tous respectés (§7 ci-dessous), mais la validation visuelle reste à faire côté Dr Fantin.

### 6.4 Smoke logique (raisonnement code-level)

**T7.4a-G (mobile fenêtre Spotify)** :
- Le mode fenêtre s'auto-active dès que `scrollHeight > clientHeight + 1`, et c'est garanti sur mobile par `max-h-[180px] overflow-y-auto` + 800+ mots du transcript pilote.
- Sur desktop, `md:max-h-none md:overflow-visible` neutralise le mode fenêtre → l'effect segment-level existant T3 reste seul actif → comportement Variante A T7.2 préservé identique.
- Pause manuelle 5s : `manualScrollAtRef.current = Date.now()` reste déclenché par les listeners `wheel` + `touchmove` inchangés ; les 2 effects (segment-level ET mot-level) la consultent au début pour bail-out.
- Garde-fou bounding-rect : un `wordEl` à `wordTopInContainer = 50` dans une fenêtre de hauteur 180 sera reconnu visible ; un `wordEl` à `wordTopInContainer = 200` (> 180) déclenchera le `scrollTo` qui le centrera.

**T7.4a-D (TabSelector)** :
- `categoryGradient` est passé via prop au composant. Le call-site (b) (ligne 642-647) le forwarde. Les 3 boutons partagent ce gradient, le tab actif reçoit le `style={{background: linear-gradient(...)}}`.
- `inline-flex` + `flex justify-center` parent → la barre est centrée et son largeur s'ajuste au contenu sur mobile 375px (3 tabs `px-5 py-2.5` + paddings ≈ 280-310px, tient confortablement).
- `aria-selected` + `role` → screen-reader friendly.

**T7.4a-E (placeholder)** :
- Les 3 spans pulsent en boucle CSS (`animate-pulse` Tailwind, durée 2s, opacity 0.5 ↔ 1). Le décalage (`animationDelay: 0/200/400ms`) crée l'effet "ondulant" séquentiel.
- `bg-current` + `text-[color:var(--color-text-muted)]` → couleur cohérente avec le design system (token CSS var, pas hardcodé).
- `min-h-[240px]` du parent inchangé → la zone placeholder garde la même hauteur que la zone whiteboard, pas de "saut" quand la première scène kicke in.

---

## §7. Conformité contraintes architecturales

| Contrainte | Statut | Vérification |
|---|---|---|
| `AudioContext.tsx` 0 ligne diff | ✅ | `git diff src/context/AudioContext.tsx` → vide |
| `AudioPlayer.tsx` 0 ligne diff | ✅ | `git diff src/components/formation/AudioPlayer.tsx` → vide |
| Call-site (a) intro audio (lignes ~558-571) 0 ligne diff | ✅ | Le diff SequencePlayer.tsx ne touche que les lignes 642-647 (call-site b) et 1406-1465 (EnrichedTabSelector). Le bloc intro lignes 558-571 est inchangé. |
| `useCurrentWord.ts` 0 ligne diff | ✅ | `git diff src/hooks/useCurrentWord.ts` → vide |
| `useEnrichedTimeline.ts` 0 ligne diff | ✅ | `git diff src/hooks/useEnrichedTimeline.ts` → vide |
| `getActiveScene.ts` + helpers 0 ligne diff | ✅ | `git diff src/lib/timeline/` → vide |
| Schéma BDD ou migrations SQL 0 changement | ✅ | Aucune migration appliquée (que des `SELECT` en pré-flight) |
| Layouts 0 ligne diff | ✅ | `git diff src/app/(app)/layout.tsx src/app/layout.tsx` → vide |
| Tout autre composant `audio-enriched/` (Grid, Figures, Comparison, Causal, Flowchart, Timeline, ConceptBadges, SpeakerBadge, **KaraokeWord**, StructuredWhiteboard) 0 ligne diff | ✅ | Seul `KaraokeTranscript.tsx` modifié (autorisé explicitement par le ticket §"Fichiers explicitement autorisés en modification T7.4a") |
| DPC `course_watch_logs` write path immuable | ✅ | Aucune écriture nouvelle. Les 3 patches ne touchent ni l'AudioContext ni AudioPlayer. La pré-flight §1.4 confirme que le DPC continue d'écrire (2 logs sur 24h). |
| Anti-skip jamais contourné | ✅ | Aucun appel à `seekTo` / `playAudio` ajouté. Lecture seule sur AudioContext via `useAudio().state` dans `EnrichedAudioPlayer` (Q5). |
| Pas de `localStorage` / `sessionStorage` | ✅ | `git grep -n "localStorage\|sessionStorage" src/components/audio-enriched src/components/formation` → seules occurrences pré-existantes hors patches T7.4a |
| Lecture seule sur AudioContext depuis le wrapper enrichi | ✅ | `EnrichedAudioPlayer` consomme uniquement `state.currentTime`, `state.audioUrl`, etc. (Q5 + Q7.1) |
| Modèle LLM `claude-sonnet-4-6` | n/a | Pas d'appel LLM en T7.4a |
| Seul write path `user_points` = `useSubmitSequenceResult` | n/a | Pas de write `user_points` en T7.4a |
| Enum `point_reason` : pas de `'sequence_completed'` | n/a | Pas de write points en T7.4a |
| Q-T7.4-1 = C : D7-7 (`demoMode`) reporté | ✅ | Aucune touche à `demoMode` ni au flag hardcodé |
| Q-T7.4-2 = B : D7-14 investigation seule | ✅ | §5 : diagnostic complet, AUCUN patch sur AudioPlayer/SequencePlayer parent/layouts |
| Q-T7.4-3 = YES : D7-11 inclus | ✅ | §2 : T7.4a-G livré |

---

## §8. Liste des fichiers touchés

```
$ git diff --stat HEAD
 src/components/audio-enriched/KaraokeTranscript.tsx  | 96 +++++++++++++++++++---
 src/components/formation/EnrichedAudioPlayer.tsx     |  9 +-
 src/components/formation/SequencePlayer.tsx          | 64 ++++++++++-----
 3 files changed, 135 insertions(+), 34 deletions(-)
```

| # | Fichier | Sous-tâche | Lignes diff (net) | Périmètre exact |
|---|---|---|---|---|
| 1 | `src/components/audio-enriched/KaraokeTranscript.tsx` | T7.4a-G | +86 / -10 | Helper `isWindowedMode`, useEffect mot-level mobile, neutralisation segment-level en mode fenêtre, classes container `max-h-[180px] overflow-y-auto md:max-h-none md:overflow-visible`, wrap `<span data-word-key>` autour de chaque KaraokeWord. |
| 2 | `src/components/formation/SequencePlayer.tsx` | T7.4a-D | +44 / -20 | Refonte interne d'`EnrichedTabSelector` (lignes 1406-1465) + 1 ligne au call-site (b) (ligne 645) pour passer `categoryGradient`. Rien d'autre touché — call-site (a) intro audio inchangé, header/contenu/quiz/etc. inchangés. |
| 3 | `src/components/formation/EnrichedAudioPlayer.tsx` | T7.4a-E | +6 / -3 | Sous-composant `WhiteboardOrCover` uniquement : remplacement du `<p>` placeholder par 3 dots pulsants. ≤15 lignes ✅. Aucun autre changement (signature props, layout grid, condition `showEnrichedPanel`, helper `getActiveOrLastScene` consumer, etc. tous inchangés). |
| 4 | `RAPPORT_T7_4_A_HARDENING_UI.md` | doc | nouveau fichier | Ce rapport. |

---

## §9. Roadmap après T7.4a

- 🔵 **T7.4b** (PR suivante) : smoke prod multi-séquences + 4 cas dégradés réseau + responsive sweep 5 viewports + recap final POC-T7.
- 🔵 **Ticket UX dédié post-T7.4** (D7-14 fix) : implémenter la stratégie recommandée §5.3 (Option B = inline cover dans card gradient).
- 🔵 **Ticket Sprint 2 dédié** (D7-7 fix) : remplacer `demoMode` hardcodé par un toggle propre.
- 🔵 **T8** : `<NewsVisualSequence>` + génération auto news.
- 🆕 **T7.5 / T7-bis-concepts** : concepts T5 dans whiteboard (à cadrer).
- 🆕 **T5-bis** : re-prompt agent extraction (à cadrer).
- 🔵 **T3-bis** : `<ConceptBadges>` user-facing (après T5-bis).
- 🔵 **T9** : tests utilisateurs prod + go/no-go POC.

---

**Fin du rapport T7.4a.**
