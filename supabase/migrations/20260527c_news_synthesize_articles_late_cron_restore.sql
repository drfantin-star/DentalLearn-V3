-- Nom du fichier : 20260527c_news_synthesize_articles_late_cron_restore.sql
-- Date de création : 2026-05-27
-- Ticket : fix bug d'idempotence synthesize_articles (claude/fix-synthesize-idempotence-27mai2026)
-- Description : Restaure le 2e cron news_synthesize_articles_late (lundi 22h UTC, body {"limit": 1}) après l'unschedule manuel du 27 mai
-- Rollback : supabase/migrations/20260527c_news_synthesize_articles_late_cron_restore_down.sql

-- ============================================================================
-- Contexte
-- ============================================================================
-- Cf DIAGNOSTIC_BUG_IDEMPOTENCE_27MAI2026.md et migration sœur
-- 20260527b_news_synthesize_articles_cron_restore.sql pour le contexte
-- complet (bug d'idempotence du 18-27 mai 2026, unschedule défensif des
-- 2 crons par Dr Fantin, retour au pattern 2-crons hebdo).
--
-- Cette migration restaure le 2e cron news_synthesize_articles_late au
-- schedule lundi 22h00 UTC (= 00h00 Paris en été), 2h après le 1er cron
-- restauré par 20260527b. Le 2h de délai laisse au 1er run le temps de
-- finir (~50s pour limit=1 + marge) et le LEFT JOIN loadCandidates côté
-- Edge Function exclura automatiquement l'article déjà synthétisé.
--
-- Body POST {"limit": 1} identique au 1er cron — même contrainte
-- IDLE_TIMEOUT 150s côté Edge Functions.
--
-- ⚠️ APPLICATION : à appliquer immédiatement après
-- 20260527b_news_synthesize_articles_cron_restore.sql (et après validation
-- manuelle sur preview du fix code de cette PR).
--
-- ⚠️ Cette migration est ADDITIVE — elle ne touche pas au cron
-- news_synthesize_articles restauré par 20260527b.

-- ============================================================================
-- 1. Pré-requis d'exécution — paramètres de session
-- ============================================================================
-- Avant d'exécuter cette migration, exécuter les 2 SET ci-dessous DANS LE
-- MÊME Run que le reste du script :
--
--   SET app.supabase_url      TO 'https://dxybsuhfkwuemapqrvgz.supabase.co';
--   SET app.service_role_key  TO '<SUPABASE_SERVICE_ROLE_KEY>';

-- ============================================================================
-- 2. Restore du cron news_synthesize_articles_late
-- ============================================================================

DO $mig$
DECLARE
  v_supabase_url text := current_setting('app.supabase_url',     false);
  v_service_key  text := current_setting('app.service_role_key', false);
BEGIN
  -- 2.0 Clean slate défensive — supprime tout schedule existant pour ce
  -- jobname. Idempotent.
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'news_synthesize_articles_late') THEN
    PERFORM cron.unschedule('news_synthesize_articles_late');
  END IF;

  -- 2.1 Schedule lundi 22h00 UTC (= 00h00 Paris en été), body {"limit": 1}.
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
-- SELECT jobname, schedule, active
--   FROM cron.job
--  WHERE jobname LIKE 'news_synthesize_articles%'
--  ORDER BY schedule;
--
-- Résultat attendu : 2 lignes
--   news_synthesize_articles       | 0 20 * * 1 | t
--   news_synthesize_articles_late  | 0 22 * * 1 | t
