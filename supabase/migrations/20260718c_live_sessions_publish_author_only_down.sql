-- Rollback de 20260718c_live_sessions_publish_author_only.sql

create or replace function public.live_sessions_enforce_publish_approval()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.is_published and new.review_status <> 'approved' then
    raise exception 'Publication refusée : la masterclass "%" n''est pas approuvée (review_status=%).', new.title, new.review_status
      using errcode = '23514';
  end if;
  return new;
end;
$$;
