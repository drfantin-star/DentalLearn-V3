-- Nom du fichier : 20260519_fix_synthesize_cron_limit1_down.sql
-- Date de création : 2026-05-19
-- Ticket : fix synthesize_articles timeout structurel
-- Description : Rollback — restaure le body POST {"limit": 3} sur news_synthesize_articles + news_synthesize_articles_late (état post-20260429_*_relimit + _second, pré-fix limit=1)
-- Rollback : n/a (ce fichier EST le rollback de 20260519_fix_synthesize_cron_limit1.sql)

-- ============================================================================
-- Contexte
-- ============================================================================
-- Ce DOWN restaure l'état post-application de
-- 20260429_news_synthesize_articles_cron_relimit.sql +
-- 20260429_news_synthesize_articles_cron_second.sql
-- (body POST {"limit": 3} sur les 2 crons).
--
-- À utiliser uniquement si le recalibrage à 1 s'avère contre-productif
-- (rythme stationnaire trop bas, timeout résolu autrement par fix
-- infrastructure, etc.).
--
-- Pré-requis identiques à l'UP : SET app.supabase_url + SET app.service_role_key
-- dans la même session SQL Editor que ce script.

-- ============================================================================
-- 1. Pré-requis d'exécution — paramètres de session
-- ============================================================================
--   SET app.supabase_url      TO 'https://dxybsuhfkwuemapqrvgz.supabase.co';
--   SET app.service_role_key  TO '<SUPABASE_SERVICE_ROLE_KEY>';

-- ============================================================================
-- 2. Re-schedule des 2 crons avec body {"limit": 3} (état pré-fix)
-- ============================================================================

DO $rb$
DECLARE
  v_supabase_url text := current_setting('app.supabase_url',     false);
  v_service_key  text := current_setting('app.service_role_key', false);
BEGIN
  -- 2.1 Cron lundi 20h00 UTC — news_synthesize_articles
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
        body    := '{"limit": 3}'::jsonb
      );
      $cmd$,
      v_supabase_url || '/functions/v1/synthesize_articles',
      'Bearer ' || v_service_key
    )
  );

  -- 2.2 Cron lundi 22h00 UTC — news_synthesize_articles_late
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'news_synthesize_articles_late') THEN
    PERFORM cron.unschedule('news_synthesize_articles_late');
  END IF;

  PERFORM cron.schedule(
    'news_synthesize_articles_late',
    '0 22 * * 1',
    format(
      $cmd$
      SELECT net.http_post(
        url     := %L,
        headers := jsonb_build_object(
          'Authorization', %L,
          'Content-Type',  'application/json'
        ),
        body    := '{"limit": 3}'::jsonb
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
-- SELECT jobname, command
--   FROM cron.job
--  WHERE jobname IN ('news_synthesize_articles', 'news_synthesize_articles_late')
--  ORDER BY jobname;
--
-- Résultat attendu : 2 lignes, command contenant "'{\"limit\": 3}'::jsonb".
