-- Rollback T4 Sprint 2 : suppression soft-delete live_events

-- Restaurer RLS DELETE originale (formateur owner + super_admin)
DROP POLICY IF EXISTS live_events_delete ON live_events;
CREATE POLICY live_events_delete ON live_events
  FOR DELETE USING ((formateur_user_id = auth.uid()) OR is_super_admin(auth.uid()));

-- Restaurer RLS SELECT originale (sans filtre deleted_at)
DROP POLICY IF EXISTS live_events_select ON live_events;
CREATE POLICY live_events_select ON live_events
  FOR SELECT USING (
    (is_published = true) OR (formateur_user_id = auth.uid()) OR is_super_admin(auth.uid())
  );

DROP INDEX IF EXISTS live_events_not_deleted_idx;

ALTER TABLE live_events DROP COLUMN IF EXISTS deleted_at;
