-- Nom du fichier : 20260918b_news_crons_rss_fix_score_daily.sql
-- Date de création : 2026-09-18
-- Ticket : news-pipeline-fraicheur-seuil-crons (Lot 3)
-- Description : Porte en migration l'état courant des deux crons news
--               corrigés à chaud le 18/09/2026 (news_ingest_rss,
--               news_score_articles) + désactivation de la source RSS
--               « L'Information Dentaire ».
-- Rollback : supabase/migrations/20260918b_news_crons_rss_fix_score_daily_down.sql

-- ============================================================================
-- Contexte
-- ============================================================================
-- Deux corrections ont été appliquées directement sur cron.job le 18/09/2026,
-- hors migration. Rien dans le repo ne les décrit : la prochaine migration qui
-- touche aux crons news repartirait de l'ancien état et les écraserait sans
-- bruit — c'est exactement ce qui s'est produit en mai 2026. Cette migration
-- reproduit l'état courant à l'identique pour que la source de vérité
-- redevienne le repo.
--
-- 1. news_ingest_rss — la commande contenait littéralement
--    'Bearer <eyJ...>', chevrons compris (reste de gabarit jamais substitué).
--    JWT invalide → HTTP 401 à chaque exécution depuis le 05/05/2026, soit
--    plus aucune ingestion RSS (Cochrane Oral Health, HAS, British Dental
--    Journal, Dental Tribune) pendant quatre mois et demi. Le job a été
--    reprogrammé avec la clé correcte et timeout_milliseconds := 150000.
--
--    ⚠️ Piège à ne pas rejouer : la chaîne finale doit être
--    'Bearer ' || <clé>, sans aucun caractère autour. Le format(%L) ci-dessous
--    s'en charge ; ne jamais réintroduire de chevrons.
--
--    ⚠️ Ce 401 n'a jamais fait échouer le cron : net.http_post ne fait que
--    dispatcher l'appel. Un status 'succeeded' dans cron.job_run_details
--    signifie « requête partie », jamais « fonction exécutée avec succès ».
--    Pour savoir ce qui s'est réellement passé, lire les logs edge.
--
-- 2. news_score_articles — passé de '0 14 * * 1' avec {"limit": 50} à
--    '0 14 * * *' avec {"limit": 30, "threshold": 0.80}, timeout 150 s
--    conservé. Cadence quotidienne pour ~190 articles ingérés/semaine, seuil
--    relevé à 0.80 pour tenir la capacité de synthèse (28/semaine).
--
--    Note : 20260723h_news_score_articles_cron_daily_permanent.sql décrivait
--    déjà un passage au quotidien, mais avec limit:100 et sans threshold, et
--    n'a jamais été appliquée en prod (le Lot 5 de rattrapage n'a pas eu
--    lieu). La présente migration est l'état de vérité pour ce job.
--
--    ⚠️ timeout_milliseconds := 150000 sur les deux jobs, sans exception.
--    Sans lui, pg_net coupe l'appel HTTP à 5 secondes par défaut et l'isolate
--    Edge est tué avant d'écrire quoi que ce soit — cause exacte de
--    l'incident « 0 synthèse » du 01/06/2026.
--
-- 3. news_sources — le flux rss.app de « L'Information Dentaire » a expiré.
--    Source passée active = false (décision Dr Fantin, réactivation plus tard,
--    abonnement rss.app à reprendre).
--
-- Périmètre strict : aucun autre job n'est touché. Les 9
-- news_ingest_pubmed_*, news_check_retractions, news_synthesize_articles et
-- news_synthesize_articles_late restent strictement inchangés.
--
-- Hors périmètre : check_retractions renvoie HTTP 500 à chaque exécution
-- (constaté le 14/09). Sujet distinct, session dédiée.

-- ============================================================================
-- 1. Pré-requis d'exécution — paramètres de session
-- ============================================================================
-- Exécuter les 2 SET ci-dessous DANS LE MÊME Run que le bloc 2 (chaque Run du
-- SQL Editor est une session PostgreSQL indépendante, les GUC de session ne
-- persistent pas entre Runs) :
--
--   SET app.supabase_url      TO 'https://dxybsuhfkwuemapqrvgz.supabase.co';
--   SET app.service_role_key  TO '<SUPABASE_SERVICE_ROLE_KEY>';
--
-- ⚠️ Aucun secret dans le repo. Les 2 GUC sont locales à la session, résolues
-- par current_setting() dans le DO block, puis gelées littéralement dans
-- cron.job.command via format(%L). Ne jamais commiter de JWT dans ce fichier.
-- (La clé service_role reste stockée en clair dans cron.job.command : dette
-- ouverte, migration vers vault.secrets à planifier séparément.)

-- ============================================================================
-- 2. Reschedule — état complet et idempotent des 2 jobs
-- ============================================================================
-- Écrit comme un état complet, jamais comme un patch partiel : unschedule si
-- le job existe, puis schedule, un seul net.http_post par job.

DO $mig$
DECLARE
  v_supabase_url text := current_setting('app.supabase_url',     false);
  v_service_key  text := current_setting('app.service_role_key', false);
BEGIN
  -- 2.1 news_ingest_rss — lundi 04h30 UTC, body {}, timeout 150 s
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'news_ingest_rss') THEN
    PERFORM cron.unschedule('news_ingest_rss');
  END IF;

  PERFORM cron.schedule(
    'news_ingest_rss',
    '30 4 * * 1',
    format(
      $cmd$
      SELECT net.http_post(
        url     := %L,
        headers := jsonb_build_object(
          'Authorization', %L,
          'Content-Type',  'application/json'
        ),
        body    := '{}'::jsonb,
        timeout_milliseconds := 150000
      );
      $cmd$,
      v_supabase_url || '/functions/v1/ingest_rss',
      'Bearer ' || v_service_key
    )
  );

  -- 2.2 news_score_articles — quotidien 14h00 UTC, limit 30, seuil 0.80,
  --     timeout 150 s. Lots de 10 articles à ~10-12 s → ~35 s par invocation,
  --     très confortable sous le plafond Edge de 150 s. Ne pas pousser
  --     au-delà de 100 par invocation.
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
        body    := '{"limit": 30, "threshold": 0.80}'::jsonb,
        timeout_milliseconds := 150000
      );
      $cmd$,
      v_supabase_url || '/functions/v1/score_articles',
      'Bearer ' || v_service_key
    )
  );

  -- 2.3 active=true explicite sur les 2 jobs : cron.schedule les active déjà
  --     par défaut, garde défensive si un run précédent en avait désactivé un
  --     manuellement.
  UPDATE cron.job
     SET active = true
   WHERE jobname IN ('news_ingest_rss', 'news_score_articles');
END
$mig$;

-- ============================================================================
-- 3. Source RSS « L'Information Dentaire » — désactivation
-- ============================================================================
-- UPDATE idempotent ciblé sur le nom. Aucune autre source touchée.

UPDATE public.news_sources
   SET active = false
 WHERE type = 'rss'
   AND name = 'L''Information Dentaire'
   AND active IS DISTINCT FROM false;

-- ============================================================================
-- 4. Vérification (à exécuter dans un RUN SÉPARÉ)
-- ============================================================================
-- SELECT jobname, schedule, active,
--        command LIKE '%timeout_milliseconds%' AS has_timeout,
--        command LIKE '%Bearer <%'             AS chevrons
--   FROM cron.job WHERE jobname LIKE 'news_%';
--
-- Attendu : news_ingest_rss en '30 4 * * 1', news_score_articles en
-- '0 14 * * *', has_timeout = true sur ces deux lignes, et chevrons = false
-- sur TOUTES les lignes.
--
-- SELECT name, type, active FROM news_sources WHERE type = 'rss' ORDER BY name;
-- Attendu : L'Information Dentaire active = false, les 4 autres à true.
--
-- ----------------------------------------------------------------------------
-- Vérification de bout en bout, le mardi suivant
-- ----------------------------------------------------------------------------
-- -- Le RSS a ingéré
-- SELECT s.name, s.last_fetched_at::date,
--        COUNT(*) FILTER (WHERE r.ingested_at > NOW() - INTERVAL '3 days') AS ingeres
--   FROM news_sources s LEFT JOIN news_raw r ON r.source_id = s.id
--  WHERE s.type = 'rss' AND s.active = true
--  GROUP BY s.id, s.name, s.last_fetched_at;
--
-- -- Le scoring tourne tous les jours au bon volume
-- SELECT DATE(scored_at) AS jour, COUNT(*) AS scores,
--        COUNT(*) FILTER (WHERE status = 'selected') AS selectionnes
--   FROM news_scored WHERE scored_at > NOW() - INTERVAL '8 days'
--  GROUP BY 1 ORDER BY 1 DESC;
--
-- Attendu : ~30 scorés par jour, ~4 sélectionnés par jour, au moins une
-- source RSS non nulle.
