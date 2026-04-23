# Migrations Supabase — DentalLearn V3

Scripts SQL versionnés appliqués au projet Supabase `dxybsuhfkwuemapqrvgv`
(plan Free — pas de Supabase branches disponibles).

## Convention de nommage

- Migrations : `YYYYMMDD_description.sql`
- Rollbacks : `YYYYMMDD_description_down.sql` (même préfixe + suffixe `_down`)
- Seeds séparés (optionnel, pour clarté) : `YYYYMMDD_description_seed_<nom>.sql`

La convention `_down.sql` est **obligatoire à partir du 23 avril 2026**
(cf. §4.8 du handoff section News). Les 4 migrations antérieures
(`20260205_*`, `20260326_*` ×2, `20260408_*`) n'en ont pas — elles ne seront
pas rétro-documentées.

## Entête obligatoire

Chaque fichier SQL commence par un bloc commentaire de 5 lignes :

```sql
-- Nom du fichier : 20260423_news_schema.sql
-- Date de création : 2026-04-23
-- Ticket : feature/news-ticket-1
-- Description : <résumé une ligne>
-- Rollback : supabase/migrations/20260423_news_schema_down.sql
```

Le champ `Rollback` pointe vers le fichier d'annulation correspondant.
Pour un fichier de seed, le champ `Rollback` pointe vers un `DELETE` ciblé
ou vers le rollback du schéma parent.

## Application — mode ping-pong SQL Editor (Free tier)

Le projet étant sur le plan Free, il n'existe pas de Supabase branches.
Les migrations sont appliquées **manuellement** via le **SQL Editor** du
dashboard Supabase, en mode copier-coller orchestré par Claude Code.

Protocole par ticket :

1. Coller le **bloc DDL/DML** principal dans le SQL Editor → `Run`.
2. Coller le **bloc SELECT de vérification** correspondant dans le SQL Editor → `Run`.
3. Renvoyer les résultats du SELECT à Claude Code pour validation.

**Règle stricte** : un bloc DDL/DML et son bloc SELECT ne sont **jamais**
mélangés dans la même exécution. Objectif : pouvoir relancer un SELECT à
volonté sans risquer de réexécuter un DDL non-idempotent.

## Rollback

Les fichiers `_down.sql` ne sont **pas exécutés en temps normal**. Ils sont
stockés dans le repo pour :

- pouvoir annuler une migration en cas de problème (coller dans le SQL Editor),
- documenter les objets à détruire en cas de refonte,
- servir de contrôle de review (un reviewer peut vérifier la symétrie
  up/down sans exécuter).

## Dette technique connue

**Auth admin par email hardcodé (`drfantin@gmail.com`)**
Pattern en place dans 8 fichiers admin existants (`src/app/admin/layout.tsx`,
`src/app/admin/page.tsx`, `src/app/api/admin/*/route.ts`, etc.). Non refactoré
dans le cadre de la section News (contrainte §4.11 du handoff :
*réutilisation stricte des patterns existants*, modifications additives
uniquement). Un ticket séparé — hors périmètre section News — devra
introduire un vrai mécanisme de rôle (champ `is_admin` sur `user_profiles`
ou table `admin_users`). Les politiques RLS des tables `news_*` sont
alignées sur ce pattern : accès réservé au service role, garde applicative
côté API routes sur l'email admin.

## Historique

| Date | Fichier | Ticket / Branche | Objet |
|------|---------|------------------|-------|
| 2026-02-05 | `20260205_daily_quiz.sql` | n/a | Daily quiz — baseline |
| 2026-03-26 | `20260326_epp_theme_slug.sql` | n/a | Slug thème EPP |
| 2026-03-26 | `20260326_ordre_inscription_date.sql` | n/a | Date inscription Ordre |
| 2026-04-08 | `20260408_daily_quiz_add_recommended_time.sql` | n/a | Ajout `recommended_time` |
| 2026-04-23 | `20260423_news_schema.sql` (+ rollback + 2 seeds) | `feature/news-ticket-1` | Section News Phase 1 — pgvector + 10 tables + indexes + RLS + seeds |

## Références

- Spec : [`spec_news_podcast_pipeline.md`](../../spec_news_podcast_pipeline.md) (v1.2)
- Handoff : [`handoff_claude_code_v1_2.md`](../../handoff_claude_code_v1_2.md) (v1.2)
- Schéma actuel (snapshot 5 avril 2026) : [`docs/prototypes/DATABASE_SCHEMA.md`](../../docs/prototypes/DATABASE_SCHEMA.md)
