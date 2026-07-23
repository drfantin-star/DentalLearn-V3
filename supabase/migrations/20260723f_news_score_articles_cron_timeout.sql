-- Nom du fichier : 20260723f_news_score_articles_cron_timeout.sql
-- Date de création : 2026-07-23
-- Ticket : news-pipeline-dedup-sizing
-- Description : Ajoute timeout_milliseconds := 150000 au cron news_score_articles
--               (Lot 3 du plan). Reschedule à l'identique sinon (lundi 14h00
--               UTC, body {"limit": 50}).
-- Rollback : supabase/migrations/20260723f_news_score_articles_cron_timeout_down.sql

-- ============================================================================
-- Contexte
-- ============================================================================
-- news_score_articles n'avait pas de timeout_milliseconds explicite → pg_net
-- coupe l'appel HTTP au défaut 5s, largement sous les ~10-12s que prend un
-- batch Haiku. Même schéma de bug que le hotfix synthesize du 02/06
-- (20260602_synthesize_cron_daily_timeout.sql) : l'Edge Function continue de
-- tourner et écrit ses résultats (l'isolate survit), mais le cron ne voit
-- jamais la réponse. Pas de perte de données, juste un cron « invisible ».
--
-- Cette migration ne touche PAS le schedule (reste hebdo lundi 14h00 UTC,
-- limit:50) — seul le Lot 6 (régime permanent quotidien, après backfill Lot 5)
-- changera schedule/limit. Ici on formalise uniquement le fix timeout.

-- ============================================================================
-- 1. Pré-requis d'exécution — paramètres de session
-- ============================================================================
--   SET app.supabase_url      TO 'https://dxybsuhfkwuemapqrvgz.supabase.co';
--   SET app.service_role_key  TO '<SUPABASE_SERVICE_ROLE_KEY>';

-- ============================================================================
-- 2. Reschedule news_score_articles avec timeout_milliseconds
-- ============================================================================

DO $mig$
DECLARE
  v_supabase_url text := current_setting('app.supabase_url',     false);
  v_service_key  text := current_setting('app.service_role_key', false);
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'news_score_articles') THEN
    PERFORM cron.unschedule('news_score_articles');
  END IF;

  PERFORM cron.schedule(
    'news_score_articles',
    '0 14 * * 1',
    format(
      $cmd$
      SELECT net.http_post(
        url     := %L,
        headers := jsonb_build_object(
          'Authorization', %L,
          'Content-Type',  'application/json'
        ),
        body    := '{"limit": 50}'::jsonb,
        timeout_milliseconds := 150000
      );
      $cmd$,
      v_supabase_url || '/functions/v1/score_articles',
      'Bearer ' || v_service_key
    )
  );
END
$mig$;

-- ============================================================================
-- 3. Vérification (à exécuter dans un RUN SÉPARÉ)
-- ============================================================================
-- SELECT jobname, schedule, active, command
--   FROM cron.job
--  WHERE jobname = 'news_score_articles';
--
-- Résultat attendu : 1 ligne, schedule='0 14 * * 1', active=true, command
-- contenant '{"limit": 50}'::jsonb ET timeout_milliseconds := 150000.
