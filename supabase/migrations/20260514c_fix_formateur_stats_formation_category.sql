-- Nom du fichier : 20260514c_fix_formateur_stats_formation_category.sql
-- Ticket : fix/formation-card-url — bug DTAX-02
-- Description : Ajoute `formation_category` (= formations.category) dans le
--               jsonb retourné par per_formation, nécessaire pour construire
--               l'URL correcte /formation/[category]?formation=[slug].
--               Toutes les autres agrégations sont inchangées.
-- Rollback : réappliquer 20260512_sprint2_t3_formateur_stats_impl.sql

CREATE OR REPLACE FUNCTION public.formateur_aggregated_stats(
  p_user_id   uuid,
  p_date_from date,
  p_date_to   date
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_result jsonb;
BEGIN
  IF v_caller IS NOT NULL
     AND p_user_id <> v_caller
     AND NOT public.is_super_admin(v_caller)
  THEN
    RAISE EXCEPTION 'Forbidden: cannot query stats for another user'
      USING ERRCODE = '42501';
  END IF;

  WITH formateur_formations AS (
    SELECT formation_id, is_primary
    FROM formation_instructors
    WHERE user_id = p_user_id
  ),
  inscrits_global AS (
    SELECT COUNT(DISTINCT uf.user_id) AS n
    FROM user_formations uf
    WHERE uf.formation_id IN (SELECT formation_id FROM formateur_formations)
  ),
  completion_global AS (
    SELECT
      COUNT(*) FILTER (WHERE uf.completed_at IS NOT NULL) AS completed,
      COUNT(*)                                            AS total
    FROM user_formations uf
    WHERE uf.formation_id IN (SELECT formation_id FROM formateur_formations)
      AND uf.started_at >= p_date_from
      AND uf.started_at <  p_date_to + interval '1 day'
  ),
  ecoutes_global AS (
    SELECT COUNT(*) AS n
    FROM course_watch_logs cwl
    JOIN sequences s ON s.id = cwl.sequence_id
    WHERE s.formation_id IN (SELECT formation_id FROM formateur_formations)
      AND cwl.started_at >= p_date_from
      AND cwl.started_at <  p_date_to + interval '1 day'
  ),
  points_global AS (
    SELECT COALESCE(SUM(up.points_earned), 0) AS total
    FROM user_points up
    JOIN sequences s ON s.id = up.sequence_id
    WHERE s.formation_id IN (SELECT formation_id FROM formateur_formations)
      AND up.created_at >= p_date_from
      AND up.created_at <  p_date_to + interval '1 day'
  ),
  per_formation AS (
    SELECT
      f.id              AS formation_id,
      f.title           AS formation_title,
      f.slug            AS formation_slug,
      f.category        AS formation_category,
      f.cover_image_url AS formation_cover,
      ff.is_primary     AS is_primary,
      (SELECT COUNT(DISTINCT uf.user_id)
         FROM user_formations uf
         WHERE uf.formation_id = f.id) AS inscrits,
      (SELECT
         CASE
           WHEN COUNT(*) < 5 THEN NULL
           ELSE ROUND(
             100.0 * COUNT(*) FILTER (WHERE uf.completed_at IS NOT NULL)
                   / NULLIF(COUNT(*), 0)
           , 1)
         END
         FROM user_formations uf
         WHERE uf.formation_id = f.id
           AND uf.started_at >= p_date_from
           AND uf.started_at <  p_date_to + interval '1 day') AS completion_rate,
      (SELECT COUNT(*)
         FROM course_watch_logs cwl
         JOIN sequences s ON s.id = cwl.sequence_id
         WHERE s.formation_id = f.id
           AND cwl.started_at >= p_date_from
           AND cwl.started_at <  p_date_to + interval '1 day') AS ecoutes,
      (SELECT COALESCE(SUM(up.points_earned), 0)
         FROM user_points up
         JOIN sequences s ON s.id = up.sequence_id
         WHERE s.formation_id = f.id
           AND up.created_at >= p_date_from
           AND up.created_at <  p_date_to + interval '1 day') AS points_distribues
    FROM formations f
    JOIN formateur_formations ff ON ff.formation_id = f.id
  )
  SELECT jsonb_build_object(
    'period', jsonb_build_object(
      'date_from', to_char(p_date_from, 'YYYY-MM-DD'),
      'date_to',   to_char(p_date_to,   'YYYY-MM-DD')
    ),
    'global', jsonb_build_object(
      'inscrits_total',     (SELECT n FROM inscrits_global),
      'completion_rate',
        CASE
          WHEN (SELECT total FROM completion_global) < 5 THEN NULL
          ELSE ROUND(
            100.0 * (SELECT completed FROM completion_global)
                  / NULLIF((SELECT total FROM completion_global), 0)
          , 1)
        END,
      'ecoutes_audio',      (SELECT n     FROM ecoutes_global),
      'points_distribues',  (SELECT total FROM points_global)
    ),
    'per_formation', COALESCE(
      (SELECT jsonb_agg(to_jsonb(pf.*) ORDER BY pf.formation_title)
         FROM per_formation pf),
      '[]'::jsonb
    ),
    'formations_count', (SELECT COUNT(*) FROM formateur_formations)
  )
  INTO v_result;

  RETURN v_result;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.formateur_aggregated_stats(uuid, date, date)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.formateur_aggregated_stats(uuid, date, date)
  TO authenticated, service_role;
