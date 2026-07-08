-- Réglage durable : temps dispo hebdo (réutilisé chaque mois, modifiable)
create table if not exists public.autopilot_settings (
  user_id        uuid primary key references auth.users(id) on delete cascade,
  weekly_minutes integer not null check (weekly_minutes in (15, 30, 60)),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

alter table public.autopilot_settings enable row level security;

create policy autopilot_settings_user_policy on public.autopilot_settings
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Plan mensuel : 1 ligne = 1 item d'action (granulaire)
create table if not exists public.autopilot_plan (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  month_key    text not null,                       -- format 'YYYY-MM'
  axe_id       integer not null references public.cp_axes(id),
  item_type    text not null default 'formation' check (item_type in ('formation')),
  ref_id       uuid,                                -- id de la formation
  title        text not null,
  est_minutes  integer,
  status       text not null default 'todo' check (status in ('todo','done')),
  ordre        integer not null default 0,
  created_at   timestamptz not null default now(),
  completed_at timestamptz,
  unique (user_id, month_key, item_type, ref_id)
);

create index if not exists idx_autopilot_plan_user_month
  on public.autopilot_plan (user_id, month_key);

alter table public.autopilot_plan enable row level security;

create policy autopilot_plan_user_policy on public.autopilot_plan
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
