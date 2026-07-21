# RECAP — Migration 2 : validations éditoriales des synthèses news

**Date :** 21 juillet 2026
**Demandeur :** Dr Julie Fantin
**Branche de session :** `claude/audit-cs-validations-etipt2`
**Projet Supabase :** `dxybsuhfkwuemapqrvgz` (DentalLearn)
**État :** 🛑 **POINT D'ARRÊT ÉTAPE 5 atteint.** SQL livré et appliqué. **Front NON démarré** — en attente du feu vert de Julie, en particulier sur la vérification 4 (stabilité du hash).

---

## Périmètre

Étendre le dispositif de validation éditoriale au `content_type = 'news_synthesis'`
et enregistrer rétroactivement la validation des **623 synthèses actives**
(traçabilité IA Act art. 50 §4 + Qualiopi #21).

Cette remise couvre **Étapes 1 → 4** (SQL). Les Étapes 6 (front) et 7
(build/commit final) ne seront traitées qu'après confirmation de Julie.

## Décisions appliquées

- **3A** — `content_type` étendu à `'news_synthesis'` (contrainte CHECK à 3 valeurs).
- **8A** — canal de lecture par RPC `SECURITY DEFINER` `get_syntheses_for_validation()`
  à colonnes sûres. **Aucune policy RLS** ajoutée sur `news_syntheses` (une policy
  exposerait la table entière : `embedding`, `llm_model`, ids internes, `gdrive_*`).
- **9B** — payload du hash limité au **noyau scientifique stable** (7 colonnes) :
  `display_title`, `summary_fr`, `method`, `key_figures` (trié), `evidence_level`,
  `clinical_impact`, `caveats`. **Exclus** : `themes`, `keywords_libres`,
  `category_editorial`, `formation_category_match`, `embedding`, `llm_model`,
  `gdrive_*`, timestamps, `status`, `added_by`, `manual_added`, `scored_id`, `raw_id`.
- **12A** — backfill par `INSERT ... SELECT` direct (pas `validate_content_bulk`,
  gardée par `is_super_admin(auth.uid())` = NULL en service_role). Lead résolu par
  requête (`is_lead=true AND active=true`), **UUID non codé en dur**. Idempotent via
  `NOT EXISTS` sur validation courante (respect de l'index unique).
- **13A** — commentaire honnête `'Validation rétroactive (backfill)'`.

## Fichiers livrés

- `supabase/migrations/20260721b_news_synthesis_validations.sql`
- `supabase/migrations/20260721b_news_synthesis_validations_down.sql`
- `RECAP_SESSION_21JUIL2026_MIGRATION_2_SYNTHESES.md`

Préfixe `20260721b` (vérifié : `20260721a` pris par la migration 1). Migration
**appliquée via MCP Supabase** (`apply_migration`, `success: true`).

Détail hash `key_figures` (text[]) : trié avant concaténation
(`array_to_string(ARRAY(SELECT kf FROM unnest(...) AS kf ORDER BY kf), '||')`) →
un réordonnancement ne change pas le hash. `search_path` conservé à
`public, extensions, pg_catalog` (digest() vit dans `extensions`).

Le `_down.sql` : purge les validations de backfill, drop la RPC, restaure
`compute_content_hash` sans la branche synthèse, puis restaure la contrainte à
2 valeurs — avec avertissement en tête : **l'ADD CONSTRAINT échouera
volontairement** si des validations `news_synthesis` hors backfill subsistent
(on ne supprime pas de validation légitime en silence).

## Résultat des 6 vérifications (SELECT uniquement)

| # | Contrôle | Attendu | Obtenu |
|---|---|---|---|
| 1 | Contrainte accepte les 3 valeurs | `formation, news_episode, news_synthesis` | ✅ `CHECK (content_type = ANY (ARRAY['formation','news_episode','news_synthesis']))` |
| 2 | `compute_content_hash('news_synthesis', <id actif>)` non NULL | hash 64 hex | ✅ `hash_len=64`, `non_null=true` |
| 3 | Comptage `is_current=true` par type | 8 / 13 / 623 | ✅ **formation 8 · news_episode 13 · news_synthesis 623** |
| 4 | **Anti-stale** : hash stocké vs recalculé (échantillon 20) | 0 écart | ✅ **sampled=20, mismatches=0, null_recompute=0** |
| 5 | RPC : garde + colonnes exposées | rejet non autorisé, aucune colonne interne | ✅ appel service_role → `Forbidden: cs_member or super_admin required` ; retour = `id, display_title, summary_fr, method, key_figures, evidence_level, clinical_impact, caveats, specialite, published_at` (aucune interne) |
| 6 | `validate_content`, `add_secondary_validation`, `revoke_validation`, `validate_content_bulk` inchangées | md5 identiques | ✅ md5 identiques à la capture de la migration 1 |

### Écarts de hash constatés
**Aucun.** Le point critique (vérif 4) est vert : 0 mismatch sur l'échantillon de
20. Le payload 9B est stable sur les données actuelles. *(Contrôle mené sur 20
lignes comme spécifié ; un balayage exhaustif des 623 peut être lancé à la
demande si Julie souhaite une garantie sur la totalité.)*

## Dette loggée

- **Front en attente** (Étape 6, non démarré) : types (`EditorialContentType`,
  `CsContentType`), hook `useValidationCandidates` (3e source via la RPC), page
  `/admin/editorial-validations` (onglet + badge + masquage filtre Publication),
  espace `/cs` (`getValidationQueue` / `getContentPreview` / `getMyValidations`).
- **Badge praticien** hors périmètre de cette migration (passe ultérieure) :
  `NewsModal`, `NewsRecapCard`, `NewsCardItem` non touchés.
- **Backfill mono-lot** : les 623 ont été insérés en une transaction (arbitrage
  12A `INSERT ... SELECT`, sans contrainte IDLE_TIMEOUT côté RPC SQL). Passé sans
  incident.

## Prochaine étape

1. **Feu vert de Julie** sur les 6 vérifications (surtout la #4).
2. Étape 6 — front admin + `/cs` (aucun badge praticien).
3. Étape 7 — `npx next build`, commit, push. Pas de PR.
4. Passe ultérieure — **badge praticien** « Synthèse validée » sur les actus.
