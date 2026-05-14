-- T4 Sprint 2 : ajout soft-delete sur live_events
-- Décision produit D3 : deleted_at IS NOT NULL = supprimé (distinct de is_published=false = brouillon)

ALTER TABLE live_events ADD COLUMN deleted_at timestamptz;

-- Index partiel pour les requêtes formateur (accès à ses events non-deleted)
CREATE INDEX live_events_not_deleted_idx
  ON live_events(formateur_user_id)
  WHERE deleted_at IS NULL;

-- Mettre à jour RLS SELECT : exclure les rows deleted pour public + formateur (super_admin voit tout)
DROP POLICY IF EXISTS live_events_select ON live_events;
CREATE POLICY live_events_select ON live_events
  FOR SELECT USING (
    (deleted_at IS NULL AND (is_published = true OR formateur_user_id = auth.uid()))
    OR is_super_admin(auth.uid())
  );

-- Restreindre DELETE réel à super_admin uniquement
-- Les formateurs passent désormais par le soft-delete (UPDATE deleted_at) via l'API
DROP POLICY IF EXISTS live_events_delete ON live_events;
CREATE POLICY live_events_delete ON live_events
  FOR DELETE USING (is_super_admin(auth.uid()));
