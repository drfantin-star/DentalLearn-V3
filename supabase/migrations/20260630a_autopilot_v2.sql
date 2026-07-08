drop table if exists public.autopilot_plan;
drop table if exists public.autopilot_settings;

-- Réglages durables : temps dispo + lacunes déclarées (slugs de catégories cochés)
create table public.autopilot_settings (
  user_id        uuid primary key references auth.users(id) on delete cascade,
  weekly_minutes integer not null check (weekly_minutes in (15, 30, 60)),
  focus          jsonb   not null default '[]'::jsonb,   -- ex. ["restauratrice","annonce-diagnostic","risques-pro"]
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
alter table public.autopilot_settings enable row level security;
create policy autopilot_settings_user_policy on public.autopilot_settings
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Plan mensuel : 1 ligne = 1 action (multi-sources)
create table public.autopilot_plan (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  month_key    text not null,                            -- 'YYYY-MM'
  axe_id       integer not null references public.cp_axes(id),
  item_type    text not null check (item_type in ('formation','epp','autoeval','attestation')),
  ref_id       uuid,                                     -- id catalogue (formation/epp/questionnaire) ; null pour attestation
  ref_key      text not null,                            -- clé logique unique
  title        text not null,
  href         text not null,                            -- lien de navigation calculé à la génération
  est_minutes  integer,
  status       text not null default 'todo' check (status in ('todo','done')),
  ordre        integer not null default 0,
  created_at   timestamptz not null default now(),
  completed_at timestamptz,
  unique (user_id, month_key, ref_key)
);
create index idx_autopilot_plan_user_month on public.autopilot_plan (user_id, month_key);
alter table public.autopilot_plan enable row level security;
create policy autopilot_plan_user_policy on public.autopilot_plan
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
