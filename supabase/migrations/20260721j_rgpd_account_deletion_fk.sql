-- Migration A — RGPD suppression de compte : debloquer DELETE FROM auth.users
--
-- Contexte : aujourd'hui DELETE FROM auth.users echoue a cause de FK en
-- NO ACTION / RESTRICT. Cette migration ne touche QUE les contraintes qui
-- bloquent la suppression, plus les attestations (a conserver).
--
-- Decisions Julie :
--  - Pas d'ajout de FK sur les 11 tables "donnees praticien" : elles sont
--    deja ON DELETE CASCADE vers public.user_profiles, la cascade passe donc
--    automatiquement des que user_profiles.id -> auth.users est en CASCADE.
--  - course_watch_logs : NON MODIFIE (reste CASCADE + NOT NULL). La preuve
--    DPC/Qualiopi est portee par l'attestation, pas par les traces brutes.
--  - Attestations conservees : user_attestations.user_id devient nullable et
--    sa FK passe en SET NULL (le CASCADE actuel detruirait l'attestation ET
--    sa ligne miroir user_attestation_verifications).
--  - Pas de garde-fou formateur (efface son contenu publie).
--  - organizations.owner_user_id : NON TOUCHE (garde-fou owner gere par la
--    fonction delete_user_data, migration B).
--
-- Orphelins verifies = 0 sur toutes les tables concernees : aucune purge
-- prealable requise, les ADD CONSTRAINT passent proprement.

BEGIN;

-- §1.3 — Bloqueurs directs de DELETE FROM auth.users

-- Blocage principal : le profil part avec le compte
ALTER TABLE public.user_profiles DROP CONSTRAINT user_profiles_id_fkey;
ALTER TABLE public.user_profiles ADD CONSTRAINT user_profiles_id_fkey
  FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- Acteurs (qui a valide / assigne / gere) : on efface le lien, pas l'objet
ALTER TABLE public.formation_instructors DROP CONSTRAINT formation_instructors_assigned_by_fkey;
ALTER TABLE public.formation_instructors ADD CONSTRAINT formation_instructors_assigned_by_fkey
  FOREIGN KEY (assigned_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.live_sessions DROP CONSTRAINT live_sessions_reviewed_by_fkey;
ALTER TABLE public.live_sessions ADD CONSTRAINT live_sessions_reviewed_by_fkey
  FOREIGN KEY (reviewed_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.organization_members DROP CONSTRAINT organization_members_manager_id_fkey;
ALTER TABLE public.organization_members ADD CONSTRAINT organization_members_manager_id_fkey
  FOREIGN KEY (manager_id) REFERENCES auth.users(id) ON DELETE SET NULL;

-- triggered_by : NOT NULL -> nullable puis SET NULL
ALTER TABLE public.audio_generation_jobs ALTER COLUMN triggered_by DROP NOT NULL;
ALTER TABLE public.audio_generation_jobs DROP CONSTRAINT audio_generation_jobs_triggered_by_fkey;
ALTER TABLE public.audio_generation_jobs ADD CONSTRAINT audio_generation_jobs_triggered_by_fkey
  FOREIGN KEY (triggered_by) REFERENCES auth.users(id) ON DELETE SET NULL;

-- admin_user_id : NOT NULL + RESTRICT -> nullable puis SET NULL
ALTER TABLE public.satisfaction_admin_views ALTER COLUMN admin_user_id DROP NOT NULL;
ALTER TABLE public.satisfaction_admin_views DROP CONSTRAINT satisfaction_admin_views_admin_user_id_fkey;
ALTER TABLE public.satisfaction_admin_views ADD CONSTRAINT satisfaction_admin_views_admin_user_id_fkey
  FOREIGN KEY (admin_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

-- news_episodes.validated_by : aucune FK aujourd'hui -> SET NULL
ALTER TABLE public.news_episodes ADD CONSTRAINT news_episodes_validated_by_fkey
  FOREIGN KEY (validated_by) REFERENCES auth.users(id) ON DELETE SET NULL;

-- §1.4 — Attestations conservees : CASCADE -> SET NULL + user_id nullable
ALTER TABLE public.user_attestations ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE public.user_attestations DROP CONSTRAINT user_attestations_user_id_fkey;
ALTER TABLE public.user_attestations ADD CONSTRAINT user_attestations_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

COMMIT;
