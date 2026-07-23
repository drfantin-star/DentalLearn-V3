-- Nom du fichier : 20260723h_news_score_articles_cron_daily_permanent.sql
-- Date de création : 2026-07-23
-- Ticket : news-pipeline-dedup-sizing
-- Description : Lot 6 — régime permanent news_score_articles : hebdo lundi
--               14h00 UTC limit:50 → quotidien limit:100, active:true.
-- Rollback : supabase/migrations/20260723h_news_score_articles_cron_daily_permanent_down.sql
--
-- ============================================================================
-- ⚠️ NE PAS APPLIQUER avant la fin du Lot 5 (rattrapage manuel du backlog)
-- ============================================================================
-- Cette migration est écrite maintenant mais volontairement NON appliquée en
-- prod à la date du 23/07/2026 : le plan la place explicitement "après file
-- à zéro" (Lot 6, séance manuelle après Lot 5). Tant que le backlog n'a pas
-- été ramené à 0 via le script de rattrapage (limit:100, threshold:0.80,
-- cron désactivé pendant la boucle), garder le cron hebdo limit:50 actuel
-- (formalisé par 20260723f_news_score_articles_cron_timeout.sql) évite de
-- mélanger rattrapage manuel et cron automatique sur la même file.
--
-- Capacité visée : quotidien × limit:100 ≈ 700/semaine, pour ~200 articles
-- ingérés/semaine après dédoublonnage (Lot 1) — marge large pour absorber
-- toute reprise de retard.

-- ============================================================================
-- 1. Pré-requis d'exécution — paramètres de session
-- ============================================================================
--   SET app.supabase_url      TO 'https://dxybsuhfkwuemapqrvgz.supabase.co';
--   SET app.service_role_key  TO '<SUPABASE_SERVICE_ROLE_KEY>';

-- ============================================================================
-- 2. Reschedule news_score_articles → quotidien, limit:100, active:true
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
    '0 14 * * *',
    format(
      $cmd$
      SELECT net.http_post(
        url     := %L,
        headers := jsonb_build_object(
          'Authorization', %L,
          'Content-Type',  'application/json'
        ),
        body    := '{"limit": 100}'::jsonb,
        timeout_milliseconds := 150000
      );
      $cmd$,
      v_supabase_url || '/functions/v1/score_articles',
      'Bearer ' || v_service_key
    )
  );

  -- active=true explicite : cron.schedule active déjà le job par défaut,
  -- ce UPDATE est une garde défensive si un run précédent l'avait désactivé
  -- manuellement (ex: pendant le rattrapage Lot 5).
  UPDATE cron.job SET active = true WHERE jobname = 'news_score_articles';
END
$mig$;

-- ============================================================================
-- 3. Vérification (à exécuter dans un RUN SÉPARÉ)
-- ============================================================================
-- SELECT jobname, schedule, active, command
--   FROM cron.job
--  WHERE jobname = 'news_score_articles';
--
-- Résultat attendu : 1 ligne, schedule='0 14 * * *', active=true, command
-- contenant '{"limit": 100}'::jsonb ET timeout_milliseconds := 150000.
