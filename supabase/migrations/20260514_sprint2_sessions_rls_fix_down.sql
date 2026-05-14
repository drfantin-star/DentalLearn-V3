-- Rollback T5 — Masterclass live : restauration RLS + suppression deleted_at

-- (4) Restaurer la policy DELETE live_registrations (super_admin uniquement)
DROP POLICY IF EXISTS live_registrations_delete ON public.live_registrations;
CREATE POLICY live_registrations_delete_super_admin ON public.live_registrations
  FOR DELETE USING (
    is_super_admin(auth.uid())
  );

-- (3) Restaurer la policy UPDATE live_sessions (sans filtre deleted_at)
DROP POLICY IF EXISTS live_sessions_update ON public.live_sessions;
CREATE POLICY live_sessions_update ON public.live_sessions
  FOR UPDATE USING (
    (formateur_user_id = auth.uid()) OR is_super_admin(auth.uid())
  );

-- (2) Restaurer la policy SELECT live_sessions (sans filtre deleted_at)
DROP POLICY IF EXISTS live_sessions_select ON public.live_sessions;
CREATE POLICY live_sessions_select ON public.live_sessions
  FOR SELECT USING (
    (is_published = true) OR
    (formateur_user_id = auth.uid()) OR
    is_super_admin(auth.uid())
  );

-- (1) Supprimer la colonne deleted_at
ALTER TABLE public.live_sessions DROP COLUMN IF EXISTS deleted_at;
