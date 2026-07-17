-- Purge des notifications lues de plus de 90 jours. Les non-lues ne sont
-- jamais purgées, quel que soit leur âge. Même pattern que
-- send_autoeval_reminders : SECURITY DEFINER + search_path fixé.
create or replace function public.purge_old_notifications()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare v_count int;
begin
  delete from notifications
  where read_at is not null
    and read_at < now() - interval '90 days';
  get diagnostics v_count = row_count;
  return v_count;
end $$;

select cron.schedule('notifications_purge_monthly', '0 4 1 * *', $$select public.purge_old_notifications()$$);
