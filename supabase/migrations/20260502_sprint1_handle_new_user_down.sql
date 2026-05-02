-- Down migration T4 Sprint 1 : retire le trigger + la fonction handle_new_user.

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();
