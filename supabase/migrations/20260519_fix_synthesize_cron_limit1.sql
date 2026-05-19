-- Nom du fichier : 20260519_fix_synthesize_cron_limit1.sql
-- Date de création : 2026-05-19
-- Ticket : fix synthesize_articles timeout structurel
-- Description : Recalibrage body POST cron news_synthesize_articles + news_synthesize_articles_late ({"limit": 3} → {"limit": 1}) pour rester sous IDLE_TIMEOUT 150s même en cas de latence Sonnet variable
-- Rollback : supabase/migrations/20260519_fix_synthesize_cron_limit1_down.sql

-- ============================================================================
-- Contexte (hot fix 19/05/2026 — timeout structurel mesuré)
-- ============================================================================
-- Suite aux migrations 20260429_*_relimit + 20260429_*_second, les deux crons
-- hebdomadaires postent body {"limit": 3} :
--   - news_synthesize_articles       : lundi 20h00 UTC
--   - news_synthesize_articles_late  : lundi 22h00 UTC
--
-- Faits mesurés en régime stationnaire (mai 2026) :
--   - IDLE_TIMEOUT Supabase Edge Functions = 150s (hard limit gateway)
--   - Latence Sonnet variable : certains articles >50s à synthétiser
--   - 3 articles × 50s = 150s → timeout côté gateway sur les batches lents
--   - Les 2 crons hebdo timeout (504) sur ces batches
--   - Le script backfill_synthesize.sh s'arrêtait au 1er 504 (corrigé en
--     parallèle de cette migration, cf scripts/backfill_synthesize.sh)
--
-- Recalibrage : {"limit": 3} → {"limit": 1}
--   - 1 article × ~50s worst-case = 50s, marge 100s sous IDLE_TIMEOUT
--   - Absorption hebdo : 2 crons × 1 = 2 articles/sem (vs 6 avant). Sous la
--     moyenne mesurée 6,5/sem (cf doc migration _second.sql), mais le
--     rattrapage est désormais sûr via backfill_synthesize.sh manuel (le
--     script tolère les 504 ponctuels et continue).
--
-- Note dette technique : pour absorber le rythme stationnaire sans backfill
-- manuel, il faudra à terme un job worker dédié hors IDLE_TIMEOUT 150s, ou
-- une auto-relance côté Edge Function jusqu'à has_more=false. Hors scope
-- de ce fix.
--
-- cron.unschedule + cron.schedule sur le même jobname sont idempotents côté
-- pg_cron — la migration est rejouable.

-- ============================================================================
-- 1. Pré-requis d'exécution — paramètres de session
-- ============================================================================
-- Avant d'exécuter cette migration, exécuter les 2 SET ci-dessous DANS LE
-- MÊME Run que le reste du script :
--
--   SET app.supabase_url      TO 'https://dxybsuhfkwuemapqrvgz.supabase.co';
--   SET app.service_role_key  TO '<SUPABASE_SERVICE_ROLE_KEY>';

-- ============================================================================
-- 2. Re-schedule des 2 crons avec body {"limit": 1}
-- ============================================================================

DO $mig$
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
$mig$;

-- ============================================================================
-- 3. Vérification (à exécuter dans un RUN SÉPARÉ — règle ping-pong)
-- ============================================================================
-- SELECT jobname, schedule, active, command
--   FROM cron.job
--  WHERE jobname IN ('news_synthesize_articles', 'news_synthesize_articles_late')
--  ORDER BY schedule;
--
-- Résultat attendu : 2 lignes, active=true, command contenant
-- "'{\"limit\": 1}'::jsonb" pour les deux jobs.
