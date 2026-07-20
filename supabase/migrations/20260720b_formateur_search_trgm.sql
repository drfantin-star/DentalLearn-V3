-- Recherche formateur par nom + prénom + email (écran admin de promotion).
--
-- Contexte : l'écran /admin/formateurs/promote ne cherchait que par email
-- exact. Objectif : un seul champ, match email OR prénom OR nom, insensible
-- casse + accents, ILIKE %terme%, performant.
--
-- Colonnes first_name / last_name : DÉJÀ présentes sur user_profiles
-- (varchar NULL). Aucune migration de colonne — on réutilise l'existant.
--
-- L'email n'existe que dans auth.users (pas de colonne email dans
-- user_profiles). Une recherche unifiée email + nom/prénom impose donc de
-- lire auth.users : d'où la RPC SECURITY DEFINER ci-dessous.
--
-- NB : on ne peut pas indexer auth.users.email (table possédée par le rôle
-- supabase_auth_admin, pas par le rôle de migration → "must be owner").
-- L'ILIKE sur l'email reste donc un scan séquentiel — acceptable vu la
-- taille modeste de la base (cf. dette D-S1-T5-01 déjà documentée pour
-- listUsers). Les index trigram couvrent prénom + nom.

set local search_path = public, extensions;

-- 1. Extensions (schéma extensions, déjà dans le search_path du projet).
create extension if not exists pg_trgm with schema extensions;
create extension if not exists unaccent with schema extensions;

-- 2. Wrapper IMMUTABLE d'unaccent : unaccent() est seulement STABLE, on ne
--    peut donc pas l'indexer directement. La forme à deux arguments fige le
--    dictionnaire → l'expression devient déterministe et indexable.
create or replace function public.immutable_unaccent(text)
returns text
language sql
immutable
parallel safe
strict
as $func$
  select extensions.unaccent('extensions.unaccent', $1)
$func$;

-- 3. Index GIN trigram sur les colonnes recherchées (accent-insensibles).
create index if not exists idx_user_profiles_first_name_trgm
  on public.user_profiles
  using gin (public.immutable_unaccent(first_name) gin_trgm_ops);

create index if not exists idx_user_profiles_last_name_trgm
  on public.user_profiles
  using gin (public.immutable_unaccent(last_name) gin_trgm_ops);

-- 4. RPC de recherche. SECURITY DEFINER pour lire auth.users, mais garde
--    stricte is_super_admin(auth.uid()) en tête : rien n'est exposé à un
--    non super-admin. Retourne au plus 20 lignes, déclenchement >= 2 car.
create or replace function public.search_formateur_candidates(p_query text)
returns table (
  id uuid,
  email text,
  first_name text,
  last_name text,
  is_formateur boolean,
  formations_count integer
)
language plpgsql
security definer
set search_path = public, extensions
as $func$
declare
  v_term text := trim(coalesce(p_query, ''));
  v_pat  text;
begin
  if not public.is_super_admin(auth.uid()) then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  if length(v_term) < 2 then
    return;
  end if;

  v_pat := '%' || public.immutable_unaccent(v_term) || '%';

  return query
  select
    u.id,
    u.email::text,
    up.first_name::text,
    up.last_name::text,
    exists (
      select 1 from public.user_roles r
      where r.user_id = u.id and r.role = 'formateur'
    ) as is_formateur,
    (
      select count(*)::integer from public.formation_instructors fi
      where fi.user_id = u.id
    ) as formations_count
  from auth.users u
  left join public.user_profiles up on up.id = u.id
  where public.immutable_unaccent(u.email) ilike v_pat
     or public.immutable_unaccent(up.first_name) ilike v_pat
     or public.immutable_unaccent(up.last_name) ilike v_pat
  order by
    -- Nom/prénom renseignés d'abord, puis tri alpha stable.
    coalesce(up.last_name, up.first_name, u.email::text) asc
  limit 20;
end;
$func$;

revoke all on function public.search_formateur_candidates(text) from public, anon;
grant execute on function public.search_formateur_candidates(text) to authenticated, service_role;
