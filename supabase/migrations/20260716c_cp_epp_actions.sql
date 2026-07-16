-- Source B : EPP (axe 2).
-- Méthodo HAS T1/T2 : l'EPP n'est validante CP qu'après le TOUR 2.
-- => on ne crée l'action CP qu'à la complétion du tour 2. Un tour 1 seul ne
-- compte pas. Dédup par audit (1 action / (user, epp_audit)).
create or replace function public.cp_action_from_epp_session()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if NEW.completed_at is not null
     and NEW.tour = 2
     and (TG_OP = 'INSERT' or OLD.completed_at is null)
     and not exists (
       select 1 from public.cp_actions ca
       where ca.user_id = NEW.user_id and ca.epp_audit_id = NEW.audit_id
     ) then
    insert into public.cp_actions
      (user_id, axe_id, action_type, title, validation_date, is_external, source, epp_audit_id)
    select NEW.user_id, 2, 'epp'::cp_action_type,
           coalesce(a.title, 'Audit clinique EPP'),
           NEW.completed_at::date, false, 'trigger_epp', NEW.audit_id
    from public.epp_audits a where a.id = NEW.audit_id;
  end if;
  return NEW;
end $$;

drop trigger if exists trg_cp_action_on_epp on public.user_epp_sessions;
create trigger trg_cp_action_on_epp
after insert or update of completed_at on public.user_epp_sessions
for each row execute function public.cp_action_from_epp_session();

-- Backfill idempotent : 1 action / (user, audit), seulement pour les tours 2 complétés.
insert into public.cp_actions
  (user_id, axe_id, action_type, title, validation_date, is_external, source, epp_audit_id)
select x.user_id, 2, 'epp'::cp_action_type, coalesce(x.title, 'Audit clinique EPP'),
       x.vdate, false, 'backfill_epp', x.audit_id
from (
  select distinct on (s.user_id, s.audit_id)
         s.user_id, s.audit_id, s.completed_at::date as vdate, a.title
  from public.user_epp_sessions s
  join public.epp_audits a on a.id = s.audit_id
  where s.completed_at is not null
    and s.tour = 2
  order by s.user_id, s.audit_id, s.completed_at
) x
where not exists (
  select 1 from public.cp_actions ca
  where ca.user_id = x.user_id and ca.epp_audit_id = x.audit_id
);
