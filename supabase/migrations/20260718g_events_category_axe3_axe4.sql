-- Étend le référentiel category (live_sessions + live_events) aux axes 3 et 4
-- (PALETTE_COULEURS_CERTILY.md section 3) :
--   Axe 3 — conflits, decision-partagee (communication, consentement déjà présents)
--   Axe 4 — ergonomie, stress-burnout, risques-pro, violences, pratique-reflexive
-- radiologie toujours exclue (dégradé non défini, cf. 20260718d).

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
