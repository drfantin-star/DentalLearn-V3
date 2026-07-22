-- 20260722a_handle_new_user_cp_seed.sql
-- LOT 1 — Fiabilite rappels CP : seed cp_user_settings des l'inscription.
--
-- Contexte : handle_new_user() seedait deja user_profiles / streaks /
-- user_notification_preferences, mais PAS cp_user_settings (creee seulement au
-- premier passage sur /ma-certif). Resultat constate : comptes sans periode CP
-- -> aucun rappel CP possible.
--
-- Changement (additif, non destructif) : les INSERT existants sont conserves a
-- l'identique. On ajoute :
--   1. l'ecriture de user_profiles.ordre_inscription_date depuis la metadata
--      signup (raw_user_meta_data->>'ordre_inscription_date') ;
--   2. si cette date est presente, le seed idempotent de cp_user_settings via
--      public.create_cp_settings_for_user (SECURITY DEFINER, regle derogation
--      9 ans / 6 ans deja en prod).
--
-- Garde-fou : date absente (compte cree hors formulaire signup) -> on ne seede
-- pas cp_user_settings et le signup n'echoue pas. Le lazy-seed cote /ma-certif
-- reste le filet.
--
-- Non destructif : aucun DROP, aucune colonne retiree. create_cp_settings_for_user
-- reste appelee uniquement en contexte SECURITY DEFINER (pas exposee au client).

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_ordre_date date := NULLIF(NEW.raw_user_meta_data->>'ordre_inscription_date', '')::date;
BEGIN
    INSERT INTO public.user_profiles (id, first_name, last_name, ordre_inscription_date)
    VALUES (
        NEW.id,
        NEW.raw_user_meta_data->>'first_name',
        NEW.raw_user_meta_data->>'last_name',
        v_ordre_date
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

    -- Seed CP idempotent uniquement si la date d'inscription a l'Ordre est fournie.
    IF v_ordre_date IS NOT NULL THEN
        PERFORM public.create_cp_settings_for_user(NEW.id, v_ordre_date);
    END IF;

    RETURN NEW;
END;
$function$;
