-- Nom du fichier : 20260601a_user_profiles_interests.sql
-- Date de création : 2026-06-01
-- Description : Ajoute la colonne `interests` (jsonb, NULL par défaut) à
--               user_profiles, socle de la personnalisation « Pour vous » (PR1).
--                 - NULL          = utilisateur pas encore passé par l'onboarding
--                                   (servira au redirect en PR2).
--                 - Non-NULL      = a vu le questionnaire d'intérêts, même s'il l'a
--                                   skippé (forme : {"categories":[],"axes":[]}).
--               Forme applicative attendue (validée côté front en PR2, PAS de CHECK
--               DB en V1 pour rester souple) :
--                 { "categories": ["esthetique","endodontie","management"],
--                   "axes": [1,3,4] }
--               Index GIN pour le containment futur côté feed.
--               RLS : aucune nouvelle policy. Les policies SELECT/UPDATE self
--               existantes (« Users can view/update own profile », USING
--               auth.uid() = id) sont row-level et couvrent déjà cette colonne.
--               updated_at : trigger `update_user_profiles_updated_at` déjà présent,
--               non recréé.
-- Rollback : supabase/migrations/20260601a_user_profiles_interests_down.sql

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS interests jsonb;

COMMENT ON COLUMN public.user_profiles.interests IS
  'Centres d''intérêt déclarés (« Pour vous »). NULL = onboarding non fait. '
  'Non-NULL = questionnaire vu. Forme : {"categories":[slugs],"axes":[1..4]}. '
  'Validation applicative en PR2, pas de CHECK DB en V1.';

CREATE INDEX IF NOT EXISTS user_profiles_interests_idx
  ON public.user_profiles USING gin (interests);
