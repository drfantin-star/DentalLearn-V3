-- Règle de publication : seul l'AUTEUR de la proposition (created_by_role)
-- peut publier une masterclass approuvée, pas la partie qui a juste validé.
--   - created_by_role = 'formateur' -> seul ce formateur peut publier.
--   - created_by_role = 'admin'     -> seul un superadmin peut publier.
-- Verrouillé côté DB (trigger), pas seulement côté UI : tient même en
-- écriture directe. Ne s'applique qu'à la transition is_published
-- false -> true (dépublier reste ouvert aux deux parties, cf. ticket).

create or replace function public.live_sessions_enforce_publish_approval()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.is_published and new.review_status <> 'approved' then
    raise exception 'Publication refusée : la masterclass "%" n''est pas approuvée (review_status=%).', new.title, new.review_status
      using errcode = '23514';
  end if;

  if tg_op = 'UPDATE' and new.is_published and (old.is_published is distinct from new.is_published) then
    if new.created_by_role = 'formateur' and auth.uid() is distinct from new.formateur_user_id then
      raise exception 'Seul le formateur auteur de cette masterclass peut la publier.'
        using errcode = '42501';
    elsif new.created_by_role = 'admin' and not public.is_super_admin(auth.uid()) then
      raise exception 'Seul un administrateur peut publier cette masterclass (proposée par l''administration).'
        using errcode = '42501';
    end if;
  end if;

  return new;
end;
$$;
