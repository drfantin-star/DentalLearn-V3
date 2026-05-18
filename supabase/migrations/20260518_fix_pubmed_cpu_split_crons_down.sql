-- Nom du fichier : 20260518_fix_pubmed_cpu_split_crons_down.sql
-- Date de création : 2026-05-18
-- Rollback de : 20260518_fix_pubmed_cpu_split_crons.sql
-- Description : Supprime les 10 crons individuels et recrée le cron unique
--               news_ingest_pubmed (lundi 04h00 UTC, body vide) tel qu'il
--               existait avant le fix CPU split.
--
-- ATTENTION : ce rollback restaure l'état antérieur, qui sature le CPU limit
-- Edge Function (cf. ticket). À n'exécuter que pour repartir d'un état propre
-- avant de re-jouer la migration up (ex. rotation service_role key).

-- ============================================================================
-- 1. Pré-requis de session (identiques à 20260423)
-- ============================================================================
--   SET app.supabase_url      TO 'https://dxybsuhfkwuemapqrvgz.supabase.co';
--   SET app.service_role_key  TO '<SUPABASE_SERVICE_ROLE_KEY>';
-- ============================================================================

DO $mig$
DECLARE
  v_supabase_url text := current_setting('app.supabase_url',     false);
  v_service_key  text := current_setting('app.service_role_key', false);
  v_jobnames     text[] := ARRAY[
    'news_ingest_pubmed_chirurgie_orale',
    'news_ingest_pubmed_dentisterie_restauratrice_endodontie',
    'news_ingest_pubmed_gerodontologie',
    'news_ingest_pubmed_medecine_buccale_diagnostic',
    'news_ingest_pubmed_occlusodontie_esthetique',
    'news_ingest_pubmed_orthodontie',
    'news_ingest_pubmed_parodontologie',
    'news_ingest_pubmed_pedodontie',
    'news_ingest_pubmed_prothese_implantologie',
    'news_ingest_pubmed_sante_publique_dentaire'
  ];
  v_name text;
BEGIN
  -- 1. Drop des 10 crons individuels (idempotent).
  FOREACH v_name IN ARRAY v_jobnames LOOP
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = v_name) THEN
      PERFORM cron.unschedule(v_name);
    END IF;
  END LOOP;

  -- 2. Re-création du cron monolithique d'origine (cf. 20260423 §3.2).
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'news_ingest_pubmed') THEN
    PERFORM cron.unschedule('news_ingest_pubmed');
  END IF;

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
-- Vérification (à exécuter dans un RUN SÉPARÉ)
-- ============================================================================
-- SELECT jobid, jobname, schedule, active
--   FROM cron.job
--  WHERE jobname LIKE 'news_ingest_pubmed%'
--  ORDER BY jobname;
--
-- Résultat attendu : 1 seule ligne (news_ingest_pubmed, schedule '0 4 * * 1').
