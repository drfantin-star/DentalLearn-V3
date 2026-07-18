-- Rollback de 20260718a_masterclass_review_workflow.sql

drop function if exists public.admin_propose_live_session(uuid, varchar, text, timestamptz, integer, text, varchar, integer, uuid);
drop function if exists public.review_live_session(uuid, varchar, text);
drop function if exists public.submit_live_session_for_review(uuid);

drop trigger if exists live_sessions_content_lock on public.live_sessions;
drop function if exists public.live_sessions_enforce_content_lock();

drop trigger if exists live_sessions_publish_guard on public.live_sessions;
drop function if exists public.live_sessions_enforce_publish_approval();

drop policy if exists live_sessions_delete on public.live_sessions;
create policy live_sessions_delete
  on public.live_sessions
  for delete
  to public
  using (
    (formateur_user_id = auth.uid())
    or is_super_admin(auth.uid())
  );

drop policy if exists live_sessions_insert on public.live_sessions;
create policy live_sessions_insert
  on public.live_sessions
  for insert
  to public
  with check (
    is_super_admin(auth.uid())
    or (formateur_user_id = auth.uid() and has_role(auth.uid(), 'formateur'::app_role))
  );

alter table public.live_sessions
  drop column if exists reviewed_at,
  drop column if exists reviewed_by,
  drop column if exists review_comment,
  drop column if exists awaiting,
  drop column if exists created_by_role,
  drop column if exists review_status;
