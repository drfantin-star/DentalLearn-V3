-- Rollback de 20260718d_events_category.sql

alter table public.live_events drop constraint if exists live_events_category_check;
alter table public.live_events drop column if exists category;

alter table public.live_sessions drop constraint if exists live_sessions_category_check;
alter table public.live_sessions drop column if exists category;
