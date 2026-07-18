-- Workflow de validation croisée pour les masterclass (live_sessions) :
--   1. Formateur crée une masterclass -> superadmin approuve/refuse.
--   2. Superadmin propose une masterclass à un formateur -> il accepte/refuse.
-- Périmètre : live_sessions uniquement. live_events (dates présentielles) non concerné.

-- ─── Colonnes ────────────────────────────────────────────────────────────────

alter table public.live_sessions
  add column review_status varchar not null default 'draft',
  add column created_by_role varchar not null,
  add column awaiting varchar,
  add column review_comment text,
  add column reviewed_by uuid references auth.users(id),
  add column reviewed_at timestamptz;

alter table public.live_sessions
  add constraint live_sessions_review_status_check
    check (review_status in ('draft', 'pending_review', 'approved', 'rejected')),
  add constraint live_sessions_created_by_role_check
    check (created_by_role in ('formateur', 'admin')),
  add constraint live_sessions_awaiting_check
    check (awaiting in ('admin', 'formateur'));

-- ─── Invariant verrouillé côté DB : pas de publication sans approbation ──────
-- Tient même en écriture directe (SQL brut, service_role...), pas seulement via l'UI.

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
  return new;
end;
$$;

drop trigger if exists live_sessions_publish_guard on public.live_sessions;
create trigger live_sessions_publish_guard
  before insert or update on public.live_sessions
  for each row execute function public.live_sessions_enforce_publish_approval();

-- ─── Verrou contenu : édition uniquement en draft/rejected (hors super admin) ─

create or replace function public.live_sessions_enforce_content_lock()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if public.is_super_admin(auth.uid()) then
    return new;
  end if;

  if old.review_status not in ('draft', 'rejected') then
    if new.title is distinct from old.title
      or new.description is distinct from old.description
      or new.starts_at is distinct from old.starts_at
      or new.duration_min is distinct from old.duration_min
      or new.zoom_url is distinct from old.zoom_url
      or new.zoom_password is distinct from old.zoom_password
      or new.capacity is distinct from old.capacity
      or new.formation_id is distinct from old.formation_id
    then
      raise exception 'Modification impossible : masterclass hors brouillon/refusée (review_status=%).', old.review_status
        using errcode = '23514';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists live_sessions_content_lock on public.live_sessions;
create trigger live_sessions_content_lock
  before update on public.live_sessions
  for each row execute function public.live_sessions_enforce_content_lock();

-- ─── Colonnes de revue réservées aux RPC (SECURITY DEFINER) ──────────────────
-- L'INSERT reste possible (valeurs initiales) ; seul l'UPDATE direct est bloqué,
-- pour forcer toute transition d'état à passer par submit_live_session_for_review /
-- review_live_session / admin_propose_live_session.

revoke update (review_status, created_by_role, awaiting, review_comment, reviewed_by, reviewed_at)
  on public.live_sessions from authenticated;

-- ─── RLS : INSERT restreint au formateur créant son propre brouillon ─────────
-- Le superadmin passe désormais exclusivement par admin_propose_live_session
-- (SECURITY DEFINER, contourne la RLS), donc plus besoin d'un accès direct ici.

drop policy if exists live_sessions_insert on public.live_sessions;
create policy live_sessions_insert
  on public.live_sessions
  for insert
  to public
  with check (
    formateur_user_id = auth.uid()
    and has_role(auth.uid(), 'formateur'::app_role)
    and created_by_role = 'formateur'
    and review_status = 'draft'
    and awaiting is null
  );

-- ─── RLS : DELETE restreint aux sessions draft/rejected pour le formateur ────

drop policy if exists live_sessions_delete on public.live_sessions;
create policy live_sessions_delete
  on public.live_sessions
  for delete
  to public
  using (
    (formateur_user_id = auth.uid() and review_status in ('draft', 'rejected'))
    or is_super_admin(auth.uid())
  );

-- ─── RPC : formateur soumet son brouillon (ou sa masterclass refusée) ────────

create or replace function public.submit_live_session_for_review(p_session_id uuid)
returns public.live_sessions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_row public.live_sessions;
  v_author_label text;
begin
  if v_uid is null then
    raise exception 'Authentification requise';
  end if;

  select ls.* into v_row
  from public.live_sessions ls
  where ls.id = p_session_id and ls.deleted_at is null
  for update;

  if not found then
    raise exception 'Masterclass introuvable';
  end if;

  if v_row.created_by_role <> 'formateur' then
    raise exception 'Cette masterclass n''a pas été créée par un formateur';
  end if;

  if v_row.formateur_user_id <> v_uid then
    raise exception 'Non autorisé';
  end if;

  if v_row.review_status not in ('draft', 'rejected') then
    raise exception 'Statut invalide pour une soumission (review_status=%).', v_row.review_status;
  end if;

  update public.live_sessions
  set review_status = 'pending_review',
      awaiting = 'admin',
      review_comment = null,
      reviewed_by = null,
      reviewed_at = null,
      updated_at = now()
  where id = p_session_id
  returning * into v_row;

  select coalesce(nullif(trim(concat_ws(' ', up.first_name, up.last_name)), ''), 'Un formateur')
  into v_author_label
  from public.user_profiles up
  where up.id = v_uid;

  insert into public.notifications (user_id, type, title, message, status, sent_at, metadata)
  select ur.user_id, 'in_app', 'Masterclass à valider',
         format('%s a soumis la masterclass "%s" pour validation.', coalesce(v_author_label, 'Un formateur'), v_row.title),
         'sent', now(),
         jsonb_build_object('kind', 'masterclass_review_submitted', 'session_id', v_row.id::text, 'href', '/admin/masterclass')
  from public.user_roles ur
  where ur.role = 'super_admin'::app_role;

  return v_row;
end;
$$;

-- ─── RPC : validation croisée (admin sur soumission formateur, ou formateur
-- sur proposition admin), refus avec motif obligatoire ────────────────────────

create or replace function public.review_live_session(p_session_id uuid, p_decision varchar, p_comment text default null)
returns public.live_sessions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_row public.live_sessions;
  v_is_admin boolean;
begin
  if v_uid is null then
    raise exception 'Authentification requise';
  end if;

  if p_decision not in ('approved', 'rejected') then
    raise exception 'Décision invalide : %', p_decision;
  end if;

  if p_decision = 'rejected' and coalesce(trim(p_comment), '') = '' then
    raise exception 'Un motif de refus est obligatoire';
  end if;

  select ls.* into v_row
  from public.live_sessions ls
  where ls.id = p_session_id and ls.deleted_at is null
  for update;

  if not found then
    raise exception 'Masterclass introuvable';
  end if;

  if v_row.review_status <> 'pending_review' then
    raise exception 'Cette masterclass n''est pas en attente de validation (review_status=%).', v_row.review_status;
  end if;

  v_is_admin := public.is_super_admin(v_uid);

  if v_row.awaiting = 'admin' then
    if not v_is_admin then
      raise exception 'Seul un super administrateur peut valider cette masterclass';
    end if;
  elsif v_row.awaiting = 'formateur' then
    if v_row.formateur_user_id <> v_uid then
      raise exception 'Non autorisé';
    end if;
  else
    raise exception 'Aucune validation n''est attendue pour cette masterclass';
  end if;

  update public.live_sessions
  set review_status = p_decision,
      awaiting = null,
      review_comment = case when p_decision = 'rejected' then p_comment else null end,
      reviewed_by = v_uid,
      reviewed_at = now(),
      updated_at = now()
  where id = p_session_id
  returning * into v_row;

  if v_is_admin then
    -- Admin a tranché une soumission formateur -> notifier l'auteur.
    insert into public.notifications (user_id, type, title, message, status, sent_at, metadata)
    values (
      v_row.formateur_user_id, 'in_app',
      case when p_decision = 'approved' then 'Masterclass approuvée' else 'Masterclass refusée' end,
      case when p_decision = 'approved'
        then format('Votre masterclass "%s" a été approuvée. Vous pouvez la publier.', v_row.title)
        else format('Votre masterclass "%s" a été refusée. Motif : %s', v_row.title, p_comment)
      end,
      'sent', now(),
      jsonb_build_object('kind', 'masterclass_reviewed', 'session_id', v_row.id::text, 'decision', p_decision, 'href', '/formateur/sessions')
    );
  else
    -- Formateur a tranché une proposition admin -> notifier les super admins.
    insert into public.notifications (user_id, type, title, message, status, sent_at, metadata)
    select ur.user_id, 'in_app',
      case when p_decision = 'approved' then 'Proposition de masterclass acceptée' else 'Proposition de masterclass refusée' end,
      case when p_decision = 'approved'
        then format('La masterclass "%s" a été acceptée par le formateur.', v_row.title)
        else format('La masterclass "%s" a été refusée par le formateur. Motif : %s', v_row.title, p_comment)
      end,
      'sent', now(),
      jsonb_build_object('kind', 'masterclass_reviewed', 'session_id', v_row.id::text, 'decision', p_decision, 'href', '/admin/masterclass')
    from public.user_roles ur
    where ur.role = 'super_admin'::app_role;
  end if;

  return v_row;
end;
$$;

-- ─── RPC : superadmin crée une masterclass et la propose à un formateur ──────

create or replace function public.admin_propose_live_session(
  p_formateur_user_id uuid,
  p_title varchar,
  p_description text,
  p_starts_at timestamptz,
  p_duration_min integer,
  p_zoom_url text,
  p_zoom_password varchar,
  p_capacity integer,
  p_formation_id uuid
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
    zoom_url, zoom_password, capacity, created_by_role, review_status, awaiting
  )
  values (
    p_formateur_user_id, p_formation_id, p_title, p_description, p_starts_at, coalesce(p_duration_min, 60),
    nullif(p_zoom_url, ''), p_zoom_password, p_capacity, 'admin', 'pending_review', 'formateur'
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

-- ─── Grants : RPC réservées aux utilisateurs authentifiés (pas anon) ─────────
-- Le garde interne (auth.uid() is null -> exception) suffisait déjà ; ceci
-- retire aussi EXECUTE au niveau privilèges Postgres, en cohérence avec le
-- pattern déjà utilisé par update_sm2_state.

revoke execute on function public.submit_live_session_for_review(uuid) from public, anon;
revoke execute on function public.review_live_session(uuid, varchar, text) from public, anon;
revoke execute on function public.admin_propose_live_session(uuid, varchar, text, timestamptz, integer, text, varchar, integer, uuid) from public, anon;

grant execute on function public.submit_live_session_for_review(uuid) to authenticated;
grant execute on function public.review_live_session(uuid, varchar, text) to authenticated;
grant execute on function public.admin_propose_live_session(uuid, varchar, text, timestamptz, integer, text, varchar, integer, uuid) to authenticated;

-- TODO (hors scope de ce ticket) : dépublication automatique si une masterclass
-- déjà `approved` repasse en `pending_review` après une modification substantielle.
