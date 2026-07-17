-- Corrige les périodes CP selon la règle référentiel (dérogation 9 ans si
-- inscription < 2023, sinon 6 ans). Idempotent (ne touche que l'incohérent).
-- Le seed 20260628a codait 6 ans en dur pour tout le monde ; la fonction
-- create_cp_settings_for_user avait déjà la bonne règle mais n'était appelée
-- par aucun trigger — le seed réel passait par 20260628a + le lazy-seed client.
update cp_user_settings s
set installation_date = up.ordre_inscription_date,
    cp_start_date     = case when up.ordre_inscription_date < date '2023-01-01' then date '2023-01-01'
                             else up.ordre_inscription_date end,
    cp_duration_years = case when up.ordre_inscription_date < date '2023-01-01' then 9 else 6 end,
    cp_end_date       = case when up.ordre_inscription_date < date '2023-01-01' then date '2032-01-01'
                             else (up.ordre_inscription_date + interval '6 years')::date end,
    updated_at = now()
from user_profiles up
where up.id = s.user_id
  and up.ordre_inscription_date is not null
  and (s.cp_duration_years is distinct from (case when up.ordre_inscription_date < date '2023-01-01' then 9 else 6 end)
    or s.cp_end_date is distinct from (case when up.ordre_inscription_date < date '2023-01-01' then date '2032-01-01' else (up.ordre_inscription_date + interval '6 years')::date end)
    or s.cp_start_date is distinct from (case when up.ordre_inscription_date < date '2023-01-01' then date '2023-01-01' else up.ordre_inscription_date end));
