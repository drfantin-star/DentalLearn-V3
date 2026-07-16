-- Nom du fichier : 20260716b_handle_new_user_notif_prefs_down.sql
-- Rollback de : 20260716b_handle_new_user_notif_prefs.sql
-- Restaure la version 20260502 de handle_new_user (sans le seed des prefs).

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

    RETURN NEW;
END;
$function$;
