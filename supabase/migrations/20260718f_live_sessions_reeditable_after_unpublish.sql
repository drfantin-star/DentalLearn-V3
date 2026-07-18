-- Règle 1A : une masterclass approuvée puis dépubliée reste modifiable par
-- son auteur formateur (au lieu d'être verrouillée sans issue). Toute
-- modification de contenu la repasse automatiquement en `draft` (awaiting,
-- reviewed_by, reviewed_at, review_comment remis à NULL) -> resoumission et
-- revalidation obligatoires avant republication. L'invariant de publication
-- (is_published => approved, cf. live_sessions_enforce_publish_approval)
-- reste intact et indépendant de ce trigger.
--
-- Portée volontairement restreinte à created_by_role = 'formateur' : pour
-- une session admin-authored, l'auteur est l'admin, qui bypass déjà
-- totalement ce trigger (branche is_super_admin en tête, inchangée).
--
-- NB : `category` (ajoutée en 20260718d) manquait de la comparaison de
-- contenu du trigger d'origine -- corrigé ici au passage (une édition de
-- la seule thématique n'était pas verrouillée hors draft/rejected).

create or replace function public.live_sessions_enforce_content_lock()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_content_changed boolean;
begin
  if public.is_super_admin(auth.uid()) then
    return new;
  end if;

  v_content_changed := (
    new.title is distinct from old.title
    or new.description is distinct from old.description
    or new.starts_at is distinct from old.starts_at
    or new.duration_min is distinct from old.duration_min
    or new.zoom_url is distinct from old.zoom_url
    or new.zoom_password is distinct from old.zoom_password
    or new.capacity is distinct from old.capacity
    or new.formation_id is distinct from old.formation_id
    or new.category is distinct from old.category
  );

  if not v_content_changed then
    return new;
  end if;

  if old.review_status in ('draft', 'rejected') then
    return new;
  end if;

  if old.review_status = 'approved'
     and old.is_published = false
     and old.created_by_role = 'formateur'
     and old.formateur_user_id = auth.uid()
  then
    new.review_status := 'draft';
    new.awaiting := null;
    new.reviewed_by := null;
    new.reviewed_at := null;
    new.review_comment := null;
    return new;
  end if;

  raise exception 'Modification impossible : masterclass hors brouillon/refusée (review_status=%).', old.review_status
    using errcode = '23514';
end;
$$;
