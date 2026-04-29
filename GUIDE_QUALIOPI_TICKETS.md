# GUIDE QUALIOPI — Tickets actionnables pour mise en conformité

**Version** : 1.0
**Date** : 29 avril 2026
**Porteur** : Dr Julie Fantin — Dentalschool / EROJU SAS
**Échéance** : Certificat Qualiopi QUA006589 expire le **27/12/2026**
**Audit ICPF visé** : juillet 2026

---

## 0. Comment utiliser ce document

1. Chaque ticket est traité dans **une discussion Claude dédiée**, comme la méthode utilisée pour les Tickets News (cf `RECAP_SESSION_*_TICKET*_NEWS.md`).
2. Pour ouvrir une nouvelle session, copier-coller le **Prompt d'amorçage** du ticket dans une nouvelle fenêtre Claude.
3. Claude lit d'abord le contexte projet (récaps + ce guide), puis attaque le ticket.
4. Un PR par ticket, validation Dr Fantin avant merge, pas d'enchaînement avant validation.
5. À la fin de chaque session, créer un récap `RECAP_QUALIOPI_TICKET_X_DDMMMYYYY.md` à la racine du repo.

---

## 1. Vue d'ensemble — Indicateurs restants

Sur les 22 indicateurs Qualiopi applicables à EROJU, voici ceux qui restent à traiter (état au 29/04/2026) :

| # | Indicateur | Localisation | Priorité | Ticket |
|---|---|---|---|---|
| 30 | Appréciations stagiaires | App | 🔴 BLOQUANT | **Ticket A** |
| 17 | Référent handicap + accessibilité | dentalschool.fr | 🔴 BLOQUANT | **Ticket B** |
| 26 | Handicap (lié 17) | dentalschool.fr | 🔴 BLOQUANT | (inclus Ticket B) |
| 2 | Indicateurs de résultats publics | dentalschool.fr | 🔴 BLOQUANT | **Ticket C** |
| 1 | Info claire et complète | dentalschool.fr + app | 🟡 Recommandé | **Ticket D** |
| 21 | Compétences formateurs | dentalschool.fr | 🟡 Recommandé | **Ticket E** |
| 22 | Veille | dentalschool.fr | 🟡 Recommandé | **Ticket F** |
| 32 | Amélioration continue | dentalschool.fr | 🟡 Recommandé | **Ticket G** |

**4 bloquants absolus** à traiter en priorité avant juillet 2026.

---

## 2. Ticket A — Questionnaire de satisfaction (#30)

### Contexte
Indicateur #30 du référentiel : *"L'organisme recueille les appréciations des parties prenantes (bénéficiaires, financeurs, équipes pédagogiques)."*

Ce ticket finalise la Phase B2 prévue de longue date dans le plan d'attestations.

### Périmètre
- Table `satisfaction_surveys` (à chaud, fin de formation)
- Table `cold_surveys` (à froid, 3 mois après)
- Modal bloquant avant téléchargement attestation formation
- Email de relance à froid (3 mois) — peut être manuel pour démarrer
- Items proposés : note globale (1-5), note contenu, note pédagogie, note ergonomie, NPS, 3 champs texte optionnels (points forts, à améliorer, libre)

### Décisions à arbitrer dans la session
- Satisfaction obligatoire pour EPP aussi ? (reportée 22/04)
- Workflow CGU à mettre à jour (mention questionnaire obligatoire)
- Ajout dans le dashboard admin pour consultation par formation
- Calcul automatique des indicateurs publics agrégés (nourrit le Ticket C)

### Effort estimé
1 session longue (4-6h) — Phase de migration SQL + composants React + intégration dans le bouton "Obtenir mon attestation".

### Documents de référence
- `PLAN_ATTESTATIONS_QUALIOPI.md` §E.1 — spec initiale satisfaction
- `RECAP_DENTALLEARN_V3_22AVRIL2026.md` — décisions Phase B2

### Prompt d'amorçage

```
Tu travailles sur le projet DentalLearn (repo DentalLearn-V3, stack
Next.js 14 / TypeScript / Supabase / Vercel). Editeur : EROJU SAS,
marque Dentalschool Formations.

MISSION : implémenter le Ticket A Qualiopi — questionnaire de
satisfaction obligatoire avant téléchargement d'attestation
(indicateur Qualiopi #30).

Avant d'écrire la moindre ligne de code :

1. Lis intégralement à la racine du repo :
   - GUIDE_QUALIOPI_TICKETS.md (§2 Ticket A)
   - PLAN_ATTESTATIONS_QUALIOPI.md (Phase B2)
   - RECAP_DENTALLEARN_V3_22AVRIL2026.md (décisions plan)
   - RECAP_DENTALLEARN_V3_29AVRIL2026.md (état actuel)
2. Inspecte les hooks existants :
   - src/components/attestations/GenerateAttestationButton.tsx
     (où intercaler la modal satisfaction)
   - src/lib/attestations/ (pour la chaîne PDF actuelle)
3. Inspecte le schéma Supabase via le MCP Supabase (list_tables) pour
   confirmer qu'aucune table satisfaction_surveys n'existe encore.

CONTRAINTES NON-NÉGOCIABLES
============================
- Modal STRICTEMENT bloquante (aucun contournement, validé 22/04).
- 7 items obligatoires : 4 notes 1-5 + NPS booléen + 3 champs texte
  optionnels.
- Une seule réponse par (user_id, formation_id) — contrainte UNIQUE.
- Soumission AVANT déclenchement de saveAttestation().
- Calculs agrégés exposés via une RPC pour préparer le Ticket C
  (page indicateurs publics).
- Mention CGU à ajouter (champ texte uniquement, pas de modif juriste
  dans ce ticket).

ATTENDU EN SORTIE
=================
1. Migration SQL : tables satisfaction_surveys + cold_surveys + RLS
2. Composant SatisfactionSurveyModal.tsx (bloquant)
3. Intégration dans GenerateAttestationButton.tsx (avant saveAttestation)
4. Hook useSatisfactionSurvey (check existence + soumission)
5. Page admin /admin/satisfaction (vue agrégée par formation)
6. RPC get_satisfaction_indicators(formation_id) : moyennes + NPS + nb_responses

À la fin, production d'un récap RECAP_QUALIOPI_TICKET_A_<DATE>.md.
```

### Critères de validation
- [ ] Migration SQL exécutée sans erreur
- [ ] Modal s'ouvre quand RPPS OK + clic sur "Obtenir mon attestation"
- [ ] Modal non fermable autrement qu'en soumettant
- [ ] Une fois soumise, l'attestation se génère immédiatement
- [ ] Tentative 2ème téléchargement : modal saute (déjà répondu)
- [ ] Page `/admin/satisfaction` affiche les agrégats par formation
- [ ] Build Next.js passe

---

## 3. Ticket B — Page handicap dentalschool.fr (#17 + #26)

### Contexte
Indicateur #17 : *"L'organisme désigne un référent chargé des questions de handicap."*
Indicateur #26 : *"L'organisme met en œuvre les adaptations nécessaires aux personnes en situation de handicap."*

### Périmètre
- Remettre en ligne sur dentalschool.fr la page handicap **déjà rédigée** en archive de l'ancien site
- Ajouter le contenu requis :
  - Désignation du référent handicap (Dr Julie Fantin par défaut)
  - Email de contact dédié : `accessibilite@dentalschool.fr` (à créer)
  - Procédure d'adaptation : demande par email → réponse sous 48h
  - Liste des ressources adaptées disponibles (transcriptions audio, sous-titres si vidéo, formats lecteur d'écran)
  - Délai de mise en place adaptation (max 30 jours)
- Lier la page depuis le footer du site
- Référencer la page dans les CGU et la politique de confidentialité

### Décisions à arbitrer dans la session
- Création de l'adresse `accessibilite@dentalschool.fr` ou utilisation de `contact@`
- Format de la page : page WordPress, statique, ou autre selon stack dentalschool.fr
- Transcription des audios DentalLearn nécessaire ? Si oui, ce sera un sous-ticket dédié

### Effort estimé
2-3h — surtout du contenu et publication, peu de dev (sauf audit RGAA si requis).

### Action complémentaire app DentalLearn
Dans le footer de l'app, ajouter un lien `Accessibilité` qui pointe vers `https://www.dentalschool.fr/accessibilite`.

### Prompt d'amorçage

```
Tu travailles sur le site dentalschool.fr (PAS l'app DentalLearn-V3).

MISSION : remettre en ligne la page Accessibilité / Handicap pour
respecter les indicateurs Qualiopi #17 et #26.

CONTEXTE :
- La page existait déjà sur l'ancien site, archive en local de Julie.
- Référent handicap : Dr Julie Fantin
- Email de contact : à arbitrer dans la session (accessibilite@ ou
  contact@dentalschool.fr)
- Délai de réponse engagé : 48h
- Délai de mise en place adaptation : 30 jours max

LIVRABLES :
1. Page accessible sur https://www.dentalschool.fr/accessibilite
2. Lien dans le footer du site
3. Audit RGAA simplifié (couleurs, contrastes, navigation clavier,
   alt textes) du site dentalschool.fr — produire un rapport listant
   les points à corriger
4. Mention "page accessibilité" ajoutée dans les CGU et la politique
   de confidentialité

EN PARALLÈLE côté app DentalLearn :
- Ajouter dans le footer global de l'app un lien
  "Accessibilité" → https://www.dentalschool.fr/accessibilite
  (commit séparé sur DentalLearn-V3)
```

### Critères de validation
- [ ] Page `dentalschool.fr/accessibilite` en ligne et accessible
- [ ] Référent handicap nommé avec email dédié
- [ ] Procédure d'adaptation décrite
- [ ] Lien footer site web
- [ ] Lien footer app DentalLearn
- [ ] Audit RGAA produit (même partiel)

---

## 4. Ticket C — Page indicateurs qualité dentalschool.fr (#2)

### Contexte
Indicateur #2 : *"L'organisme rend publics les indicateurs de résultats appropriés à la nature des prestations."*

### Périmètre
Page publique sur dentalschool.fr affichant :
- Taux de satisfaction (cible 85%+)
- Taux de recommandation NPS (cible 80%+)
- Taux de présence aux séances / complétion (cible 90%+)
- Taux de réponse aux questionnaires (cible 70%+)
- Mise à jour trimestrielle minimum

**Seuil de publication validé** : minimum **30 réponses** par formation avant affichage public. En dessous : "Données en cours de collecte — résultats publiés dès 30 évaluations."

**Pré-requis** : Ticket A (questionnaire satisfaction) doit être livré avant pour avoir des données à afficher.

### Décisions à arbitrer dans la session
- Update manuel ou automatique des indicateurs sur dentalschool.fr (export CSV depuis Supabase ?)
- Granularité : indicateur global ou par formation ?
- Période : depuis le début ou glissant 12 mois ?

### Données à exposer (validées par Julie)

```
Engagement des apprenants
Statistiques calculées sur l'ensemble de vos sessions

Taux de satisfaction         93%
Taux de recommandation       100%
Taux de présence aux séances 97%
Taux de réponse questionnaires 100%
```

### Effort estimé
3-4h selon la stack dentalschool.fr. Possibilité de simplifier en publication manuelle initialement, puis automatiser plus tard.

### Action complémentaire app DentalLearn
Footer global avec lien `Indicateurs qualité` → `https://www.dentalschool.fr/qualite`.

### Prompt d'amorçage

```
Tu travailles sur le site dentalschool.fr (PAS l'app DentalLearn-V3).

MISSION : créer la page publique "Indicateurs qualité" pour respecter
l'indicateur Qualiopi #2.

CONTEXTE :
- Données initiales validées par Julie :
  * Taux de satisfaction : 93%
  * Taux de recommandation : 100%
  * Taux de présence : 97%
  * Taux de réponse questionnaires : 100%
- Seuil de publication : 30 réponses minimum par formation
- Mise à jour trimestrielle (à formaliser dans une procédure interne)

LIVRABLES :
1. Page accessible sur https://www.dentalschool.fr/qualite
2. Affichage des 4 indicateurs avec libellé clair, valeur en %, et
   éventuellement un visuel barre/jauge
3. Mention "Mis à jour le JJ/MM/AAAA"
4. Mention seuil minimal "Données calculées sur 30+ évaluations
   validées"
5. Lien dans le footer du site
6. Procédure interne documentée pour mise à jour trimestrielle (qui,
   quand, comment exporter de Supabase)

EN PARALLÈLE côté app DentalLearn :
- Ajouter dans le footer global de l'app un lien "Indicateurs qualité"
  → https://www.dentalschool.fr/qualite (commit séparé)

PRÉ-REQUIS : Ticket A (questionnaire satisfaction) livré pour avoir
des données fiables. À défaut, démarrer avec les valeurs validées
ci-dessus pour la première publication.
```

### Critères de validation
- [ ] Page `dentalschool.fr/qualite` en ligne
- [ ] 4 indicateurs affichés avec date de mise à jour
- [ ] Mention seuil 30 réponses
- [ ] Lien footer site
- [ ] Lien footer app
- [ ] Procédure interne documentée

---

## 5. Ticket D — Page formation publique enrichie (#1)

### Contexte
Indicateur #1 : *"L'organisme diffuse une information accessible au public, détaillée et vérifiable, sur les prestations proposées."*

### Périmètre
Pour chaque formation, exposer publiquement :
- Intitulé
- Public cible
- Prérequis
- Objectifs pédagogiques
- Contenu (programme)
- Durée
- Modalités pédagogiques (audio, quiz, dialogue Sophie/Martin)
- Modalités d'évaluation (15 séquences avec quiz)
- Tarifs (ou "sur devis" si confidentiel)
- Modalités d'accès (en ligne, sans rendez-vous)
- Délai d'accès (immédiat après inscription)
- Méthodes mobilisées
- Contact
- Référent handicap
- Indicateurs de résultats spécifiques formation (lien vers /qualite)

### Localisation
- **Chaque formation publiée** doit avoir une page publique sur dentalschool.fr (ou sur l'app accessible sans login)
- Format proposé : page par formation `/formations/{slug}`

### Effort estimé
4-5h pour le template + génération des pages depuis la base Supabase.

### Prompt d'amorçage

```
[À écrire après les Tickets B et C, selon les arbitrages stack
dentalschool.fr]
```

---

## 6. Ticket E — Page équipe pédagogique + DPI (#21)

### Contexte
Indicateur #21 : *"L'organisme s'assure des compétences des personnels chargés de mettre en œuvre les prestations."*

### Périmètre
Page publique listant les formateurs avec :
- Nom, titre, photo (avec autorisation)
- CV résumé (formation initiale, expérience, publications)
- Domaine d'expertise dans DentalLearn
- DPI (Déclaration Publique d'Intérêts) au format réglementaire

### Formateurs identifiés
- Dr Julie Fantin (responsable pédagogique)
- Dr Laurent Elbeze (Esthétique — Éclaircissements/Taches blanches)
- Dr Alexis Gaudin (Comité scientifique)
- Dr Philippe Bargman (Comité scientifique)
- Dr Gauthier Weisrock (Restauratrice — Fêlures/Overlays)
- Autres à compléter

### Effort estimé
3-4h après réception des CV et DPI signés par chaque formateur.

### Action préalable hors dev
Récupérer auprès de chaque formateur :
- Photo officielle
- CV de 5-10 lignes
- DPI signée (formulaire ANDPC standard)
- Autorisation publication

### Prompt d'amorçage

```
[À écrire après réception des contenus formateurs]
```

---

## 7. Ticket F — Page Veille scientifique (#22)

### Contexte
Indicateur #22 : *"L'organisme développe une veille sur les évolutions des compétences."*

### Périmètre
Page publique sur dentalschool.fr décrivant :
- Sources de veille suivies (revues, bases bibliographiques, congrès)
- Fréquence de mise à jour des contenus
- Lien avec la section News (qui est elle-même une preuve de veille active)

**Forte synergie avec le pipeline News** : la section News quotidienne EST la preuve vivante de la veille. À mentionner explicitement.

### Effort estimé
1-2h (essentiellement éditorial).

### Prompt d'amorçage

```
[À écrire en s'appuyant sur spec_news_podcast_pipeline_v1_3.md
qui décrit déjà tout le système de veille]
```

---

## 8. Ticket G — Bilan qualité annuel (#32)

### Contexte
Indicateur #32 : *"L'organisme met en œuvre les mesures d'amélioration à partir de l'analyse des appréciations et des réclamations."*

### Périmètre
Document annuel téléchargeable depuis dentalschool.fr présentant :
- Indicateurs annuels (satisfaction, NPS, complétion)
- Synthèse des réclamations reçues et traitées (anonymisé)
- Améliorations apportées suite aux retours
- Plan d'amélioration pour l'année suivante

**Pré-requis** : Tickets A (satisfaction) et #31 (réclamations, livré 29/04) doivent avoir au moins 12 mois de données.

### Effort estimé
2-3h pour le template + 1 jour rédaction annuelle.

### Prompt d'amorçage

```
[À écrire au moment de produire le premier bilan annuel]
```

---

## 9. Workflow de revue (commun à tous les tickets)

1. Une nouvelle discussion Claude par ticket
2. Lecture obligatoire des récaps + ce guide en début de session
3. Inspection MCP Supabase si modifications BDD prévues
4. Migration SQL d'abord, validée avant code
5. PR séparée par ticket avec validation Dr Fantin
6. Pas d'enchaînement sur le ticket suivant avant merge
7. Récap `RECAP_QUALIOPI_TICKET_<X>_<DATE>.md` produit en fin de session
8. Mise à jour du présent guide pour faire avancer le statut

---

## 10. Roadmap suggérée

### Mai 2026 — Tickets bloquants
- Semaine 1 (5-9 mai) : Ticket A — Questionnaire satisfaction
- Semaine 2 (12-16 mai) : Ticket B — Page handicap + lien app
- Semaine 3 (19-23 mai) : Ticket C — Page indicateurs qualité + lien app
- Semaine 4 (26-30 mai) : audit blanc Qualiopi interne avec Julie

### Juin 2026 — Tickets recommandés
- Ticket D — Pages formation publiques
- Ticket E — Page équipe + DPI
- Ticket F — Page Veille
- Préparation dossier audit ICPF

### Juillet 2026
- Dépôt dossier renouvellement ICPF
- Audit prévu septembre-octobre 2026

### Décembre 2026
- Limite : certificat actuel expire 27/12/2026

---

## 11. Documents associés

À la racine du repo `DentalLearn-V3` :
- `PLAN_ATTESTATIONS_QUALIOPI.md` — plan stratégique initial 22/04/2026
- `RECAP_DENTALLEARN_V3_22AVRIL2026.md` — Phase A + B1 livrées
- `RECAP_DENTALLEARN_V3_29AVRIL2026.md` — finalisation B1 + indicateur #31
- `REFERENTIEL_CP_.pdf` — référentiel Certification Périodique
- `DENTALLEARN_VISION_EQUIPE_v2_2.docx` — vision projet

Hors repo (à conserver chez Dr Fantin) :
- Certificat Qualiopi QUA006589 (expire 27/12/2026)
- Procédures internes ISO 9001 si applicable
- Registre des aléas et actions correctives
- DPI signées des formateurs (à collecter pour Ticket E)

---

*Fin du guide v1.0. Document vivant, à mettre à jour au fil de l'avancement des tickets.*
