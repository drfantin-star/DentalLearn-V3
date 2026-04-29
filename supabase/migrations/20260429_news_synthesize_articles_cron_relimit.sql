-- Nom du fichier : 20260429_news_synthesize_articles_cron_relimit.sql
-- Date de création : 2026-04-29
-- Ticket : feature/news-ticket-5 (claude/news-section-ticket-5-hPm1t)
-- Description : Recalibrage du body POST cron news_synthesize_articles ({"limit": 8} → {"limit": 3}) après mesure live ~30s/article
-- Rollback : supabase/migrations/20260429_news_synthesize_articles_cron_relimit_down.sql

-- ============================================================================
-- Contexte (hot fix 29/04/2026 post-déploiement Phase 1)
-- ============================================================================
-- La migration initiale 20260428_news_synthesize_articles_cron.sql planifiait
-- le job avec body POST {"limit": 8} (estimation design ~8s/article ×8 = 64s).
--
-- Mesure réelle après déploiement Phase 1 : ~30s/article (Sonnet 4.6
-- single-call avec retry tag potentiel + OpenAI embeddings + INSERT 2 tables).
-- À 8 articles × 30s = 240s, on dépasse l'IDLE_TIMEOUT 150s d'Edge Functions
-- Supabase. Le 1er run live a effectivement timeout côté gateway, même si
-- les 5 articles traités ont tous été INSERT correctement en BDD (l'INSERT
-- atomique par article a sauvé les données, mais le retour HTTP a expiré).
--
-- Recalibrage côté types.ts :
--   DEFAULT_BATCH_LIMIT 8 → 3  (~90s, marge 60s)
--   MAX_BATCH_LIMIT     15 → 5 (~150s, pile sur la limite — backfill manuel
--                                avec mesures uniquement)
--
-- Cette migration aligne le body cron sur DEFAULT_BATCH_LIMIT=3 pour rester
-- dans la zone confortable 60s de marge en régime stationnaire hebdo.
--
-- Pas de UNIQUE sur cron.job.jobname, mais cron.unschedule + cron.schedule
-- sur le même nom sont idempotents — l'opération est sûre côté pg_cron.
--
-- ⚠️ Cette migration doit être appliquée APRÈS le redéploiement de la
-- fonction Edge (sinon le cron du lundi 20h UTC suivant continuerait à
-- envoyer body {"limit": 8} → l'Edge Function le cap silencieusement à
-- MAX_BATCH_LIMIT=5 mais on perd la traçabilité côté cron).

-- ============================================================================
-- 1. Pré-requis d'exécution — paramètres de session
-- ============================================================================
-- Avant d'exécuter cette migration, exécuter les 2 SET ci-dessous DANS LE
-- MÊME Run que le reste du script :
--
--   SET app.supabase_url      TO 'https://dxybsuhfkwuemapqrvgz.supabase.co';
--   SET app.service_role_key  TO '<SUPABASE_SERVICE_ROLE_KEY>';

-- ============================================================================
-- 2. Re-schedule avec body {"limit": 3}
-- ============================================================================

DO $mig$
DECLARE
  v_supabase_url text := current_setting('app.supabase_url',     false);
  v_service_key  text := current_setting('app.service_role_key', false);
BEGIN
  -- 2.0 Clean slate du job existant (créé par 20260428_news_synthesize_articles_cron.sql).
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'news_synthesize_articles') THEN
    PERFORM cron.unschedule('news_synthesize_articles');
  END IF;

  -- 2.1 Re-schedule identique à 20260428_news_synthesize_articles_cron.sql
  --     SAUF body POST : {"limit": 3} au lieu de {"limit": 8}.
  --     Schedule '0 20 * * 1' inchangé (lundi 20h00 UTC = 22h00 Paris été).
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
-- SELECT jobid, jobname, schedule, active, command
--   FROM cron.job
--  WHERE jobname = 'news_synthesize_articles';
--
-- Résultat attendu : 1 ligne avec active=true, schedule='0 20 * * 1',
-- command contenant "'{\"limit\": 3}'::jsonb" (au lieu de "{\"limit\": 8}").
