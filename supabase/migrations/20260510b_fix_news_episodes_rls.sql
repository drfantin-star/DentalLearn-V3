-- ============================================================================
-- Ticket E Lot 2 fix-1 : RLS lecture admin sur news_episodes
-- ============================================================================
-- Bug : aucune policy SELECT pour authenticated sur news_episodes.
-- La page /admin/editorial-validations ne voyait aucun episode.
-- Fix additif : on autorise les super admins à lire toutes les lignes.
-- (La lecture côté user pour les news publiées sera traitée séparément
-- lors du Lot 3 ou d'un ticket dédié page user /news.)
-- ============================================================================

CREATE POLICY "news_episodes_admin_read_all"
  ON public.news_episodes
  FOR SELECT
  TO authenticated
  USING (public.is_super_admin(auth.uid()));
