-- Nom du fichier : 20260723h_news_score_articles_cron_daily_permanent_down.sql
-- Date de création : 2026-07-23
-- Ticket : news-pipeline-dedup-sizing
-- Description : Rollback — restaure le schedule hebdo limit:50 (état 20260723f)
-- Rollback : n/a (ce fichier EST le rollback de 20260723h_news_score_articles_cron_daily_permanent.sql)

-- ============================================================================
-- 1. Pré-requis d'exécution — paramètres de session
-- ============================================================================
--   SET app.supabase_url      TO 'https://dxybsuhfkwuemapqrvgz.supabase.co';
--   SET app.service_role_key  TO '<SUPABASE_SERVICE_ROLE_KEY>';

-- ============================================================================
-- 2. Restore canonique news_score_articles (lundi 14h00 UTC, limit:50, timeout 150000)
-- ============================================================================

DO $rb$
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
$rb$;

-- ============================================================================
-- 3. Vérification (à exécuter dans un RUN SÉPARÉ)
-- ============================================================================
-- SELECT jobname, schedule, active, command
--   FROM cron.job
--  WHERE jobname = 'news_score_articles';
--
-- Résultat attendu : 1 ligne, schedule='0 14 * * 1', active=true, command
-- contenant '{"limit": 50}'::jsonb ET timeout_milliseconds := 150000.
