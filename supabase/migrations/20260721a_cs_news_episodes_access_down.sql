-- 20260721a_cs_news_episodes_access_down.sql — rollback de
-- 20260721a_cs_news_episodes_access.sql.
--
-- Restaure exactement l'état antérieur :
--   - supprime la policy de lecture CS sur news_episodes ;
--   - restaure `editorial_validations_cs_insert` dans sa définition d'origine
--     (20260720a_cs_space_v1.sql), SANS la condition `is_lead = true`.
-- N'affecte aucune donnée des lignes editorial_validations existantes.

-- Retrait 2A : lecture des épisodes par un membre CS.
DROP POLICY IF EXISTS news_episodes_cs_read ON public.news_episodes;

-- Retrait 11A : restauration de la policy d'INSERT d'origine (sans is_lead).
DROP POLICY IF EXISTS editorial_validations_cs_insert ON public.editorial_validations;
CREATE POLICY editorial_validations_cs_insert
  ON public.editorial_validations
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (public.is_cs_member(auth.uid()) OR public.is_super_admin(auth.uid()))
    AND validated_by_lead IN (
      SELECT m.id
      FROM public.cs_members m
      WHERE m.user_id = auth.uid() AND m.active = true
    )
  );
