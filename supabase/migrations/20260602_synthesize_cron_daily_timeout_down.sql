-- Nom du fichier : 20260602_synthesize_cron_daily_timeout_down.sql
-- Date de création : 2026-06-02
-- Ticket : fix crons synthesize 0 synthèse (timeout pg_net 5s) + passage quotidien (claude/optimistic-sagan-XzlvG)
-- Description : Rollback — restaure l'état canonique antérieur 27b/27c (hebdo lundi 20h/22h UTC, limit:1, sans timeout, single-post)
-- Rollback : n/a (ce fichier EST le rollback de 20260602_synthesize_cron_daily_timeout.sql)

-- ============================================================================
-- Contexte
-- ============================================================================
-- Restaure EXACTEMENT la définition canonique antérieure des 2 crons telle
-- que posée par :
--   - 20260527b_news_synthesize_articles_cron_restore.sql       (lundi 20h UTC)
--   - 20260527c_news_synthesize_articles_late_cron_restore.sql  (lundi 22h UTC)
--
-- Cet état canonique est : hebdo (0 20/22 * * 1), body {"limit": 1}, SANS
-- timeout_milliseconds, single-post (un seul net.http_post par job — vérifié
-- par lecture directe de 27b lignes 65-82 et 27c lignes 56-73).
--
-- ⚠️ Ce rollback ne restaure PAS le hotfix live (limit:2 / timeout 150000) :
-- il revient à l'état source-of-truth du repo, conformément à la convention
-- des _down de 27b/27c.

-- ============================================================================
-- 1. Pré-requis d'exécution — paramètres de session
-- ============================================================================
--   SET app.supabase_url      TO 'https://dxybsuhfkwuemapqrvgz.supabase.co';
--   SET app.service_role_key  TO '<SUPABASE_SERVICE_ROLE_KEY>';

-- ============================================================================
-- 2. Restore canonique news_synthesize_articles (lundi 20h UTC, limit:1)
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
-- 3. Restore canonique news_synthesize_articles_late (lundi 22h UTC, limit:1)
-- ============================================================================

DO $rb$
DECLARE
  v_supabase_url text := current_setting('app.supabase_url',     false);
  v_service_key  text := current_setting('app.service_role_key', false);
BEGIN
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
-- 4. Vérification (à exécuter dans un RUN SÉPARÉ)
-- ============================================================================
-- SELECT jobname, schedule, active
--   FROM cron.job
--  WHERE jobname LIKE 'news_synthesize%'
--  ORDER BY jobname;
--
-- Résultat attendu : 2 lignes
--   news_synthesize_articles       | 0 20 * * 1 | t
--   news_synthesize_articles_late  | 0 22 * * 1 | t
