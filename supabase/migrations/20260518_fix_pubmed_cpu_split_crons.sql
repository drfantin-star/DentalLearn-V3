-- Nom du fichier : 20260518_fix_pubmed_cpu_split_crons.sql
-- Date de création : 2026-05-18
-- Ticket : fix/pubmed-cpu-split-crons
-- Description : Split du cron unique news_ingest_pubmed (10 sources en séquentiel,
--               qui saturait le CPU limit Edge Function à 2000 ms) en 10 crons
--               individuels, un par source active, décalés de 2 min à partir
--               de lundi 04h00 UTC. Chaque cron POSTe {"source_id":"<uuid>"} à
--               /functions/v1/ingest_pubmed, qui ne traite plus qu'une source
--               par invocation (cf. ingest_pubmed/index.ts post fix).
-- Rollback : supabase/migrations/20260518_fix_pubmed_cpu_split_crons_down.sql
--
-- ============================================================================
-- NOTE — Timezone, pg_cron et pg_net
-- ============================================================================
-- Convention héritée de 20260423_news_cron_schedules.sql :
--   * cron.timezone reste figé à GMT (PGC_POSTMASTER, non modifiable côté
--     utilisateur) ; expressions UTC encodées pour l'heure d'été Europe/Paris
--     (UTC+2). Décalage d'1h en hiver accepté.
--   * Seule la signature positionnelle 3-args de cron.schedule est exposée
--     par Supabase.
--   * net.http_post : `body := <jsonb>` (pas de cast text). Pattern strict
--     identique à 20260423 (`body := '{}'::jsonb`), ici étendu à
--     `body := %L::jsonb` via format() pour injecter le source_id par cron.
--
-- Fenêtre d'exécution : 04:00 → 04:18 UTC le lundi. Dernier cron à 04:18,
-- ingest_rss à 04:30 UTC (cf. 20260426) : 12 min de marge — suffisant car
-- chaque invocation single-source consomme désormais < 500 ms CPU
-- (vs ~2000+ ms cumulés en séquentiel sur 10 sources).
--
-- Source IDs récupérés via MCP Supabase le 2026-05-18 :
--   SELECT id, name FROM news_sources
--    WHERE type = 'pubmed' AND active = true
--    ORDER BY name;
-- Ces 10 lignes correspondent à la totalité des sources pubmed actives à la
-- date de cette migration. Toute nouvelle source pubmed devra ajouter son
-- propre cron (ticket dédié) — il n'y a pas de génération dynamique à
-- l'exécution.
-- ============================================================================

DO $mig$
DECLARE
  v_supabase_url text := current_setting('app.supabase_url',     false);
  v_service_key  text := current_setting('app.service_role_key', false);
  v_jobs         text[][] := ARRAY[
    -- [jobname, schedule, source_id]
    ARRAY['news_ingest_pubmed_chirurgie_orale',                     '0 4 * * 1',  '9eeb7c9b-4381-4b00-9e1e-5124484bfbd3'],
    ARRAY['news_ingest_pubmed_dentisterie_restauratrice_endodontie','2 4 * * 1',  '120d892b-f852-43dc-8aa1-6ce2f69ae62a'],
    ARRAY['news_ingest_pubmed_gerodontologie',                      '4 4 * * 1',  'f9a0d1d0-7afe-448a-91c8-dd109532efa2'],
    ARRAY['news_ingest_pubmed_medecine_buccale_diagnostic',         '6 4 * * 1',  '58716c53-fc33-4131-99c9-b8082f86fdf1'],
    ARRAY['news_ingest_pubmed_occlusodontie_esthetique',            '8 4 * * 1',  '0cd2016a-1edf-4c4e-bcc8-fde86b1f8542'],
    ARRAY['news_ingest_pubmed_orthodontie',                         '10 4 * * 1', '67656d7d-7452-4da1-87ad-ccb477c2d279'],
    ARRAY['news_ingest_pubmed_parodontologie',                      '12 4 * * 1', '7c5d11e4-11d6-4a3b-a2f7-4edd8fbf5b2b'],
    ARRAY['news_ingest_pubmed_pedodontie',                          '14 4 * * 1', 'de42b485-3a31-44a5-869e-b57a3d8e9698'],
    ARRAY['news_ingest_pubmed_prothese_implantologie',              '16 4 * * 1', '84567256-58d7-477a-9b76-d5aba033024c'],
    ARRAY['news_ingest_pubmed_sante_publique_dentaire',             '18 4 * * 1', '8977e497-057b-4942-be53-f9518ce7acc4']
  ];
  v_i        int;
  v_jobname  text;
  v_sched    text;
  v_srcid    text;
BEGIN
  -- 1. Drop de l'ancien cron monolithique (idempotent).
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'news_ingest_pubmed') THEN
    PERFORM cron.unschedule('news_ingest_pubmed');
  END IF;

  -- 2. (Re)schedule des 10 crons individuels.
  --    Idempotent : si un job du même nom existe déjà (re-run), on l'unschedule
  --    d'abord (même pattern défensif que 20260423).
  FOR v_i IN 1 .. array_length(v_jobs, 1) LOOP
    v_jobname := v_jobs[v_i][1];
    v_sched   := v_jobs[v_i][2];
    v_srcid   := v_jobs[v_i][3];

    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = v_jobname) THEN
      PERFORM cron.unschedule(v_jobname);
    END IF;

    PERFORM cron.schedule(
      v_jobname,
      v_sched,
      format(
        $cmd$
        SELECT net.http_post(
          url     := %L,
          headers := jsonb_build_object(
            'Authorization', %L,
            'Content-Type',  'application/json'
          ),
          body    := %L::jsonb
        );
        $cmd$,
        v_supabase_url || '/functions/v1/ingest_pubmed',
        'Bearer ' || v_service_key,
        format('{"source_id":"%s"}', v_srcid)
      )
    );
  END LOOP;
END
$mig$;

-- ============================================================================
-- Vérification (à exécuter dans un RUN SÉPARÉ)
-- ============================================================================
-- SELECT jobid, jobname, schedule, active
--   FROM cron.job
--  WHERE jobname LIKE 'news_ingest_pubmed%'
--  ORDER BY schedule, jobname;
--
-- Résultat attendu : 10 lignes, aucune nommée 'news_ingest_pubmed' (l'ancien
-- cron monolithique), toutes actives, schedules de '0 4 * * 1' à '18 4 * * 1'.
