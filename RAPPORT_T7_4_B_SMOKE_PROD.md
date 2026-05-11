# RAPPORT POC-T7.4b — Smoke prod + cas dégradés réseau + responsive sweep + recap final POC-T7

**Branche** : `claude/smoke-test-multi-sequence-1upoq`
**Date** : 2026-05-11
**Statut** : 🟡 Pré-flight clôturé. T7.4b-A préparation clôturée (décision C fallback T9 multi-séquences). T7.4b-A smoke pilote / T7.4b-B / T7.4b-C / T7.4b-H : en cours d'exécution.
**Décisions ad hoc T7.4b appliquées** : Q-T7.4b-A = C (fallback T9 pour le smoke multi-séquences).

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

### 3.1 Statut : ⏳ EN ATTENTE Dr Fantin

Le smoke visuel ne peut pas être exécuté depuis la sandbox (apprentissage T7.4a §6.3 + T7.4-UX §8.3 : pas de navigateur interactif). Le déploiement Vercel preview de la branche `claude/smoke-test-multi-sequence-1upoq` se déclenchera après le `git push` initial de ce rapport.

### 3.2 Checklist T7.4b-A — smoke pilote renforcé

**Préambule** :
- Connecter `jujufant@hotmail.com` sur la preview Vercel.
- Naviguer vers formation pilote `99b270dd-...` → séquence #2 (`e8dfa6b8-...`).

**6 cas fonctionnels** :

| # | Cas | Attendu | Statut |
|---|---|---|---|
| 1 | **Démarrage** : tap FAB Play whiteboard (mobile) ou bouton Play card (`audio_only` tab) | Lecture démarre, MiniPlayer flottant apparaît bottom, INSERT `course_watch_logs` | ⏳ |
| 2 | **Lecture** : laisser jouer ~10s | Whiteboard suit les scènes, karaoké suit les mots, pas de freeze, pas de drift visible | ⏳ |
| 3 | **Pause** : tap pause MiniPlayer | Lecture s'arrête, MiniPlayer affiche état pause, UPDATE `course_watch_logs.last_position_seconds` | ⏳ |
| 4 | **Reprise** : tap play MiniPlayer | Lecture reprend exactement à la position de pause (Q3 anti-skip respecté), pas de seek arrière forcé | ⏳ |
| 5 | **Close** : back button navigateur ou tap "Retour" dans SequencePlayer | Audio s'arrête, UPDATE final `course_watch_logs`, navigation OK vers liste séquences | ⏳ |
| 6 | **Retour** : re-rentrer dans la même séquence | Reprise à la dernière position connue, pas de re-démarrage à 0 | ⏳ |

**Critères visuels T7.4-UX à valider** (Combiné ou Whiteboard tab par défaut) :

| # | Critère | Attendu | Statut |
|---|---|---|---|
| V1 | **Header compact mobile** | Visible 375px : titre tronqué + bouton ⓘ Objectifs touch target 44px | ⏳ |
| V2 | **Drawer Objectifs** | Tap ⓘ ouvre bottom sheet `rounded-t-3xl max-h-[85vh]`. Contient titre séquence + liste objectifs avec puces. Ferme via tap backdrop + tap bouton X | ⏳ |
| V3 | **Pas de gros player gradient orange** en Combiné/Whiteboard | Mobile + Desktop : la card AudioPlayer legacy n'est PAS rendue en mode enriched (T7.4-UX-B) | ⏳ |
| V4 | **Cover #1 mobile 160×160 absente** en Combiné/Whiteboard | Mobile 375px : pas de carré 160×160 cover au-dessus du panneau (D7-14 résolue via T7.4-UX-B) | ⏳ |
| V5 | **Mode "Audio seul" restaure la card legacy** | Tap onglet `audio_only` → card gradient orange réapparaît AVEC cover #1 mobile 160×160 (D-UX-4) | ⏳ |
| V6 | **MiniPlayer flottant visible bottom** | Pendant la lecture : `fixed bottom-20 left-3 right-3 z-40`, au-dessus du BottomNav | ⏳ |
| V7 | **Whiteboard plein cadre + karaoké fenêtre Spotify visibles sans scroll viewport 375px** | iPhone SE/12/13 : tout le panneau enrichi tient en 1 viewport (header + tabs + whiteboard + karaoké 180px + buffer pb-40) | ⏳ |
| V8 | **TabSelector segmented dark T7.4a-D** | 3 pills "Combiné / Whiteboard / Audio seul", tab actif en gradient catégorie, touch target ≥ 44px | ⏳ |
| V9 | **Karaoké fenêtre Spotify mobile T7.4a-G** | Mobile : container `max-h-[180px] overflow-y-auto`, ~3 lignes visibles, auto-scroll mot-level | ⏳ |
| V10 | **Placeholder 3 dots pulsants T7.4a-E** | Si visite courte avant 1ère scène (ou pas de scène à un moment) : 3 dots pulsants opacity-40, delays 0/200/400ms | ⏳ |

**Vérification SQL post-smoke** :

```sql
-- À exécuter après le smoke complet T7.4b-A par Claude Code
SELECT COUNT(*) as nb_logs_post_smoke_A,
       MAX(created_at) as latest_log_created,
       MAX(updated_at) as latest_log_updated,
       SUM(CASE WHEN created_at > '<timestamp_debut_smoke>' THEN 1 ELSE 0 END) as nb_new_logs
FROM course_watch_logs
WHERE user_id = '2b4985d2-4967-4ab8-ba3e-163cde22d88d'
  AND created_at > now() - interval '24 hours';
```

Attendu : **nb_new_logs ≥ 1** (au moins un INSERT au démarrage), UPDATEs supplémentaires si pauses/reprises/close.

### 3.3 Résultats T7.4b-A — À COMPLÉTER post smoke Dr Fantin

> _À remplir une fois le smoke effectué._

---

## §4. T7.4b-B — 4 cas dégradés réseau (Dr Fantin)

### 4.1 Statut : ⏳ EN ATTENTE T7.4b-A clôturé

### 4.2 Checklist B1 — Timeline fetch KO (fallback Q6)

**Procédure** :
1. **Claude Code** demande confirmation Dr Fantin AVANT UPDATE temporaire (rituel question #3).
2. UPDATE temporaire BDD :
   ```sql
   UPDATE sequences
   SET timeline_url = REPLACE(timeline_url, '.json', '-broken.json')
   WHERE id = 'e8dfa6b8-ef34-4454-a198-e6f973f466de';
   ```
3. Smoke pilote : rafraîchir page séquence.
4. **Comportement attendu (Q6 + T7.4-UX-B)** :

| Élément | Attendu B1 | Statut |
|---|---|---|
| Card gradient legacy | **Réapparaît** AVEC cover #1 mobile (`hasTimeline=false || error=true` → `hideLegacyCard=false`) | ⏳ |
| Header compact mobile (T7.4-UX-D) | **PAS rendu** (conditionné sur `timeline_url && timeline_published`) | ⏳ |
| Drawer Objectifs (T7.4-UX-E) | **PAS accessible** (objectifs sont dans la card legacy) | ⏳ |
| FAB Play whiteboard (T7.4-UX-FAB) | **PAS rendu** (`hideLegacyCard=false` → `showPrePlayState=false`) | ⏳ |
| Panneau enrichi (whiteboard + karaoké) | **PAS rendu** (`hasTimeline=false`) | ⏳ |
| Lecture audio | Fonctionnelle via card legacy (Play, pause, anti-skip, DPC) | ⏳ |
| Erreur dans la console JS | Visible mais gracieusement gérée (pas de crash de page) | ⏳ |

5. **Restauration immédiate** :
   ```sql
   UPDATE sequences
   SET timeline_url = REPLACE(timeline_url, '-broken.json', '.json')
   WHERE id = 'e8dfa6b8-ef34-4454-a198-e6f973f466de';
   ```
6. **Confirmation SQL finale** :
   ```sql
   SELECT id, timeline_url, timeline_published
   FROM sequences
   WHERE id = 'e8dfa6b8-ef34-4454-a198-e6f973f466de';
   ```
   Attendu : `timeline_url` = `…/2026-05-09T07-38-27-896Z.json` (identique pré-flight §1.1) ✅

### 4.3 Checklist B2 — Network slow (Slow 3G Chrome DevTools)

**Procédure** :
1. Chrome DevTools → Network tab → Throttling = "Slow 3G".
2. Rafraîchir page séquence pilote.
3. Observer :

| # | Observation | Attendu | Statut |
|---|---|---|---|
| B2.1 | Pendant chargement timeline | Aucun crash, état de chargement gracieux (placeholder 3 dots T7.4a-E ou panneau vide) | ⏳ |
| B2.2 | Une fois timeline chargée | Whiteboard + karaoké s'affichent dans l'ordre, pas d'erreur console | ⏳ |
| B2.3 | Race au démarrage | Pas de `useState` désynchronisé entre `state.audioUrl` set et timeline fetch (Q7.7) | ⏳ |
| B2.4 | Lecture pendant fetch | Si lecture démarre avant fetch terminé : card legacy doit prendre le relais (Q6 fallback transitoire) OU délai d'affichage du panneau enrichi (selon timing) | ⏳ |

### 4.4 Checklist B3 — Anti-skip stress test

**Procédure** (sur lecture pilote en cours) :
1. Touche clavier `→` répétée 5 fois rapides.
2. Si barre native exposée : tenter seek manuel.
3. Clic sur mot futur dans le karaoké (note : seek-by-click désactivé par décision T3 produit — à confirmer en smoke).

**Vérifications** :

| # | Vérification | Attendu | Statut |
|---|---|---|---|
| B3.1 | Listener `timeupdate` (AudioContext.tsx:118-136) | Chaque tentative de saut > tolerance → `audio.currentTime = state.currentTime` (revert) | ⏳ |
| B3.2 | Wrapper `seekTo()` (AudioContext.tsx:346-354) | Bloque les seek forward au-delà du timestamp max atteint | ⏳ |
| B3.3 | `course_watch_logs` après stress | Aucun saut non autorisé enregistré (last_position_seconds reste cohérent) | ⏳ |
| B3.4 | Click mot futur karaoké | Pas de seek effectif (T3 produit) | ⏳ |

**Vérification SQL post-B3** :

```sql
SELECT created_at, last_position_seconds, total_listened_seconds
FROM course_watch_logs
WHERE user_id = '2b4985d2-4967-4ab8-ba3e-163cde22d88d'
  AND sequence_id = 'e8dfa6b8-ef34-4454-a198-e6f973f466de'
ORDER BY created_at DESC
LIMIT 5;
```

### 4.5 Checklist B4 — Race condition `state.audioUrl !== src` (Q7.7)

**Procédure** :
1. Démarrer la séquence pilote (lecture en cours).
2. Ouvrir le MiniPlayer global, naviguer vers une **autre piste audio** disponible (épisode news `journal_episodes` si publié, ou autre séquence dans la formation pilote avec audio).
3. Pendant la transition autre piste, vérifier le panneau pilote.
4. Revenir à la séquence pilote (`e8dfa6b8-...`).

**Vérifications** :

| # | Vérification | Attendu | Statut |
|---|---|---|---|
| B4.1 | Pendant transition autre piste : panneau enrichi pilote | **Masqué** (`state.audioUrl !== src` → `showEnrichedPanel=false`, Q7.7) | ⏳ |
| B4.2 | Pendant transition : header compact mobile pilote | **Masqué aussi** (cohérence T7.4-UX, conditionné sur `timeline_url && timeline_published` mais pas sur `state.audioUrl`) → **À VÉRIFIER si visible/invisible en pratique** | ⏳ |
| B4.3 | Pendant transition : FAB Play overlay | **Visible** sur la zone pilote (`hideLegacyCard && !isCurrentTrack` → showPrePlayState=true, T7.4-UX-FAB) — permet de re-switcher | ⏳ |
| B4.4 | Retour pilote (tap FAB ou MiniPlayer) | Panneau enrichi réapparaît, lecture reprend correctement | ⏳ |
| B4.5 | DPC `course_watch_logs` autre piste | INSERT/UPDATE distinct sur autre `sequence_id` (pas de mélange entre pistes) | ⏳ |

### 4.6 Résultats T7.4b-B — À COMPLÉTER post smoke Dr Fantin

> _À remplir une fois les 4 sous-cas B1-B4 effectués._

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

### 5.5 Résultats T7.4b-C — À COMPLÉTER post captures Dr Fantin

> _À remplir une fois les 5 captures fournies. Si captures non livrables avant merge, dette explicite à signaler dans le RECAP final POC-T7._

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

## §7. Vérification SQL post-smoke (À COMPLÉTER)

### 7.1 Comparaison baseline vs après smoke

> _Sera complété par Claude Code une fois les smokes T7.4b-A et T7.4b-B terminés._

```sql
-- Attendu : nb_logs ≥ baseline 4 + 1 INSERT au démarrage A + UPDATEs B
SELECT COUNT(*) as nb_logs_post_smoke,
       MAX(created_at) as latest_created,
       MAX(updated_at) as latest_updated
FROM course_watch_logs
WHERE user_id = '2b4985d2-4967-4ab8-ba3e-163cde22d88d'
  AND created_at > now() - interval '24 hours';
```

### 7.2 Restauration B1 confirmée

> _Sera complété par Claude Code après B1._

```sql
SELECT id, timeline_url, timeline_published
FROM sequences
WHERE id = 'e8dfa6b8-ef34-4454-a198-e6f973f466de';
```

Attendu : `timeline_url = …/2026-05-09T07-38-27-896Z.json` (identique pré-flight).

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

## §10. Statut D7-15 post-smoke

> _Sera complété par Dr Fantin en fin de smoke T7.4b._

Décision à prendre : MiniPlayer overlap transitoire au démarrage (~200-500ms) sur les boutons "Retour" et "Passer au Quiz" mobile est-il :

- **(a) Cosmétique acceptable** (déjà documenté, ouvert, ticket T7.4-UX-BIS optionnel post-T7.4b) ?
- **(b) Bloquant pour T9** (nécessite ticket T7.4-UX-BIS dédié AVANT tests utilisateurs) ?

→ Renvoyé au RECAP final POC-T7 §11 / dettes consolidées.

---

## §11. Roadmap après T7.4b

- 🔵 **T7.4-UX-BIS** (conditionnel D7-15 bloquant) — fix MiniPlayer/buttons overlap transitoire au démarrage mobile.
- 🔵 **T8** — `<NewsVisualSequence>` + génération auto news.
- 🆕 **T7.5 / T7-bis-concepts** — concepts T5 dans whiteboard (à cadrer).
- 🆕 **T5-bis** — re-prompt agent extraction (à cadrer).
- 🔵 **T3-bis** — `<ConceptBadges>` user-facing (après T5-bis).
- 🔵 **Sprint 2 dédié D7-7** — `demoMode` hardcodé.
- 🔵 **T9** — Tests utilisateurs prod + go/no-go POC final. **Inclut le smoke multi-séquences reporté par T7.4b-A décision C.**

---

**Statut du rapport : INITIAL — sera complété par Claude Code au fil des smokes Dr Fantin (T7.4b-A pilote, T7.4b-B 4 sous-cas, T7.4b-C captures, T7.4b-H recap).**
