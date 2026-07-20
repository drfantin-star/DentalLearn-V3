-- 20260720a_cs_space_v1_down.sql — rollback de 20260720a_cs_space_v1.sql.
-- N'affecte aucune donnée des lignes editorial_validations existantes.

DROP FUNCTION IF EXISTS public.add_secondary_validation(uuid, text);

DROP POLICY IF EXISTS editorial_validations_cs_insert ON public.editorial_validations;
DROP POLICY IF EXISTS editorial_validations_cs_read ON public.editorial_validations;

DROP FUNCTION IF EXISTS public.is_cs_member(uuid);
