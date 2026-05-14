-- T5 — Masterclass live : corrections RLS + ajout colonne deleted_at
-- (1) Ajouter deleted_at à live_sessions pour le soft delete
ALTER TABLE public.live_sessions ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

-- (2) Mettre à jour la policy SELECT live_sessions pour exclure les lignes soft-deleted
DROP POLICY IF EXISTS live_sessions_select ON public.live_sessions;
CREATE POLICY live_sessions_select ON public.live_sessions
  FOR SELECT USING (
    (deleted_at IS NULL) AND (
      (is_published = true) OR
      (formateur_user_id = auth.uid()) OR
      is_super_admin(auth.uid())
    )
  );

-- (3) Mettre à jour la policy UPDATE live_sessions pour exclure les lignes soft-deleted
DROP POLICY IF EXISTS live_sessions_update ON public.live_sessions;
CREATE POLICY live_sessions_update ON public.live_sessions
  FOR UPDATE USING (
    (deleted_at IS NULL) AND (
      (formateur_user_id = auth.uid()) OR
      is_super_admin(auth.uid())
    )
  );

-- (4) Corriger la policy DELETE live_registrations : autoriser le propriétaire à supprimer sa propre inscription
DROP POLICY IF EXISTS live_registrations_delete_super_admin ON public.live_registrations;
CREATE POLICY live_registrations_delete ON public.live_registrations
  FOR DELETE USING (
    (auth.uid() = user_id) OR is_super_admin(auth.uid())
  );
