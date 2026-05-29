-- Nom du fichier : 20260529a_bibliotheque_ressources.sql
-- Date de création : 2026-05-29
-- Description : Migration des ressources de la Bibliothèque (axes 1/3/4 de la CP)
--               depuis le fichier TS statique `src/lib/constants/bibliotheque.ts`
--               vers une table Supabase administrable.
--               Contenu :
--                 1. Table public.bibliotheque_ressources
--                 2. Index de tri (axe, categorie, ordre)
--                 3. Trigger updated_at (fonction scopée biblio_set_updated_at)
--                 4. RLS table : SELECT authentifié, CRUD super_admin
--                 5. Policies storage sur le bucket bibliotheque-publique
--                    (SELECT public + INSERT/UPDATE/DELETE super_admin) — l'upload
--                    et la suppression de PDF se font côté client (pas de service
--                    role), il faut donc autoriser l'admin authentifié sur le bucket
--                 6. Seed des 7 ressources patient (axe 3) existantes
-- Rollback : supabase/migrations/20260529a_bibliotheque_ressources_down.sql

-- ============================================================================
-- 1. Table
-- ============================================================================
create table public.bibliotheque_ressources (
  id            uuid primary key default gen_random_uuid(),
  axe           smallint not null check (axe in (1, 3, 4)),
  titre         text not null,
  source        text not null,                   -- 'DentalLearn', 'ADF', 'SFCO', 'HAS'...
  description   text,
  type          text not null check (type in ('internal', 'external')),
  url           text not null,                   -- URL externe OU URL publique Storage
  storage_path  text,                            -- 'internal' uniquement : chemin dans le bucket (pour suppression)
  categorie     text,
  ordre         integer not null default 100,    -- tri ASC dans une catégorie
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

comment on table public.bibliotheque_ressources is
  'Ressources documentaires de la Bibliothèque, rattachées aux axes 1/3/4 de la certification périodique. Administrable via /admin/bibliotheque.';

-- ============================================================================
-- 2. Index de tri
-- ============================================================================
create index idx_biblio_ressources_axe_ordre
  on public.bibliotheque_ressources (axe, categorie, ordre);

-- ============================================================================
-- 3. Trigger updated_at
-- ============================================================================
-- Fonction scopée à cette table : le projet n'a pas de fonction tg_set_updated_at
-- partagée (chaque table définit la sienne, cf. news_episodes_set_updated_at,
-- update_audio_jobs_updated_at). On suit ce pattern pour ne rien écraser.
create or replace function public.biblio_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_biblio_updated_at
  before update on public.bibliotheque_ressources
  for each row execute function public.biblio_set_updated_at();

-- ============================================================================
-- 4. RLS table
-- ============================================================================
alter table public.bibliotheque_ressources enable row level security;

-- Lecture : tout utilisateur authentifié
create policy "Lecture biblio authentifié"
  on public.bibliotheque_ressources for select
  to authenticated
  using (true);

-- Écriture : super_admin uniquement (mécanisme d'admin du projet : is_super_admin)
create policy "CRUD biblio admin"
  on public.bibliotheque_ressources for all
  to authenticated
  using (is_super_admin(auth.uid()))
  with check (is_super_admin(auth.uid()));

-- ============================================================================
-- 5. Policies storage sur le bucket bibliotheque-publique
-- ============================================================================
-- Le bucket existe déjà (public, 10 MB, application/pdf). Il n'a AUCUNE policy
-- d'écriture. L'upload/suppression des PDF internes se fait côté client avec le
-- JWT de l'admin (pas de service role côté client), il faut donc autoriser
-- explicitement l'admin authentifié. SELECT reste public (bucket public).
-- DROP IF EXISTS pour l'idempotence du re-run.

drop policy if exists "bibliotheque-publique public read" on storage.objects;
create policy "bibliotheque-publique public read"
  on storage.objects for select
  to public
  using (bucket_id = 'bibliotheque-publique');

drop policy if exists "bibliotheque-publique admin insert" on storage.objects;
create policy "bibliotheque-publique admin insert"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'bibliotheque-publique' and is_super_admin(auth.uid()));

drop policy if exists "bibliotheque-publique admin update" on storage.objects;
create policy "bibliotheque-publique admin update"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'bibliotheque-publique' and is_super_admin(auth.uid()))
  with check (bucket_id = 'bibliotheque-publique' and is_super_admin(auth.uid()));

drop policy if exists "bibliotheque-publique admin delete" on storage.objects;
create policy "bibliotheque-publique admin delete"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'bibliotheque-publique' and is_super_admin(auth.uid()));

-- ============================================================================
-- 6. Seed des 7 ressources patient (axe 3) existantes
-- ============================================================================
insert into public.bibliotheque_ressources
  (axe, titre, source, description, type, url, storage_path, categorie, ordre)
values
  -- Fiches d'information DentalLearn (internes)
  (3, 'Vos droits en tant que patient', 'DentalLearn',
   'Fiche d''information générale à remettre systématiquement au patient.',
   'internal',
   'https://dxybsuhfkwuemapqrvgz.supabase.co/storage/v1/object/public/bibliotheque-publique/fiches-CP/patient/vos-droits.pdf',
   'fiches-CP/patient/vos-droits.pdf', 'Information patient', 10),
  (3, 'Vous accompagnez votre enfant', 'DentalLearn',
   'Information destinée aux parents accompagnant un patient mineur.',
   'internal',
   'https://dxybsuhfkwuemapqrvgz.supabase.co/storage/v1/object/public/bibliotheque-publique/fiches-CP/patient/enfant.pdf',
   'fiches-CP/patient/enfant.pdf', 'Information patient', 20),
  (3, 'Vous accompagnez un proche sous protection juridique', 'DentalLearn',
   'Information destinée aux tuteurs, curateurs et personnes de confiance.',
   'internal',
   'https://dxybsuhfkwuemapqrvgz.supabase.co/storage/v1/object/public/bibliotheque-publique/fiches-CP/patient/majeur-protege.pdf',
   'fiches-CP/patient/majeur-protege.pdf', 'Information patient', 30),
  -- Documents officiels externes
  (3, 'Formulaires de consentement éclairé (6 disciplines)', 'ADF',
   'Chirurgie orale, parodontale, pédiatrie, prothèse, implanto, endo.',
   'external',
   'https://adf.asso.fr/articles/consentement-eclaire-du-patient-vos-formulaires-pour-le-recueillir/',
   null, 'Consentements', 10),
  (3, 'Consentements et informations médicales par acte', 'SFCO',
   'Avulsions, dents de sagesse, implants, greffes, biopsies, comblements sinusiens…',
   'external',
   'https://societechirorale.com/consentements/',
   null, 'Consentements', 20),
  (3, 'Conseils post-opératoires (chirurgie orale)', 'SFCO',
   'Document officiel SFCO à remettre au patient après intervention de chirurgie orale.',
   'external',
   'https://societechirorale.com/wp-content/uploads/2023/06/conseils_postoperatoires.pdf',
   null, 'Conseils post-opératoires', 10),
  (3, 'Délivrance de l''information à la personne sur son état de santé', 'HAS',
   'Recommandation de bonne pratique (mai 2012) — cadre de référence.',
   'external',
   'https://www.has-sante.fr/jcms/c_1261551/fr/delivrance-de-l-information-a-la-personne-sur-son-etat-de-sante',
   null, 'Référence', 10);
