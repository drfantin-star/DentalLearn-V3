-- Rollback de 20260718g_events_category_axe3_axe4.sql

alter table public.live_sessions drop constraint live_sessions_category_check;
alter table public.live_sessions add constraint live_sessions_category_check
  check (category is null or category in (
    'esthetique', 'restauratrice', 'chirurgie', 'implant', 'prothese',
    'parodontologie', 'endodontie', 'numerique', 'communication',
    'consentement', 'soft-skills'
  ));

alter table public.live_events drop constraint live_events_category_check;
alter table public.live_events add constraint live_events_category_check
  check (category is null or category in (
    'esthetique', 'restauratrice', 'chirurgie', 'implant', 'prothese',
    'parodontologie', 'endodontie', 'numerique', 'communication',
    'consentement', 'soft-skills'
  ));
