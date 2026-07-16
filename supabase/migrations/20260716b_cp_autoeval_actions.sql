-- Source A : auto-évaluation santé (axe 4).
-- Une auto-éval = UNE action CP par année civile (Action B du référentiel,
-- annuelle) => dédup 2A sur (user_id, 'auto_evaluation', année de validation).
create or replace function public.cp_action_from_autoeval()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.cp_actions ca
    where ca.user_id = NEW.user_id
      and ca.action_type = 'auto_evaluation'
      and extract(year from ca.validation_date) = extract(year from NEW.completed_at)
  ) then
    insert into public.cp_actions
      (user_id, axe_id, action_type, title, validation_date, is_external, source)
    select NEW.user_id, 4, 'auto_evaluation'::cp_action_type,
           coalesce(q.titre, 'Auto-évaluation santé'),
           NEW.completed_at::date, false, 'trigger_autoeval'
    from (select NEW.questionnaire_id as qid) s
    left join public.questionnaires q on q.id = s.qid;
  end if;
  return NEW;
end $$;

drop trigger if exists trg_cp_action_on_autoeval on public.autoeval_completions;
create trigger trg_cp_action_on_autoeval
after insert on public.autoeval_completions
for each row execute function public.cp_action_from_autoeval();

-- Backfill idempotent + dédup 2A : 1 action / user / année civile.
-- DISTINCT ON retient la complétion la plus ancienne de l'année.
insert into public.cp_actions
  (user_id, axe_id, action_type, title, validation_date, is_external, source)
select x.user_id, 4, 'auto_evaluation'::cp_action_type,
       coalesce(x.titre, 'Auto-évaluation santé'), x.vdate, false, 'backfill_autoeval'
from (
  select distinct on (ac.user_id, extract(year from ac.completed_at))
         ac.user_id,
         ac.completed_at::date as vdate,
         q.titre,
         extract(year from ac.completed_at) as yr
  from public.autoeval_completions ac
  left join public.questionnaires q on q.id = ac.questionnaire_id
  order by ac.user_id, extract(year from ac.completed_at), ac.completed_at
) x
where not exists (
  select 1 from public.cp_actions ca
  where ca.user_id = x.user_id
    and ca.action_type = 'auto_evaluation'
    and extract(year from ca.validation_date) = x.yr
);
