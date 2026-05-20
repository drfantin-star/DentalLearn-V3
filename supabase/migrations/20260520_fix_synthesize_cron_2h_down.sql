-- Nom du fichier : 20260520_fix_synthesize_cron_2h_down.sql
-- Date de création : 2026-05-20
-- Ticket : augmentation débit synthesize_articles
-- Description : Rollback — restaure les 2 crons hebdo (news_synthesize_articles lundi 20h + news_synthesize_articles_late lundi 22h, body {"limit": 1}), état post-20260519_fix_synthesize_cron_limit1
-- Rollback : n/a (ce fichier EST le rollback de 20260520_fix_synthesize_cron_2h.sql)

-- ============================================================================
-- Contexte
-- ============================================================================
-- Ce DOWN restaure l'état post-application de
-- 20260519_fix_synthesize_cron_limit1.sql :
--   - news_synthesize_articles       : lundi 20h00 UTC, body {"limit": 1}
--   - news_synthesize_articles_late  : lundi 22h00 UTC, body {"limit": 1}
--
-- À utiliser uniquement si le cron toutes les 2h s'avère contre-productif
-- (charge Sonnet trop élevée, coût API, etc.).
--
-- Pré-requis identiques à l'UP : SET app.supabase_url + SET app.service_role_key
-- dans la même session SQL Editor que ce script.

-- ============================================================================
-- 1. Pré-requis d'exécution — paramètres de session
-- ============================================================================
--   SET app.supabase_url      TO 'https://dxybsuhfkwuemapqrvgz.supabase.co';
--   SET app.service_role_key  TO '<SUPABASE_SERVICE_ROLE_KEY>';

-- ============================================================================
-- 2. Re-schedule des 2 crons hebdo avec body {"limit": 1}
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
        body    := '{"limit": 1}'::jsonb
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
        body    := '{"limit": 1}'::jsonb
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
-- SELECT jobname, schedule, active, command
--   FROM cron.job
--  WHERE jobname IN ('news_synthesize_articles', 'news_synthesize_articles_late')
--  ORDER BY jobname;
--
-- Résultat attendu : 2 lignes, schedules '0 20 * * 1' et '0 22 * * 1',
-- active=true, command contenant "'{\"limit\": 1}'::jsonb".
