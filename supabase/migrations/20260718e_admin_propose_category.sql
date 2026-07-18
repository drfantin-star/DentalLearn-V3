-- Ajoute le paramètre p_category (optionnel, trailing avec défaut NULL) à
-- admin_propose_live_session, pour que le superadmin puisse renseigner la
-- thématique d'une masterclass proposée dès sa création.
--
-- NB : CREATE OR REPLACE avec un paramètre supplémentaire (même optionnel)
-- ne remplace PAS la fonction en place, il crée un surcharge (overload) --
-- vérifié empiriquement. Drop explicite de l'ancienne signature d'abord.

drop function if exists public.admin_propose_live_session(uuid, varchar, text, timestamptz, integer, text, varchar, integer, uuid);

create or replace function public.admin_propose_live_session(
  p_formateur_user_id uuid,
  p_title varchar,
  p_description text,
  p_starts_at timestamptz,
  p_duration_min integer,
  p_zoom_url text,
  p_zoom_password varchar,
  p_capacity integer,
  p_formation_id uuid,
  p_category varchar default null
)
returns public.live_sessions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_row public.live_sessions;
begin
  if v_uid is null then
    raise exception 'Authentification requise';
  end if;

  if not public.is_super_admin(v_uid) then
    raise exception 'Non autorisé';
  end if;

  if not public.has_role(p_formateur_user_id, 'formateur'::app_role) then
    raise exception 'Le destinataire doit avoir le rôle formateur';
  end if;

  if coalesce(trim(p_title), '') = '' then
    raise exception 'Le titre est requis';
  end if;

  insert into public.live_sessions (
    formateur_user_id, formation_id, title, description, starts_at, duration_min,
    zoom_url, zoom_password, capacity, category, created_by_role, review_status, awaiting
  )
  values (
    p_formateur_user_id, p_formation_id, p_title, p_description, p_starts_at, coalesce(p_duration_min, 60),
    nullif(p_zoom_url, ''), p_zoom_password, p_capacity, p_category, 'admin', 'pending_review', 'formateur'
  )
  returning * into v_row;

  insert into public.notifications (user_id, type, title, message, status, sent_at, metadata)
  values (
    p_formateur_user_id, 'in_app', 'Nouvelle proposition de masterclass',
    format('Le super administrateur vous propose la masterclass "%s". Acceptez-la ou refusez-la.', v_row.title),
    'sent', now(),
    jsonb_build_object('kind', 'masterclass_proposed', 'session_id', v_row.id::text, 'href', '/formateur/sessions')
  );

  return v_row;
end;
$$;

revoke execute on function public.admin_propose_live_session(uuid, varchar, text, timestamptz, integer, text, varchar, integer, uuid, varchar) from public, anon;
grant execute on function public.admin_propose_live_session(uuid, varchar, text, timestamptz, integer, text, varchar, integer, uuid, varchar) to authenticated;
