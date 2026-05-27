-- Nom du fichier : 20260527a_news_syntheses_unique_active_scored.sql
-- Date de création : 2026-05-27
-- Ticket : fix bug d'idempotence synthesize_articles (claude/fix-synthesize-idempotence-27mai2026)
-- Description : Partial UNIQUE INDEX sur news_syntheses(scored_id) pour les statuts "vivants" (active, failed, failed_permanent) — défense en profondeur contre le bug de cascade de doublons observé du 18 au 27 mai 2026
-- Rollback : supabase/migrations/20260527a_news_syntheses_unique_active_scored_down.sql

-- ============================================================================
-- Contexte
-- ============================================================================
-- Cf DIAGNOSTIC_BUG_IDEMPOTENCE_27MAI2026.md (racine du repo) pour le détail
-- complet de la cause racine. En résumé : le chemin "retry-de-failed → success"
-- dans processArticle (article_processor/index.ts) effectuait un INSERT pur
-- sans supprimer la ligne 'failed' pré-existante. Combiné à l'absence de
-- UNIQUE constraint sur scored_id, cela a permis l'accumulation de 35 doublons
-- sur 2 articles en 9 jours.
--
-- Le fix code (commit séparé sur cette même PR) corrige le chemin retry-success
-- (étape 3bis : cleanup de la ligne failed avant INSERT). Cette migration
-- ajoute une défense en profondeur au niveau schéma : un partial UNIQUE INDEX
-- qui interdit physiquement plus d'une ligne "vivante" par scored_id.
--
-- Statuts couverts par la contrainte :
--   - 'active'           — synthèse opérationnelle
--   - 'failed'           — échec en cours de retry (attempts < 2)
--   - 'failed_permanent' — échec définitif (attempts >= 2)
--
-- Statuts EXCLUS (peuvent légitimement s'accumuler par scored_id) :
--   - 'deleted'   — soft-delete administratif (ménage manuel du 27 mai a créé
--                    37 lignes deleted sur la base, dont les 35 doublons du bug)
--   - 'retracted' — article rétracté côté source (PubMed, etc.) ; comportement
--                    documentaire, plusieurs entrées possibles si rétractation
--                    après une 1re synthèse
--
-- ============================================================================
-- Pré-condition validée le 27 mai 2026 par Dr Fantin
-- ============================================================================
-- État BDD post-cleanup complémentaire :
--   active : 504, deleted : 37, failed_permanent : 1, failed : 0
--
-- La requête :
--   SELECT scored_id, COUNT(*) FROM news_syntheses
--   WHERE status IN ('active', 'failed', 'failed_permanent')
--   GROUP BY scored_id HAVING COUNT(*) > 1;
-- retourne 0 rows.
--
-- => CREATE UNIQUE INDEX réussira sans violation.
--
-- À ré-exécuter avant application en preview / production pour confirmation.

-- ============================================================================
-- 1. Création du partial UNIQUE INDEX
-- ============================================================================
-- IF NOT EXISTS pour rendre la migration rejouable.
-- Pas de CONCURRENTLY : la table news_syntheses contient ~542 rows (27 mai
-- 2026), création quasi-instantanée. CONCURRENTLY interdit dans un DO/script
-- multi-statement de toute façon.

CREATE UNIQUE INDEX IF NOT EXISTS news_syntheses_scored_id_active_uniq
  ON public.news_syntheses (scored_id)
  WHERE status IN ('active', 'failed', 'failed_permanent');

COMMENT ON INDEX public.news_syntheses_scored_id_active_uniq IS
  'Garantit max 1 ligne (active|failed|failed_permanent) par scored_id. '
  'Défense en profondeur contre le bug d''idempotence 27 mai 2026 — cf '
  'DIAGNOSTIC_BUG_IDEMPOTENCE_27MAI2026.md.';

-- ============================================================================
-- 2. Vérification (à exécuter dans un RUN SÉPARÉ — règle ping-pong)
-- ============================================================================
-- SELECT indexname, indexdef
--   FROM pg_indexes
--  WHERE schemaname = 'public'
--    AND tablename = 'news_syntheses'
--    AND indexname = 'news_syntheses_scored_id_active_uniq';
--
-- Résultat attendu : 1 ligne avec indexdef contenant
--   "CREATE UNIQUE INDEX news_syntheses_scored_id_active_uniq
--    ON public.news_syntheses USING btree (scored_id)
--    WHERE (status = ANY (ARRAY['active'::text, 'failed'::text, 'failed_permanent'::text]))".
--
-- Test du garde-fou (devrait ÉCHOUER avec violation de contrainte UNIQUE) :
--   BEGIN;
--   INSERT INTO news_syntheses (scored_id, summary_fr, status, manual_added)
--   SELECT scored_id, '[TEST] dup', 'active', false
--     FROM news_syntheses WHERE status = 'active' LIMIT 1;
--   ROLLBACK;
-- => doit lever "duplicate key value violates unique constraint
--    news_syntheses_scored_id_active_uniq".
