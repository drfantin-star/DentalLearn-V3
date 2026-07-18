-- Rollback de 20260718i : retour aux 18 valeurs (avant complétion Axe 3).

alter table public.live_sessions drop constraint live_sessions_category_check;
alter table public.live_sessions add constraint live_sessions_category_check
  check (category is null or category in (
    'esthetique', 'restauratrice', 'chirurgie', 'implant', 'prothese',
    'parodontologie', 'endodontie', 'numerique',
    'communication', 'consentement', 'conflits', 'decision-partagee',
    'ergonomie', 'stress-burnout', 'risques-pro', 'violences', 'pratique-reflexive',
    'soft-skills'
  ));

alter table public.live_events drop constraint live_events_category_check;
alter table public.live_events add constraint live_events_category_check
  check (category is null or category in (
    'esthetique', 'restauratrice', 'chirurgie', 'implant', 'prothese',
    'parodontologie', 'endodontie', 'numerique',
    'communication', 'consentement', 'conflits', 'decision-partagee',
    'ergonomie', 'stress-burnout', 'risques-pro', 'violences', 'pratique-reflexive',
    'soft-skills'
  ));
