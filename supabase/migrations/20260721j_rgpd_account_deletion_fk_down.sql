-- Down de Migration A — retablit l'etat des contraintes anterieur.
--
-- ATTENTION : ce down est un rollback de SCHEMA. Il ne doit etre joue que si
-- aucune suppression de compte n'a encore ete effectuee. Une fois qu'une purge
-- a fait passer des user_id / colonnes acteur a NULL, la re-application des
-- NOT NULL / CASCADE ci-dessous echouerait (lignes orphelines creees par le
-- SET NULL). Dans ce cas, nettoyer les NULL avant de rejouer ce down.
--
-- course_watch_logs n'ayant pas ete modifie par le up, rien a retablir ici.

BEGIN;

-- §1.4 — Attestations : SET NULL -> CASCADE + user_id NOT NULL
ALTER TABLE public.user_attestations DROP CONSTRAINT user_attestations_user_id_fkey;
ALTER TABLE public.user_attestations ADD CONSTRAINT user_attestations_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.user_attestations ALTER COLUMN user_id SET NOT NULL;

-- news_episodes.validated_by : retirer la FK ajoutee
ALTER TABLE public.news_episodes DROP CONSTRAINT news_episodes_validated_by_fkey;

-- admin_user_id : SET NULL -> RESTRICT + NOT NULL
ALTER TABLE public.satisfaction_admin_views DROP CONSTRAINT satisfaction_admin_views_admin_user_id_fkey;
ALTER TABLE public.satisfaction_admin_views ADD CONSTRAINT satisfaction_admin_views_admin_user_id_fkey
  FOREIGN KEY (admin_user_id) REFERENCES auth.users(id) ON DELETE RESTRICT;
ALTER TABLE public.satisfaction_admin_views ALTER COLUMN admin_user_id SET NOT NULL;

-- triggered_by : SET NULL -> NO ACTION + NOT NULL
ALTER TABLE public.audio_generation_jobs DROP CONSTRAINT audio_generation_jobs_triggered_by_fkey;
ALTER TABLE public.audio_generation_jobs ADD CONSTRAINT audio_generation_jobs_triggered_by_fkey
  FOREIGN KEY (triggered_by) REFERENCES auth.users(id) ON DELETE NO ACTION;
ALTER TABLE public.audio_generation_jobs ALTER COLUMN triggered_by SET NOT NULL;

-- Acteurs : SET NULL -> NO ACTION
ALTER TABLE public.organization_members DROP CONSTRAINT organization_members_manager_id_fkey;
ALTER TABLE public.organization_members ADD CONSTRAINT organization_members_manager_id_fkey
  FOREIGN KEY (manager_id) REFERENCES auth.users(id) ON DELETE NO ACTION;

ALTER TABLE public.live_sessions DROP CONSTRAINT live_sessions_reviewed_by_fkey;
ALTER TABLE public.live_sessions ADD CONSTRAINT live_sessions_reviewed_by_fkey
  FOREIGN KEY (reviewed_by) REFERENCES auth.users(id) ON DELETE NO ACTION;

ALTER TABLE public.formation_instructors DROP CONSTRAINT formation_instructors_assigned_by_fkey;
ALTER TABLE public.formation_instructors ADD CONSTRAINT formation_instructors_assigned_by_fkey
  FOREIGN KEY (assigned_by) REFERENCES auth.users(id) ON DELETE NO ACTION;

-- Blocage principal : CASCADE -> NO ACTION
ALTER TABLE public.user_profiles DROP CONSTRAINT user_profiles_id_fkey;
ALTER TABLE public.user_profiles ADD CONSTRAINT user_profiles_id_fkey
  FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE NO ACTION;

COMMIT;
