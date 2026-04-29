-- Nom du fichier : 20260429_news_synthesize_articles_cron_relimit_down.sql
-- Date de création : 2026-04-29
-- Ticket : feature/news-ticket-5 (claude/news-section-ticket-5-hPm1t)
-- Description : Rollback — restaure le body POST cron news_synthesize_articles à {"limit": 8} (état pré-recalibrage)
-- Rollback : n/a (ce fichier EST le rollback de 20260429_news_synthesize_articles_cron_relimit.sql)

-- ============================================================================
-- Contexte
-- ============================================================================
-- Ce DOWN restaure l'état post-application de 20260428_news_synthesize_articles_cron.sql
-- (body POST {"limit": 8}). À utiliser uniquement si le recalibrage à 3
-- s'avère contre-productif (timeout résolu autrement, batch trop petit en
-- régime stationnaire, etc.).
--
-- Pré-requis identiques à l'UP : SET app.supabase_url + SET app.service_role_key
-- dans la même session SQL Editor que ce script.

-- ============================================================================
-- 1. Pré-requis d'exécution — paramètres de session
-- ============================================================================
--   SET app.supabase_url      TO 'https://dxybsuhfkwuemapqrvgz.supabase.co';
--   SET app.service_role_key  TO '<SUPABASE_SERVICE_ROLE_KEY>';

-- ============================================================================
-- 2. Re-schedule avec body {"limit": 8} (état pré-recalibrage)
-- ============================================================================

DO $rb$
DECLARE
  v_supabase_url text := current_setting('app.supabase_url',     false);
  v_service_key  text := current_setting('app.service_role_key', false);
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'news_synthesize_articles') THEN
    PERFORM cron.unschedule('news_synthesize_articles');
  END IF;

  PERFORM cron.schedule(
    'news_synthesize_articles',
    '0 20 * * 1',
    format(
      $cmd$
      SELECT net.http_post(
        url     := %L,
        headers := jsonb_build_object(
          'Authorization', %L,
          'Content-Type',  'application/json'
        ),
        body    := '{"limit": 8}'::jsonb
      );
      $cmd$,
      v_supabase_url || '/functions/v1/synthesize_articles',
      'Bearer ' || v_service_key
    )
  );
END
$rb$;

-- ============================================================================
-- 3. Vérification (à exécuter dans un RUN SÉPARÉ)
-- ============================================================================
-- SELECT command
--   FROM cron.job
--  WHERE jobname = 'news_synthesize_articles';
--
-- Résultat attendu : command contenant "'{\"limit\": 8}'::jsonb".
