-- Nom du fichier : 20260602_synthesize_cron_daily_timeout.sql
-- Date de création : 2026-06-02
-- Ticket : fix crons synthesize 0 synthèse (timeout pg_net 5s) + passage quotidien (claude/optimistic-sagan-XzlvG)
-- Description : Reschedule news_synthesize_articles (0 20 * * *) et news_synthesize_articles_late (0 22 * * *) en quotidien, single net.http_post limit:2 avec timeout_milliseconds := 150000
-- Rollback : supabase/migrations/20260602_synthesize_cron_daily_timeout_down.sql

-- ============================================================================
-- Contexte
-- ============================================================================
-- Les 2 crons synthesize produisaient 0 synthèse. Cause confirmée : la
-- commande cron ne fixait pas `timeout_milliseconds`, donc pg_net coupait
-- l'appel HTTP au défaut 5 s alors que l'Edge Function synthesize_articles
-- met ~43 s — la fonction était avortée avant d'écrire en base. Un curl
-- manuel (43 s) réussit.
--
-- L'état live avait été réparé à la main hors-migration (unschedule/schedule
-- direct posant hebdo / limit:2 / timeout 150000 / single-post, AVEC la
-- service_role en clair dans cron.job.command). La prod divergeait donc des
-- migrations du repo. Cette migration redevient le SOURCE OF TRUTH : elle
-- formalise le hotfix (timeout) ET passe les 2 jobs en quotidien.
--
-- État antérieur canonique (repo) : 20260527b + 20260527c (hebdo lundi
-- 20h/22h UTC, limit:1, sans timeout). Le _down restaure exactement cet état.
--
-- ⚠️ limit:2 n'a jamais tourné en prod (cron hebdo non rejoué + backfill
-- manuel en limit:1). Le fix réel est le timeout (5s → 150000) ; limit:2
-- reste à valider au 1er run quotidien. Repli limit:1 via migration de suivi
-- si un run dépasse IDLE_TIMEOUT 150s côté Edge Function.

-- ============================================================================
-- 1. Pré-requis d'exécution — paramètres de session
-- ============================================================================
-- Avant d'exécuter cette migration, exécuter les 2 SET ci-dessous DANS LE
-- MÊME Run que le reste du script (aucun secret n'est committé dans ce
-- fichier — il est injecté via current_setting au moment de l'apply) :
--
--   SET app.supabase_url      TO 'https://dxybsuhfkwuemapqrvgz.supabase.co';
--   SET app.service_role_key  TO '<SUPABASE_SERVICE_ROLE_KEY>';

-- ============================================================================
-- 2. Reschedule news_synthesize_articles → quotidien 20h00 UTC
-- ============================================================================

DO $mig$
DECLARE
  v_supabase_url text := current_setting('app.supabase_url',     false);
  v_service_key  text := current_setting('app.service_role_key', false);
BEGIN
  -- 2.0 Clean slate défensive — supprime tout schedule existant pour ce
  -- jobname (idempotent : couvre le hotfix live hebdo et un éventuel rejeu).
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'news_synthesize_articles') THEN
    PERFORM cron.unschedule('news_synthesize_articles');
  END IF;

  -- 2.1 Schedule quotidien 20h00 UTC (= 22h00 Paris en été), body {"limit": 2},
  -- timeout_milliseconds := 150000 (15x le défaut pg_net 5s) pour laisser
  -- l'Edge Function synthesize_articles aller au bout (~43s mesuré).
  PERFORM cron.schedule(
    'news_synthesize_articles',
    '0 20 * * *',
    format(
      $cmd$
      SELECT net.http_post(
        url     := %L,
        headers := jsonb_build_object(
          'Authorization', %L,
          'Content-Type',  'application/json'
        ),
        body    := '{"limit": 2}'::jsonb,
        timeout_milliseconds := 150000
      );
      $cmd$,
      v_supabase_url || '/functions/v1/synthesize_articles',
      'Bearer ' || v_service_key
    )
  );
END
$mig$;

-- ============================================================================
-- 3. Reschedule news_synthesize_articles_late → quotidien 22h00 UTC
-- ============================================================================

DO $mig$
DECLARE
  v_supabase_url text := current_setting('app.supabase_url',     false);
  v_service_key  text := current_setting('app.service_role_key', false);
BEGIN
  -- 3.0 Clean slate défensive — idempotent.
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'news_synthesize_articles_late') THEN
    PERFORM cron.unschedule('news_synthesize_articles_late');
  END IF;

  -- 3.1 Schedule quotidien 22h00 UTC (= 00h00 Paris en été), 2h après le 1er
  -- cron. Même body {"limit": 2} et même timeout_milliseconds := 150000.
  PERFORM cron.schedule(
    'news_synthesize_articles_late',
    '0 22 * * *',
    format(
      $cmd$
      SELECT net.http_post(
        url     := %L,
        headers := jsonb_build_object(
          'Authorization', %L,
          'Content-Type',  'application/json'
        ),
        body    := '{"limit": 2}'::jsonb,
        timeout_milliseconds := 150000
      );
      $cmd$,
      v_supabase_url || '/functions/v1/synthesize_articles',
      'Bearer ' || v_service_key
    )
  );
END
$mig$;

-- ============================================================================
-- 4. Vérification (à exécuter dans un RUN SÉPARÉ — règle ping-pong)
-- ============================================================================
-- SELECT jobname, schedule, active, command
--   FROM cron.job
--  WHERE jobname LIKE 'news_synthesize%'
--  ORDER BY jobname;
--
-- Résultat attendu : 2 lignes
--   news_synthesize_articles       | 0 20 * * * | t
--   news_synthesize_articles_late  | 0 22 * * * | t
-- et command contenant '{"limit": 2}'::jsonb ET timeout_milliseconds := 150000.
