insert into cp_actions (user_id, axe_id, action_type, title, validation_date,
                        formation_id, user_formation_id, is_external, source)
select uf.user_id,
       f.axe_cp,
       'formation_interne'::cp_action_type,
       f.title,
       uf.completed_at::date,
       f.id,
       uf.id,
       false,
       'backfill_formation'
from user_formations uf
join formations f on f.id = uf.formation_id
where uf.completed_at is not null
  and f.axe_cp is not null
  and not exists (select 1 from cp_actions ca where ca.user_formation_id = uf.id);
