-- T4 Sprint 1 : trigger handle_new_user sur auth.users
--
-- Crée automatiquement le profil et la streak du user à l'inscription,
-- pour éviter de devoir le faire côté client (register/page.tsx).
--
-- ON CONFLICT DO NOTHING => idempotent (rejeu sans erreur).

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

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();
