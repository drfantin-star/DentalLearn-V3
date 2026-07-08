-- Restore original cp_start_date / cp_end_date from ordre_inscription_date for affected rows.
update cp_user_settings s
set cp_start_date = up.ordre_inscription_date,
    cp_end_date   = (up.ordre_inscription_date + interval '6 years')::date
from user_profiles up
where up.id = s.user_id
  and up.ordre_inscription_date is not null
  and up.ordre_inscription_date < date '2023-01-01'
  and s.cp_start_date = date '2023-01-01';
