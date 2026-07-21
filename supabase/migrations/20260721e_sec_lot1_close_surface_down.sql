-- Nom du fichier : 20260721e_sec_lot1_close_surface_down.sql
-- Date de création : 2026-07-21
-- Rollback de : 20260721e_sec_lot1_close_surface.sql (BRIEF 2 — LOT 1)
-- Restaure exactement l'état antérieur (grants EXECUTE, 6 policies SELECT
-- storage.objects, RLS désactivée sur les 2 tables).

-- ============================================================================
-- 1.1 — Restaure EXECUTE (anon, authenticated) sur les 8 fonctions
-- ============================================================================
GRANT EXECUTE ON FUNCTION public.send_autoeval_reminders(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.send_autopilot_reminders(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.purge_old_notifications() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_cold_survey_recipients() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_unscored_articles(integer) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.audio_jobs_cost_summary() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mark_cold_survey_notified(uuid, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO anon, authenticated;

-- ============================================================================
-- 1.2 — Recrée les 6 policies SELECT « broad » sur storage.objects
--        (définitions identiques à l'état d'origine : roles + USING)
-- ============================================================================
CREATE POLICY "audio-timelines public read" ON storage.objects
  FOR SELECT TO public USING (bucket_id = 'audio-timelines');

CREATE POLICY "bibliotheque-publique public read" ON storage.objects
  FOR SELECT TO public USING (bucket_id = 'bibliotheque-publique');

CREATE POLICY "Authenticated users can read formations files" ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'formations');

CREATE POLICY "news-audio public read" ON storage.objects
  FOR SELECT TO public USING (bucket_id = 'news-audio');

CREATE POLICY "Anyone view photos" ON storage.objects
  FOR SELECT TO public USING (bucket_id = 'profile-photos');

CREATE POLICY "Public read access for question images" ON storage.objects
  FOR SELECT TO public USING (bucket_id = 'question-images');

-- ============================================================================
-- 1.3 — Désactive la RLS sur les 2 tables (retour à l'état d'origine)
-- ============================================================================
ALTER TABLE public.weekly_journal_notifications_sent DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.new_formation_notifications_sent DISABLE ROW LEVEL SECURITY;
