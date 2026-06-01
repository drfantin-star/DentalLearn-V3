-- Rollback de 20260601a_user_profiles_interests.sql
-- Supprime l'index GIN puis la colonne `interests` de user_profiles.
-- Aucune policy RLS ni trigger n'avait été créé par la migration montante :
-- rien d'autre à défaire.

DROP INDEX IF EXISTS public.user_profiles_interests_idx;

ALTER TABLE public.user_profiles
  DROP COLUMN IF EXISTS interests;
