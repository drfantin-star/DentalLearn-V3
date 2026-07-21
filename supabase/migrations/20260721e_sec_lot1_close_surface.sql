-- Nom du fichier : 20260721a_sec_lot1_close_surface.sql
-- Date de création : 2026-07-21
-- Ticket : Durcissement sécurité BRIEF 2 — LOT 1 (fermetures, risque nul)
-- Description : Réduit la surface d'exposition publique sans changer aucun
--               comportement applicatif :
--   1.1  Retire EXECUTE (anon, authenticated) sur 8 fonctions SECURITY DEFINER
--        appelées uniquement par pg_cron / routes service_role / trigger.
--        verify_attestation_public(varchar) reste exposée à anon (page /verify).
--   1.2  Retire 6 policies SELECT « broad » sur storage.objects qui autorisent
--        l'ENUMÉRATION (.list()) du contenu de 6 buckets PUBLICS. L'accès direct
--        par URL /object/public/... reste intact (buckets public = true).
--   1.3  Active la RLS (deny-by-default, aucune policy) sur 2 tables écrites
--        exclusivement par des Edge Functions en service_role.
-- Rollback : supabase/migrations/20260721a_sec_lot1_close_surface_down.sql
--
-- NOTE destructive : DROP POLICY (1.2) — signalé et validé dans le brief.

-- ============================================================================
-- 1.1 — REVOKE EXECUTE sur 8 fonctions (anon, authenticated)
-- ============================================================================
REVOKE EXECUTE ON FUNCTION public.send_autoeval_reminders(text) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.send_autopilot_reminders(text) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.purge_old_notifications() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_cold_survey_recipients() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_unscored_articles(integer) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.audio_jobs_cost_summary() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.mark_cold_survey_notified(uuid, text) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated;

-- ============================================================================
-- 1.2 — DROP des 6 policies SELECT d'énumération sur storage.objects
--        (accès direct par URL publique NON impacté : buckets public = true)
-- ============================================================================
DROP POLICY IF EXISTS "audio-timelines public read" ON storage.objects;
DROP POLICY IF EXISTS "bibliotheque-publique public read" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can read formations files" ON storage.objects;
DROP POLICY IF EXISTS "news-audio public read" ON storage.objects;
DROP POLICY IF EXISTS "Anyone view photos" ON storage.objects;
DROP POLICY IF EXISTS "Public read access for question images" ON storage.objects;

-- ============================================================================
-- 1.3 — ENABLE RLS (deny-by-default) sur 2 tables service_role-only
-- ============================================================================
ALTER TABLE public.weekly_journal_notifications_sent ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.new_formation_notifications_sent ENABLE ROW LEVEL SECURITY;
