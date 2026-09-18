-- Nom du fichier : 20260918b_news_crons_rss_fix_score_daily_down.sql
-- Date de création : 2026-09-18
-- Ticket : news-pipeline-fraicheur-seuil-crons (Lot 3)
-- Description : Rollback — restaure l'état antérieur documenté :
--               news_ingest_rss hebdomadaire sans timeout,
--               news_score_articles hebdomadaire {"limit": 50},
--               source « L'Information Dentaire » réactivée.
-- Rollback : n/a (ce fichier EST le rollback de
--            20260918b_news_crons_rss_fix_score_daily.sql)

-- ⚠️ Ce rollback restaure l'état antérieur *fonctionnel* documenté, pas le
-- bug : la commande news_ingest_rss est reconstruite avec une vraie clé via
-- format(%L). Les chevrons 'Bearer <eyJ...>' de l'incident du 05/05/2026 ne
-- sont jamais réintroduits.
--
-- ⚠️ Restaurer news_ingest_rss sans timeout_milliseconds ramène le défaut
-- pg_net de 5 secondes, donc le risque d'isolate Edge tué avant écriture.
-- C'est l'état antérieur assumé de ce rollback, pas une cible.

-- ============================================================================
-- 1. Pré-requis d'exécution — paramètres de session
-- ============================================================================
--   SET app.supabase_url      TO 'https://dxybsuhfkwuemapqrvgz.supabase.co';
--   SET app.service_role_key  TO '<SUPABASE_SERVICE_ROLE_KEY>';

-- ============================================================================
-- 2. Restore des 2 jobs
-- ============================================================================

DO $rb$
DECLARE
  v_supabase_url text := current_setting('app.supabase_url',     false);
  v_service_key  text := current_setting('app.service_role_key', false);
BEGIN
  -- 2.1 news_ingest_rss — lundi 04h30 UTC, body {}, SANS timeout
  --     (état 20260426_news_ingest_rss_cron.sql)
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'news_ingest_rss') THEN
    PERFORM cron.unschedule('news_ingest_rss');
  END IF;

  PERFORM cron.schedule(
    'news_ingest_rss',
    '30 4 * * 1',
    format(
      $cmd$
      SELECT net.http_post(
        url     := %L,
        headers := jsonb_build_object(
          'Authorization', %L,
          'Content-Type',  'application/json'
        ),
        body    := '{}'::jsonb
      );
      $cmd$,
      v_supabase_url || '/functions/v1/ingest_rss',
      'Bearer ' || v_service_key
    )
  );

  -- 2.2 news_score_articles — lundi 14h00 UTC, limit 50, sans threshold,
  --     timeout 150 s (état 20260723f_news_score_articles_cron_timeout.sql)
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
-- 3. Source RSS « L'Information Dentaire » — réactivation
-- ============================================================================

UPDATE public.news_sources
   SET active = true
 WHERE type = 'rss'
   AND name = 'L''Information Dentaire'
   AND active IS DISTINCT FROM true;

-- ============================================================================
-- 4. Vérification (à exécuter dans un RUN SÉPARÉ)
-- ============================================================================
-- SELECT jobname, schedule, active,
--        command LIKE '%timeout_milliseconds%' AS has_timeout,
--        command LIKE '%Bearer <%'             AS chevrons
--   FROM cron.job WHERE jobname LIKE 'news_%';
--
-- Attendu : news_ingest_rss en '30 4 * * 1' has_timeout = false,
-- news_score_articles en '0 14 * * 1' has_timeout = true, chevrons = false
-- partout.
