-- Nom du fichier : 20260428_news_synthesize_articles_cron.sql
-- Date de création : 2026-04-28
-- Ticket : feature/news-ticket-5 (claude/news-section-ticket-5-hPm1t)
-- Description : pg_cron — ajout du job news_synthesize_articles (lundi 20h00 UTC, spec v1.3 §4.4)
-- Rollback : supabase/migrations/20260428_news_synthesize_articles_cron_down.sql

-- ============================================================================
-- NOTE SUPABASE — Timezone cron
-- ============================================================================
-- Convention héritée des Tickets 2-4 (cf 20260423_news_cron_schedules.sql) :
-- cron.timezone est figé à GMT côté Supabase (PGC_POSTMASTER, non modifiable
-- par l'utilisateur), et la signature cron.schedule(..., timezone => ...) de
-- pg_cron 1.6 n'est pas exposée. Toutes les expressions cron sont donc
-- encodées en UTC.
--
-- Cadence hebdo News Phase 1 — résumé pour reviewers (5 jobs en place
-- après application de cette migration) :
--   '30 3 * * 1'  = check_retractions    (lundi 03h30 UTC = 05h30 Paris été)
--   '0 4 * * 1'   = ingest_pubmed        (lundi 04h00 UTC = 06h00 Paris été)
--   '30 4 * * 1'  = ingest_rss           (lundi 04h30 UTC = 06h30 Paris été)
--   '0 14 * * 1'  = score_articles       (lundi 14h00 UTC = 16h00 Paris été)
--   '0 20 * * 1'  = synthesize_articles  (lundi 20h00 UTC = 22h00 Paris été) ← ce ticket
--
-- L'écart de ~6h entre le scoring (14h00 UTC) et la synthèse (20h00 UTC)
-- est imposé par la spec v1.3 §4.4 : il laisse le temps à Dr Fantin
-- d'auditer les articles selected en début d'après-midi avant que la
-- synthèse Sonnet ne tourne. Régime stationnaire : 8 articles × ~8s
-- (Sonnet single-call + embedding OpenAI) = ~64s, marge confortable
-- sur IDLE_TIMEOUT 150s.
-- ============================================================================

-- ============================================================================
-- 1. EXTENSION pg_cron
-- ============================================================================
-- Déjà installée par 20260423_news_cron_schedules.sql. Le IF NOT EXISTS rend
-- cette migration rejouable.

CREATE EXTENSION IF NOT EXISTS pg_cron;

-- ============================================================================
-- 2. Pré-requis d'exécution — paramètres de session
-- ============================================================================
-- Avant d'exécuter cette migration, exécuter les 2 SET ci-dessous DANS LE
-- MÊME Run que le reste du script (chaque Run du SQL Editor est une session
-- PostgreSQL indépendante, les GUC de session ne persistent pas entre Runs).
--
--   SET app.supabase_url      TO 'https://dxybsuhfkwuemapqrvgz.supabase.co';
--   SET app.service_role_key  TO '<SUPABASE_SERVICE_ROLE_KEY>';
--
-- Les 2 GUC sont locales à la session et ne persistent jamais en BDD. Les
-- valeurs sont résolues par current_setting() dans le DO block, puis gelées
-- littéralement dans cron.job.command via format(%L) au moment du
-- cron.schedule(). Re-exécuter cette migration après rotation de la clé
-- nécessite d'abord d'appliquer le _down.sql puis de relancer cette
-- migration avec la nouvelle clé.

-- ============================================================================
-- 3. Schedule — argument positionnel (seule signature exposée par Supabase)
-- ============================================================================

DO $mig$
DECLARE
  v_supabase_url text := current_setting('app.supabase_url',     false);
  v_service_key  text := current_setting('app.service_role_key', false);
BEGIN
  -- 3.0 Clean slate défensive — rend la migration rejouable.
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'news_synthesize_articles') THEN
    PERFORM cron.unschedule('news_synthesize_articles');
  END IF;

  -- 3.1 Synthèse Claude Sonnet — lundi 20h00 UTC (= 22h00 Paris en été).
  -- Tourne 6h après score_articles pour laisser le temps à Dr Fantin
  -- d'auditer la sélection (status='selected') en après-midi avant que
  -- Sonnet ne génère les synthèses + tags + quiz + embeddings.
  --
  -- Body POST : {"limit": 8}
  --   Borne dure d'articles synthétisés par invocation pour rester sous
  --   IDLE_TIMEOUT ~150s d'Edge Functions Supabase (cf header
  --   synthesize_articles/index.ts §"Body POST" + arbitrage produit A5).
  --   8 articles × ~8s (Sonnet ~6s + OpenAI embeddings ~1s + INSERT) = ~64s,
  --   marge confortable. Cap dur côté code : MAX_BATCH_LIMIT=15 (jamais
  --   dépassé même avec un body custom).
  --
  --   Le caller (cron en régime stationnaire) envoie 8 ; le backfill manuel
  --   utilise 15 via scripts/backfill_synthesize.sh (boucle jusqu'à
  --   has_more=false ou cap 30 invocations).
  --
  -- Signature 3-args positionnelle (seule exposée par Supabase) :
  --   cron.schedule(job_name text, schedule text, command text)
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
$mig$;

-- ============================================================================
-- 4. Vérification (à exécuter dans un RUN SÉPARÉ du bloc 1-3 ci-dessus,
--    conformément à la règle ping-pong du README supabase/migrations/)
-- ============================================================================
-- SELECT jobid, jobname, schedule, active, command
--   FROM cron.job
--  WHERE jobname = 'news_synthesize_articles';
--
-- Résultat attendu : 1 ligne avec active=true, schedule='0 20 * * 1',
-- command contenant l'URL /functions/v1/synthesize_articles et le body
-- '{"limit": 8}'.
--
-- Vérif chaîne complète des 5 jobs hebdomadaires :
--
-- SELECT jobname, schedule, active
--   FROM cron.job
--  WHERE jobname IN (
--    'news_check_retractions',
--    'news_ingest_pubmed',
--    'news_ingest_rss',
--    'news_score_articles',
--    'news_synthesize_articles'
--  )
--  ORDER BY schedule;
--
-- Résultat attendu : 5 lignes, toutes active=true.
