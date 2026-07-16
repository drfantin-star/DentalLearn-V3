-- Nom du fichier : 20260716d_journal_formation_notif_crons.sql
-- Date de création : 2026-07-16
-- Description : pg_cron — 2 nouveaux jobs horaires qui invoquent les Edge
--               Functions notify_new_journal et notify_new_formation.
-- Rollback : supabase/migrations/20260716d_journal_formation_notif_crons_down.sql
--
-- Pattern repris de 20260515_sprint2_t7_crons.sql.

-- ============================================================================
-- NOTE SUPABASE — Timezone cron
-- ============================================================================
-- cron.timezone est figé à GMT côté Supabase (non modifiable) : toutes les
-- expressions cron sont en UTC.
--
-- Cadence — 2 nouveaux jobs horaires, décalés des jobs T7 existants
-- ('0' live_session_reminders, '30' notify_followers_new_publication) :
--   '15 * * * *'  = notify_new_journal    (toutes les heures, +15min)
--   '45 * * * *'  = notify_new_formation  (toutes les heures, +45min)
--
-- Détection par table d'idempotence (voir 20260716c) : chaque item en ligne
-- non encore présent dans la table _sent est notifié une seule fois. Cron
-- horaire => livraison au plus tard ~1h après le passage en ligne (publication
-- journal / toggle is_published formation, tous deux manuels).

-- ============================================================================
-- 1. EXTENSION pg_cron
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pg_cron;

-- ============================================================================
-- 2. Pré-requis d'exécution — paramètres de session
-- ============================================================================
-- Exécuter les 2 SET ci-dessous DANS LE MÊME Run que le reste du script :
--
--   SET app.supabase_url      TO 'https://dxybsuhfkwuemapqrvgz.supabase.co';
--   SET app.service_role_key  TO '<SUPABASE_SERVICE_ROLE_KEY>';

-- ============================================================================
-- 3. Schedule des 2 jobs
-- ============================================================================

DO $mig$
DECLARE
  v_supabase_url text := current_setting('app.supabase_url',     false);
  v_service_key  text := current_setting('app.service_role_key', false);
BEGIN

  -- ── 3.1 notify_new_journal — toutes les heures, +15min ────────────────────
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'notify_new_journal') THEN
    PERFORM cron.unschedule('notify_new_journal');
  END IF;

  PERFORM cron.schedule(
    'notify_new_journal',
    '15 * * * *',
    format(
      $cmd$
      SELECT net.http_post(
        url     := %L,
        headers := jsonb_build_object(
          'Authorization', %L,
          'Content-Type',  'application/json'
        ),
        body    := '{"limit": 50}'::jsonb
      );
      $cmd$,
      v_supabase_url || '/functions/v1/notify_new_journal',
      'Bearer ' || v_service_key
    )
  );

  -- ── 3.2 notify_new_formation — toutes les heures, +45min ──────────────────
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'notify_new_formation') THEN
    PERFORM cron.unschedule('notify_new_formation');
  END IF;

  PERFORM cron.schedule(
    'notify_new_formation',
    '45 * * * *',
    format(
      $cmd$
      SELECT net.http_post(
        url     := %L,
        headers := jsonb_build_object(
          'Authorization', %L,
          'Content-Type',  'application/json'
        ),
        body    := '{"limit": 50}'::jsonb
      );
      $cmd$,
      v_supabase_url || '/functions/v1/notify_new_formation',
      'Bearer ' || v_service_key
    )
  );

END
$mig$;

-- ============================================================================
-- 4. Vérification (à exécuter dans un RUN SÉPARÉ)
-- ============================================================================
-- SELECT jobname, schedule, active
--   FROM cron.job
--  WHERE jobname IN ('notify_new_journal', 'notify_new_formation')
--  ORDER BY schedule;
--
-- Résultat attendu : 2 lignes, active=true.
