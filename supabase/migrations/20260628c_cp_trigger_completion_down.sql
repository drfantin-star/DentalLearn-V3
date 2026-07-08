drop trigger if exists trg_cp_action_on_completion on user_formations;
drop function if exists public.cp_action_from_formation_completion();
-- Note : sync_formation_to_cp_action() n'est pas restauré (il était cassé avant cette migration).
