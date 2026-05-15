# Rapport livraison T13 — Workflow publication journal news

**Date** : 2026-05-14
**Branch** : `claude/workflow-publication-journal-Lt1BX`
**Projet** : DentalLearn V3

---

## Objectif

Séparer "Générer l'audio" et "Publier" en deux actions distinctes pour le journal hebdomadaire, introduire un statut intermédiaire `ready`, et résoudre trois dettes techniques adjacentes.

**Machine d'état après T13** : `draft → [generate-audio] → ready → [publish] → published → [archive] → archived`

---

## Dettes résolues

| Dette | Description | Résolution |
|---|---|---|
| `D-T12-D-REGEN-FLAG` | Helper audio partagé (3 callers) | `src/lib/news/generate-episode-audio.ts` |
| `D-T12-D-bis-3-CLIENT-ORCHESTRATION` | Orchestration script→audio partiellement migrée backend | Helper extrait, statuts maîtrisés côté serveur |
| `D-T11-NAV-01` | Liste "Au sommaire" non cliquable | Links vers `/admin/news/[id]/edit` |

---

## Fichiers créés

### Helpers partagés

- **`src/lib/news/generate-episode-audio.ts`** — Génération audio ElevenLabs + upload Storage + timeline, pour les 3 callers (journal initial, episode initial, régénération). Ne fait aucun UPDATE BDD.
- **`src/lib/news/generate-episode-script.ts`** — Génération script Claude claude-sonnet-4-6 pour les journaux. Wraps `buildJournalPrompt()` + appel Anthropic avec retry.

### Nouveaux endpoints

- **`src/app/api/admin/news/episodes/[id]/publish/route.ts`** — `POST` : `ready → published`. Écrit `published_at` + `validated_by`. Précondition : `status === 'ready'` → 409 sinon.
- **`src/app/api/admin/news/episodes/[id]/archive/route.ts`** — `POST` : `published|ready → archived`. Libère l'index UNIQUE partiel `type_week_uniq`.

---

## Fichiers modifiés

### Endpoints generate-audio refactorés

- **`src/app/api/admin/news/journal/[id]/generate-audio/route.ts`** — Utilise `generateEpisodeAudio()`, passe à `status='ready'` (au lieu de `published`) en mode non-régénération. Flag `?regenerate=true` préservé.
- **`src/app/api/admin/news/episodes/[id]/generate-audio/route.ts`** — Même refactor. Précondition changée de `status !== 'ready'` à `status !== 'draft'`.

### UI admin journal T11

- **`src/app/admin/news/journal/[id]/page.tsx`** — Nouveau badge `ready` (amber). Section "Audio prêt" avec bouton "Publier le journal" (CTA) + "Régénérer l'audio". Section de statut simplifiée. Fix D-T11-NAV-01 (Au sommaire → links).

---

## Invariants préservés

- `?regenerate=true` : le flag préserve strictement `status`, `published_at`, `validated_by`. `EpisodeRegenerationPanel` non modifié — il appelle les mêmes routes avec ce flag.
- `regenerate-linked-episodes` : fait des appels HTTP internes vers les routes generate-audio avec `?regenerate=true` — aucun changement nécessaire, comportement inchangé par transitivité.
- Constraint CHECK BDD `status = ANY (ARRAY['draft','review_cs','ready','published','archived'])` : non modifiée, `ready` était déjà présent.
- `published_at` + `validated_by` : écrits **uniquement** par `/publish`, jamais par `generate-audio`.

---

## Smoke tests à exécuter

### T13-B : workflow complet
```
1. Créer journal draft → générer script → cliquer "Générer l'audio"
   → vérif MCP : status='ready', audio_url non-null, published_at IS NULL
2. Cliquer "Publier le journal"
   → vérif MCP : status='published', published_at non-null, validated_by = UUID Dr Fantin
3. Cliquer "Archiver"
   → vérif MCP : status='archived'
```

### T13-A : régression régénération
```
POST /api/admin/news/journal/{archivedId}/generate-audio?regenerate=true
→ vérif MCP : audio_url mis à jour, status reste 'archived'
```

### T13-F : navigation Au sommaire
```
Ouvrir /admin/news/journal/[id] → cliquer un item "Au sommaire"
→ /admin/news/[synthesisId]/edit s'ouvre correctement
```
