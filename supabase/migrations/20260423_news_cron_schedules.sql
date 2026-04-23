-- Nom du fichier : 20260423_news_cron_schedules.sql
-- Date de création : 2026-04-23
-- Ticket : feature/news-ticket-2
-- Description : pg_cron + schedule des 2 Edge Functions news (check_retractions lundi 05h30, ingest_pubmed lundi 06h00 — timezone Europe/Paris par job)
-- Rollback : supabase/migrations/20260423_news_cron_schedules_down.sql

-- ============================================================================
-- 1. EXTENSION pg_cron
-- ============================================================================
-- Aligné sur le pattern pgvector du Ticket 1 (pas de WITH SCHEMA).
-- pg_net est déjà installé (v0.19.5) côté projet — on l'utilise tel quel,
-- ne pas le recréer dans cette migration.

CREATE EXTENSION IF NOT EXISTS pg_cron;

-- ============================================================================
-- 2. Pré-requis d'exécution — paramètres de session
-- ============================================================================
-- Avant d'exécuter cette migration (SQL Editor, MÊME session) :
--
--   SET app.supabase_url      TO 'https://dxybsuhfkwuemapqrvgv.supabase.co';
--   SET app.service_role_key  TO '<SUPABASE_SERVICE_ROLE_KEY>';
--
-- Les deux GUC sont locales à la session et ne persistent pas en BDD.
-- Les valeurs sont résolues par current_setting() dans le DO block ci-dessous,
-- puis gelées littéralement dans cron.job.command au moment du cron.schedule()
-- (comportement standard pg_cron). Re-exécuter cette migration après rotation
-- de la clé nécessite d'abord d'appliquer le script _down.sql puis de relancer
-- cette migration avec la nouvelle clé.
--
-- Ces valeurs n'apparaissent jamais dans le repo git.

-- ============================================================================
-- 3. Schedules (timezone par job, requiert pg_cron >= 1.6)
-- ============================================================================

DO $mig$
DECLARE
  v_supabase_url text := current_setting('app.supabase_url',     false);
  v_service_key  text := current_setting('app.service_role_key', false);
BEGIN
  -- 3.0 Clean slate défensive — rend la migration rejouable sans pré-requis.
  -- Même pattern que dans 20260423_news_cron_schedules_down.sql (§1) :
  -- on unschedule d'abord si le job existe déjà, puis on (re)schedule.
  -- Alternative écartée : s'en remettre au comportement upsert implicite
  -- de cron.schedule() sur job_name (pg_cron >= 1.4). Écrire l'idempotence
  -- explicitement évite la dépendance à la doc.
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'news_check_retractions') THEN
    PERFORM cron.unschedule('news_check_retractions');
  END IF;
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'news_ingest_pubmed') THEN
    PERFORM cron.unschedule('news_ingest_pubmed');
  END IF;

  -- 3.1 Surveillance rétractations — lundi 05h30 Europe/Paris.
  -- Tourne AVANT l'ingestion PubMed pour marquer les rétractations détectées
  -- sur la KB existante avant qu'un nouvel article rétracté (improbable mais
  -- possible) ne soit ingéré la même nuit.
  PERFORM cron.schedule(
    job_name => 'news_check_retractions',
    schedule => '30 5 * * 1',
    command  => format(
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
      v_supabase_url || '/functions/v1/check_retractions',
      'Bearer ' || v_service_key
    ),
    timezone => 'Europe/Paris'
  );

  -- 3.2 Ingestion PubMed — lundi 06h00 Europe/Paris.
  PERFORM cron.schedule(
    job_name => 'news_ingest_pubmed',
    schedule => '0 6 * * 1',
    command  => format(
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
      v_supabase_url || '/functions/v1/ingest_pubmed',
      'Bearer ' || v_service_key
    ),
    timezone => 'Europe/Paris'
  );
END
$mig$;

-- ============================================================================
-- 4. Vérification (à exécuter dans un RUN SÉPARÉ du bloc 1-3 ci-dessus,
--    conformément à la règle ping-pong du README supabase/migrations/)
-- ============================================================================
-- SELECT jobid, jobname, schedule, active, command
--   FROM cron.job
--  WHERE jobname LIKE 'news_%'
--  ORDER BY jobname;
--
-- Résultat attendu : 2 lignes (news_check_retractions, news_ingest_pubmed)
-- avec active=true, command contenant l'URL /functions/v1/… correspondante.
