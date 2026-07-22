-- Down de Migration B — retire la fonction de purge.
DROP FUNCTION IF EXISTS public.delete_user_data(uuid);
