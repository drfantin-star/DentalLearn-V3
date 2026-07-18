-- Rollback de 20260718f_live_sessions_reeditable_after_unpublish.sql

create or replace function public.live_sessions_enforce_content_lock()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if public.is_super_admin(auth.uid()) then
    return new;
  end if;

  if old.review_status not in ('draft', 'rejected') then
    if new.title is distinct from old.title
      or new.description is distinct from old.description
      or new.starts_at is distinct from old.starts_at
      or new.duration_min is distinct from old.duration_min
      or new.zoom_url is distinct from old.zoom_url
      or new.zoom_password is distinct from old.zoom_password
      or new.capacity is distinct from old.capacity
      or new.formation_id is distinct from old.formation_id
    then
      raise exception 'Modification impossible : masterclass hors brouillon/refusée (review_status=%).', old.review_status
        using errcode = '23514';
    end if;
  end if;

  return new;
end;
$$;
