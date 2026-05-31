-- Rollback de 20260531a_axe4_autoeval_v2_fixes.sql
-- Restaure les valeurs d'origine du seed 20260529d.

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

  update public.questionnaire_items
    set libelle = 'À quelle fréquence vous sentez-vous éreinté·e ?'
    where block_id = cbi_id and ordre = 5;

  update public.questionnaire_items
    set type_input = 'scale',
        options    = '[{"label":"Jamais","value":0},{"label":"Parfois","value":1},{"label":"Souvent","value":2},{"label":"Toujours","value":3}]'::jsonb,
        sens       = 'positif',
        reverse    = true
    where block_id = equi_id and ordre = 4;

  update public.questionnaire_routing
    set carte = carte - 'href'
    where questionnaire_id = q_id and condition->>'key' = 'cdom_onvs';

  update public.questionnaires
    set time_estimate_min = 10,
        intro_text = replace(intro_text, 'entre 15 et 20 minutes', 'environ 10 minutes')
    where slug = 'sante-axe4';
end $$;
