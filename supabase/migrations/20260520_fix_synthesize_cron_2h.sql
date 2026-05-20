-- Nom du fichier : 20260520_fix_synthesize_cron_2h.sql
-- Date de création : 2026-05-20
-- Ticket : augmentation débit synthesize_articles
-- Description : Fusion des 2 crons hebdo (news_synthesize_articles lundi 20h + news_synthesize_articles_late lundi 22h, body {"limit": 1}) en un cron unique news_synthesize_articles toutes les 2h avec body {"limit": 2}
-- Rollback : supabase/migrations/20260520_fix_synthesize_cron_2h_down.sql

-- ============================================================================
-- Contexte (20/05/2026 — augmentation débit synthèse)
-- ============================================================================
-- État pré-migration (post-20260519_fix_synthesize_cron_limit1) :
--   - news_synthesize_articles       : lundi 20h00 UTC, body {"limit": 1}
--   - news_synthesize_articles_late  : lundi 22h00 UTC, body {"limit": 1}
--   - Débit hebdo : 2 articles/sem, sous la moyenne mesurée 6,5/sem
--     → rattrapage manuel récurrent via scripts/backfill_synthesize.sh
--
-- Décision : passer en cron unique toutes les 2h avec limit=2 :
--   - Schedule '0 */2 * * *' → 12 runs/jour × 7 = 84 runs/sem
--   - 84 runs × 2 articles = 168 articles/sem capacité théorique
--   - Marge confortable au-dessus du rythme stationnaire 6,5/sem, le worker
--     no-op rapidement quand la file est vide (rien à synthétiser → exit)
--   - Body {"limit": 2} reste sous IDLE_TIMEOUT 150s gateway Supabase Edge
--     Functions : 2 articles × ~50s worst-case = 100s, marge 50s
--
-- Suppression de news_synthesize_articles_late : fusionné dans le cron unique.
-- Le jobname news_synthesize_articles est conservé (re-schedule).
--
-- cron.unschedule + cron.schedule sur le même jobname sont idempotents côté
-- pg_cron — la migration est rejouable.

-- ============================================================================
-- 1. Pré-requis d'exécution — paramètres de session
-- ============================================================================
-- Avant d'exécuter cette migration, exécuter les 2 SET ci-dessous DANS LE
-- MÊME Run que le reste du script :
--
--   SET app.supabase_url      TO 'https://dxybsuhfkwuemapqrvgz.supabase.co';
--   SET app.service_role_key  TO '<SUPABASE_SERVICE_ROLE_KEY>';

-- ============================================================================
-- 2. Suppression du cron late + re-schedule du cron principal en 2h
-- ============================================================================

DO $mig$
DECLARE
  v_supabase_url text := current_setting('app.supabase_url',     false);
  v_service_key  text := current_setting('app.service_role_key', false);
BEGIN
  -- 2.1 Suppression du cron late (fusionné dans le cron unique)
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'news_synthesize_articles_late') THEN
    PERFORM cron.unschedule('news_synthesize_articles_late');
  END IF;

  -- 2.2 Re-schedule du cron principal en toutes les 2h, body {"limit": 2}
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'news_synthesize_articles') THEN
    PERFORM cron.unschedule('news_synthesize_articles');
  END IF;

  PERFORM cron.schedule(
    'news_synthesize_articles',
    '0 */2 * * *',
    format(
      $cmd$
      SELECT net.http_post(
        url     := %L,
        headers := jsonb_build_object(
          'Authorization', %L,
          'Content-Type',  'application/json'
        ),
        body    := '{"limit": 2}'::jsonb
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
--  WHERE jobname IN ('news_synthesize_articles', 'news_synthesize_articles_late')
--  ORDER BY jobname;
--
-- Résultat attendu : 1 seule ligne (news_synthesize_articles),
-- schedule='0 */2 * * *', active=true, command contenant
-- "'{\"limit\": 2}'::jsonb". news_synthesize_articles_late doit avoir disparu.
