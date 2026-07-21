-- Nom du fichier : 20260721f_sec_lot2_views_security_invoker_down.sql
-- Date de création : 2026-07-21
-- Rollback de : 20260721f_sec_lot2_views_security_invoker.sql (BRIEF 2 — LOT 2)
-- Retire la reloption security_invoker sur les 6 vues → retour exact à l'état
-- d'origine (reloptions = NULL, exécution SECURITY DEFINER par défaut).
-- Aucune définition de vue n'est touchée.

ALTER VIEW public.cp_user_progress        RESET (security_invoker);
ALTER VIEW public.cp_user_summary         RESET (security_invoker);
ALTER VIEW public.themes_with_content     RESET (security_invoker);
ALTER VIEW public.questions_with_context  RESET (security_invoker);
ALTER VIEW public.sequences_with_formation RESET (security_invoker);
ALTER VIEW public.formations_with_stats   RESET (security_invoker);
