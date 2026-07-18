-- Champ thématique sur les événements (masterclass live_sessions + dates
-- présentielles live_events), pour appliquer le même dégradé que les cartes
-- formation (getCategoryConfig, src/lib/supabase/types.ts).
--
-- Valeurs : sous-ensemble de formations.category (mêmes libellés exacts,
-- cf. formations_category_check) — uniquement les catégories qui ont un
-- dégradé défini et pertinent pour un événement/masterclass. `radiologie`
-- est exclue : son dégradé est marqué "à définir" dans
-- PALETTE_COULEURS_CERTILY.md (section 1 et point de vigilance 7.3),
-- malgré une valeur déjà présente dans le code — TODO : la réintégrer ici
-- une fois le dégradé radiologie officiellement tranché.
-- NULL toléré : événements existants / thématique non renseignée -> rendu
-- neutre actuel (pas de dégradé).

alter table public.live_sessions add column category varchar;
alter table public.live_sessions add constraint live_sessions_category_check
  check (category is null or category in (
    'esthetique', 'restauratrice', 'chirurgie', 'implant', 'prothese',
    'parodontologie', 'endodontie', 'numerique', 'communication',
    'consentement', 'soft-skills'
  ));

alter table public.live_events add column category varchar;
alter table public.live_events add constraint live_events_category_check
  check (category is null or category in (
    'esthetique', 'restauratrice', 'chirurgie', 'implant', 'prothese',
    'parodontologie', 'endodontie', 'numerique', 'communication',
    'consentement', 'soft-skills'
  ));
