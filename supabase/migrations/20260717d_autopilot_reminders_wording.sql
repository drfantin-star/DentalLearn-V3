-- Correction de formulation du message cloche (in-app) du rappel Autopilot :
-- "ton plan Sophie" -> "ton plan proposé par Sophie". Modification du texte
-- uniquement, logique d'éligibilité/dédup et relais push inchangés.
create or replace function public.send_autopilot_reminders(p_wave text)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_month text := to_char(current_date, 'YYYY-MM');
  v_count int;
  v_ids uuid[];
begin
  if p_wave not in ('mid', 'end') then
    raise exception 'wave invalide: %', p_wave;
  end if;

  with eligible as (
    select ap.user_id, count(*) as todo_count
    from autopilot_plan ap
    where ap.month_key = v_month and ap.status = 'todo'
    group by ap.user_id
  ),
  filtered as (
    select e.user_id, e.todo_count
    from eligible e
    where not exists (
      select 1 from notifications n
      where n.user_id = e.user_id
        and n.metadata->>'kind' = 'autopilot_reminder'
        and n.metadata->>'month_key' = v_month
        and n.metadata->>'wave' = p_wave
    )
  ),
  ins as (
    insert into notifications (user_id, type, title, message, status, sent_at, metadata)
    select
      f.user_id,
      'in_app',
      'Ton plan du mois t''attend',
      'Il te reste ' || f.todo_count || ' action' || (case when f.todo_count > 1 then 's' else '' end)
        || ' prévue' || (case when f.todo_count > 1 then 's' else '' end)
        || ' ce mois-ci dans ton plan proposé par Sophie. Quelques minutes suffisent pour avancer.',
      'sent',
      now(),
      jsonb_build_object('kind', 'autopilot_reminder', 'month_key', v_month, 'wave', p_wave, 'href', '/', 'todo_count', f.todo_count)
    from filtered f
    returning id
  )
  select array_agg(id) into v_ids from ins;

  v_count := coalesce(array_length(v_ids, 1), 0);

  if v_count > 0 then
    perform net.http_post(
      url     := 'https://dxybsuhfkwuemapqrvgz.supabase.co/functions/v1/send-reminder-push',
      headers := jsonb_build_object(
        'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR4eWJzdWhma3d1ZW1hcHFydmd6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2Mzc0Mzc2NywiZXhwIjoyMDc5MzE5NzY3fQ.k6FwWR5kdkblP2dDoNjDBZMAdwT41BJj35yXi0cLEI0',
        'Content-Type', 'application/json'
      ),
      body := jsonb_build_object('notification_ids', v_ids)
    );
  end if;

  return v_count;
end $$;
