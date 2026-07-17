drop trigger if exists trg_cp_action_on_autoeval on public.autoeval_completions;
drop function if exists public.cp_action_from_autoeval();
delete from public.cp_actions where source in ('backfill_autoeval', 'trigger_autoeval');
