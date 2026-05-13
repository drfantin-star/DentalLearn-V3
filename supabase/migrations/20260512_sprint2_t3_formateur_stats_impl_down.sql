-- Rollback de 20260512_sprint2_t3_formateur_stats_impl.sql
-- Restaure le body stub T1 (`SELECT '{}'::jsonb`). Signature inchangée.

CREATE OR REPLACE FUNCTION public.formateur_aggregated_stats(
  p_user_id   uuid,
  p_date_from date,
  p_date_to   date
)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT '{}'::jsonb;
$$;

REVOKE EXECUTE ON FUNCTION public.formateur_aggregated_stats(uuid, date, date)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.formateur_aggregated_stats(uuid, date, date)
  TO authenticated, service_role;
