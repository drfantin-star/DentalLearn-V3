-- Nom du fichier : 20260716b_handle_new_user_notif_prefs.sql
-- Date de création : 2026-07-16
-- Description : handle_new_user() seede désormais user_notification_preferences
--               avec le consentement global choisi à l'inscription
--               (raw_user_meta_data.notifications_opt_in, défaut true).
-- Rollback : supabase/migrations/20260716b_handle_new_user_notif_prefs_down.sql
--
-- ⚠️ Touche le trigger d'auth handle_new_user (AFTER INSERT ON auth.users).
--    Justifié : relier explicitement le choix de la case « Autoriser l'envoi de
--    notifications » du formulaire d'inscription à la section Notifications du
--    profil. Base : 20260502_sprint1_handle_new_user.sql (INSERT user_profiles
--    + streaks inchangés).
--
-- Ordre : cette migration doit s'appliquer APRÈS 20260716a (colonne
--    notifications_enabled). L'INSERT prefs est placé APRÈS l'INSERT
--    user_profiles car user_notification_preferences.user_id référence
--    user_profiles(id). Seul notifications_enabled est posé ; les autres
--    colonnes prennent leur DEFAULT true.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
    INSERT INTO public.user_profiles (id, first_name, last_name)
    VALUES (
        NEW.id,
        NEW.raw_user_meta_data->>'first_name',
        NEW.raw_user_meta_data->>'last_name'
    )
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO public.streaks (user_id, current_streak, longest_streak)
    VALUES (NEW.id, 0, 0)
    ON CONFLICT (user_id) DO NOTHING;

    -- Consentement global choisi à l'inscription (case pré-cochée décochable).
    -- Absent / non booléen => true (opt-in par défaut, convention projet).
    INSERT INTO public.user_notification_preferences (user_id, notifications_enabled)
    VALUES (
        NEW.id,
        COALESCE((NEW.raw_user_meta_data->>'notifications_opt_in')::boolean, true)
    )
    ON CONFLICT (user_id) DO NOTHING;

    RETURN NEW;
END;
$function$;

-- Le trigger on_auth_user_created existe déjà (20260502) et pointe sur cette
-- fonction ; CREATE OR REPLACE suffit, pas besoin de le recréer.
