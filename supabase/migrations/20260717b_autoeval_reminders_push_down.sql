-- Rollback : restaure send_autoeval_reminders tel qu'il était avant l'ajout
-- du relais push (supabase/migrations/20260716f_autoeval_reminders.sql).
create or replace function public.send_autoeval_reminders(p_wave text)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_year int := extract(year from current_date)::int;
  v_count int;
  v_msg text;
begin
  if p_wave not in ('oct', 'dec') then
    raise exception 'wave invalide: %', p_wave;
  end if;

  v_msg := case when p_wave = 'oct'
    then 'Avez-vous pensé à votre auto-évaluation santé cette année ? Prenez un moment pour faire le point sur votre bien-être — c''est pour vous, et personne d''autre.'
    else 'Il vous reste un peu de temps pour votre auto-évaluation santé de l''année. Quelques minutes au calme, quand vous le souhaitez.'
  end;

  insert into notifications (user_id, type, title, message, status, sent_at, metadata)
  select s.user_id, 'in_app', 'Un moment pour vous', v_msg, 'sent', now(),
         jsonb_build_object('kind', 'autoeval_reminder', 'year', v_year, 'wave', p_wave, 'href', '/sante/auto-evaluation')
  from cp_user_settings s
  where coalesce(s.notifications_enabled, true)
    and s.cp_end_date > current_date
    and not exists (
      select 1 from cp_actions ca
      where ca.user_id = s.user_id
        and ca.action_type = 'auto_evaluation'
        and extract(year from ca.validation_date) = v_year
    )
    and not exists (
      select 1 from notifications n
      where n.user_id = s.user_id
        and n.metadata->>'kind' = 'autoeval_reminder'
        and (n.metadata->>'year')::int = v_year
        and n.metadata->>'wave' = p_wave
    );

  get diagnostics v_count = row_count;
  return v_count;
end $$;
