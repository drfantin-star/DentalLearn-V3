-- Waitlist Certily (fermeture des inscriptions publiques, cf. feat/refonte-certily).
-- Le formulaire public /register enregistre desormais un email + consentement RGPD
-- au lieu de creer un compte. Aucune creation de compte ici : simple capture de lead.
create table if not exists public.waitlist (
  id         uuid primary key default gen_random_uuid(),
  email      text not null unique,
  consent    boolean not null,
  source     text,
  created_at timestamptz not null default now()
);

comment on table public.waitlist is
  'Liste d attente beta Certily. Email + consentement RGPD captures via le formulaire public /register (aucun compte cree). Lecture reservee super_admin.';

alter table public.waitlist enable row level security;

-- Insertion publique (anon + authenticated) autorisee, uniquement avec consentement.
-- Aucune colonne sensible : seul un email de lead est stocke.
create policy waitlist_public_insert on public.waitlist
  for insert
  to anon, authenticated
  with check (consent = true);

-- Lecture reservee a l administration (meme pattern que le reste du RBAC).
create policy waitlist_admin_select on public.waitlist
  for select
  to authenticated
  using (is_super_admin(auth.uid()));
