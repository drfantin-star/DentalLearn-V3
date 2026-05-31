-- Nom du fichier : 20260529c_axe4_autoeval.sql
-- Date de création : 2026-05-29
-- Description : Schéma data-driven du module d'auto-évaluation santé (Axe 4 — Action B).
--               Définition du questionnaire en base (administrable plus tard, PR C),
--               la LOGIQUE de scoring restant dans un moteur TS (src/lib/autoeval).
--               Contenu :
--                 1. Tables de définition : questionnaires, questionnaire_blocks,
--                    questionnaire_items, questionnaire_routing
--                 2. Table d'événement : autoeval_completions (preuve Action B)
--                    — AUCUNE réponse, AUCUN score stocké (RGPD Art. 9)
--                 3. Index
--                 4. Triggers updated_at (fonction scopée autoeval_set_updated_at)
--                 5. RLS : lecture authentifiée + écriture super_admin sur la
--                    définition (posé pour PR C) ; INSERT/SELECT self sur completions
-- Rollback : supabase/migrations/20260529c_axe4_autoeval_down.sql
-- Migration non destructive (créations uniquement).

-- ============================================================================
-- 1. Tables de définition
-- ============================================================================
create table public.questionnaires (
  id                uuid primary key default gen_random_uuid(),
  slug              text not null unique,
  titre             text not null,
  description       text,
  axe_cp            smallint,
  actif             boolean not null default true,
  intro_text        text,
  time_estimate_min integer,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

comment on table public.questionnaires is
  'Définition d''un questionnaire réflexif (ex. auto-évaluation santé Axe 4). Les réponses ne sont JAMAIS stockées (cf. autoeval_completions).';

create table public.questionnaire_blocks (
  id                uuid primary key default gen_random_uuid(),
  questionnaire_id  uuid not null references public.questionnaires (id) on delete cascade,
  ordre             integer not null,
  titre             text not null,
  type_bloc         text not null check (type_bloc in ('cbi', 'reflexif', 'substances', 'factuel')),
  -- verrouille : instrument validé repris verbatim (CBI) — non éditable par l'admin (PR C).
  verrouille        boolean not null default false,
  -- scoring_rule / recap_config : paramètres lus par le moteur TS (sous-échelles,
  -- seuils de paliers, forcing, messages). Forme typée par type_bloc côté TS.
  scoring_rule      jsonb,
  recap_config      jsonb,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

comment on column public.questionnaire_blocks.scoring_rule is
  'Paramètres de scoring lus par le moteur TS (src/lib/autoeval/scoring.ts). Forme dépend de type_bloc (CbiScoringRule | ReflexifScoringRule | SubstancesScoringRule).';

create table public.questionnaire_items (
  id                uuid primary key default gen_random_uuid(),
  block_id          uuid not null references public.questionnaire_blocks (id) on delete cascade,
  ordre             integer not null,
  libelle           text not null,
  -- libelle_en : libellé canonique anglais (traçabilité instrument validé, ex. CBI).
  libelle_en        text,
  type_input        text not null check (type_input in ('scale', 'yesno', 'choice', 'multi')),
  -- options : [{ label, value }]. value numérique (échelles scorées) ou texte (choix).
  options           jsonb,
  -- sens : 'negatif' (jamais=0…), 'positif' (inversé, jamais=max), 'na' (non scoré).
  sens              text not null default 'na' check (sens in ('negatif', 'positif', 'na')),
  reverse           boolean not null default false,
  -- factual_card : item non scoré déclenchant une carte. { triggerValues:[...], routeKey } ou carte inline.
  factual_card      jsonb,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create table public.questionnaire_routing (
  id                uuid primary key default gen_random_uuid(),
  questionnaire_id  uuid not null references public.questionnaires (id) on delete cascade,
  ordre             integer not null,
  -- condition : { key } — identifiant de route déclenché par le moteur TS.
  condition         jsonb not null,
  -- carte : contenu de la carte ressource ({ key, title, body, phone?, href?, variant }).
  carte             jsonb not null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- ============================================================================
-- 2. Table d'événement de complétion — preuve Action B
-- ============================================================================
-- AUCUNE colonne réponse / score (donnée de santé Art. 9). Seul l'événement de
-- réalisation est conservé, même nature que course_watch_logs. Pas de contrainte
-- UNIQUE : plusieurs complétions par an autorisées.
create table public.autoeval_completions (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users (id) on delete cascade,
  questionnaire_id  uuid not null references public.questionnaires (id),
  completed_at      timestamptz not null default now()
);

comment on table public.autoeval_completions is
  'Événement de complétion (preuve de réalisation Action B). Métadonnée d''activité — AUCUNE réponse ni score (RGPD Art. 9).';

-- ============================================================================
-- 3. Index
-- ============================================================================
create index idx_questionnaire_blocks_ordre
  on public.questionnaire_blocks (questionnaire_id, ordre);
create index idx_questionnaire_items_ordre
  on public.questionnaire_items (block_id, ordre);
create index idx_questionnaire_routing_ordre
  on public.questionnaire_routing (questionnaire_id, ordre);
create index idx_autoeval_completions_user
  on public.autoeval_completions (user_id, completed_at);

-- ============================================================================
-- 4. Triggers updated_at (fonction scopée, cf. pattern biblio_set_updated_at)
-- ============================================================================
create or replace function public.autoeval_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_questionnaires_updated_at
  before update on public.questionnaires
  for each row execute function public.autoeval_set_updated_at();
create trigger trg_questionnaire_blocks_updated_at
  before update on public.questionnaire_blocks
  for each row execute function public.autoeval_set_updated_at();
create trigger trg_questionnaire_items_updated_at
  before update on public.questionnaire_items
  for each row execute function public.autoeval_set_updated_at();
create trigger trg_questionnaire_routing_updated_at
  before update on public.questionnaire_routing
  for each row execute function public.autoeval_set_updated_at();

-- ============================================================================
-- 5. RLS
-- ============================================================================
alter table public.questionnaires       enable row level security;
alter table public.questionnaire_blocks enable row level security;
alter table public.questionnaire_items  enable row level security;
alter table public.questionnaire_routing enable row level security;
alter table public.autoeval_completions enable row level security;

-- Définition : lecture authentifiée, écriture super_admin (posé pour PR C).
create policy "Lecture questionnaires authentifié"
  on public.questionnaires for select to authenticated using (true);
create policy "CRUD questionnaires admin"
  on public.questionnaires for all to authenticated
  using (is_super_admin(auth.uid())) with check (is_super_admin(auth.uid()));

create policy "Lecture blocks authentifié"
  on public.questionnaire_blocks for select to authenticated using (true);
create policy "CRUD blocks admin"
  on public.questionnaire_blocks for all to authenticated
  using (is_super_admin(auth.uid())) with check (is_super_admin(auth.uid()));

create policy "Lecture items authentifié"
  on public.questionnaire_items for select to authenticated using (true);
create policy "CRUD items admin"
  on public.questionnaire_items for all to authenticated
  using (is_super_admin(auth.uid())) with check (is_super_admin(auth.uid()));

create policy "Lecture routing authentifié"
  on public.questionnaire_routing for select to authenticated using (true);
create policy "CRUD routing admin"
  on public.questionnaire_routing for all to authenticated
  using (is_super_admin(auth.uid())) with check (is_super_admin(auth.uid()));

-- Completions : chaque utilisateur écrit/lit les siennes ; super_admin lit (audit DPC).
create policy "Insert completion self"
  on public.autoeval_completions for insert to authenticated
  with check (auth.uid() = user_id);
create policy "Select completion self"
  on public.autoeval_completions for select to authenticated
  using (auth.uid() = user_id or is_super_admin(auth.uid()));
