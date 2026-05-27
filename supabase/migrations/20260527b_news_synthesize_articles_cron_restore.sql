-- Nom du fichier : 20260527b_news_synthesize_articles_cron_restore.sql
-- Date de création : 2026-05-27
-- Ticket : fix bug d'idempotence synthesize_articles (claude/fix-synthesize-idempotence-27mai2026)
-- Description : Restaure le cron news_synthesize_articles (lundi 20h UTC, body {"limit": 1}) après l'unschedule manuel du 27 mai
-- Rollback : supabase/migrations/20260527b_news_synthesize_articles_cron_restore_down.sql

-- ============================================================================
-- Contexte
-- ============================================================================
-- Suite au bug d'idempotence observé du 18 au 27 mai 2026 (cf
-- DIAGNOSTIC_BUG_IDEMPOTENCE_27MAI2026.md), Dr Fantin a manuellement passé
-- les 2 crons en UNSCHEDULED :
--   - news_synthesize_articles       (schedule '0 */2 * * *' depuis le 20 mai)
--   - news_synthesize_articles_late  (schedule '0 22 * * 1', précédemment fusionné)
--
-- Cette migration restaure le cron news_synthesize_articles au schedule
-- original hebdomadaire (lundi 20h00 UTC), avec body {"limit": 1} (décision
-- du fix 19 mai : 1 article/run pour rester sous IDLE_TIMEOUT 150s avec
-- marge confortable).
--
-- La migration sœur 20260527c_news_synthesize_articles_late_cron_restore.sql
-- restaure le 2e cron lundi 22h00 UTC.
--
-- ⚠️ Ces 2 migrations remplacent fonctionnellement le schedule '0 */2 * * *'
-- de 20260520_fix_synthesize_cron_2h.sql. Le retour au pattern 2-crons hebdo
-- est volontaire : il limite la fréquence d'exécution (donc le blast radius
-- d'un éventuel bug futur) tout en couvrant le rythme stationnaire mesuré
-- (~6/sem) via une absorption ciblée (lundi soir + créneau backfill).
--
-- ⚠️ APPLICATION : cette migration ne doit être appliquée qu'APRÈS :
--   1. Application de 20260527a_news_syntheses_unique_active_scored.sql
--   2. Re-déploiement de l'Edge Function synthesize_articles avec le fix
--      code de cette même PR (étape 3bis cleanup retry-de-failed)
--   3. Validation manuelle du fix sur preview (cf section "Plan de
--      validation" de la PR)

-- ============================================================================
-- 1. Pré-requis d'exécution — paramètres de session
-- ============================================================================
-- Avant d'exécuter cette migration, exécuter les 2 SET ci-dessous DANS LE
-- MÊME Run que le reste du script :
--
--   SET app.supabase_url      TO 'https://dxybsuhfkwuemapqrvgz.supabase.co';
--   SET app.service_role_key  TO '<SUPABASE_SERVICE_ROLE_KEY>';

-- ============================================================================
-- 2. Restore du cron news_synthesize_articles
-- ============================================================================

DO $mig$
DECLARE
  v_supabase_url text := current_setting('app.supabase_url',     false);
  v_service_key  text := current_setting('app.service_role_key', false);
BEGIN
  -- 2.0 Clean slate défensive — supprime tout schedule existant pour ce
  -- jobname (peut être présent avec un schedule obsolète si la migration
  -- est rejouée). Idempotent.
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'news_synthesize_articles') THEN
    PERFORM cron.unschedule('news_synthesize_articles');
  END IF;

  -- 2.1 Schedule lundi 20h00 UTC (= 22h00 Paris en été), body {"limit": 1}.
  -- 1 article par run pour rester très conservateur sous IDLE_TIMEOUT 150s
  -- (cf décision du fix 19 mai 2026 — 20260519_fix_synthesize_cron_limit1.sql).
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
END
$mig$;

-- ============================================================================
-- 3. Vérification (à exécuter dans un RUN SÉPARÉ — règle ping-pong)
-- ============================================================================
-- SELECT jobname, schedule, active, command
--   FROM cron.job
--  WHERE jobname = 'news_synthesize_articles';
--
-- Résultat attendu : 1 ligne avec
--   schedule = '0 20 * * 1'
--   active   = true
--   command contenant "'{\"limit\": 1}'::jsonb"
