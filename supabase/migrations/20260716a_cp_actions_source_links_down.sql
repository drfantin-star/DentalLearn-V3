drop index if exists public.idx_cp_actions_epp_audit;
drop index if exists public.idx_cp_actions_attestation;
alter table public.cp_actions
  drop column if exists epp_audit_id,
  drop column if exists attestation_id;
