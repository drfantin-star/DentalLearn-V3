-- Nom du fichier : 20260721f_sec_lot2_views_security_invoker.sql
-- Date de création : 2026-07-21
-- Ticket : Durcissement sécurité BRIEF 2 — LOT 2 (vues en mode INVOKER)
-- Description : Bascule 6 vues du schéma public de SECURITY DEFINER (défaut,
--               droits du propriétaire → contourne la RLS des tables sous-
--               jacentes) vers `security_invoker = on` (droits de l'appelant →
--               la RLS s'applique). Corrige les 6 advisors ERROR
--               `security_definer_view`.
--
--   ⚠️ On ne change QUE le mode d'exécution (reloption). Aucune définition de
--   vue n'est modifiée. `ALTER VIEW ... SET (security_invoker = on)` ne
--   réécrit pas le corps de la vue — la définition de `cp_user_progress`
--   (invariant verrouillé) reste strictement inchangée.
--
--   Innocuité vérifiée en base avant application :
--     - cp_user_settings : RLS on, policy ALL USING (auth.uid() = user_id)
--     - cp_actions       : RLS on, policy ALL USING (auth.uid() = user_id)
--     - cp_axes          : RLS on, SELECT public (USING true)
--   → un praticien connecté lit exactement ses propres lignes via la chaîne
--     cp_user_summary → cp_user_progress → {cp_user_settings, cp_axes,
--     cp_actions}. Les lectures serveur en service_role ne sont pas affectées
--     (service_role n'est pas soumis à la RLS).
--
-- Rollback : supabase/migrations/20260721f_sec_lot2_views_security_invoker_down.sql
--
-- Décisions Julie respectées : aucune vue supprimée ; définition de
-- cp_user_progress non touchée.

ALTER VIEW public.cp_user_progress        SET (security_invoker = on);
ALTER VIEW public.cp_user_summary         SET (security_invoker = on);
ALTER VIEW public.themes_with_content     SET (security_invoker = on);
ALTER VIEW public.questions_with_context  SET (security_invoker = on);
ALTER VIEW public.sequences_with_formation SET (security_invoker = on);
ALTER VIEW public.formations_with_stats   SET (security_invoker = on);
