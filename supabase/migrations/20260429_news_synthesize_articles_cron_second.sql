-- Nom du fichier : 20260429_news_synthesize_articles_cron_second.sql
-- Date de création : 2026-04-29
-- Ticket : feature/news-ticket-5 (claude/news-section-ticket-5-hPm1t)
-- Description : Ajout d'un 2e job cron news_synthesize_articles_late (lundi 22h00 UTC) pour doubler l'absorption hebdo après recalibrage des limites
-- Rollback : supabase/migrations/20260429_news_synthesize_articles_cron_second_down.sql

-- ============================================================================
-- Contexte (hot fix 29/04/2026 post-recalibrage)
-- ============================================================================
-- Suite au recalibrage des limites (cf 20260429_news_synthesize_articles_cron_relimit.sql),
-- le cron lundi 20h00 UTC envoie body POST {"limit": 3} (vs 8 initialement).
-- Soit ~3 articles absorbés par run.
--
-- Mesure rythme stationnaire au 29/04/2026 : ~6,5 articles selected/sem
-- en moyenne (plage observée 3-15 selon volumétrie PubMed/RSS de la semaine).
-- Un seul cron à 3/sem → accumulation ~3-4 articles/sem non absorbés.
--
-- Solution : 2e cron qui tourne 2h après le 1er (lundi 22h00 UTC).
--   Cron 1 — '0 20 * * 1' = lundi 20h00 UTC (= 22h00 Paris été), body {"limit": 3}
--   Cron 2 — '0 22 * * 1' = lundi 22h00 UTC (= 00h00 Paris été), body {"limit": 3}
-- Total absorption hebdo = 2 × 3 = 6 articles/sem, quasi-aligné sur la
-- moyenne mesurée (6,5/sem).
--
-- Le 2e cron tourne 2h après le 1er pour :
--   - laisser le 1er run finir tranquillement (~90s pour 3 articles + marge)
--   - traiter les articles non absorbés au 1er run (le LEFT JOIN
--     news_syntheses du loadCandidates exclut automatiquement ceux qui
--     ont été synthétisés par le 1er run)
--   - éviter les conflits d'INSERT concurrents sur news_syntheses
--
-- Note dette technique : à mesure que la volumétrie grimpe (ajout sources
-- RSS Phase 1.5, ouverture utilisateurs Phase 2), il faudra ré-évaluer
-- cette stratégie 2-crons et probablement passer à un job worker dédié
-- hors IDLE_TIMEOUT 150s, ou auto-relance jusqu'à has_more=false côté
-- Edge Function. Hors scope Ticket 5.
--
-- ⚠️ Cette migration est ADDITIVE — elle ne touche pas au cron existant
-- 'news_synthesize_articles' (créé par 20260428_news_synthesize_articles_cron.sql
-- puis recalibré par 20260429_news_synthesize_articles_cron_relimit.sql).
-- Les 2 crons coexistent.

-- ============================================================================
-- 1. Pré-requis d'exécution — paramètres de session
-- ============================================================================
-- Avant d'exécuter cette migration, exécuter les 2 SET ci-dessous DANS LE
-- MÊME Run que le reste du script :
--
--   SET app.supabase_url      TO 'https://dxybsuhfkwuemapqrvgz.supabase.co';
--   SET app.service_role_key  TO '<SUPABASE_SERVICE_ROLE_KEY>';

-- ============================================================================
-- 2. Schedule du 2e cron — jobname dédié 'news_synthesize_articles_late'
-- ============================================================================

DO $mig$
DECLARE
  v_supabase_url text := current_setting('app.supabase_url',     false);
  v_service_key  text := current_setting('app.service_role_key', false);
BEGIN
  -- 2.0 Clean slate défensive — rend la migration rejouable. Idempotent
  -- côté pg_cron (cron.unschedule fail silent si le job n'existe pas).
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'news_synthesize_articles_late') THEN
    PERFORM cron.unschedule('news_synthesize_articles_late');
  END IF;

  -- 2.1 Synthèse Claude Sonnet — lundi 22h00 UTC (= 00h00 Paris été).
  -- Tourne 2h après le 1er cron (lundi 20h00 UTC) pour traiter les
  -- articles selected non absorbés au 1er run. Le LEFT JOIN
  -- news_syntheses du loadCandidates côté Edge Function (cf
  -- synthesize_articles/index.ts §loadCandidates) exclut automatiquement
  -- les articles déjà synthétisés (matrice 0bis : skip si syn.status='active').
  --
  -- Body POST {"limit": 3} identique au 1er cron — même contrainte
  -- IDLE_TIMEOUT 150s côté Edge Functions.
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
$mig$;

-- ============================================================================
-- 3. Vérification (à exécuter dans un RUN SÉPARÉ — règle ping-pong)
-- ============================================================================
-- SELECT jobname, schedule, active
--   FROM cron.job
--  WHERE jobname LIKE 'news_synthesize_articles%'
--  ORDER BY schedule;
--
-- Résultat attendu : 2 lignes
--   - news_synthesize_articles       | 0 20 * * 1 | t
--   - news_synthesize_articles_late  | 0 22 * * 1 | t
--
-- Vérif chaîne complète des 6 jobs hebdomadaires post-application :
--
-- SELECT jobname, schedule, active
--   FROM cron.job
--  WHERE jobname IN (
--    'news_check_retractions',
--    'news_ingest_pubmed',
--    'news_ingest_rss',
--    'news_score_articles',
--    'news_synthesize_articles',
--    'news_synthesize_articles_late'
--  )
--  ORDER BY schedule;
--
-- Résultat attendu : 6 lignes, toutes active=true.
