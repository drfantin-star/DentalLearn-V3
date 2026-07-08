-- Classement « à vie » (cumul total) — calqué sur get_weekly_quiz_leaderboard
-- sans le filtre de semaine. Colonne de points renommée total_points.
CREATE OR REPLACE FUNCTION public.get_lifetime_leaderboard(p_user_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(user_id uuid, full_name text, avatar_url text, total_points bigint,
               rank bigint, is_current_user boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  RETURN QUERY
  WITH ranked AS (
    SELECT
      dqr.user_id,
      CONCAT(up.first_name, ' ', up.last_name)::text as full_name,
      up.profile_photo_url as avatar_url,
      SUM(dqr.total_points)::bigint as total_points,
      ROW_NUMBER() OVER (ORDER BY SUM(dqr.total_points) DESC) as rank
    FROM daily_quiz_results dqr
    JOIN user_profiles up ON up.id = dqr.user_id
    WHERE dqr.completed_at IS NOT NULL
    GROUP BY dqr.user_id, up.first_name, up.last_name, up.profile_photo_url
  )
  SELECT
    r.user_id,
    r.full_name,
    r.avatar_url,
    r.total_points,
    r.rank,
    (r.user_id = p_user_id) as is_current_user
  FROM ranked r
  WHERE r.rank <= 10 OR r.user_id = p_user_id
  ORDER BY r.rank;
END;
$function$;
