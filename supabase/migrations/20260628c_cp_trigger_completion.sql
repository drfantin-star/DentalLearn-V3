-- Remplace trg_sync_formation_cp (cassé : utilisait cp_axe_id non alimenté)
-- par un trigger aligné sur axe_cp (même colonne que le backfill et get_user_cp_progress).
drop trigger if exists trg_sync_formation_cp on user_formations;
drop function if exists public.sync_formation_to_cp_action();

create or replace function public.cp_action_from_formation_completion()
returns trigger language plpgsql security definer as $$
begin
  if NEW.completed_at is not null and OLD.completed_at is null then
    insert into cp_actions (user_id, axe_id, action_type, title, validation_date,
                            formation_id, user_formation_id, is_external, source)
    select NEW.user_id, f.axe_cp, 'formation_interne'::cp_action_type, f.title,
           NEW.completed_at::date, f.id, NEW.id, false, 'formation_completion'
    from formations f
    where f.id = NEW.formation_id
      and f.axe_cp is not null
      and not exists (select 1 from cp_actions ca where ca.user_formation_id = NEW.id);
  end if;
  return NEW;
end $$;

drop trigger if exists trg_cp_action_on_completion on user_formations;
create trigger trg_cp_action_on_completion
after update of completed_at on user_formations
for each row execute function public.cp_action_from_formation_completion();
