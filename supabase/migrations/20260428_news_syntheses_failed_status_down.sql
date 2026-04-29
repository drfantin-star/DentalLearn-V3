-- Nom du fichier : 20260428_news_syntheses_failed_status_down.sql
-- Date de création : 2026-04-28
-- Ticket : feature/news-ticket-5 (claude/news-section-ticket-5-hPm1t)
-- Description : Rollback symétrique — drop index + drop colonnes + drop CHECK étendu + restauration de l'ancien CHECK status
-- Rollback : n/a (ce fichier EST le rollback de 20260428_news_syntheses_failed_status.sql)

-- ============================================================================
-- ⚠️ ATTENTION — perte de données + cleanup pré-rollback obligatoire
-- ============================================================================
-- Si ce rollback est exécuté APRÈS qu'au moins un run du pipeline a inséré
-- des lignes news_syntheses avec status='failed' ou 'failed_permanent', le
-- DROP CHECK étendu + ADD CHECK ancien (à 3 valeurs) plantera car les
-- lignes existantes violeront le nouveau CHECK.
--
-- Cleanup pré-rollback obligatoire dans ce cas :
--
--   UPDATE public.news_syntheses
--      SET status = 'deleted'
--    WHERE status IN ('failed','failed_permanent');
--
-- Ensuite seulement, exécuter ce DOWN. Les colonnes validation_errors /
-- validation_warnings / failed_attempts vont être supprimées : leur contenu
-- est définitivement perdu, à exporter en amont si besoin de l'archiver
-- (audit post-mortem). Acceptable pour Phase 1 (volumes faibles + traces
-- redondantes dans Supabase Logflare via logger.ts).

-- ============================================================================
-- 1. Drop de l'index status (en premier — non bloquant)
-- ============================================================================

DROP INDEX IF EXISTS public.news_syntheses_status_idx;

-- ============================================================================
-- 2. Drop des 3 colonnes (ordre inverse de l'UP)
-- ============================================================================

ALTER TABLE public.news_syntheses
  DROP COLUMN IF EXISTS failed_attempts,
  DROP COLUMN IF EXISTS validation_warnings,
  DROP COLUMN IF EXISTS validation_errors;

-- ============================================================================
-- 3. Drop du CHECK étendu
-- ============================================================================

ALTER TABLE public.news_syntheses
  DROP CONSTRAINT IF EXISTS news_syntheses_status_extended_check;

-- ============================================================================
-- 4. Restauration de l'ancien CHECK (3 valeurs uniquement)
-- ============================================================================
-- Nom explicite `news_syntheses_status_check` — le pattern auto-naming
-- Postgres pour un ADD CONSTRAINT sans nom serait identique, mais on reste
-- explicite pour traçabilité. Si une CHECK status existe déjà sous ce nom
-- (hypothétique race condition), la commande échouera proprement plutôt que
-- de risquer un état incohérent.

ALTER TABLE public.news_syntheses
  ADD CONSTRAINT news_syntheses_status_check CHECK (
    status IN ('active','retracted','deleted')
  );

-- ============================================================================
-- 5. Vérification (à exécuter dans un RUN SÉPARÉ)
-- ============================================================================
-- SELECT con.conname, pg_get_constraintdef(con.oid)
--   FROM pg_constraint con
--  WHERE con.conrelid = 'public.news_syntheses'::regclass
--    AND con.contype = 'c'
--    AND pg_get_constraintdef(con.oid) ILIKE '%status%';
--
-- Résultat attendu : 1 ligne, definition à 3 valeurs ('active','retracted','deleted').
--
-- SELECT count(*) AS remaining_columns
--   FROM information_schema.columns
--  WHERE table_schema = 'public'
--    AND table_name   = 'news_syntheses'
--    AND column_name IN ('validation_errors','validation_warnings','failed_attempts');
--
-- Résultat attendu : 0.
