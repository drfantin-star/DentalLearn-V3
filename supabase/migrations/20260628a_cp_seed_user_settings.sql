insert into cp_user_settings (user_id, cp_start_date, cp_duration_years, cp_end_date)
select up.id,
       up.ordre_inscription_date,
       6,
       (up.ordre_inscription_date + interval '6 years')::date
from user_profiles up
where up.ordre_inscription_date is not null
  and not exists (select 1 from cp_user_settings s where s.user_id = up.id);
