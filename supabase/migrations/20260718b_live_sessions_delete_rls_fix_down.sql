-- Rollback de 20260718b_live_sessions_delete_rls_fix.sql
-- Restaure les policies SELECT/UPDATE telles qu'avant (bug de suppression
-- réintroduit) -- à ne faire qu'en cas de rollback complet.

drop policy if exists live_sessions_select on public.live_sessions;
create policy live_sessions_select
  on public.live_sessions
  for select
  to public
  using (
    (deleted_at is null)
    and (
      (is_published = true)
      or (formateur_user_id = auth.uid())
      or is_super_admin(auth.uid())
    )
  );

drop policy if exists live_sessions_update on public.live_sessions;
create policy live_sessions_update
  on public.live_sessions
  for update
  to public
  using (
    deleted_at is null
    and (formateur_user_id = auth.uid() or is_super_admin(auth.uid()))
  );
