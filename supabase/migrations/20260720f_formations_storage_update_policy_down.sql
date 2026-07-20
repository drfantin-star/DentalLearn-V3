-- Rollback de 20260720f_formations_storage_update_policy.sql
-- Retire la policy UPDATE super-admin sur le bucket `formations`.
-- Les policies SELECT / INSERT / DELETE existantes ne sont pas touchées.

DROP POLICY IF EXISTS "Only admins can update formations" ON storage.objects;
