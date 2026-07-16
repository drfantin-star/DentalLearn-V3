drop trigger if exists trg_cp_action_on_attestation on public.user_attestations;
drop function if exists public.cp_action_from_attestation();
delete from public.cp_actions where source in ('backfill_attestation', 'trigger_attestation');
