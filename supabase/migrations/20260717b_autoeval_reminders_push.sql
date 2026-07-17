-- Rappel push pour send_autoeval_reminders (en plus de la cloche in-app).
-- Modification STRICTEMENT ADDITIVE : la logique d'éligibilité et de dédup
-- (invariant protégé, cf. CLAUDE.md) ne change pas d'une virgule. Seul ajout :
-- capturer les ids insérés et appeler l'Edge Function send-reminder-push, qui
-- gère elle-même le filtrage par préférence (cp_reminders) et l'envoi push.
-- La cloche existe toujours AVANT le push (insert puis appel réseau).
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
  v_ids uuid[];
begin
  if p_wave not in ('oct', 'dec') then
    raise exception 'wave invalide: %', p_wave;
  end if;

  v_msg := case when p_wave = 'oct'
    then 'Avez-vous pensé à votre auto-évaluation santé cette année ? Prenez un moment pour faire le point sur votre bien-être — c''est pour vous, et personne d''autre.'
    else 'Il vous reste un peu de temps pour votre auto-évaluation santé de l''année. Quelques minutes au calme, quand vous le souhaitez.'
  end;

  with ins as (
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
      )
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
