update cp_user_settings s
set cp_start_date = greatest(up.ordre_inscription_date, date '2023-01-01'),
    cp_end_date   = (greatest(up.ordre_inscription_date, date '2023-01-01') + interval '6 years')::date
from user_profiles up
where up.id = s.user_id
  and up.ordre_inscription_date is not null
  and s.cp_start_date < date '2023-01-01';
