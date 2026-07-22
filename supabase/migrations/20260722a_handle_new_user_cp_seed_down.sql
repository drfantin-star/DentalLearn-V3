-- 20260722a_handle_new_user_cp_seed_down.sql
-- Rollback : restaure handle_new_user() dans sa definition anterieure (sans
-- ecriture de ordre_inscription_date, sans seed cp_user_settings).
--
-- Note : ne supprime PAS les lignes cp_user_settings deja seedees ni les valeurs
-- ordre_inscription_date deja ecrites par la version up (donnees legitimes,
-- pas un artefact a purger). Rollback purement fonctionnel sur le trigger.

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
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

    INSERT INTO public.user_notification_preferences (user_id, notifications_enabled)
    VALUES (
        NEW.id,
        COALESCE((NEW.raw_user_meta_data->>'notifications_opt_in')::boolean, true)
    )
    ON CONFLICT (user_id) DO NOTHING;

    RETURN NEW;
END;
$function$;
