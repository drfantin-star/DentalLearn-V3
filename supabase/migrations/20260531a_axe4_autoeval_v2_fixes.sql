-- Nom du fichier : 20260531a_axe4_autoeval_v2_fixes.sql
-- Date de création : 2026-05-31
-- Description : Corrections v2 du seed 'sante-axe4' suite au smoke test preview.
--               (1) CBI item 5 : libellé FR différencié de l'item 7 (artefact de
--                   traduction « worn out » vs « worn out at end of day ») — le
--                   scoring/sous-échelles ne changent pas.
--               (5) Équilibre, item 4 (« projet personnel ») : fréquence → oui/non
--                   scoré positif (Oui=0 / Non=3, max inchangé = 3 × nb_items).
--               (4) Carte violence (cdom_onvs) : ajout du lien ONVS (page
--                   institutionnelle stable, pas la plateforme de signalement en
--                   transition 2026).
--               (7) Estimation de temps : 10 → 15-20 min (passage réel).
--               UPDATE ciblés par slug/ordre (aucun id généré en dur).
-- Rollback : supabase/migrations/20260531a_axe4_autoeval_v2_fixes_down.sql

do $$
declare
  q_id    uuid;
  cbi_id  uuid;
  equi_id uuid;
begin
  select id into q_id from public.questionnaires where slug = 'sante-axe4';
  select id into cbi_id from public.questionnaire_blocks
    where questionnaire_id = q_id and type_bloc = 'cbi';
  select id into equi_id from public.questionnaire_blocks
    where questionnaire_id = q_id and titre = 'Équilibre vie pro / vie perso';

  -- (1) CBI item 5 — libellé différencié (item 7 « éreinté·e » inchangé)
  update public.questionnaire_items
    set libelle = 'À quelle fréquence vous sentez-vous à bout de forces ?'
    where block_id = cbi_id and ordre = 5;

  -- (5) Équilibre item 4 — oui/non scoré positif (Oui=0 / Non=3)
  update public.questionnaire_items
    set type_input = 'yesno',
        options    = '[{"label":"Oui","value":0},{"label":"Non","value":3}]'::jsonb,
        sens       = 'positif',
        reverse    = false
    where block_id = equi_id and ordre = 4;

  -- (4) Carte violence — ajout du lien ONVS
  update public.questionnaire_routing
    set carte = jsonb_set(
      carte, '{href}',
      '"https://sante.gouv.fr/professionnels/ameliorer-les-conditions-d-exercice/observatoire-national-des-violences-en-sante/"'::jsonb
    )
    where questionnaire_id = q_id and condition->>'key' = 'cdom_onvs';

  -- (7) Estimation de temps 15-20 min
  update public.questionnaires
    set time_estimate_min = 20,
        intro_text = replace(intro_text, 'environ 10 minutes', 'entre 15 et 20 minutes')
    where slug = 'sante-axe4';
end $$;
