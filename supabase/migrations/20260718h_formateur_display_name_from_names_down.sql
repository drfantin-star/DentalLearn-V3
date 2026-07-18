-- Rollback best-effort de 20260718h : recalcule display_name depuis le
-- local-part de l'email (comportement historique auto-généré à la création).
-- Non réversible à l'identique si la valeur d'origine venait de
-- user_metadata.full_name plutôt que de l'email — cas non rencontré en base
-- au moment de cette migration (un seul compte formateur, vérifié dérivé de
-- l'email : "drfantin" pour drfantin@gmail.com).

update public.formateur_profiles fp
set display_name = split_part(au.email, '@', 1),
    updated_at = now()
from auth.users au, public.user_profiles up
where au.id = fp.user_id
  and up.id = fp.user_id
  and nullif(trim(up.first_name), '') is not null
  and nullif(trim(up.last_name), '') is not null;
