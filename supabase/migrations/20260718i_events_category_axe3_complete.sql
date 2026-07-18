-- Complète l'Axe 3 à 8 thématiques (PALETTE_COULEURS_CERTILY.md section 3) :
--   annonce-diagnostic, education-therapeutique, ethique-deontologie,
--   numerique-relation — déjà valides côté formations.category
--   (formations_category_check), pas encore ouvertes aux événements
--   (live_sessions/live_events).
-- Toujours sur le dégradé orange Axe 3 partagé (cf. AXE3_GRADIENT,
-- eventCategories.ts). radiologie toujours exclue.

alter table public.live_sessions drop constraint live_sessions_category_check;
alter table public.live_sessions add constraint live_sessions_category_check
  check (category is null or category in (
    'esthetique', 'restauratrice', 'chirurgie', 'implant', 'prothese',
    'parodontologie', 'endodontie', 'numerique',
    'communication', 'consentement', 'conflits', 'decision-partagee',
    'annonce-diagnostic', 'education-therapeutique', 'ethique-deontologie', 'numerique-relation',
    'ergonomie', 'stress-burnout', 'risques-pro', 'violences', 'pratique-reflexive',
    'soft-skills'
  ));

alter table public.live_events drop constraint live_events_category_check;
alter table public.live_events add constraint live_events_category_check
  check (category is null or category in (
    'esthetique', 'restauratrice', 'chirurgie', 'implant', 'prothese',
    'parodontologie', 'endodontie', 'numerique',
    'communication', 'consentement', 'conflits', 'decision-partagee',
    'annonce-diagnostic', 'education-therapeutique', 'ethique-deontologie', 'numerique-relation',
    'ergonomie', 'stress-burnout', 'risques-pro', 'violences', 'pratique-reflexive',
    'soft-skills'
  ));
