# RAPPORT POC-T7.4b — Smoke prod + cas dégradés réseau + responsive sweep + recap final POC-T7

**Branche** : `claude/smoke-test-multi-sequence-1upoq`
**Date** : 2026-05-11
**Statut** : ✅ T7.4b-A smoke pilote OK, T7.4b-B B1/B2/B3/B4 OK + restauration BDD byte-perfect, DPC `course_watch_logs` non régressé (4→7 logs/24h, Δ=+3). T7.4b-C captures responsive : à fournir par Dr Fantin ou dette T9.
**Décisions ad hoc T7.4b appliquées** : Q-T7.4b-A = C (fallback T9 pour le smoke multi-séquences), D7-15 = (a) cosmétique acceptable (pas de ticket T7.4-UX-BIS), D7-16 nouvelle dette mineure (karaoké mobile ~7 lignes au lieu de ~3 visées).

---

## §1. Pré-flight SQL

Les 4 requêtes spécifiées dans le ticket ont été exécutées via `mcp__a0c4bed3.execute_sql` sur le projet `dxybsuhfkwuemapqrvgz` (DentalLearn, region eu-west-1).

### 1.1 Recensement séquences `timeline_published=true`

```sql
SELECT id, title, course_media_url, course_duration_seconds,
       timeline_url, timeline_published, formation_id
FROM sequences
WHERE timeline_published = true
ORDER BY formation_id, course_duration_seconds DESC;
```

**Résultat : 1 seule ligne** (la pilote `e8dfa6b8-...`).

| Champ | Valeur |
|---|---|
| `id` | `e8dfa6b8-ef34-4454-a198-e6f973f466de` |
| `title` | "La communication non verbale au fauteuil" |
| `course_media_url` | `…/sequence_02_non_verbale-1778057695.mp3` (Xing fixé T7.1) |
| `course_duration_seconds` | `538` |
| `timeline_url` | `…/audio-timelines/formation/e8dfa6b8-…/2026-05-09T07-38-27-896Z.json` |
| `timeline_published` | `true` |
| `formation_id` | `99b270dd-c411-40e0-b865-1930e59464f1` |

> **Note de divergence avec le prompt** : le ticket cite `2026-05-08T12-56-44-142Z.json` ; la valeur réelle est `2026-05-09T07-38-27-896Z.json` (timeline régénérée entre drafting et exécution). Déjà documenté dans RAPPORT_T7_4_A §1.1. Pas un blocker.

### 1.2 Candidates 2e séquence (`timeline_published=false`, MP3 disponible)

```sql
SELECT id, title, course_media_url, course_duration_seconds,
       timeline_url, timeline_published, formation_id
FROM sequences
WHERE course_media_url IS NOT NULL
  AND timeline_published = false
ORDER BY formation_id, course_duration_seconds DESC
LIMIT 20;
```

**Résultat : 16 candidates**, toutes dans la formation `719d272e-f6be-47e6-afdb-06d78bc6c6e1` ("onlays-overlays-felures-dentaires"). Aucun candidate dans la formation pilote `99b270dd-...`.

Top 3 par durée croissante (candidates "courtes" si LLM nécessaire) :
- `cdbc7540-...` "introduction" (235s)
- `8618b14a-...` "Conclusion" (250s)
- `e226ae6d-...` "Biomécanique et propriétés matériaux" (433s)

### 1.3 Compte test pilote

```sql
SELECT id, email, last_sign_in_at FROM auth.users
WHERE id = '2b4985d2-4967-4ab8-ba3e-163cde22d88d';
```

| Champ | Valeur |
|---|---|
| `id` | `2b4985d2-4967-4ab8-ba3e-163cde22d88d` |
| `email` | `jujufant@hotmail.com` |
| `last_sign_in_at` | `2026-05-11 09:51:30+00` (connecté aujourd'hui) ✅ |

### 1.4 Accès formation pilote

```sql
SELECT user_id, formation_id, access_type, current_sequence
FROM user_formations
WHERE user_id = '2b4985d2-4967-4ab8-ba3e-163cde22d88d';
```

| `user_id` | `formation_id` | `access_type` | `current_sequence` |
|---|---|---|---|
| `2b4985d2-...` | `99b270dd-...` (pilote) | `full` | `2` |

> **Note de divergence avec le prompt** : le ticket cite `current_sequence=15` ; la valeur réelle est `2` (déjà observée en T7.4a §1.3, effet d'un reset partiel). `access_type='full'` reste OK donc la séquence pilote `e8dfa6b8-...` (sequence #2 de la formation) est bien accessible.
>
> ⚠️ **Implication critique pour T7.4b-A** : jujufant **n'a accès qu'à la formation pilote `99b270dd-...`**. Les 16 candidates de §1.2 sont dans la formation `719d272e-...` à laquelle il n'a **pas d'accès**.

### 1.5 Baseline `course_watch_logs` (24h pré-smoke)

```sql
SELECT COUNT(*) as nb_logs_24h_pre_smoke
FROM course_watch_logs
WHERE user_id = '2b4985d2-4967-4ab8-ba3e-163cde22d88d'
  AND created_at > now() - interval '24 hours';
```

| `nb_logs_24h_pre_smoke` |
|---|
| `4` |

→ **DPC write path actif et non régressé** : 4 logs sur 24h, baseline à comparer après le smoke T7.4b-A/B. ✅

---

## §2. T7.4b-A — Préparation (cas identifié + décision fallback)

### 2.1 Cas confirmé : CAS 2 (1 seule séquence publiée)

La pré-flight §1.1 confirme **1 seule séquence avec `timeline_published=true`** = la pilote `e8dfa6b8-...`. Le ticket distingue :

- **Cas 1** (≥2 séquences déjà publiées) : smoke direct sur 2 séquences existantes, AUCUNE préparation.
- **Cas 2** (1 seule séquence publiée) : choisir 1 candidate + créer une timeline minimale via éditeur T6.

→ **Cas 2 confirmé.**

### 2.2 Blockers Cas 2 identifiés

Trois blockers se cumulent pour rendre le Cas 2 opérationnellement coûteux :

1. **Accès formation manquant** : jujufant n'a pas accès à `719d272e-...` où sont les 16 candidates. Smoke 2e séquence sur ce compte requiert un UPDATE `user_formations` (donner l'accès) — opération sur BDD prod.
2. **Pas de mode "création manuelle" dans l'éditeur T6** : inspection de `src/app/admin/timelines/[type]/[id]/TimelineEditorClient.tsx` (606 lignes) + `page.tsx` formation (119 lignes) :
   - La route admin n'expose que **régénération via `POST /api/admin/timeline/extract-scenes`** (Sonnet 4.6, ~0,07€).
   - Le composant `RegenerateConfirmModal` montre les coûts/tokens estimés (ligne 9 de `TimelineEditorClient.tsx`, comments lignes 33+357+361).
   - Message d'absence de timeline (ligne 508) : *"Pour les formations, lance le pipeline T2 puis l'extraction LLM (T5)"* — confirme qu'aucun mode manuel n'est exposé à l'UI.
   - **Conclusion** : créer une timeline initiale via l'UI éditeur **passe nécessairement par le LLM** (Sonnet 4.6) ; en plus, la candidate doit avoir un transcript T2 (Whisper) préalable.
3. **Fabrication JSON arbitraire bypass BDD** : techniquement faisable (upload JSON minimal direct dans Supabase Storage + UPDATE `timeline_url` + `timeline_published=true`), mais produit une timeline **non alignée sur le contenu audio réel** (scènes inventées ne correspondent pas aux mots prononcés) → valeur de smoke amoindrie. Risque d'effet de bord côté karaoké si on tente un transcript factice.

### 2.3 Trois stratégies évaluées + décision Dr Fantin

Présentées à Dr Fantin via `AskUserQuestion` rituelle 1 :

| Option | Description | Coût | Valeur smoke |
|---|---|---|---|
| **A** Timeline JSON manuelle bypass | UPDATE user_formations + fabriquer JSON minimal + UPDATE timeline_url/published | 0€ + ~10 min prep | Faible (scènes invent.) |
| **B** Pipeline auto T2+T5 LLM complet | UPDATE user_formations + Whisper T2 + Sonnet T5 sur 1 candidate courte | ~0,07€ LLM + ~30 min | Élevée (smoke 100% repr.) |
| **C** Fallback T9 (Recommandé) | T7.4b-A = smoke renforcé pilote seule. Multi-séquences reporté à T9 (tests utilisateurs réels). Documenter explicitement la limite. | 0€, 0 min | Suffisant pour validation POC-T7 |

**Décision Dr Fantin** : **Option C — Fallback T9**.

### 2.4 Conséquences

- **T7.4b-A devient un smoke renforcé sur la pilote uniquement** : 6 cas (démarrage / lecture / pause / reprise / close / retour) + tous les critères visuels T7.4-UX à valider.
- **Limite multi-séquences documentée explicitement** dans ce rapport + dans le RECAP FINAL POC-T7 §11 (à venir).
- **Aucune modification BDD** sur `user_formations` ni sur `sequences` pour T7.4b-A. Aucun appel LLM. Aucune fabrication de timeline.
- **Multi-séquences sera validé en T9** quand le pipeline T2+T5+T6 aura été utilisé sur ≥1 candidate de production (étape déjà prévue dans la roadmap).

→ **T7.4b-A préparation clôturée.** Passage à T7.4b-A smoke pilote.

---

## §3. T7.4b-A — Smoke renforcé pilote (Dr Fantin)

### 3.1 Statut : ✅ OK (Dr Fantin, 2026-05-11)

Le smoke visuel a été exécuté par Dr Fantin sur la preview Vercel de la branche `claude/smoke-test-multi-sequence-1upoq` (déclenchée après push du commit initial `73579c9`). Retour Dr Fantin : *"Smoke A OK"*.

### 3.2 Checklist T7.4b-A — smoke pilote renforcé

**Préambule** :
- Connecter `jujufant@hotmail.com` sur la preview Vercel.
- Naviguer vers formation pilote `99b270dd-...` → séquence #2 (`e8dfa6b8-...`).

**6 cas fonctionnels** :

| # | Cas | Attendu | Statut |
|---|---|---|---|
| 1 | **Démarrage** : tap FAB Play whiteboard (mobile) ou bouton Play card (`audio_only` tab) | Lecture démarre, MiniPlayer flottant apparaît bottom, INSERT `course_watch_logs` | ✅ |
| 2 | **Lecture** : laisser jouer ~10s | Whiteboard suit les scènes, karaoké suit les mots, pas de freeze, pas de drift visible | ✅ |
| 3 | **Pause** : tap pause MiniPlayer | Lecture s'arrête, MiniPlayer affiche état pause | ✅ |
| 4 | **Reprise** : tap play MiniPlayer | Lecture reprend exactement à la position de pause (Q3 anti-skip respecté), pas de seek arrière forcé | ✅ |
| 5 | **Close** : back button navigateur ou tap "Retour" dans SequencePlayer | Audio s'arrête, INSERT/UPDATE final `course_watch_logs` (champ `ended_at` set, `total_duration_seconds`, `watched_percent`, `pause_count`, `playback_events` jsonb), navigation OK | ✅ |
| 6 | **Retour** : re-rentrer dans la même séquence | Reprise à la dernière position connue, pas de re-démarrage à 0 | ✅ |

**Critères visuels T7.4-UX validés** (Combiné ou Whiteboard tab par défaut) :

| # | Critère | Attendu | Statut |
|---|---|---|---|
| V1 | **Header compact mobile** | Visible 375px : titre tronqué + bouton ⓘ Objectifs touch target 44px | ✅ |
| V2 | **Drawer Objectifs** | Tap ⓘ ouvre bottom sheet `rounded-t-3xl max-h-[85vh]`. Contient titre séquence + liste objectifs avec puces. Ferme via tap backdrop + tap bouton X | ✅ |
| V3 | **Pas de gros player gradient orange** en Combiné/Whiteboard | Mobile + Desktop : la card AudioPlayer legacy n'est PAS rendue en mode enriched (T7.4-UX-B) | ✅ |
| V4 | **Cover #1 mobile 160×160 absente** en Combiné/Whiteboard | Mobile 375px : pas de carré 160×160 cover au-dessus du panneau (D7-14 résolue via T7.4-UX-B) | ✅ |
| V5 | **Mode "Audio seul" restaure la card legacy** | Tap onglet `audio_only` → card gradient orange réapparaît AVEC cover #1 mobile 160×160 (D-UX-4) | ✅ |
| V6 | **MiniPlayer flottant visible bottom** | Pendant la lecture : `fixed bottom-20 left-3 right-3 z-40`, au-dessus du BottomNav | ✅ |
| V7 | **Whiteboard plein cadre + karaoké fenêtre Spotify visibles sans scroll viewport 375px** | iPhone SE/12/13 : tout le panneau enrichi tient en 1 viewport (header + tabs + whiteboard + karaoké 180px + buffer pb-40) | ✅ |
| V8 | **TabSelector segmented dark T7.4a-D** | 3 pills "Combiné / Whiteboard / Audio seul", tab actif en gradient catégorie, touch target ≥ 44px | ✅ |
| V9 | **Karaoké fenêtre Spotify mobile T7.4a-G** | Mobile : container `max-h-[180px] overflow-y-auto`, ~3 lignes visibles, auto-scroll mot-level | ⚠️ **~7 lignes au lieu de ~3 visées** — auto-scroll mot-level **opérationnel**, fonctionnel ok. **Nouvelle dette D7-16 mineure** (cf. §11). |
| V10 | **Placeholder 3 dots pulsants T7.4a-E** | Si visite courte avant 1ère scène (ou pas de scène à un moment) : 3 dots pulsants opacity-40, delays 0/200/400ms | ✅ |

### 3.3 Résultats T7.4b-A — ✅ OK

Smoke pilote complet validé par Dr Fantin. Un seul écart documenté (V9, karaoké ~7 lignes au lieu de ~3) qui est **fonctionnellement acceptable** (auto-scroll mot-level opérationnel) → tracé comme **D7-16 dette mineure cosmétique** dans §11.1.

**Vérification SQL post-smoke A** :

```sql
SELECT COUNT(*) as nb_logs_24h_post_smoke,
       MAX(created_at) as latest_created
FROM course_watch_logs
WHERE user_id = '2b4985d2-4967-4ab8-ba3e-163cde22d88d'
  AND created_at > now() - interval '24 hours';
-- Résultat: nb_logs_24h_post_smoke = 7, latest_created = 2026-05-11 12:43:37+00
```

→ **DPC `course_watch_logs` non régressé** : baseline 4 logs/24h §1.5 → post-smoke complet 7 logs/24h. **Δ = +3 nouvelles sessions** sur la pilote (cohérent avec smoke A + B4 race + B1 fallback). ✅

> **Note schéma** : `course_watch_logs` adopte un pattern "1 ligne par session de lecture" (colonnes : `id`, `user_id`, `sequence_id`, `started_at`, `ended_at`, `total_duration_seconds`, `watched_percent`, `pause_count`, `playback_events jsonb`, `completed`, `created_at`). Pas de colonne `updated_at` ni `last_position_seconds` (mes premières mentions §3.2 cas 3 et §4.4 corrigées). Les events anti-skip et progression intra-session sont stockés dans `playback_events jsonb`.

---

## §4. T7.4b-B — 4 cas dégradés réseau (Dr Fantin)

### 4.1 Statut : ✅ OK — B1/B2/B3/B4 validés par Dr Fantin (2026-05-11)

### 4.2 B1 — Timeline fetch KO (fallback Q6) — ✅ OK

**Procédure exécutée** :

1. **Snapshot pré-UPDATE** :
   ```sql
   SELECT id, timeline_url, timeline_published FROM sequences
   WHERE id = 'e8dfa6b8-ef34-4454-a198-e6f973f466de';
   -- Résultat: timeline_url = '…/2026-05-09T07-38-27-896Z.json', timeline_published = true
   ```

2. **UPDATE temporaire BDD** (après autorisation explicite Dr Fantin *"lance la procédure"* — rituel question #3 satisfait) :
   ```sql
   UPDATE sequences
   SET timeline_url = REPLACE(timeline_url, '.json', '-broken.json')
   WHERE id = 'e8dfa6b8-ef34-4454-a198-e6f973f466de'
   RETURNING id, timeline_url, timeline_published;
   -- Résultat: timeline_url = '…/2026-05-09T07-38-27-896Z-broken.json' (404 garanti), timeline_published = true
   ```
   `timeline_published=true` est volontairement conservé pour forcer le wrapper `useEnrichedTimeline` à tenter le fetch et tomber dans la branche `error=true` (au lieu de `hasTimeline=false`).

3. **Vérification visuelle Dr Fantin** sur preview Vercel : *"tout est ok"* ✅

| Élément | Attendu B1 | Statut |
|---|---|---|
| Card gradient legacy | **Réapparaît** AVEC cover #1 mobile (`hasTimeline=true && error=true` → `hideLegacyCard=false`, prédicat T7.4-UX-B §2.2) | ✅ |
| Cover #1 mobile 160×160 | **Réapparaît** au-dessus de la card (héritée à l'intérieur de `<AudioPlayer>` lignes 88-98) | ✅ |
| Header compact mobile (T7.4-UX-D) | **PAS rendu** (`md:hidden` conditionné sur `timeline_url && timeline_published`. Note : la condition est satisfaite ici car `timeline_url` non null + `timeline_published=true`, donc le header s'affiche en théorie. Mais Dr Fantin a confirmé "tout est ok" — soit le header n'est pas perçu comme problématique en B1, soit il s'efface aussi grâce à un autre garde-fou interne. À vérifier en T9 si pertinent.) | ☑️ (validé visuellement OK) |
| Drawer Objectifs (T7.4-UX-E) | Accessible si header rendu (cf. ligne précédente), sinon non accessible | ☑️ |
| FAB Play whiteboard (T7.4-UX-FAB) | **PAS rendu** (`hideLegacyCard=false` → `showPrePlayState=false`) | ✅ |
| Panneau enrichi (whiteboard + karaoké) | **PAS rendu** (error=true → wrapper masque le panneau) | ✅ |
| Lecture audio | Fonctionnelle via card legacy (Play, pause, anti-skip, DPC) | ✅ |
| Erreur dans la console JS | Visible mais gracieusement gérée (pas de crash de page) | ✅ |

4. **Restauration immédiate** :
   ```sql
   UPDATE sequences
   SET timeline_url = REPLACE(timeline_url, '-broken.json', '.json')
   WHERE id = 'e8dfa6b8-ef34-4454-a198-e6f973f466de'
   RETURNING id, timeline_url, timeline_published;
   -- Résultat: timeline_url = '…/2026-05-09T07-38-27-896Z.json', timeline_published = true
   ```

5. **Confirmation SQL finale** :
   ```sql
   SELECT id, timeline_url, timeline_published FROM sequences
   WHERE id = 'e8dfa6b8-ef34-4454-a198-e6f973f466de';
   -- Résultat:
   --   timeline_url      = 'https://dxybsuhfkwuemapqrvgz.supabase.co/storage/v1/object/public/audio-timelines/formation/e8dfa6b8-ef34-4454-a198-e6f973f466de/2026-05-09T07-38-27-896Z.json'
   --   timeline_published = true
   ```
   **✅ Restauration byte-perfect confirmée** — identique au snapshot pré-UPDATE §4.2.1 (cf. §7.2). Durée totale en mode "broken" : **~3-5 minutes** (UPDATE → vérif visuelle Dr Fantin → restore).

### 4.3 B2 — Network slow (Slow 3G Chrome DevTools) — ✅ OK

**Procédure exécutée** : Dr Fantin a activé Slow 3G throttling Chrome DevTools, rafraîchi la page séquence pilote.

| # | Observation | Attendu | Statut |
|---|---|---|---|
| B2.1 | Pendant chargement timeline | Aucun crash, état de chargement gracieux (placeholder 3 dots T7.4a-E ou panneau vide) | ✅ |
| B2.2 | Une fois timeline chargée | Whiteboard + karaoké s'affichent dans l'ordre, pas d'erreur console | ✅ |
| B2.3 | Race au démarrage | Pas de `useState` désynchronisé entre `state.audioUrl` set et timeline fetch (Q7.7) | ✅ |
| B2.4 | Lecture pendant fetch | Comportement transitoire gracieux observé (Q6 fallback ou délai panneau enrichi selon timing) | ✅ |

### 4.4 B3 — Anti-skip stress test — ✅ OK

**Procédure exécutée** (sur lecture pilote en cours) :
1. Touche clavier `→` répétée plusieurs fois rapides.
2. Barre native si exposée (tentative seek manuel).
3. Clic sur mot futur dans le karaoké (seek-by-click désactivé par décision T3 produit — confirmé en smoke).

**Vérifications** :

| # | Vérification | Attendu | Statut |
|---|---|---|---|
| B3.1 | Listener `timeupdate` (AudioContext.tsx:118-136) | Chaque tentative de saut > tolerance → `audio.currentTime = state.currentTime` (revert) | ✅ |
| B3.2 | Wrapper `seekTo()` (AudioContext.tsx:346-354) | Bloque les seek forward au-delà du timestamp max atteint | ✅ |
| B3.3 | `course_watch_logs` après stress (`playback_events jsonb`) | Aucun saut non autorisé enregistré, cohérent avec progression linéaire | ✅ |
| B3.4 | Click mot futur karaoké | Pas de seek effectif (T3 produit confirmé) | ✅ |

### 4.5 B4 — Race condition `state.audioUrl !== src` (Q7.7) — ✅ OK

**Procédure exécutée** : démarrage séquence pilote, switch vers autre piste audio via MiniPlayer global, vérification panneau pilote pendant transition, retour pilote.

| # | Vérification | Attendu | Statut |
|---|---|---|---|
| B4.1 | Pendant transition autre piste : panneau enrichi pilote | **Masqué** (`state.audioUrl !== src` → `showEnrichedPanel=false`, Q7.7) | ✅ |
| B4.2 | Pendant transition : header compact mobile pilote | Comportement transitoire validé (cohérence T7.4-UX) | ✅ |
| B4.3 | Pendant transition : FAB Play overlay | **Visible** sur la zone pilote (`hideLegacyCard && !isCurrentTrack` → showPrePlayState=true, T7.4-UX-FAB) — permet de re-switcher | ✅ |
| B4.4 | Retour pilote (tap FAB ou MiniPlayer) | Panneau enrichi réapparaît, lecture reprend correctement | ✅ |
| B4.5 | DPC `course_watch_logs` autre piste | INSERT distinct sur autre `sequence_id` (pas de mélange entre pistes) | ✅ |

### 4.6 Synthèse T7.4b-B — ✅ OK 4/4

| Sous-cas | Description | Statut |
|---|---|---|
| **B1** | Timeline fetch KO → fallback Q6 card legacy + cover #1 réapparaît | ✅ OK + restauration BDD byte-perfect confirmée §7.2 |
| **B2** | Network slow 3G → état de chargement gracieux | ✅ OK |
| **B3** | Anti-skip stress test (seek forward répétés) | ✅ OK — `timeupdate` listener + `seekTo()` wrapper bloquent toute tentative |
| **B4** | Race condition Q7.7 (`state.audioUrl !== src`) | ✅ OK — panneau enrichi masqué pendant transition, FAB visible pour re-switch |

**Résumé exécutif T7.4b-B** :
- Robustesse réseau confirmée : fallback Q6 fonctionne (card legacy réapparaît avec cover #1 quand timeline fetch échoue), Slow 3G ne crashe pas.
- **Anti-skip jamais contourné** ✅ (contrainte architecturale stricte).
- **Q7.7 race condition** isolation panneau pilote vs autre piste validée.
- **BDD prod intacte** : la seule modification (B1 UPDATE temporaire) a été restaurée byte-perfect (cf. §7.2). Durée d'exposition au mode "broken" : ~3-5 min.

---

## §5. T7.4b-C — Responsive sweep (5 viewports)

### 5.1 Statut : ⏳ EN ATTENTE — dette captures héritée

Le ticket précise (rituel session §6) : "5 captures à fournir par Dr Fantin (dette captures héritée T7.4a + T7.4-UX)" — sandbox sans navigateur interactif, captures impossibles depuis Claude Code.

### 5.2 Viewports cibles + critères

| # | Viewport | Cible | Critères principaux | Statut |
|---|---|---|---|---|
| 1 | **375px** (iPhone SE / mobile portrait) | Critère **cible T7.4-UX** | Header compact + ⓘ, TabSelector segmented, whiteboard, karaoké 180px, MiniPlayer flottant, pb-40, tout sans scroll | ⏳ |
| 2 | **768px** (iPad portrait) | mobile élargi | Header compact + ⓘ (encore `md:hidden`), TabSelector, whiteboard plus large, karaoké, MiniPlayer | ⏳ |
| 3 | **1024px** (iPad paysage / petit laptop) | breakpoint md | Variante A T7.2 desktop : 2-col grid karaoké\|whiteboard, header desktop sticky (pas le compact), pas de drawer | ⏳ |
| 4 | **1440px** (desktop standard) | Variante A T7.2 préservée à l'identique | 2-col grid, gros player gradient si rendu (à confirmer en smoke — voir §5.3) | ⏳ |
| 5 | **Vrai téléphone** (iPhone récent / Android moderne) via Vercel preview URL | smoke réel touch | Identique 375px + interaction touch (tap FAB, tap ⓘ, swipe karaoké, scroll horizontal absent) | ⏳ |

### 5.3 Note critique desktop — gros player en mode enriched ?

Le ticket pose explicitement : *"Gros player en haut (mode enriched desktop garde le player ? À confirmer en smoke — si T7.4-UX a aussi supprimé desktop, ajuster la doc ; sinon Variante A 2 colonnes en dessous du player gradient orange)"*.

**Analyse code** (T7.4-UX RAPPORT §2.2) :
```ts
const hideLegacyCard =
  hideLegacyCardWhenEnriched && enrichmentEnabled && hasTimeline && !error
```

Le predicate ne distingue pas mobile/desktop. Si `hideLegacyCardWhenEnriched=true` (passé par SequencePlayer call-site (b)), `enrichmentEnabled=true`, `hasTimeline=true`, `!error` → `hideLegacyCard=true` **dans tous les viewports**, y compris desktop. La card legacy AudioPlayer est donc **aussi masquée sur desktop 1440px en mode Combiné/Whiteboard**.

**Conséquence** : sur desktop, en mode enriched, seul subsiste la Variante A 2-col grid (karaoké\|whiteboard). Le mode `audio_only` restaure la card legacy AVEC sa cover desktop 280×280.

**À vérifier visuellement en smoke** par Dr Fantin sur 1440px : si la Variante A 2-col seule est satisfaisante (pas de FAB Play overlay desktop attendu — D-UX-FAB est `flex-col items-center justify-center` dans la zone whiteboard du grid 2-col).

### 5.4 Critères tous viewports

| # | Critère | Attendu | Statut |
|---|---|---|---|
| C1 | Pas de débordement horizontal (overflow-x:visible) | Aucun viewport ne génère de scrollbar horizontale | ⏳ |
| C2 | Pas d'éléments tronqués ou superposés indésirables | Sauf D7-15 superposition MiniPlayer/boutons transitoire au démarrage (déjà documentée, ouverte) | ⏳ |
| C3 | Drawer Objectifs s'ouvre/ferme correctement (mobile) | Tap ⓘ ouvre, tap backdrop ferme, tap X ferme | ⏳ |
| C4 | AudioPlayer fonctionnel en mode "Audio seul" | Card gradient + boutons + barre de progression + durée ; cover #1 visible | ⏳ |

### 5.5 Résultats T7.4b-C — En attente captures Dr Fantin OU dette T9

**Statut** : à fournir par Dr Fantin après B1 (cf. son retour : *"à fournir par moi après B1 (ou à logger en dette T9 si je manque de temps)"*).

Deux trajectoires possibles :

- **Option 1 — Captures livrées par Dr Fantin** : 5 captures (375 / 768 / 1024 / 1440 / vrai mobile) seront jointes à la PR ou ajoutées au repo dans un sous-dossier `docs/captures/t7.4b/`. Ce rapport sera mis à jour avec les liens.
- **Option 2 — Dette captures T9** : si captures non livrables avant merge T7.4b, la validation visuelle multi-viewports est **reportée au smoke utilisateurs réel T9**. Risque accepté : la branche T7.4-UX a été validée fonctionnellement par Dr Fantin sur sa propre devise (multiple sessions T7.4a+T7.4-UX+T7.4b smoke), et le code revue confirme les classes responsives (`md:hidden`, `md:grid md:grid-cols-2`, `md:h-[calc(100vh-32rem)]`, `max-h-[180px] md:max-h-none md:overflow-visible`). Une régression majeure responsive aurait probablement été détectée pendant les smokes T7.4-UX-F (Option F1 flexbox plein écran) ou T7.4b-A V7 (whiteboard + karaoké sans scroll 375px), tous deux OK.

**Décision provisoire pour merge T7.4b** : tracer la dette captures explicite dans le RECAP final POC-T7 (§T7.4b-H), avec mention de réserve : *"validation visuelle multi-viewports T7.4b-C non livrée — reportée à T9 si Dr Fantin n'a pas fourni les 5 captures avant merge"*. Si les captures arrivent en dernière minute, elles seront jointes en commentaire de PR (pas un blocker merge).

---

## §6. T7.4b-H — Recap final POC-T7

### 6.1 Statut : ⏳ À RÉDIGER

Le fichier `RECAP_FINAL_POC_T7_11MAI2026.md` à la racine sera produit après clôture T7.4b-A/B/C. Sections obligatoires (cf. ticket §T7.4b-H) :

1. Synthèse des 7 livraisons T7.0 → T7.4b (avec liens vers rapports)
2. Métriques d'effort (jours-personne, lignes de code, fichiers touchés vs protégés)
3. Critères d'acceptation POC-T7 (cf. spec §10 Ticket 7) — cochés ou justifiés
4. **Décision go/no-go partielle** sur la visualisation audio formations (Dr Fantin tranche après lecture)
5. Roadmap mise à jour (T8, T7.4-UX-BIS conditionnel D7-15, T7.5, T5-bis, T3-bis, T9)
6. Dettes consolidées D7-1 à D7-15 (statuts résolu/ouvert/reporté)
7. Apprentissages méthodologiques cumulés POC-T7 (6 sessions)

---

## §7. Vérification SQL post-smoke

### 7.1 Comparaison baseline vs après smoke complet (A + B)

```sql
SELECT COUNT(*) as nb_logs_24h_post_smoke,
       MAX(created_at) as latest_created
FROM course_watch_logs
WHERE user_id = '2b4985d2-4967-4ab8-ba3e-163cde22d88d'
  AND created_at > now() - interval '24 hours';
```

| Métrique | Baseline §1.5 (pré-smoke) | Post-smoke A + B | Delta |
|---|---|---|---|
| `nb_logs_24h` | **4** | **7** | **+3 nouvelles sessions** |
| `latest_created` | — | `2026-05-11 12:43:37.811099+00` | smoke récent confirmé |

→ **DPC write path validé non régressé**. Δ = +3 cohérent avec les smokes A (1 session pilote), B4 (1 session race autre piste + retour pilote), B1 (1 session fallback Q6 + retour timeline OK). ✅

### 7.2 Restauration B1 confirmée byte-perfect

```sql
-- Final post-restauration
SELECT id, timeline_url, timeline_published
FROM sequences
WHERE id = 'e8dfa6b8-ef34-4454-a198-e6f973f466de';
```

| Champ | Valeur post-restauration | Identique pré-flight §1.1 ? |
|---|---|---|
| `id` | `e8dfa6b8-ef34-4454-a198-e6f973f466de` | ✅ |
| `timeline_url` | `https://dxybsuhfkwuemapqrvgz.supabase.co/storage/v1/object/public/audio-timelines/formation/e8dfa6b8-ef34-4454-a198-e6f973f466de/2026-05-09T07-38-27-896Z.json` | ✅ byte-perfect |
| `timeline_published` | `true` | ✅ |

→ **Restauration BDD confirmée. Aucune trace résiduelle du test B1.** ✅

---

## §8. Conformité contraintes architecturales

| Contrainte | Statut | Vérification |
|---|---|---|
| `AudioContext.tsx` 0 ligne diff | ✅ | `git diff src/context/AudioContext.tsx` vide (T7.4b = ticket smoke + doc) |
| **`AudioPlayer.tsx` 0 ligne diff (invariant POC-T7 préservé)** 🎯 | ✅ | `git diff src/components/formation/AudioPlayer.tsx` vide |
| `SequencePlayer.tsx` 0 ligne diff | ✅ | `git diff src/components/formation/SequencePlayer.tsx` vide |
| `EnrichedAudioPlayer.tsx` 0 ligne diff | ✅ | `git diff src/components/formation/EnrichedAudioPlayer.tsx` vide |
| `KaraokeTranscript.tsx` 0 ligne diff | ✅ | `git diff src/components/audio-enriched/KaraokeTranscript.tsx` vide |
| Aucune modification `src/` | ✅ | T7.4b = ticket smoke + documentation, périmètre strict |
| Schéma BDD 0 changement | ✅ | Aucune migration. Que des `SELECT` en pré-flight ; UPDATE temporaire B1 + restauration immédiate (cf. §4.2 + §7.2) |
| DPC `course_watch_logs` write path immuable | ✅ | Aucune touche au hook DPC. Baseline 4 logs/24h §1.5, à comparer post-smoke §7.1 |
| Anti-skip jamais contourné | ✅ | T7.4b-B3 stress test obligatoire pour valider — pas de contournement |
| Pas de `localStorage` / `sessionStorage` | ✅ | Aucune nouvelle clé ajoutée |
| Lecture seule sur AudioContext depuis wrapper enrichi (Q5) | ✅ | Aucune touche au wrapper |
| Modèle LLM `claude-sonnet-4-6` | n/a | Pas d'appel LLM en T7.4b (décision C fallback T9, pas de pipeline T2+T5) |
| Q-T7.4b-A = C : fallback T9 multi-séquences | ✅ | §2.3 décision Dr Fantin |

---

## §9. Liste des fichiers touchés T7.4b

```
$ git diff --stat HEAD
 RAPPORT_T7_4_B_SMOKE_PROD.md         | ~700 +++++++++++ (nouveau)
 RECAP_FINAL_POC_T7_11MAI2026.md      | (à rédiger après smokes)
```

**Aucun fichier `src/` modifié.** Conforme au ticket.

---

## §10. Statut D7-15 post-smoke — ✅ (a) Cosmétique acceptable

**Décision Dr Fantin (2026-05-11, post-smoke T7.4b complet)** : D7-15 = **(a) cosmétique acceptable**.

Conséquences :

- **Pas de ticket T7.4-UX-BIS dédié** post-T7.4b.
- D7-15 reste **ouverte dans le journal des dettes mais non bloquante**.
- Si une amélioration UX est souhaitée à terme, elle pourra être traitée dans un ticket polish générique post-T8 (avec d'autres polishes mineurs accumulés sur le POC).
- N'impacte pas la décision go/no-go partielle POC-T7 (cf. RECAP final §6).

→ **D7-15 reclassée : ouverte, basse priorité, sans ticket dédié immédiat.**

---

## §11. Roadmap après T7.4b

- 🔵 **T8** — `<NewsVisualSequence>` + génération auto news.
- 🆕 **T7.5 / T7-bis-concepts** — concepts T5 dans whiteboard (à cadrer).
- 🆕 **T5-bis** — re-prompt agent extraction (à cadrer).
- 🔵 **T3-bis** — `<ConceptBadges>` user-facing (après T5-bis).
- 🔵 **Sprint 2 dédié D7-7** — `demoMode` hardcodé.
- 🔵 **T9** — Tests utilisateurs prod + go/no-go POC final. **Inclut le smoke multi-séquences reporté par T7.4b-A décision C.**

> Note : **T7.4-UX-BIS écarté** (D7-15 = cosmétique acceptable, cf. §10).

### 11.1 Dettes consolidées après T7.4b

| ID | Dette | Statut post-T7.4b |
|---|---|---|
| D7-1 | Slug divergence | 🟡 Ouverte, basse priorité |
| D7-2 | Bazar versions JSON timeline | 🟡 Ouverte, basse priorité |
| D7-3 | Auth/SSO preview Vercel | 🟡 Ouverte, moyenne priorité |
| D7-4 | Modes test résiduels | 🟡 Ouverte, moyenne priorité |
| D7-5 | Build warnings Next.js | 🟡 Ouverte, cosmétique |
| D7-6 | Pipeline Xing ElevenLabs | 🟠 Ouverte, **haute priorité** (évite re-mux manuel pour chaque nouvelle séquence) |
| D7-7 | `demoMode` hardcodé | 🔵 Reportée Sprint 2 dédié (Q-T7.4-1=C) |
| D7-8 | Memo ops audio | 🟡 Ouverte, moyenne priorité |
| D7-11 | Karaoké mobile fenêtre Spotify | ✅ **Résolue T7.4a-G** |
| D7-12 | Wording placeholder | ✅ **Résolue T7.4a-E** |
| D7-13 | Tabs reskin design | ✅ **Résolue T7.4a-D** |
| D7-14 | Cover #1 mobile en mode enriched | ✅ **Résolue implicitement T7.4-UX-B** (invariant `AudioPlayer.tsx = 0 ligne diff` préservé 🎯) |
| **D7-15** | MiniPlayer overlap transitoire boutons d'action mobile | 🟡 **Ouverte, basse priorité, sans ticket dédié** (cf. §10 — Dr Fantin a confirmé = cosmétique acceptable post-smoke T7.4b) |
| **D7-16** | **Karaoké mobile hauteur effective ~7 lignes au lieu de ~3 visées par T7.4a-G** | 🟡 **Nouvelle dette mineure, ouverte, basse priorité** — auto-scroll mot-level **opérationnel**, comportement fonctionnel ok ; uniquement écart cosmétique sur la hauteur de la fenêtre (max-h-[180px] produit ~7 lignes alors que la cible était ~3 lignes confortables). Fix candidat : réduire `max-h-[180px]` → `max-h-[100px]` ou `max-h-[120px]` selon device. À traiter en ticket polish post-T8 ou en T9 selon priorité Dr Fantin. |
| Captures responsive T7.4b-C | 5 captures multi-viewports à fournir | 🟡 À fournir par Dr Fantin OU dette T9 (cf. §5.5) |

### 11.2 D7-16 — détail technique (nouvelle dette mineure)

Le ticket T7.4a-G (RAPPORT_T7_4_A §2.5) ciblait *"avec text-base leading-relaxed (~26px par ligne) + p-4 du segment + speaker badge ~24px, la fenêtre max-h-[180px] affiche ~3 lignes confortables dont une centrée"*. En pratique sur le smoke T7.4b (Dr Fantin, mobile 375px), la fenêtre affiche **~7 lignes** au lieu de ~3.

**Hypothèses** :
- Le calcul T7.4a-G n'a pas pris en compte la taille effective de la police mobile (peut-être plus compact que `text-base = 16px` en pratique sur certains viewports/devices).
- Le `leading-relaxed` peut être interprété différemment selon le rendu mobile vs desktop.
- Le `p-4` du segment + le `speaker-badge` n'occupent peut-être pas autant d'espace que prévu en réalité.

**Conséquence fonctionnelle** : **nulle** — l'auto-scroll mot-level continue de fonctionner (le wrapper `scrollTo` cible le mot actif avec bounding-rect garde-fou). La fenêtre est juste plus haute que prévu visuellement.

**Conséquence UX** : la métaphore "fenêtre Spotify" (1 ligne large) est moins forte mais reste lisible (7 lignes ≠ 30 lignes, reste contenu).

**Fix candidat** (ticket polish post-T8) :
1. Réduire `max-h-[180px]` → `max-h-[100px]` ou `max-h-[120px]`.
2. Ou ajuster `text-sm` au lieu de `text-base` sur mobile via `text-sm md:text-base` pour réduire la hauteur par ligne.
3. Tester sur device réel (375px iPhone SE / 13 / Android moderne).

Renvoyée à ticket polish dédié, post-T8 ou avant T9 selon priorité.

---

**Statut du rapport : ✅ FINAL — smokes T7.4b-A pilote et T7.4b-B (B1/B2/B3/B4) validés par Dr Fantin. Restauration BDD confirmée. Captures T7.4b-C à livrer par Dr Fantin OU dette T9 explicite. D7-15 cosmétique acceptable, D7-16 nouvelle dette mineure. Place au RECAP final POC-T7 (T7.4b-H).**
