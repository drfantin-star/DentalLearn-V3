-- Nom du fichier : 20260423_news_cron_schedules.sql
-- Date de création : 2026-04-23
-- Ticket : feature/news-ticket-2
-- Description : pg_cron + 2 jobs cron news (check_retractions lundi 03h30 UTC / ingest_pubmed lundi 04h00 UTC, équivalent Europe/Paris en heure d'été UTC+2)
-- Rollback : supabase/migrations/20260423_news_cron_schedules_down.sql

-- ============================================================================
-- NOTE SUPABASE — Timezone cron
-- ============================================================================
-- Supabase managé n'expose pas la signature cron.schedule(..., timezone => ...)
-- de pg_cron 1.6 (seules les variantes positionnelles 2-args et 3-args sont
-- disponibles). Par ailleurs, cron.timezone est classé PGC_POSTMASTER et ne
-- peut pas être modifié via ALTER DATABASE côté utilisateur (nécessite un
-- redémarrage serveur, hors de notre contrôle).
--
-- Conséquence : cron.timezone reste figé à GMT (défaut Supabase). Les
-- expressions cron ci-dessous sont encodées en UTC pour correspondre à
-- l'heure d'été Europe/Paris (UTC+2, cas du pic d'usage DentalLearn
-- juin-septembre) :
--   '30 3 * * 1' = lundi 03h30 UTC = 05h30 Paris (été) / 04h30 Paris (hiver)
--   '0 4 * * 1'  = lundi 04h00 UTC = 06h00 Paris (été) / 05h00 Paris (hiver)
-- Décalage d'1h en période d'hiver accepté (jobs plus tôt, aucun impact).
-- Ticket futur : si Supabase expose timezone => ou si vault/cron-timezone
-- devient modifiable, rebasculer sur une gestion DST-aware.
-- ============================================================================

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
-- Avant d'exécuter cette migration, exécuter les 2 SET ci-dessous
-- DANS LE MÊME Run que le reste du script (dans le SQL Editor de
-- Supabase, chaque Run est une session PostgreSQL indépendante,
-- les GUC de session ne persistent donc pas entre 2 Run distincts).
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
-- 3. Schedules — arguments positionnels (seule signature exposée par Supabase)
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

  -- 3.1 Surveillance rétractations — lundi 03h30 UTC (= 05h30 Paris en été).
  -- Tourne AVANT l'ingestion PubMed pour marquer les rétractations détectées
  -- sur la KB existante avant qu'un nouvel article rétracté (improbable mais
  -- possible) ne soit ingéré la même nuit.
  -- Signature 3-args positionnelle (seule exposée par Supabase) :
  --   cron.schedule(job_name text, schedule text, command text)
  PERFORM cron.schedule(
    'news_check_retractions',
    '30 3 * * 1',
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
      v_supabase_url || '/functions/v1/check_retractions',
      'Bearer ' || v_service_key
    )
  );

  -- 3.2 Ingestion PubMed — lundi 04h00 UTC (= 06h00 Paris en été).
  PERFORM cron.schedule(
    'news_ingest_pubmed',
    '0 4 * * 1',
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
      v_supabase_url || '/functions/v1/ingest_pubmed',
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
--  WHERE jobname LIKE 'news_%'
--  ORDER BY jobname;
--
-- Résultat attendu : 2 lignes (news_check_retractions, news_ingest_pubmed)
-- avec active=true, command contenant l'URL /functions/v1/… correspondante.
