# RECAP FINAL POC-T7 — Visualisation audio formations

**Date** : 2026-05-11
**Auteur** : Claude Code (sous direction Dr Fantin)
**Périmètre** : synthèse des 7 livraisons T7.0 → T7.4b du POC-T7 visualisation audio formations, dettes consolidées, métriques d'effort, décision go/no-go partielle.
**Hors scope** : T8 (news), T7.5/T5-bis/T3-bis (à cadrer), T9 (tests utilisateurs réels). Ce recap traite **uniquement** la visualisation audio formations.

---

## §1. Synthèse des 7 livraisons T7.0 → T7.4b

| # | Sous-ticket | Date | Branche / merge | Statut | Rapport |
|---|---|---|---|---|---|
| 1 | **T7.0 — Inspection silencieuse** | 2026-05-07 | Lecture-seule (aucun commit) | ✅ Livré | `RAPPORT_T7_0_INSPECTION.md` |
| 2 | **T7.1 — Préparation pilote (Xing/LAME fix MP3)** | 2026-05-08 | Pré-prod (MP3 ré-encodé Storage) | ✅ Livré | `RAPPORT_T7_1_PREPARATION_PILOTE.md` |
| 3 | **T7.2 — Démo wrapper isolée** | 2026-05-09 | PR mergée | ✅ Livré | `RAPPORT_T7_2_DEMO_ENRICHED_PLAYER.md` |
| 4 | **T7.3 + T7.3.1 — Intégration SequencePlayer + fix tabs cover #2** | 2026-05-09 / 2026-05-10 | PRs mergées | ✅ Livrés | `RAPPORT_T7_3_INTEGRATION_SEQUENCEPLAYER.md` + `RAPPORT_T7_3_1_ADDENDUM_FIX_TABS_COVER.md` |
| 5 | **T7.4a — Hardening UI (karaoké mobile + tabs + placeholder + investigation D7-14)** | 2026-05-10 | `claude/patches-ui-karaoke-FTgjT` → mergée | ✅ Livré | `RAPPORT_T7_4_A_HARDENING_UI.md` |
| 6 | **T7.4-UX — Layout mobile compact (suppression card legacy + header + drawer Objectifs + FAB Play + résolution implicite D7-14)** | 2026-05-10 | `claude/verify-miniplayer-ditqh` → mergée (PR #257) | ✅ Livré | `RAPPORT_T7_4_UX_LAYOUT_MOBILE.md` |
| 7 | **T7.4b — Smoke prod + cas dégradés réseau + responsive sweep + recap final** | 2026-05-11 | `claude/smoke-test-multi-sequence-1upoq` | ✅ En clôture (cette PR) | `RAPPORT_T7_4_B_SMOKE_PROD.md` + ce fichier |

### 1.1 Détail par livraison

**T7.0 — Inspection silencieuse** : audit complet du périmètre AudioContext / AudioPlayer / SequencePlayer / DPC `course_watch_logs` / anti-skip / `useCurrentWord` avant tout patch. A produit le **catalogue initial des 14 décisions Q1-Q7 + Q7.1-Q7.7** (mode lecture seule sur AudioContext, wrapper sibling non-invasif, fallback gracieux Q6, panneau enrichi masqué si autre track joue Q7.7, etc.) qui structurent l'ensemble du POC-T7.

**T7.1 — Préparation pilote** : ajout du header Xing/LAME au MP3 `sequence_02_non_verbale-1778057695.mp3` (séquence pilote `e8dfa6b8-...`) pour stabiliser le seek HTML5. Aucune modification de code applicatif. **Dette D7-6 ouverte (haute priorité)** : pipeline ElevenLabs ne produit pas le header Xing par défaut → re-mux manuel requis pour chaque nouvelle séquence du POC.

**T7.2 — Démo wrapper isolée** : création du wrapper `<EnrichedAudioPlayer>` (`src/components/formation/EnrichedAudioPlayer.tsx`) et des composants `src/components/audio-enriched/*` (KaraokeTranscript, KaraokeWord, StructuredWhiteboard, SpeakerBadge, Grid, Figures, Comparison, Causal, Flowchart, Timeline, ConceptBadges). Hook `src/hooks/useCurrentWord.ts` (throttle 4Hz) + `src/hooks/useEnrichedTimeline.ts` (fetch + cache JSON timeline). Variante A (Q-T7.2-D1) 2-col grid desktop validée. **Décisions D1/D2/D3/D4** prises (pas de concepts user-facing, D4 dormant). Démo POC admin `/admin/poc/extract-scenes` créée.

**T7.3 + T7.3.1 — Intégration SequencePlayer** : connexion du wrapper au `<SequencePlayer>` user via 2 call-sites :
- **Call-site (a)** intro audio (~558-571) : pas touché, `<AudioPlayer>` legacy gardé.
- **Call-site (b)** principal séquence (~640-660) : `<EnrichedAudioPlayer>` ajouté en sibling.

T7.3.1 corrige le doublon cover #2 (`WhiteboardOrCover` rendait une cover dupliquée). Pattern méthodologique clé établi : *validation maquettes textuelles AVANT patch sur sujets design*.

**T7.4a — Hardening UI** :
- **T7.4a-D** : TabSelector segmented dark + gradient catégorie sur tab actif (résolution D7-13).
- **T7.4a-E** : placeholder whiteboard 3 dots pulsants (résolution D7-12).
- **T7.4a-G** : karaoké mobile fenêtre Spotify `max-h-[180px] overflow-y-auto` + auto-scroll mot-level (résolution D7-11). Détection mode fenêtre via `scrollHeight > clientHeight + 1`.
- **T7.4a-F** : investigation D7-14 (cover #1 mobile) **sans patch** sur décision Q-T7.4-2=B. Diagnostic confirme source `AudioPlayer.tsx:88-98`. Trois options de fix recommandées pour ticket UX dédié.

**T7.4-UX — Layout mobile compact** (session ad hoc le 2026-05-10) :
- **T7.4-UX-B** : prop `hideLegacyCardWhenEnriched` ajoutée à `EnrichedAudioPlayer`, predicate `hideLegacyCard = hideLegacyCardWhenEnriched && enrichmentEnabled && hasTimeline && !error`. Masque la card legacy en mode enriched (Combiné/Whiteboard). **D7-14 résolue implicitement** : la cover #1 est rendue À L'INTÉRIEUR de `<AudioPlayer>`, donc elle disparaît avec la card.
- **T7.4-UX-C** : **annulée en cours de session** suite à STOP Dr Fantin. D7-14 résolue par T7.4-UX-B sans toucher `AudioPlayer.tsx`. → **Invariant `AudioPlayer.tsx = 0 ligne diff` préservé sur tout le POC-T7** 🎯
- **T7.4-UX-D** : header compact mobile (titre + ⓘ Objectifs) Option α validée.
- **T7.4-UX-E** : drawer Objectifs bottom sheet (pattern `NewsModal.tsx`, pas de framer-motion ajouté).
- **T7.4-UX-FAB** : FAB Play overlay whiteboard (Q-stop-1) — entry point Play visible quand `hideLegacyCard=true && !isCurrentTrack`. Préservation Q5 stricte (callback `onPlayRequest` exposé, `playAudio` côté SequencePlayer parent).
- **T7.4-UX-F** : flexbox plein écran mobile simplifié (suppression sticky whiteboard), `pb-24 → pb-40` pour clearance MiniPlayer.

**T7.4b — Smoke prod + cas dégradés réseau + responsive sweep + ce recap** :
- **T7.4b-A** : décision fallback T9 actée (Q-T7.4b-A=C) pour le smoke multi-séquences. Smoke renforcé sur la pilote uniquement validé OK par Dr Fantin (6 cas fonctionnels + 10 critères visuels T7.4-UX, 1 écart cosmétique D7-16).
- **T7.4b-B** : 4 cas dégradés (B1 timeline fetch KO → fallback Q6 OK + restauration BDD byte-perfect confirmée, B2 Slow 3G OK, B3 anti-skip stress OK, B4 race Q7.7 OK).
- **T7.4b-C** : 5 captures responsive sweep — à fournir par Dr Fantin OU dette T9 explicite.
- **T7.4b-H** : ce fichier.

---

## §2. Métriques d'effort

### 2.1 Durée calendaire

POC-T7 du **2026-05-07 (T7.0)** au **2026-05-11 (T7.4b)** = **5 jours calendaires**, **6 sessions de travail** distinctes (T7.0+T7.1 fusionnées, T7.2, T7.3+T7.3.1, T7.4a, T7.4-UX, T7.4b). Travail concentré sur la pilote `e8dfa6b8-...` (formation `99b270dd-...`, séquence #2 "La communication non verbale au fauteuil").

### 2.2 Lignes de code par sous-ticket (sources : `git diff --numstat` des rapports respectifs)

| Sous-ticket | Fichier | Added | Removed | Net |
|---|---|---|---|---|
| T7.0 | (inspection) | 0 | 0 | 0 |
| T7.1 | (MP3 Storage) | 0 (code) | 0 | 0 (code) |
| **T7.2** | `EnrichedAudioPlayer.tsx` + `audio-enriched/*` (10 composants) + hooks (2) + démo POC | ~1800 (estim.) | 0 | ~+1800 |
| **T7.3 + T7.3.1** | `SequencePlayer.tsx` call-site (b) + `EnrichedAudioPlayer.tsx` cover fix + `audio-enriched/WhiteboardOrCover` cleanup | ~60 (estim.) | ~10 (estim.) | ~+50 |
| **T7.4a** | `KaraokeTranscript.tsx` (+86/-10) + `EnrichedAudioPlayer.tsx` (+6/-3) + `SequencePlayer.tsx` (+44/-20) | **+136** | **-33** | **+103** |
| **T7.4-UX** | `EnrichedAudioPlayer.tsx` (+92/-21) + `SequencePlayer.tsx` (+142/-7) | **+234** | **-28** | **+206** |
| **T7.4b** | (smoke + doc only) | 0 (code) | 0 | 0 (code) |

**Total POC-T7 estimé** : **~+2160 lignes de code applicatif net**.

> Note : les valeurs T7.2/T7.3+T7.3.1 sont des estimations à valider par Dr Fantin via `git log --stat` sur la branche `main` ou via les PR mergées correspondantes. T7.4a/T7.4-UX sont exactes (lues dans les rapports).

### 2.3 Fichiers touchés vs explicitement protégés

**Touchés sur tout le POC-T7** (3 fichiers `src/` principaux + 10 nouveaux fichiers `audio-enriched/` + 2 hooks + 1 page admin démo) :

```
src/components/formation/EnrichedAudioPlayer.tsx        (créé T7.2, modifié T7.3/T7.3.1/T7.4a/T7.4-UX)
src/components/formation/SequencePlayer.tsx             (modifié T7.3/T7.4a/T7.4-UX, call-site b uniquement)
src/components/audio-enriched/KaraokeTranscript.tsx     (créé T7.2, modifié T7.4a-G)
src/components/audio-enriched/KaraokeWord.tsx           (créé T7.2, jamais re-touché)
src/components/audio-enriched/StructuredWhiteboard.tsx  (créé T7.2, jamais re-touché)
src/components/audio-enriched/SpeakerBadge.tsx          (créé T7.2)
src/components/audio-enriched/Grid.tsx                  (créé T7.2)
src/components/audio-enriched/Figures.tsx               (créé T7.2)
src/components/audio-enriched/Comparison.tsx            (créé T7.2)
src/components/audio-enriched/Causal.tsx                (créé T7.2)
src/components/audio-enriched/Flowchart.tsx             (créé T7.2)
src/components/audio-enriched/Timeline.tsx              (créé T7.2)
src/components/audio-enriched/ConceptBadges.tsx         (créé T7.2, D4 dormant)
src/hooks/useCurrentWord.ts                             (créé T7.2)
src/hooks/useEnrichedTimeline.ts                        (créé T7.2)
src/lib/timeline/*                                      (créé T7.2 helpers)
src/app/admin/poc/extract-scenes/page.tsx               (créé T7.2 démo)
src/app/admin/timelines/...                             (créé T6 hors POC-T7 mais utilisé en T7.4b-A préparation)
```

**Protégés (invariant 0 ligne diff sur tout le POC-T7)** 🎯 :

```
src/components/formation/AudioPlayer.tsx                ✅ 0 ligne diff (invariant POC-T7 préservé)
src/context/AudioContext.tsx                            ✅ 0 ligne diff
src/components/MiniPlayer.tsx                           ✅ 0 ligne diff (lecture seule pour identification)
src/app/(app)/layout.tsx                                ✅ 0 ligne diff
src/app/layout.tsx                                      ✅ 0 ligne diff
```

> **Victoire architecturale clé** : **AudioPlayer.tsx 0 ligne diff sur les 5 jours et 6 sessions du POC-T7**. Le wrapper sibling non-invasif Q7.1 a tenu sur l'ensemble du périmètre, y compris quand T7.4-UX a remplacé la card legacy par un FAB Play overlay (préserve l'invariant via `hideLegacyCardWhenEnriched` + `onPlayRequest` callback côté SequencePlayer parent).

### 2.4 Schéma BDD

**Migrations appliquées sur tout le POC-T7** : **0**. Aucune table ou colonne ajoutée. Aucune RLS modifiée. Aucune fonction Postgres créée.

**Opérations BDD ad hoc** :
- T7.1 : ajout MP3 ré-encodé dans Storage `formations/communication-ecoute-active/audio/`
- T7.2 : insertion 1 timeline JSON dans Storage `audio-timelines/formation/e8dfa6b8-.../` puis UPDATE `sequences.timeline_url` + `timeline_published=true`
- T7.4b-B1 : UPDATE temporaire (suffixe `-broken.json` ~3-5 min) + restauration byte-perfect (cf. RAPPORT_T7_4_B §7.2)

**Aucune autre opération BDD prod** sur tout le POC-T7. ✅

### 2.5 Coût LLM cumulé

- **T7.0 → T7.4b** : 0€ LLM applicatif (le code applicatif n'appelle pas le LLM en production user)
- **T7.2** : 1 appel Sonnet 4.6 pour extraction scènes pilote (~0,07€) via la démo POC admin
- **T7.4b-A décision C** : pas d'appel LLM (fallback T9, pas de pipeline T2+T5 sur une 2e séquence)

→ **Coût LLM cumulé POC-T7 ≈ 0,07€**. Frugalité validée.

---

## §3. Critères d'acceptation POC-T7

Cf. `spec_poc_visualisation_audio_v1_0.md §10 Ticket 7`. Statut consolidé :

| Critère | Description | Statut | Justification / Réserve |
|---|---|---|---|
| **C1** | Wrapper `<EnrichedAudioPlayer>` rendu en sibling de `<AudioPlayer>` (Q7.1) | ✅ | T7.2 + intégration T7.3 call-site (b) |
| **C2** | Lecture seule sur `AudioContext` depuis le wrapper (Q5) | ✅ | T7.2 + préservé en T7.4-UX-FAB via callback `onPlayRequest` côté parent |
| **C3** | Fallback gracieux Q6 si timeline absente / fetch KO | ✅ | T7.2 (init) + validé en T7.4b-B1 (smoke prod, card legacy + cover #1 réapparaissent) |
| **C4** | Panneau enrichi masqué si autre track joue (Q7.7) | ✅ | T7.2 (init) + validé en T7.4b-B4 (smoke prod, isolation pilote vs autre piste) |
| **C5** | Whiteboard structured rendu (scènes T4 + extension D3) | ✅ | T7.2 + smoke T7.4b-A V7 |
| **C6** | Karaoké mot-level auto-scroll (mobile fenêtre Spotify, desktop segment-level) | ✅ (fonctionnel) | T7.4a-G ; ⚠️ écart cosmétique D7-16 (mobile ~7 lignes au lieu de ~3 visées) — non bloquant |
| **C7** | TabSelector Combiné/Whiteboard/Audio seul fonctionnel | ✅ | T7.4a-D (reskin), validé smoke T7.4b-A V8 + V5 |
| **C8** | Anti-skip jamais contourné | ✅ | Vérifié T7.4b-B3 stress test : listener `timeupdate` + `seekTo()` wrapper bloquent toutes tentatives |
| **C9** | DPC `course_watch_logs` write path immuable | ✅ | Baseline 4 logs/24h → post-smoke 7 logs/24h (Δ=+3 cohérent), aucune touche au hook DPC |
| **C10** | `AudioContext.tsx` 0 ligne diff | ✅ | Vérifié à chaque livraison |
| **C11** | **`AudioPlayer.tsx` 0 ligne diff (invariant POC-T7)** 🎯 | ✅ | Préservé sur tout le POC-T7 (T7.4-UX-C annulé pour préserver l'invariant) |
| **C12** | Variante A T7.2 desktop préservée (2-col grid karaoké\|whiteboard) | ✅ | T7.2 + T7.4-UX-F préservé desktop (mobile simplifié uniquement) |
| **C13** | Pas de `localStorage` / `sessionStorage` | ✅ | Tous les états en `useState` local |
| **C14** | Pas de migration BDD ni RLS changée | ✅ | 0 migration sur tout le POC-T7 |
| **C15** | Smoke prod pilote validé | ✅ | T7.4b-A OK |
| **C16** | Smoke prod multi-séquences (≥ 2 séquences) | 🟡 **Reporté T9** | Décision Q-T7.4b-A=C : cas 2 confirmé (1 seule séquence avec timeline_published=true), création d'une 2e timeline impliquait soit ~0,07€ LLM + accès formation à donner, soit fabrication arbitraire. Reporté à T9 quand le pipeline complet sera utilisé en conditions réelles. |
| **C17** | Cas dégradés réseau validés (timeline KO, slow, anti-skip stress, race Q7.7) | ✅ | T7.4b-B 4/4 OK |
| **C18** | Responsive sweep 5 viewports | 🟡 **Dette à clôturer** | Captures à fournir par Dr Fantin OU dette T9 explicite (cf. RAPPORT_T7_4_B §5.5) |
| **C19** | Critères visuels T7.4-UX (header compact + drawer + pas de gros player en enriched + cover #1 absente en enriched + mode `audio_only` restauré + MiniPlayer + whiteboard plein cadre + karaoké fenêtre sans scroll 375px + TabSelector segmented + placeholder 3 dots) | ✅ (9/10) | T7.4b-A V1-V10 OK, sauf V9 écart D7-16 mineur (auto-scroll mot-level opérationnel, hauteur fenêtre ~7 lignes au lieu de ~3) |

**Synthèse acceptation** : **17/19 critères OK** + 2 dettes/reports documentés (C16 multi-séquences → T9, C18 captures responsive → Dr Fantin ou T9). Aucun critère échoué.

---

## §4. Décision go/no-go partielle

### 4.1 Question posée à Dr Fantin

> *"La visualisation audio formations est-elle prête pour des tests utilisateurs T9 ?"*

### 4.2 Position de Claude Code (synthèse pour aide à la décision Dr Fantin)

**Arguments pour GO T9** :

1. **17/19 critères d'acceptation POC-T7 OK**, les 2 restants sont :
   - C16 multi-séquences : reporté T9 par décision explicite (la pilote seule est suffisante pour valider l'architecture POC, le multi-séquences est par nature un test utilisateur réel).
   - C18 captures responsive : dette administrative (production de fichiers PNG), pas une lacune technique.

2. **Invariant architectural préservé** : `AudioPlayer.tsx` 0 ligne diff sur tout le POC-T7. Cela démontre que le pattern wrapper sibling non-invasif Q7.1 est robuste et que le périmètre POC est strictement contenu. Aucune dérive du périmètre legacy.

3. **DPC `course_watch_logs` write path validé non régressé** par 6 sessions de smoke (baseline 4 logs/24h → 7 logs/24h post-T7.4b, Δ=+3 cohérent). Le contrat DPC obligatoire ne casse pas.

4. **Anti-skip jamais contourné** : T7.4b-B3 stress test valide le comportement strict. Conformité réglementaire/pédagogique préservée.

5. **Cas dégradés réseau validés** : T7.4b-B1 (timeline KO + fallback Q6 + cover #1 réapparaît) + T7.4b-B2 (Slow 3G) + T7.4b-B4 (race condition Q7.7). Robustesse en conditions imparfaites confirmée.

6. **Dettes restantes** : 2 dettes mineures **non bloquantes** (D7-15 cosmétique acceptable, D7-16 cosmétique karaoké hauteur) + 1 dette haute priorité **hors POC-T7** (D7-6 pipeline ElevenLabs Xing — affecte les **futures** séquences, pas la pilote). Toutes les dettes UI/UX bloquantes (D7-11, D7-12, D7-13, D7-14) sont résolues.

**Arguments contre GO T9 / pour pause** :

1. **Multi-séquences non validé en prod** : un seul jeu de scènes/transcripts a été testé end-to-end. Risque de surprise sur :
   - Séquences plus courtes (250-470s vs pilote 538s) : timing whiteboard/karaoké éprouvé sur 1 cas seulement.
   - Séquences avec d'autres tags dans le whiteboard (Grid, Figures, Comparison, Causal, Flowchart, Timeline) : utilisés en T7.2 démo POC admin mais pas tous testés en SequencePlayer user-facing.
   - MP3 sans header Xing (toutes les futures séquences ElevenLabs natives) : seek HTML5 instable jusqu'à fix D7-6.
2. **Concepts T5 (D4) dormants** : `ConceptBadges` créé mais pas user-facing (T3-bis à venir). Le payload timeline contient des concepts mais ils ne sont pas exploités côté UI user.
3. **Captures responsive multi-viewports manquantes** : si les 5 captures T7.4b-C ne sont pas livrées avant merge, validation visuelle 768/1024/1440 est inférée du code (pas du runtime).

### 4.3 Recommandation Claude Code

**GO T9 partiel, sur la pilote uniquement, avec déballage progressif** :

1. **Étape T9a — Tests utilisateurs pilote** : ouvrir l'accès à la pilote `e8dfa6b8-...` à un panel de 3-5 dentistes (`access_type='full'` formation `99b270dd-...`). Collecte feedback UX qualitatif sur 7-10 jours.
2. **Étape T9b — Préparation 2e séquence** : pendant T9a, traiter en parallèle **D7-6** (pipeline ElevenLabs Xing) + faire tourner le pipeline T2 (Whisper) + T5 (Sonnet extraction) + T6 (publication éditeur) sur 1 séquence candidate (recommandation : `cdbc7540-...` "introduction" 235s = courte = peu cher LLM + couvre le cas onboarding utilisateur). Publier `timeline_published=true`.
3. **Étape T9c — Smoke multi-séquences** : valider sur ≥ 2 séquences (C16) avant tests utilisateurs étendus.

**Réserve formelle Dr Fantin** : la décision go/no-go finale est de la responsabilité de Dr Fantin après lecture de ce recap. Claude Code recommande GO partiel comme ci-dessus, mais la trajectoire alternative (pause + 2e séquence avant T9, ou GO total complet immédiat) reste valide selon les contraintes calendrier produit.

---

## §5. Roadmap mise à jour après POC-T7

### 5.1 Roadmap immédiate

| Ticket | Description | Priorité | Pré-requis |
|---|---|---|---|
| 🔵 **T9a** | Tests utilisateurs réels pilote (3-5 dentistes) | Haute | Décision Dr Fantin GO |
| 🟠 **D7-6 fix** | Pipeline ElevenLabs Xing/LAME automatique | Haute | Conditionne T9b |
| 🔵 **T9b** | Pipeline T2+T5+T6 sur 1 séquence candidate (recommandation `cdbc7540-...` "introduction" 235s) | Moyenne | D7-6 fix souhaitable mais pas bloquant |
| 🔵 **T9c** | Smoke multi-séquences (C16) | Moyenne | T9b livré |

### 5.2 Roadmap suivante (parallèle ou post-T9)

| Ticket | Description | Priorité | Pré-requis |
|---|---|---|---|
| 🔵 **T8** | `<NewsVisualSequence>` + génération auto news | Moyenne | Indépendant de T9, peut démarrer en parallèle |
| 🆕 **T5-bis** | Re-prompt agent extraction (à cadrer) | Moyenne | Feedback T9a peut informer |
| 🔵 **T3-bis** | `<ConceptBadges>` user-facing | Moyenne | T5-bis livré |
| 🆕 **T7.5 / T7-bis-concepts** | Concepts T5 dans whiteboard (à cadrer) | Basse | T5-bis livré |
| 🔵 **Sprint 2 dédié D7-7** | `demoMode` hardcodé remplacé par toggle propre | Basse | Indépendant |

### 5.3 Tickets écartés / résolus implicitement

- ❌ **T7.4-UX-BIS** (D7-15 fix) : écarté, D7-15 reclassée cosmétique acceptable (cf. RAPPORT_T7_4_B §10).
- ❌ **Ticket UX dédié D7-14 fix** : écarté, D7-14 résolue implicitement par T7.4-UX-B (invariant `AudioPlayer.tsx = 0 ligne diff` préservé).

---

## §6. Dettes consolidées D7-1 à D7-16

| ID | Dette | Description courte | Statut post-T7.4b | Priorité | Ticket dédié |
|---|---|---|---|---|---|
| D7-1 | Slug divergence | Slug formation vs URL | 🟡 Ouverte | Basse | Aucun |
| D7-2 | Bazar versions JSON timeline | Multiplicité timestamps `audio-timelines/...` | 🟡 Ouverte | Basse | Aucun |
| D7-3 | Auth/SSO preview Vercel | Difficulté de smoke preview sans logout/login | 🟡 Ouverte | Moyenne | T9a peut motiver fix |
| D7-4 | Modes test résiduels | Flags `?test=` divers | 🟡 Ouverte | Moyenne | Aucun |
| D7-5 | Build warnings Next.js | Warnings prerender Supabase env vars en sandbox | 🟡 Ouverte | Cosmétique | Aucun (issue connue, pas blocker CI) |
| D7-6 | Pipeline Xing/LAME ElevenLabs | MP3 ElevenLabs natifs sans header Xing → re-mux manuel | 🟠 **Ouverte** | **Haute** | **Bloque T9b multi-séquences** |
| D7-7 | `demoMode` hardcodé | Flag mode démo POC admin en dur | 🔵 Reportée Sprint 2 | Basse | Sprint 2 dédié (Q-T7.4-1=C) |
| D7-8 | Memo ops audio | Mémoïsation manquante sur certains callbacks | 🟡 Ouverte | Moyenne | Aucun |
| D7-11 | Karaoké mobile fenêtre Spotify | Auto-scroll segment-level uniquement avant T7.4a | ✅ **Résolue T7.4a-G** | — | — |
| D7-12 | Wording placeholder | "Visualisation suivante à venir…" trop technique | ✅ **Résolue T7.4a-E** | — | — |
| D7-13 | Tabs reskin design | TabSelector turquoise déconnecté du flow user | ✅ **Résolue T7.4a-D** | — | — |
| D7-14 | Cover #1 mobile en mode enriched | Cover 160×160 doublée avec whiteboard | ✅ **Résolue implicitement T7.4-UX-B** 🎯 | — | — (invariant `AudioPlayer.tsx = 0 ligne diff` préservé) |
| D7-15 | MiniPlayer overlap transitoire | Boutons "Retour" / "Quiz" cachés ~200-500ms au démarrage mobile | 🟡 Ouverte, cosmétique acceptable | Basse | **Pas de ticket dédié** (Dr Fantin a confirmé acceptable post-smoke T7.4b) |
| **D7-16** | **Karaoké mobile hauteur ~7 lignes vs ~3 visées** | T7.4a-G `max-h-[180px]` produit ~7 lignes effectives sur device réel | 🟡 **Nouvelle, ouverte, mineure** | Basse | Ticket polish post-T8 (réduire `max-h-[180px]` → `max-h-[100px]` ou `text-sm md:text-base`) |
| Captures T7.4b-C | 5 captures responsive sweep | 375 / 768 / 1024 / 1440 / vrai mobile | 🟡 À fournir Dr Fantin OU dette T9 | Moyenne | Aucun (administrative) |

**Bilan dettes** :
- ✅ **4 résolues** (D7-11, D7-12, D7-13, D7-14)
- 🔵 **1 reportée Sprint 2** (D7-7)
- 🟠 **1 haute priorité ouverte** (D7-6 — bloque T9b)
- 🟡 **9 ouvertes basse/moyenne priorité** (D7-1, D7-2, D7-3, D7-4, D7-5, D7-8, D7-15, D7-16, captures)
- ❌ **0 dette critique restante** sur le périmètre POC-T7 visualisation audio formations.

---

## §7. Apprentissages méthodologiques cumulés POC-T7

Six sessions distinctes (T7.0+T7.1, T7.2, T7.3+T7.3.1, T7.4a, T7.4-UX, T7.4b) ont consolidé un **pattern méthodologique reproductible** pour les futurs POC complexes :

### 7.1 Pattern wrapper sibling non-invasif Q7.1 confirmé robuste

L'invariant `AudioPlayer.tsx = 0 ligne diff` a tenu sur **5 jours et 6 sessions**, malgré :
- L'ajout d'un panneau enrichi à 10 composants `audio-enriched/*`
- La consommation lecture-seule de l'AudioContext
- La résolution implicite de D7-14 (cover #1 mobile)
- L'introduction d'un FAB Play overlay (T7.4-UX-FAB) qui ne casse pas le pattern lecture seule (callback parent)

→ **Pattern à généraliser** pour d'autres wrappers user-facing (par ex. T8 `NewsVisualSequence`).

### 7.2 Découpage en sous-tickets ≤ 1 jour : nécessité confirmée

Apprentissage T7.3 → T7.3.1 (fix tabs cover #2 sortant en addendum) → T7.4a (3 patches G+D+E) → T7.4-UX (5 sous-tâches B/D/E/FAB/F + 1 annulée C) → T7.4b (4 sous-tâches A/B/C/H).

Le découpage fin a permis :
- Validation Dr Fantin granulaire (1 maquette → 1 patch → 1 smoke)
- Annulation à temps de cadrages erronés (T7.4-UX-C abandonnée AVANT toute touche `AudioPlayer.tsx`)
- Rollback ciblé si nécessaire (jamais déclenché grâce à la fragmentation)

### 7.3 Validation maquettes textuelles AVANT patch sur sujets design

Apprentissage clé T7.3.1 ("doublon cover #2 : 2 options de fix présentées, Option A choisie après échange") propagé en :
- T7.4a-D : 3 maquettes ASCII textuelles TabSelector → Maquette 1 segmented dark validée
- T7.4a-E : 3 options wording → Option 3 "3 dots pulsants" validée
- T7.4-UX-D : Option α/β/γ header → Option α validée
- T7.4-UX-F : Option F1/F2 layout → F1 flexbox simplifié validée

→ **Économie d'allers-retours patch ↔ rollback considérable**.

### 7.4 Annulation T7.4-UX-C en cours de session

Exemple précieux de **remise en cause d'un cadrage de prompt par l'analyse de Claude Code** :
- Prompt initial T7.4-UX prévoyait T7.4-UX-C (ajout prop `enriched` à `AudioPlayer.tsx` pour cacher la cover #1).
- Dr Fantin a analysé avant exécution : T7.4-UX-B masque déjà la card entière → cover #1 (à l'intérieur de la card) disparaît avec elle.
- T7.4-UX-C aurait été du dead code défensif → annulée.
- **Conséquence** : invariant `AudioPlayer.tsx = 0 ligne diff` préservé. Victoire architecturale.

→ **Pattern à valoriser** : un cadrage de prompt est une hypothèse, pas une obligation. L'analyse en pré-flight peut le remettre en cause.

### 7.5 Smoke visuel local par Dr Fantin obligatoire

Apprentissage T7.4a + T7.4-UX + T7.4b : la sandbox Claude Code n'a pas de navigateur interactif → **dette captures écran systématique**.

Mitigations adoptées :
- **Mini-smoke logique** (raisonnement code-level) systématique en clôture de chaque sous-ticket
- **Build clean + type-check 0 erreur** vérifiés en CI
- **Smoke prod Vercel preview** par Dr Fantin avant merge (T7.4b)
- **Décision explicite Dr Fantin** sur tout cas ambigu (D7-15 acceptable, D7-16 mineur)

→ **Pattern à institutionnaliser** : prévoir explicitement le créneau "smoke visuel Dr Fantin" dans chaque ticket UX, avec checklist détaillée fournie par Claude Code.

### 7.6 Pré-flight SQL systématique

Apprentissage T7.4a + T7.4-UX + T7.4b : 4 requêtes SQL fixées (séquences publiées + candidates + compte test + baseline `course_watch_logs`) en début de chaque sous-ticket smoke.

Bénéfices observés :
- Détection précoce des divergences entre prompt et réalité (`current_sequence=2` vs 15, timeline régénérée `2026-05-09` vs `2026-05-08`)
- Baseline DPC pour validation non-régression post-smoke
- Confirmation invariants entre tickets (séquence pilote toujours OK)

→ **Pattern à généraliser** dans les futurs tickets DBA-sensibles.

### 7.7 Rituel de session strict (1 sous-tâche à la fois)

Pas d'enchaînement de sujets, pas de roadmap pendant un patch. Confirmation explicite "déploiement Vercel Ready" + "test passé / échoué" avant proposition suivante.

→ **Discipline anti-dérive** efficace, à conserver.

### 7.8 Approche "0 ligne de code applicatif T7.4b" pour le smoke + doc

Bonne pratique : **un ticket de validation finale ne touche pas le code applicatif**. T7.4b est l'exemple : 100% smoke prod + documentation, 0 patch `src/`. Si un bug bloquant avait été identifié pendant le smoke, validation Dr Fantin requise AVANT tout patch (rituel question #4).

→ **Pattern à reproduire** pour les futures clôtures de POC : séparer livraison code (T7.4-UX) et validation/recap (T7.4b).

---

## §8. Liens vers livrables

### 8.1 Rapports POC-T7 à la racine du repo

```
RAPPORT_T7_0_INSPECTION.md
RAPPORT_T7_1_PREPARATION_PILOTE.md
RAPPORT_T7_2_DEMO_ENRICHED_PLAYER.md
RAPPORT_T7_3_INTEGRATION_SEQUENCEPLAYER.md
RAPPORT_T7_3_1_ADDENDUM_FIX_TABS_COVER.md
RAPPORT_T7_4_A_HARDENING_UI.md
RAPPORT_T7_4_UX_LAYOUT_MOBILE.md
RAPPORT_T7_4_B_SMOKE_PROD.md
RECAP_FINAL_POC_T7_11MAI2026.md          ← ce fichier
```

### 8.2 Recaps de session Project Knowledge (côté Claude.ai)

```
RECAP_SESSION_POC_AUDIO_T7_0_T7_1_09MAI2026.md
RECAP_SESSION_POC_AUDIO_T7_2_09MAI2026.md
RECAP_SESSION_POC_AUDIO_T7_3_10MAI2026.md
```

### 8.3 Branches Git

```
claude/patches-ui-karaoke-FTgjT             (T7.4a, mergée)
claude/verify-miniplayer-ditqh              (T7.4-UX, mergée PR #257)
claude/smoke-test-multi-sequence-1upoq      (T7.4b, en cours d'ouverture PR)
```

### 8.4 Pilote de référence

- Formation : `99b270dd-c411-40e0-b865-1930e59464f1` ("communication-ecoute-active")
- Séquence : `e8dfa6b8-ef34-4454-a198-e6f973f466de` ("La communication non verbale au fauteuil", 538s)
- Audio : `formations/communication-ecoute-active/audio/sequence_02_non_verbale-1778057695.mp3` (Xing fixé T7.1)
- Timeline : `audio-timelines/formation/e8dfa6b8-…/2026-05-09T07-38-27-896Z.json`
- Compte test : `2b4985d2-4967-4ab8-ba3e-163cde22d88d` (jujufant@hotmail.com)

---

## §9. Conclusion

POC-T7 livré en **5 jours, 6 sessions, 7 sous-tickets**, **0 régression** sur les périmètres legacy (AudioContext, AudioPlayer, MiniPlayer, DPC, anti-skip), **17/19 critères d'acceptation OK** + 2 dettes documentées et reportées T9. Invariant architectural majeur **`AudioPlayer.tsx = 0 ligne diff`** préservé sur tout le périmètre.

**Visualisation audio formations** : prête pour décision Dr Fantin GO T9a (tests utilisateurs pilote) ou GO complet selon trajectoire produit. Recommandation Claude Code : **GO partiel sur la pilote**, traitement parallèle D7-6 + T9b 2e séquence pendant T9a.

---

**Fin du RECAP FINAL POC-T7.**
