-- Nom du fichier : 20260529d_axe4_autoeval_seed.sql
-- Date de création : 2026-05-29
-- Description : Seed du questionnaire d'auto-évaluation santé Axe 4 (slug 'sante-axe4').
--               Source : DENTALLEARN_AXE4_AUTOEVAL_CONTENU_v1 (v1.1).
--               Blocs : CBI (19 items, verrouillé) · 3 dimensions réflexives maison
--               · substances (non scoré) · factuel · table de routage des cartes.
--               Les formes scoring_rule / recap_config correspondent EXACTEMENT aux
--               types TS (src/lib/autoeval/types.ts) lus par le moteur de scoring.
-- Seed : exempt de fichier _down jumelé (convention CLAUDE.md).
-- NB : le libellé FR du CBI est une traduction de travail (Kristensen et al., 2005),
--      reprise verbatim et verrouillée (verrouille = true). libelle_en = source.

do $seed$
declare
  q_id    uuid;
  cbi_id  uuid;
  ergo_id uuid;
  env_id  uuid;
  equi_id uuid;
  sub_id  uuid;
  fac_id  uuid;

  -- Jeux d'options réutilisés
  cbi_freq   jsonb := $j$[{"label":"Jamais ou presque","value":0},{"label":"Rarement","value":25},{"label":"Parfois","value":50},{"label":"Souvent","value":75},{"label":"Toujours","value":100}]$j$;
  cbi_degre  jsonb := $j$[{"label":"À un très faible degré","value":0},{"label":"À un faible degré","value":25},{"label":"Modérément","value":50},{"label":"À un haut degré","value":75},{"label":"À un très haut degré","value":100}]$j$;
  reflex     jsonb := $j$[{"label":"Jamais","value":0},{"label":"Parfois","value":1},{"label":"Souvent","value":2},{"label":"Toujours","value":3}]$j$;
  sub_freq   jsonb := $j$[{"label":"Jamais","value":"jamais"},{"label":"Parfois","value":"parfois"},{"label":"Souvent","value":"souvent"},{"label":"Toujours","value":"toujours"}]$j$;
  fac_freq   jsonb := $j$[{"label":"Jamais","value":"jamais"},{"label":"Parfois","value":"parfois"},{"label":"Souvent","value":"souvent"},{"label":"Toujours","value":"toujours"}]$j$;
  yesno      jsonb := $j$[{"label":"Oui","value":"oui"},{"label":"Non","value":"non"}]$j$;
begin

-- ============================================================================
-- Questionnaire
-- ============================================================================
insert into public.questionnaires (slug, titre, description, axe_cp, actif, intro_text, time_estimate_min)
values (
  'sante-axe4',
  'Auto-évaluation de ma santé professionnelle',
  $d$Un miroir de votre santé professionnelle — pas un diagnostic. Couvre l'Action B de l'Axe 4 de la certification périodique.$d$,
  4,
  true,
  $intro$Ce bilan est un miroir de votre santé professionnelle — pas un diagnostic. Il est là pour vous, et pour personne d'autre.

⏱️ Comptez entre 15 et 20 minutes (une quarantaine de questions), à faire d'une seule traite.

⚠️ Vos réponses ne sont pas enregistrées en cours de route. Si vous quittez avant la fin, il faudra recommencer depuis le début. Prévoyez un moment au calme.

🔒 Confidentialité : vos réponses restent sur votre appareil, ne sont jamais transmises à nos serveurs, et ne sont partagées avec personne — ni Ordre, ni employeur. Seule la date de réalisation est conservée, pour générer votre attestation.

À la fin, vous pourrez télécharger votre bilan (il reste sur votre appareil) et votre attestation de réalisation (utile pour votre certification périodique).$intro$,
  20
)
returning id into q_id;

-- ============================================================================
-- BLOC 1 — CBI (Copenhagen Burnout Inventory) — verrouillé
-- ============================================================================
insert into public.questionnaire_blocks (questionnaire_id, ordre, titre, type_bloc, verrouille, scoring_rule, recap_config)
values (
  q_id, 1, 'Épuisement professionnel', 'cbi', true,
  $j${"subscales":[{"key":"perso","label":"Épuisement personnel","items":[1,2,3,4,5,6]},{"key":"travail","label":"Épuisement lié au travail","items":[7,8,9,10,11,12,13]},{"key":"patients","label":"Épuisement lié aux patients","items":[14,15,16,17,18,19]}],"bands":{"moderate":50,"high":75},"routeHighTo":"sps"}$j$::jsonb,
  $j${"bands":{"low":{"label":"Faible","message":"Ça semble tenir de ce côté."},"moderate":{"label":"Modéré","message":"Des signaux d'épuisement à ne pas laisser s'installer."},"high":{"label":"Élevé","message":"Plusieurs signaux convergent. En parler à un professionnel est la meilleure étape — ce n'est pas un diagnostic, c'est un repère."}}}$j$::jsonb
)
returning id into cbi_id;

insert into public.questionnaire_items (block_id, ordre, libelle, libelle_en, type_input, options, sens, reverse) values
  (cbi_id, 1,  $b$À quelle fréquence vous sentez-vous fatigué·e ?$b$, $b$How often do you feel tired?$b$, 'scale', cbi_freq, 'negatif', false),
  (cbi_id, 2,  $b$À quelle fréquence vous sentez-vous physiquement épuisé·e ?$b$, $b$physically exhausted$b$, 'scale', cbi_freq, 'negatif', false),
  (cbi_id, 3,  $b$À quelle fréquence vous sentez-vous émotionnellement épuisé·e ?$b$, $b$emotionally exhausted$b$, 'scale', cbi_freq, 'negatif', false),
  (cbi_id, 4,  $b$À quelle fréquence vous dites-vous « je n'en peux plus » ?$b$, $b$I can't take it anymore$b$, 'scale', cbi_freq, 'negatif', false),
  (cbi_id, 5,  $b$À quelle fréquence vous sentez-vous à bout de forces ?$b$, $b$worn out$b$, 'scale', cbi_freq, 'negatif', false),
  (cbi_id, 6,  $b$À quelle fréquence vous sentez-vous fragile et vulnérable à la maladie ?$b$, $b$weak and susceptible to illness$b$, 'scale', cbi_freq, 'negatif', false),
  (cbi_id, 7,  $b$Vous sentez-vous éreinté·e à la fin de votre journée de travail ?$b$, null, 'scale', cbi_freq, 'negatif', false),
  (cbi_id, 8,  $b$Êtes-vous épuisé·e le matin à l'idée d'une nouvelle journée de travail ?$b$, null, 'scale', cbi_freq, 'negatif', false),
  (cbi_id, 9,  $b$Avez-vous le sentiment que chaque heure de travail vous fatigue ?$b$, null, 'scale', cbi_freq, 'negatif', false),
  (cbi_id, 10, $b$Avez-vous assez d'énergie pour votre famille et vos amis pendant vos loisirs ?$b$, $b$(reverse) enough energy for family and friends$b$, 'scale', cbi_freq, 'positif', true),
  (cbi_id, 11, $b$Votre travail est-il émotionnellement épuisant ?$b$, null, 'scale', cbi_freq, 'negatif', false),
  (cbi_id, 12, $b$Votre travail vous frustre-t-il ?$b$, null, 'scale', cbi_freq, 'negatif', false),
  (cbi_id, 13, $b$Vous sentez-vous « vidé·e » à cause de votre travail ?$b$, null, 'scale', cbi_freq, 'negatif', false),
  (cbi_id, 14, $b$Trouvez-vous difficile de travailler avec vos patients ?$b$, null, 'scale', cbi_freq, 'negatif', false),
  (cbi_id, 15, $b$Travailler avec vos patients épuise-t-il votre énergie ?$b$, null, 'scale', cbi_freq, 'negatif', false),
  (cbi_id, 16, $b$Trouvez-vous frustrant de travailler avec vos patients ?$b$, null, 'scale', cbi_freq, 'negatif', false),
  (cbi_id, 17, $b$Avez-vous le sentiment de donner plus que ce que vous recevez dans la relation avec vos patients ?$b$, null, 'scale', cbi_freq, 'negatif', false),
  (cbi_id, 18, $b$Êtes-vous lassé·e de travailler avec vos patients ?$b$, null, 'scale', cbi_degre, 'negatif', false),
  (cbi_id, 19, $b$Vous demandez-vous parfois combien de temps vous pourrez continuer à travailler avec vos patients ?$b$, null, 'scale', cbi_degre, 'negatif', false);

-- ============================================================================
-- BLOC 2 — Dimension réflexive : Ergonomie & postures
-- ============================================================================
insert into public.questionnaire_blocks (questionnaire_id, ordre, titre, type_bloc, scoring_rule, recap_config)
values (
  q_id, 2, 'Ergonomie & postures', 'reflexif',
  $j${"scoredItems":[1,2,3,4],"maxPerItem":3,"thresholds":{"orange":25,"rouge":55},"forcing":[{"item_ordre":2,"values":[2,3],"min_palier":"orange"}],"routeOn":[{"palier":"orange","key":"inrs_tms"}]}$j$::jsonb,
  $j${"messages":{"vert":"De ce côté, l'équilibre semble tenir. C'est précieux — continuez à entretenir ce qui vous fait du bien.","orange":"Des tensions s'installent. La fiche Étirements au fauteuil propose des gestes simples entre deux patients.","rouge":"Vos douleurs pèsent déjà sur votre pratique. Au-delà des étirements, faire évaluer votre poste et consulter évitera la chronicisation."}}$j$::jsonb
)
returning id into ergo_id;

insert into public.questionnaire_items (block_id, ordre, libelle, type_input, options, sens, reverse, factual_card) values
  (ergo_id, 1, $b$Avez-vous des douleurs cervicales ou lombaires après une journée de travail ?$b$, 'scale', reflex, 'negatif', false, null),
  (ergo_id, 2, $b$Ressentez-vous des fourmillements ou engourdissements dans les mains/poignets ?$b$, 'scale', reflex, 'negatif', false, null),
  (ergo_id, 3, $b$Faites-vous des pauses actives ou des étirements entre vos patients ?$b$, 'scale', reflex, 'positif', true, null),
  (ergo_id, 4, $b$Vos douleurs vous ont-elles déjà obligé à adapter vos actes ou votre planning ?$b$, 'scale', reflex, 'negatif', false, null),
  (ergo_id, 5, $b$Votre poste a-t-il été évalué ergonomiquement (tabouret, fauteuil, éclairage) ?$b$, 'yesno', yesno, 'na', false, $b${"triggerValues":["non"],"routeKey":"ergonomie_poste"}$b$::jsonb),
  (ergo_id, 6, $b$Travaillez-vous avec des loupes ou un microscope ?$b$, 'yesno', yesno, 'na', false, $b${"triggerValues":["oui"],"routeKey":"loupes"}$b$::jsonb);

-- ============================================================================
-- BLOC 3 — Dimension réflexive : Environnement professionnel & relations
-- ============================================================================
insert into public.questionnaire_blocks (questionnaire_id, ordre, titre, type_bloc, scoring_rule, recap_config)
values (
  q_id, 3, 'Environnement & relations', 'reflexif',
  $j${"scoredItems":[1,2,3],"maxPerItem":3,"thresholds":{"orange":25,"rouge":55}}$j$::jsonb,
  $j${"messages":{"vert":"De ce côté, l'équilibre semble tenir. C'est précieux — continuez à entretenir ce qui vous fait du bien.","orange":"L'isolement et la surcharge usent. Renouer des échanges entre pairs change souvent la donne.","rouge":"Plusieurs signaux pointent un environnement éprouvant. En parler — pairs, Ordre, médecine du travail — est un acte de protection, pas un aveu de faiblesse."}}$j$::jsonb
)
returning id into env_id;

insert into public.questionnaire_items (block_id, ordre, libelle, type_input, options, sens, reverse, factual_card) values
  (env_id, 1, $b$Votre relation avec votre équipe est-elle sereine ?$b$, 'scale', reflex, 'positif', true, null),
  (env_id, 2, $b$Votre charge de travail est-elle compatible avec la qualité de soins que vous voulez offrir ?$b$, 'scale', reflex, 'positif', true, null),
  (env_id, 3, $b$Avez-vous des échanges réguliers avec des confrères (groupes de pairs, FMC) ?$b$, 'scale', reflex, 'positif', true, null),
  (env_id, 4, $b$Avez-vous vécu ou été témoin de comportements violents ou harcelants au cabinet ?$b$, 'choice',
     $j$[{"label":"Oui","value":"oui"},{"label":"Non","value":"non"},{"label":"Je préfère ne pas répondre","value":"pnr"}]$j$::jsonb,
     'na', false, $b${"triggerValues":["oui"],"routeKey":"cdom_onvs"}$b$::jsonb);

-- ============================================================================
-- BLOC 4 — Dimension réflexive : Équilibre vie pro / vie perso
-- ============================================================================
insert into public.questionnaire_blocks (questionnaire_id, ordre, titre, type_bloc, scoring_rule, recap_config)
values (
  q_id, 4, 'Équilibre vie pro / vie perso', 'reflexif',
  $j${"scoredItems":[1,2,3,4],"maxPerItem":3,"thresholds":{"orange":25,"rouge":55},"forcing":[{"item_ordre":2,"values":[2,3],"min_palier":"orange"}]}$j$::jsonb,
  $j${"messages":{"vert":"De ce côté, l'équilibre semble tenir. C'est précieux — continuez à entretenir ce qui vous fait du bien.","orange":"La frontière pro/perso se brouille un peu. Protéger des temps vraiment déconnectés est un investissement, pas une perte.","rouge":"L'équilibre penche nettement du côté du travail, et vos proches le voient. Ça vaut la peine de s'arrêter sur le « comment » avant que le corps ne le décide à votre place."}}$j$::jsonb
)
returning id into equi_id;

insert into public.questionnaire_items (block_id, ordre, libelle, type_input, options, sens, reverse) values
  (equi_id, 1, $b$Avez-vous des activités régulières en dehors du travail ?$b$, 'scale', reflex, 'positif', true),
  (equi_id, 2, $b$Votre entourage proche exprime-t-il des inquiétudes sur votre fatigue ou votre surmenage ?$b$, 'scale', reflex, 'negatif', false),
  (equi_id, 3, $b$Arrivez-vous à décrocher mentalement du cabinet le week-end ?$b$, 'scale', reflex, 'positif', true),
  -- Item 4 : oui/non scoré positif (Oui=0 / Non=3) — la fréquence est inadaptée pour « un projet ».
  (equi_id, 4, $b$Avez-vous un projet personnel ou de vie qui vous tient à cœur en ce moment ?$b$, 'yesno',
     $j$[{"label":"Oui","value":0},{"label":"Non","value":3}]$j$::jsonb, 'positif', false);

-- ============================================================================
-- BLOC 5 — Substances (aucun score, message neutre + carte conditionnelle)
-- ============================================================================
insert into public.questionnaire_blocks (questionnaire_id, ordre, titre, type_bloc, scoring_rule, recap_config)
values (
  q_id, 5, 'Substances', 'substances',
  $j${"cardConditions":[{"item_ordre":2,"values":["oui"]},{"item_ordre":4,"values":["oui","peut-etre"]},{"item_ordre":3,"values":["souvent","toujours"]}],"routeKey":"sps"}$j$::jsonb,
  $j${"neutralMessage":"Cet espace n'évalue rien et ne juge rien. Il vous invite simplement à faire le point, pour vous."}$j$::jsonb
)
returning id into sub_id;

insert into public.questionnaire_items (block_id, ordre, libelle, type_input, options, sens) values
  (sub_id, 1, $b$Vous arrive-t-il de consommer de l'alcool pour décompresser après le travail ?$b$, 'scale', sub_freq, 'na'),
  (sub_id, 2, $b$Votre consommation (alcool, tabac/nicotine) a-t-elle augmenté ces 12 derniers mois ?$b$, 'choice',
     $j$[{"label":"Oui","value":"oui"},{"label":"Non","value":"non"},{"label":"Je ne sais pas","value":"jnsp"}]$j$::jsonb, 'na'),
  (sub_id, 3, $b$Prenez-vous parfois des médicaments non prescrits pour gérer le stress ou dormir ?$b$, 'scale', sub_freq, 'na'),
  (sub_id, 4, $b$Avez-vous le sentiment que votre rapport à ces substances mériterait votre attention ?$b$, 'choice',
     $j$[{"label":"Oui","value":"oui"},{"label":"Peut-être","value":"peut-etre"},{"label":"Non","value":"non"}]$j$::jsonb, 'na');

-- ============================================================================
-- BLOC 6 — Factuel / comportemental (non scoré, cartes ressources)
-- ============================================================================
insert into public.questionnaire_blocks (questionnaire_id, ordre, titre, type_bloc)
values (q_id, 6, 'Repères de santé', 'factuel')
returning id into fac_id;

insert into public.questionnaire_items (block_id, ordre, libelle, type_input, options, sens, factual_card) values
  (fac_id, 1, $b$Avez-vous consulté un médecin traitant dans les 12 derniers mois ?$b$, 'yesno', yesno, 'na', $b${"triggerValues":["non"],"routeKey":"medecin_traitant"}$b$::jsonb),
  (fac_id, 2, $b$Avez-vous fait un bilan de santé (sang, vision, audition) dans les 3 dernières années ?$b$, 'yesno', yesno, 'na', $b${"triggerValues":["non"],"routeKey":"bilan_sante"}$b$::jsonb),
  (fac_id, 3, $b$Êtes-vous suivi par la médecine du travail (dans les 24 derniers mois) ?$b$, 'yesno', yesno, 'na', $b${"triggerValues":["non"],"routeKey":"medecine_travail"}$b$::jsonb),
  (fac_id, 4, $b$Votre sommeil est-il réparateur ?$b$, 'scale', fac_freq, 'na', $b${"triggerValues":["jamais","parfois"],"routeKey":"sommeil"}$b$::jsonb),
  (fac_id, 5, $b$Bougez-vous suffisamment dans la semaine (marche, sport) ?$b$, 'scale', fac_freq, 'na', $b${"triggerValues":["jamais","parfois"],"routeKey":"activite_physique"}$b$::jsonb),
  (fac_id, 6, $b$Prenez-vous au moins 5 semaines de congé par an ?$b$, 'yesno', yesno, 'na', $b${"triggerValues":["non"],"routeKey":"repos"}$b$::jsonb);

-- ============================================================================
-- Routage des cartes ressources (clé → carte)
-- ============================================================================
insert into public.questionnaire_routing (questionnaire_id, ordre, condition, carte) values
  (q_id, 1, $j${"key":"sps"}$j$::jsonb,
     $j${"key":"sps","variant":"sps","title":"Besoin d'être écouté·e ?","body":"SPS — Soins aux Professionnels en Santé met à votre disposition une ligne d'écoute par des psychologues, gratuite, anonyme et confidentielle, 24h/24 et 7j/7. Votre médecin traitant est aussi un interlocuteur sans jugement.","phone":"0 805 23 23 36"}$j$::jsonb),
  (q_id, 2, $j${"key":"cdom_onvs"}$j$::jsonb,
     $j${"key":"cdom_onvs","variant":"sensitive","title":"Vous n'êtes pas seul·e face à ça","body":"Le Conseil départemental de l'Ordre et l'ONVS peuvent vous accompagner, en toute confidentialité.","href":"https://sante.gouv.fr/professionnels/ameliorer-les-conditions-d-exercice/observatoire-national-des-violences-en-sante/"}$j$::jsonb),
  (q_id, 3, $j${"key":"inrs_tms"}$j$::jsonb,
     $j${"key":"inrs_tms","variant":"default","title":"Étirements & pauses actives","body":"Des gestes simples entre deux patients réduisent les tensions cervicales et lombaires. Voir aussi le dossier INRS sur les troubles musculo-squelettiques.","href":"https://www.inrs.fr/risques/tms-troubles-musculosquelettiques/ce-qu-il-faut-retenir.html"}$j$::jsonb),
  (q_id, 4, $j${"key":"ergonomie_poste"}$j$::jsonb,
     $j${"key":"ergonomie_poste","variant":"default","title":"Évaluer son poste de travail","body":"Faire évaluer tabouret, fauteuil et éclairage limite les douleurs sur le long terme."}$j$::jsonb),
  (q_id, 5, $j${"key":"loupes"}$j$::jsonb,
     $j${"key":"loupes","variant":"default","title":"Loupes & microscope : la posture","body":"Le travail sous grossissement fige la posture cervicale. Quelques réglages et pauses ciblées font la différence."}$j$::jsonb),
  (q_id, 6, $j${"key":"medecin_traitant"}$j$::jsonb,
     $j${"key":"medecin_traitant","variant":"default","title":"Avoir un médecin traitant","body":"Un médecin traitant déclaré assure votre suivi et un meilleur remboursement (recoupe l'Action C)."}$j$::jsonb),
  (q_id, 7, $j${"key":"bilan_sante"}$j$::jsonb,
     $j${"key":"bilan_sante","variant":"default","title":"Faire un bilan de santé","body":"Un bilan (sang, vision, audition) tous les 2-3 ans est un repère simple de prévention."}$j$::jsonb),
  (q_id, 8, $j${"key":"medecine_travail"}$j$::jsonb,
     $j${"key":"medecine_travail","variant":"default","title":"Médecine du travail","body":"Un suivi par la médecine du travail protège votre santé au poste (Action D)."}$j$::jsonb),
  (q_id, 9, $j${"key":"sommeil"}$j$::jsonb,
     $j${"key":"sommeil","variant":"default","title":"Sommeil & récupération","body":"Un sommeil non réparateur use sur la durée. Protéger ses nuits est un levier de santé prioritaire."}$j$::jsonb),
  (q_id, 10, $j${"key":"activite_physique"}$j$::jsonb,
     $j${"key":"activite_physique","variant":"default","title":"Bouger un peu plus","body":"L'OMS recommande environ 150 minutes d'activité modérée par semaine. Même fractionnée, elle compte."}$j$::jsonb),
  (q_id, 11, $j${"key":"repos"}$j$::jsonb,
     $j${"key":"repos","variant":"default","title":"Droit au repos","body":"Prendre ses congés n'est pas un luxe : c'est une condition de soins de qualité dans la durée."}$j$::jsonb);

end
$seed$;
