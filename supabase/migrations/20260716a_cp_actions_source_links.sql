-- Colonnes de lien nullables pour rendre les backfills/triggers des nouvelles
-- sources cp_actions idempotents (dédup par audit EPP / par attestation).
-- N'affecte PAS la vue cp_user_progress (qui ne lit que count(*) par axe).
alter table public.cp_actions
  add column if not exists epp_audit_id   uuid references public.epp_audits(id),
  add column if not exists attestation_id uuid references public.user_attestations(id);

create index if not exists idx_cp_actions_epp_audit
  on public.cp_actions (user_id, epp_audit_id) where epp_audit_id is not null;
create index if not exists idx_cp_actions_attestation
  on public.cp_actions (attestation_id) where attestation_id is not null;
