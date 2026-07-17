-- Source C : attestations déclaratives (axe 3).
-- Seul le type déclaratif `action_cnp_info_patient` est traité : `formation_online`
-- (adossée à une formation, couverte par le trigger formation) et `epp` (couvert
-- par la source B) sont exclus pour éviter le double comptage.
-- action_type='autre' : aucune valeur d'enum ne colle (enum NON étendu).
-- is_external=false : sinon doublon d'affichage dans le modal « actions hors Certily »
-- qui filtre sur is_external=true. Dédup par ligne d'attestation.
create or replace function public.cp_action_from_attestation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if NEW.type = 'action_cnp_info_patient'
     and not exists (select 1 from public.cp_actions ca where ca.attestation_id = NEW.id) then
    insert into public.cp_actions
      (user_id, axe_id, action_type, title, validation_date, is_external, source, attestation_id)
    values (NEW.user_id, coalesce(NEW.axe_cp, 3), 'autre'::cp_action_type,
            NEW.title, NEW.completed_at, false, 'trigger_attestation', NEW.id);
  end if;
  return NEW;
end $$;

drop trigger if exists trg_cp_action_on_attestation on public.user_attestations;
create trigger trg_cp_action_on_attestation
after insert on public.user_attestations
for each row execute function public.cp_action_from_attestation();

-- Backfill idempotent : 1 action / attestation déclarative.
insert into public.cp_actions
  (user_id, axe_id, action_type, title, validation_date, is_external, source, attestation_id)
select at.user_id, coalesce(at.axe_cp, 3), 'autre'::cp_action_type,
       at.title, at.completed_at, false, 'backfill_attestation', at.id
from public.user_attestations at
where at.type = 'action_cnp_info_patient'
  and not exists (select 1 from public.cp_actions ca where ca.attestation_id = at.id);
