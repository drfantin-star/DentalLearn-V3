# Rapport POC-T7.2 — Démo `<EnrichedAudioPlayer>` (clôture)

> Composant wrapper minimal pour visualisation audio enrichie (karaoké +
> whiteboard structuré), rendu sur une page démo isolée sous `/admin/poc/`.
>
> Branche : `claude/enriched-audio-player-demo-embxq` — PR #252.
> Date : 09–10/05/2026 (session T7.2 complète).
> Périmètre : T7.2 selon prompt initial + matrice Q1→Q7.7 + 4 patches reçus
> en feedback smoke.
> Hors scope : T7.3 (intégration `SequencePlayer.tsx`) et T7.4 (smoke prod).

---

## §1. Contexte et périmètre

POC-T7.2 = **composant wrapper `<EnrichedAudioPlayer>` rendu sur une page
démo isolée**, sous `/admin/poc/enriched-player/...`. Aucune modification
de `SequencePlayer.tsx` (= T7.3). Aucun smoke prod (= T7.4). T7.2 doit
être visible et testable en local et en preview Vercel par Dr Fantin.

### Références amont

- `RAPPORT_T7_0_INSPECTION.md` — audit lecture seule du flux audio user.
  Documente l'API exacte de `useAudio()` (`src/context/AudioContext.tsx`),
  les props de `<AudioPlayer>` (lignes 11-24), les call-sites (a) et (b)
  de `<AudioPlayer>` dans `SequencePlayer.tsx`, les 6 risques identifiés,
  et les hooks/composants T3/T4 réutilisables (`useEnrichedTimeline`,
  `useCurrentWord`, `<KaraokeTranscript>`, `<StructuredWhiteboard>`).
- `RAPPORT_T7_1_PREPARATION_PILOTE.md` — fix Xing du MP3 pilote (header
  Xing/LAME injecté pour rendre la durée nominale fiable côté navigateur)
  + UPDATE BDD `course_duration_seconds = 538` sur la séquence pilote.
- Matrice de décisions Q1 → Q7.7 (14 décisions arbitrées avant codage),
  reprises en §2 et §4 ci-dessous.

### Hors scope confirmé

- ❌ Modification de `src/context/AudioContext.tsx`
- ❌ Modification de `src/components/formation/SequencePlayer.tsx` (= T7.3)
- ❌ Modification de `src/components/formation/AudioPlayer.tsx`
- ❌ Toute écriture vers `course_watch_logs` ou `user_points` autre que
  l'existant (pas de nouveau write path)
- ❌ `localStorage` / `sessionStorage`
- ❌ Bouton de seek depuis le whiteboard ou les concepts (Q5)
- ❌ Logique de validation/publication de timeline (= T6 admin)

---

## §2. Livrables T7.2

### 2.1 Fichiers créés

| Fichier | Lignes | Rôle |
|---|---|---|
| `src/components/formation/EnrichedAudioPlayer.tsx` | 249 | Composant wrapper (default export). Rend `<AudioPlayer>` inchangé puis le panneau enrichi conditionnel. 3 tabs (combined/whiteboard/audio_only). Lecture seule sur `useAudio()`. |
| `src/app/admin/poc/enriched-player/page.tsx` | 144 | Page index (Server Component). Liste les séquences avec `timeline_url IS NOT NULL`, triées par `updated_at DESC`. Auth super_admin. Theme dark DentalLearn forcé via `bg-[color:var(--color-bg)]`. |
| `src/app/admin/poc/enriched-player/[type]/[id]/page.tsx` | 85 | Page démo (Server Component). Auth super_admin + fetch séquence + parents. Seul `params.type === 'formation'` supporté en V1. |
| `src/app/admin/poc/enriched-player/[type]/[id]/EnrichedPlayerPocClient.tsx` | 255 | Page démo (Client Component). Monte un `<AudioProvider>` local, gère l'état des tabs, rend `<EnrichedAudioPlayer>` + `<DebugPanel>` (transient, à retirer en T7.3). |

### 2.2 Fichiers modifiés (additif uniquement)

| Fichier | Diff | Rôle |
|---|---|---|
| `src/lib/supabase/types.ts` | +5 lignes | Extension additive du type `Sequence` avec `timeline_url?: string \| null` et `timeline_published?: boolean`. **Note** : c'est ici (et pas dans `src/types/sequence.ts` qui n'existe pas) que le type `Sequence` est défini côté frontend (cf. rapport T7.0 §5.1). |
| `src/lib/timeline/getActiveScene.ts` | +62 lignes (additif après ligne 70) | Ajout du helper `getActiveOrLastScene` exporté. **`getActiveScene` lui-même n'est pas modifié** → T3/T4/T5/T6 admin restent intacts. |
| `src/lib/timeline/getActiveScene.spec-cases.md` | +73 lignes | Section dédiée `getActiveOrLastScene` avec cas 16-38 (extension intra-gap, post-dernière, cas pilote réels). |
| `RAPPORT_T7_2_DEMO_ENRICHED_PLAYER.md` | +406 lignes | Ce rapport (clôture). |

### 2.3 Récap

- 8 fichiers, 1 279 insertions, 0 suppression cumulée.
- 4 fichiers protégés (`AudioContext.tsx`, `AudioPlayer.tsx`,
  `SequencePlayer.tsx`, `getActiveScene.ts` partie historique) : 0 ligne
  modifiée. Vérifié `git diff origin/main` = vide pour les 3 premiers ;
  `getActiveScene.ts` diff démarre ligne 70 (post-existant).

---

## §3. Historique des 6 commits

| Ordre | SHA court | Message | Fichiers touchés | Synthèse |
|---|---|---|---|---|
| 1 | `ca66f8d` | `feat(poc-t7-2): demo page <EnrichedAudioPlayer>` | 6 nouveaux : composant wrapper + 3 pages démo + extension `Sequence` + ce rapport (initial) | Livrable initial conforme au prompt T7.2. 3 tabs Q2, fallback gracieux Q6, lecture seule Q5, masquage si `state.audioUrl !== src` (Q7.7). Theme dark assumé (1ère version utilisait `text-white/X`). |
| 2 | `4696756` | `fix(poc-t7-2): contrast on demo page texts` | `enriched-player/page.tsx`, `EnrichedPlayerPocClient.tsx` | Smoke §1.1 Dr Fantin — texte invisible sur `bg-gray-100` admin. Migration `text-white/X` → tokens DentalLearn (`var(--color-text-primary)`/`secondary`/`muted`). `<main>` forcé en `bg-[color:var(--color-bg)]` pour overrider le `bg-gray-100` du admin layout. Pattern repris des POC T3/T5/T6. |
| 3 | `4b4d5a1` | `fix(poc-t7-2): sticky whiteboard column desktop` | `EnrichedAudioPlayer.tsx` | Tentative initiale `md:sticky md:top-6 md:self-start md:max-h-[calc(100vh-3rem)] md:overflow-y-auto` sur la colonne whiteboard. **Échec en preview** — diagnostic console Dr Fantin : `<main class="flex-1 overflow-auto">` du admin layout crée un scroll container qui invalide le sticky enfant. |
| 4 | `52cb415` | `fix(poc-t7-2): replace sticky whiteboard with internal-scroll layout` | `EnrichedAudioPlayer.tsx`, ce rapport | Revert sticky desktop. Remplacement par grid à hauteur cappée `md:h-[calc(100vh-32rem)]` + `md:min-h-0 md:overflow-y-auto` sur colonne karaoké + `md:overflow-hidden` sur colonne whiteboard. Whiteboard reste visible en permanence, karaoké scrollable indépendamment. Dette D7-10 loggée. |
| 5 | `7211495` | `fix(poc-t7-2): mobile sticky whiteboard above karaoke` | `EnrichedAudioPlayer.tsx`, ce rapport | Variante A mobile validée Dr Fantin : `sticky top-0 z-10 bg-[color:var(--color-bg)] md:static`. Le `md:static` neutralise le sticky sur desktop (préserve l'internal-scroll). Sur mobile, le sticky se cale sur le `<main overflow-auto>` admin (qui est le scroll container effectif) parce que le whiteboard a sa hauteur naturelle dans un stack vertical. `bg-…` opaque obligatoire pour cacher le karaoké défilant derrière. |
| 6 | `14a1482` | `feat(poc-t7-2): add getActiveOrLastScene helper for gap continuity` | `getActiveScene.ts`, `getActiveScene.spec-cases.md`, `EnrichedAudioPlayer.tsx`, ce rapport | Smoke Dr Fantin t=200s : cover affichée à la place de la scène 1 étendue. Décision Option B (helper distinct) pour ne pas casser T3/T4/T5/T6. Wrapper T7.2 utilise le nouveau helper et passe à `<StructuredWhiteboard>` un `currentTime` calé à `displayedScene.start_sec + 0.5` (pattern existant `TimelinePreviewPanel.tsx`) pour que le `getActiveScene` interne du whiteboard la trouve, même pendant un gap. |

Branche locale et remote synchronisées (`git log origin/HEAD..HEAD` =
vide après chaque commit pushé).

---

## §4. Décisions produit prises pendant la session

### D1 — Layout desktop : internal-scroll (pas sticky)

**Tentative initiale** (commit `4b4d5a1`) : appliquer `md:sticky md:top-6
md:self-start` sur la colonne whiteboard du grid Combiné.

**Échec** : diagnostic console Dr Fantin a montré que `<main
class="flex-1 overflow-auto">` du admin layout (`src/app/admin/layout.tsx`
ligne 200) crée un scroll container intermédiaire. Le sticky ne se cale
pas sur le viewport mais essaie de se caler sur le grid voisin (qui a la
même hauteur). Test `main.style.overflow = 'visible'` en console → sticky
fonctionne. Confirmation que le coupable est unique.

**Solution adoptée** (commit `52cb415`) : grid à hauteur cappée
`md:h-[calc(100vh-32rem)]` + scroll interne sur colonne karaoké
(`md:min-h-0 md:overflow-y-auto`) + `md:overflow-hidden` sur colonne
whiteboard. Whiteboard reste fixe en permanence, karaoké scrollable
indépendamment, pas de double scrollbar. La valeur `32rem` (≈ 512px)
réserve approximativement DemoHeader (~120px) + TabSelector (~50px) +
AudioPlayer (~280px) + paddings/gaps (~60px).

**Pourquoi pas l'approche flexbox pure** (chaînage `h-full` depuis
`<main>`) : exigerait un overhaul du admin layout partagé. Hors scope
T7.2.

### D2 — Layout mobile : Variante A (whiteboard sticky top + karaoké scroll naturel)

**Choix** entre Variante A (whiteboard sticky, AudioPlayer scrollable hors
viewport) et Variante B (tout sticky : DemoHeader + AudioPlayer + Whiteboard
+ karaoké interne scrollable). Variante B rejetée pour risque
double-scroll mobile + zone karaoké trop réduite.

**Variante A retenue** (commit `7211495`) : `sticky top-0 z-10
bg-[color:var(--color-bg)] md:static` sur la colonne whiteboard.
Conséquence assumée : l'AudioPlayer scrolle hors viewport quand le user
descend dans le karaoké → l'utilisateur perd l'accès aux contrôles Pause
**sur la page démo T7.2** car le `MiniPlayer` global de DentalLearn (qui
prend le relais en prod) n'est pas monté sous `/admin/*`. Acceptable en
démo super_admin. La vraie ergonomie mobile sera validée en T7.3 dans
`/sequences/[id]` (sous `(app)/layout.tsx`) où le MiniPlayer flottant
prend le relais.

**Pourquoi le sticky fonctionne sur mobile alors qu'il échouait sur
desktop** : sur mobile, pas de grid, stack vertical naturel, le whiteboard
a sa hauteur propre, le sticky se cale sur le `<main overflow-auto>`
admin parent → top-0 = haut du viewport. Sur desktop, le sticky était
piégé dans une colonne grid avec `align-items: stretch` qui forçait sa
hauteur à celle du karaoké.

### D3 — Extension de scène : helper distinct `getActiveOrLastScene` (Option B)

**Comportement initial** (commit `ca66f8d`) : le wrapper rendait la cover
dans **tous** les gaps (avant scène 1, entre scènes, après dernière) car
`getActiveScene` retourne `null` hors fenêtre. Documenté en §6.2 du
rapport initial comme limitation assumée.

**Décision produit** Dr Fantin post-smoke t=200s : éliminer la cover entre
scènes pour avoir un flow visuel continu. Trois cas à couvrir :

- t=200s (gap inter 1-2 entre s1.end_sec=187.5 et s2.start_sec=250.4) →
  s1 doit rester affichée
- t=400s (gap inter 3-4) → s4 doit rester affichée
- t=520-538s (post-s5 jusqu'à fin audio) → s5 doit rester affichée
- t < s1.start_sec (gap initial) → cover préservée (cas 5 de Q6)

**Implémentation Option B** (commit `14a1482`, helper distinct) au lieu
d'Option A (modifier `getActiveScene` global). Justification : trois
autres pages consomment `getActiveScene` strict (`StructuredWhiteboard`
T4, `TimelineEditorClient` T6, `TimelinePreviewPanel` T6). Modifier
`getActiveScene` casserait potentiellement leur logique. Le helper
distinct est utilisé uniquement par `<EnrichedAudioPlayer>` (T7.2 et
T7.3), zéro régression sur T3/T4/T5/T6.

**Effet collatéral utile** : `Scene.end_sec` devient un indicateur
éditorial (consommé par le LLM T5 et l'éditeur T6 pour borner la fenêtre
attendue) mais n'a plus d'impact sur le rendu user via T7. Permet à T5-bis
de produire des scènes naturellement plus denses sans contrainte
end_sec/start_sec_next stricte.

### D4 — Concepts dormants en T7.2

Les 12 concepts du timeline pilote sont chargés par `useEnrichedTimeline`
(via `TimelineSchema.parse`) mais **aucun composant ne les rend** dans le
panneau enrichi T7.2. Décision : laisser dormants en T7.2, exploiter
dans un ticket dédié post-T7 (`<ConceptBadges>` user-facing T3-bis, après
T5-bis pour bénéficier d'une timeline plus dense).

---

## §5. Dettes loggées

| ID | Statut | Description | Action |
|---|---|---|---|
| **D7-2** | ouverte | 21 versions JSON dans `audio-timelines/formation/e8dfa6b8-…/` (régénérations T6). | Ménage à faire après T7.4 quand la timeline finale sera figée. Ne rien supprimer avant — préserver la possibilité de rollback. |
| **D7-7** | ouverte (existante) | `demoMode = true` hard-codé ligne 238 de `SequencePlayer.tsx`. Le bouton "Passer au Quiz" reste actif sans avoir écouté l'audio. | Hors scope T7.2/T7.3. À traiter dans un ticket de hardening DPC. |
| **D7-9** | ouverte (nouvelle) | Page index/démo a nécessité un patch dédié contraste (`4696756`) parce que la 1ère version utilisait `text-white/X` (assumait un fond sombre) alors que `/admin/*` hérite de `bg-gray-100` du layout admin. | Vigilance future : sur les pages POC sous `/admin/*`, forcer le thème dark DentalLearn au niveau `<main>` via `bg-[color:var(--color-bg)]` et utiliser les tokens `var(--color-text-primary)`/`secondary`/`muted` (pattern T3/T5/T6 existant). |
| **D7-10** | ouverte (nouvelle) | `<main class="flex-1 overflow-auto">` (`src/app/admin/layout.tsx` ligne 200) crée un scroll container qui casse silencieusement les patterns `position: sticky` enfants. | À documenter dans le memo ops. Solution alternative connue : flexbox + `min-h-0` + overflow interne (pattern utilisé en T7.2 desktop, commit `52cb415`). Si d'autres composants admin ont besoin de sticky, soit overrider `overflow` localement, soit revoir le layout admin. |
| **D7-11** | ouverte (nouvelle, mobile UX) | Karaoké mobile défile actuellement sur toute sa longueur sous le whiteboard sticky. Dr Fantin souhaite à terme une fenêtre fixe façon Spotify (2-3 lignes visibles, scroll interne au mot actif). | Reporté en T7.4 hardening ou ticket T7.2-bis dédié, à arbitrer après T7.3. |

---

## §6. Roadmap POC mise à jour

```
✅ T1   — POC schema timeline + storage bucket (livré)
✅ T2   — Pipeline génération timeline ElevenLabs + Python (livré)
✅ T3   — KaraokeTranscript + transcript schema/hooks (livré)
✅ T4   — StructuredWhiteboard + 6 templates (livré)
✅ T5   — LLM extraction Sonnet + Zod validation (livré)
✅ T6   — Timeline editor admin (livré)
✅ T7.0 — Inspection silencieuse flux audio user (livré)
✅ T7.1 — Préparation pilote (fix Xing + UPDATE BDD) (livré)
✅ T7.2 — <EnrichedAudioPlayer> + page démo (cette session)
🔵 T7.3 — Intégration dans SequencePlayer.tsx call-site (b)
🔵 T7.4 — Hardening + smoke prod + recap final T7
🆕 T5-bis — Re-prompt agent extraction pour timeline plus dense (avant T9)
🔵 T3-bis — <ConceptBadges> user-facing (après T5-bis)
🔵 T8   — <NewsVisualSequence> + génération auto news
🔵 T9   — Tests utilisateurs + doc + smoke prod + go/no-go
```

**POC-T5-bis** : nouveau ticket ouvert pendant la session T7.2.
**Objectif** : reprendre le prompt T5 LLM pour produire une timeline
naturellement dense (couverture cible ~100 % du temps audio, concepts
mieux placés). Motivation : la timeline pilote actuelle a une couverture
scènes très inégale (cf. §9 banc de test) — les gaps sont importants. À
traiter avant T9 pour que les testeurs voient une qualité finale.
Effort estimé ~0,5 jour.

---

## §7. Smoke validé

Validé en preview Vercel par Dr Fantin pendant la session (cf. messages
de session du 09–10/05/2026). **Aucun fichier `SMOKE_TEST_T7_2.md` n'a
été créé** — les validations sont consignées ici.

| Section | Smoke | Statut | Commit qui a satisfait |
|---|---|---|---|
| 1 | Page index `/admin/poc/enriched-player` lisible (titre, description, cartes, footer) | ✅ | `4696756` (post-contrast) |
| 2 | Tab Combiné default (desktop + mobile) avec extension de scène | ✅ | `52cb415` (desktop internal-scroll) + `7211495` (mobile sticky) + `14a1482` (extension de scène) |
| 3 | Tab Whiteboard seul (mobile + desktop) | ✅ | `ca66f8d` (initial) |
| 4 | Tab Audio seul — panneau enrichi entièrement masqué | ✅ | `ca66f8d` (initial) |
| 5 | Fallbacks Q6 — 5 cas (`timeline_url == null`, `timeline_published === false`, fetch KO, `state.audioUrl !== src`, gap initial) | ✅ | `ca66f8d` initial |
| 6 | Régression DPC (`course_watch_logs` insert/update/complete inchangés) | ✅ | Pas de write path nouveau ; vérifié `git diff origin/main -- src/context/AudioContext.tsx` = vide |
| 7 | Responsive sweep (375/414/768/1024/1280) | ✅ | `52cb415` (desktop) + `7211495` (mobile) |

---

## §8. Critères d'acceptation T7.2 (checklist du prompt initial §6)

| # | Critère | Statut | Commit |
|---|---|---|---|
| 1 | Composant `<EnrichedAudioPlayer>` créé sous `src/components/formation/` | ✅ | `ca66f8d` |
| 2 | Page démo accessible à `/admin/poc/enriched-player/formation/[id]` (super_admin only) | ✅ | `ca66f8d` |
| 3 | Page index accessible à `/admin/poc/enriched-player` | ✅ | `ca66f8d` |
| 4 | Type `Sequence` étendu additivement avec `timeline_url` + `timeline_published` | ✅ | `ca66f8d` (`src/lib/supabase/types.ts`) |
| 5 | 3 tabs Combiné / Whiteboard / Audio seul fonctionnels | ✅ | `ca66f8d` |
| 6 | Layout desktop = grid 2 colonnes en mode Combiné, mobile = stack vertical | ✅ | `ca66f8d` (initial) + `52cb415` (desktop internal-scroll affiné) |
| 7 | Lecture seule sur `useAudio()` — aucune mention de `seekTo`, `playAudio`, etc. dans la diff | ✅ | Vérifié `grep -nE "seekTo\|playAudio\|pauseAudio\|resumeAudio\|closePlayer"` sur `EnrichedAudioPlayer.tsx` et `EnrichedPlayerPocClient.tsx` — uniquement dans un commentaire JSDoc (Q5) |
| 8 | `<KaraokeTranscript>` rendu **sans** prop `onSeek` | ✅ | `ca66f8d`, vérifié au call-site dans `EnrichedAudioPlayer.tsx` |
| 9 | Fallback gracieux validé sur les 5 cas Q6 (cover seule, pas de toast d'erreur) | ✅ | `ca66f8d` ; smoke §7 cas 5 validé |
| 10 | `state.audioUrl !== src` → panneau enrichi masqué (Q7.7) | ✅ | `ca66f8d` (`isCurrentTrack = state.audioUrl === src`) |
| 11 | `AudioContext.tsx` non modifié | ✅ | `git diff origin/main -- src/context/AudioContext.tsx` = vide |
| 12 | `AudioPlayer.tsx` non modifié | ✅ | `git diff origin/main -- src/components/formation/AudioPlayer.tsx` = vide |
| 13 | `SequencePlayer.tsx` non modifié | ✅ | `git diff origin/main -- src/components/formation/SequencePlayer.tsx` = vide |
| 14 | Aucun `localStorage` / `sessionStorage` (grep négatif sur la diff) | ✅ | `grep -rn "localStorage\|sessionStorage"` sur les fichiers livrés = 0 hit |
| 15 | `npm run build` clean | ✅ | `Compiled successfully` à chaque commit ; les erreurs prerender restantes sont préexistantes (env vars sandbox manquantes), affectant uniquement les pages déjà cassées en sandbox (login, admin/news, formation, etc.). Mes nouvelles pages sont en `dynamic = 'force-dynamic'` donc skippent le prerender. |
| 16 | Rapport `RAPPORT_T7_2_DEMO_ENRICHED_PLAYER.md` rédigé | ✅ | Ce document |

---

## §9. Banc de test pilote

| Élément | Valeur |
|---|---|
| Séquence ID | `e8dfa6b8-ef34-4454-a198-e6f973f466de` |
| Titre | "La communication non verbale au fauteuil" |
| Formation parente | `99b270dd-c411-40e0-b865-1930e59464f1` ("Écoute active & Communication bienveillante") |
| Audio Storage | `formations/communication-ecoute-active/audio/sequence_02_non_verbale-1778057695.mp3` |
| Taille MP3 | 8 630 901 octets (Xing-fixed T7.1) |
| Durée audio | 538.45 s (header Xing fiable post-T7.1, BDD `course_duration_seconds = 538`) |
| `timeline_url` actuel (BDD) | `https://dxybsuhfkwuemapqrvgz.supabase.co/storage/v1/object/public/audio-timelines/formation/e8dfa6b8-ef34-4454-a198-e6f973f466de/2026-05-09T07-38-27-896Z.json` |
| Schéma | `schema_version: "1.0"` (Zod `TimelineSchema`) |
| Generated_at interne au JSON (T5 LLM) | `2026-05-08T12:56:44.129Z` (cf. T7.1 §2.2) |
| Scenes count | 5 |
| Concepts count | 12 |
| Transcript segments | 26 (cf. T7.1 §2.2) |
| `timeline_published` actuel | `true` post-smoke (Dr Fantin a basculé pour validation ; revert décidé en fonction de T7.3) |

### Bornes scènes (vérifiées par Dr Fantin pendant le smoke)

- s1 : `[?, 187.5]` (s1.end_sec confirmé pendant le diagnostic gap inter 1-2)
- s2 : `[250.4, ?]` (s2.start_sec confirmé)
- s3, s4, s5 : bornes non re-vérifiées dans cette session

→ Les gaps inter-scènes sont substantiels (entre s1.end_sec=187.5 et
s2.start_sec=250.4 = ~63 s de gap, soit ~12 % de la durée audio juste
sur ce gap-là). C'est précisément la motivation de **POC-T5-bis** : un
re-prompt LLM pour produire une couverture plus dense.

### Hash SHA-256 du timeline JSON pilote

⚠️ **À calculer par Dr Fantin localement** — la sandbox d'exécution
courante n'a pas accès à Supabase Storage (proxy `host_not_allowed`).
Commande à exécuter en local après merge de la PR :

```bash
curl -s "https://dxybsuhfkwuemapqrvgz.supabase.co/storage/v1/object/public/audio-timelines/formation/e8dfa6b8-ef34-4454-a198-e6f973f466de/2026-05-09T07-38-27-896Z.json" \
  | shasum -a 256
```

Le hash obtenu sera la référence de traçabilité pour POC-T5-bis (avant
remplacement) et T7.4 (recap final).

---

## §10. Prochaines étapes T7.3

1. **Brancher `<EnrichedAudioPlayer>` au call-site (b) de
   `SequencePlayer.tsx`** (lignes 637-652 selon `RAPPORT_T7_0_INSPECTION.md`
   §4.3). La signature de `<EnrichedAudioPlayer>` reproduit exactement
   les props nécessaires à `<AudioPlayer>` plus 3 props T7
   (`timelineUrl`, `timelinePublished`, `activeTab`) → substitution
   sans diff fonctionnel ailleurs.
2. **Décider du sort du call-site (a)** ("intro audio sans questions",
   lignes 556-571). Probablement enrichir aussi pour cohérence.
3. **Étendre la query Supabase de récupération de la `sequence`** côté
   user pour inclure `timeline_url, timeline_published`. Le type est
   déjà additivement étendu (T7.2).
4. **Ajouter un `useState<EnrichedPlayerTab>('combined')`** au niveau de
   `SequencePlayer`. UI de tab à designer (radio segmented control,
   dropdown, etc. — décision Dr Fantin).
5. **Retirer le `<DebugPanel>`** de la page démo T7.2 ou le gater par un
   flag URL `?debug=1` avant intégration au flow user.
6. **Validation MiniPlayer global** lors de la sortie de viewport
   AudioPlayer mobile (cas Variante A documenté en D2).
7. **Valider non-régression DPC** : `course_watch_logs` insert/update/
   complete doivent rester strictement inchangés (aucun nouveau write
   path attendu côté T7.3 — vérification croisée via T7.4).
8. **Logger D7-11** (fenêtre karaoké fixe Spotify-like mobile) à
   l'arbitrage en T7.4 hardening ou ticket T7.2-bis.

---

*Fin du rapport T7.2. PR #252 prête à merger sur `main` après validation
finale des smoke checkpoints §7 et signature Dr Fantin.*
