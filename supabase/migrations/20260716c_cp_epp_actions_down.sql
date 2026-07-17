drop trigger if exists trg_cp_action_on_epp on public.user_epp_sessions;
drop function if exists public.cp_action_from_epp_session();
delete from public.cp_actions where source in ('backfill_epp', 'trigger_epp');
