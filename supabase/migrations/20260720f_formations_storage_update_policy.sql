-- Nom du fichier : 20260720f_formations_storage_update_policy.sql
-- Date de création : 2026-07-20
-- Ticket : correctif bug « Remplacer » fiche bibliographie (claude/formation-pdf-replace-button-pfoy31)
-- Description : Ajoute une policy UPDATE sur storage.objects pour le bucket
--               `formations`, réservée aux super-admins. Le bucket ne disposait
--               que de SELECT / INSERT / DELETE ; un `upsert` sur un chemin
--               existant (chemin fixe biblio/{formationId}.pdf) est traduit par
--               Storage en UPDATE, refusé faute de policy → le bouton
--               « Remplacer » échouait silencieusement (alert générique).
-- Rollback : supabase/migrations/20260720f_formations_storage_update_policy_down.sql
--
-- Note : is_super_admin(uuid) est SECURITY DEFINER (schéma public) et
-- exécutable par le rôle `authenticated`. Référence schéma-qualifiée pour ne
-- pas dépendre du search_path du schéma storage.
--
-- Les 3 policies existantes du bucket (SELECT / INSERT / DELETE) ne sont pas
-- touchées.

DROP POLICY IF EXISTS "Only admins can update formations" ON storage.objects;
CREATE POLICY "Only admins can update formations"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'formations'
    AND public.is_super_admin(auth.uid())
  )
  WITH CHECK (
    bucket_id = 'formations'
    AND public.is_super_admin(auth.uid())
  );

-- ============================================================================
-- Vérification (RUN SÉPARÉ)
-- ============================================================================
-- SELECT polname,
--        CASE polcmd WHEN 'r' THEN 'SELECT' WHEN 'a' THEN 'INSERT'
--             WHEN 'w' THEN 'UPDATE' WHEN 'd' THEN 'DELETE' END AS cmd
--   FROM pg_policy p
--   JOIN pg_class c ON c.oid = p.polrelid
--   JOIN pg_namespace n ON n.oid = c.relnamespace
--  WHERE c.relname = 'objects' AND n.nspname = 'storage'
--    AND polname ILIKE '%formations%'
--  ORDER BY cmd;
