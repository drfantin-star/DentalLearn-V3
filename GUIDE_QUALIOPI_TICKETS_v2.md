# GUIDE QUALIOPI — Tickets actionnables pour mise en conformité

**Version** : 2.0 — IA Act intégré
**Date** : 29 avril 2026
**Porteur** : Dr Julie Fantin — Dentalschool / EROJU SAS
**Échéances** :
- Certificat Qualiopi QUA006589 expire le **27/12/2026**
- Audit ICPF visé : **juillet 2026**
- IA Act Article 50 (transparence IA générative) : **2 août 2026**
- IA Act notices utilisateurs : **2 novembre 2026**

**Journal des versions**
- v1.0 (29/04/2026) — Première version, 7 tickets Qualiopi
- v2.0 (29/04/2026) — Ticket E refondu (modèle hybride CS + IA + masterclass), ajout Tickets H (Charte IA interne) et I (Transparence IA externe), roadmap réajustée

---

## 0. Comment utiliser ce document

1. Chaque ticket est traité dans **une discussion Claude dédiée**, comme la méthode utilisée pour les Tickets News (cf `RECAP_SESSION_*_TICKET*_NEWS.md`).
2. Pour ouvrir une nouvelle session, copier-coller le **Prompt d'amorçage** du ticket dans une nouvelle fenêtre Claude.
3. Claude lit d'abord le contexte projet (récaps + ce guide), puis attaque le ticket.
4. Un PR par ticket, validation Dr Fantin avant merge, pas d'enchaînement avant validation.
5. À la fin de chaque session, créer un récap `RECAP_QUALIOPI_TICKET_X_DDMMMYYYY.md` à la racine du repo.

---

## 1. Vue d'ensemble — Indicateurs et obligations restantes

| # | Indicateur / Obligation | Localisation | Priorité | Ticket |
|---|---|---|---|---|
| 30 | Appréciations stagiaires | App | 🔴 Bloquant Qualiopi | **A** |
| 17 | Référent handicap + accessibilité | dentalschool.fr | 🔴 Bloquant Qualiopi | **B** |
| 26 | Handicap (lié 17) | dentalschool.fr | 🔴 Bloquant Qualiopi | (inclus B) |
| 2 | Indicateurs de résultats publics | dentalschool.fr | 🔴 Bloquant Qualiopi | **C** |
| 1 | Info claire et complète | dentalschool.fr + app | 🟡 Recommandé | **D** |
| 21 | Compétences formateurs | dentalschool.fr | 🟡 Recommandé | **E** (refondu) |
| 22 | Veille | dentalschool.fr | 🟡 Recommandé | **F** |
| 32 | Amélioration continue | dentalschool.fr | 🟡 Recommandé | **G** |
| **AI Act Art.4** | **Charte IA + AI literacy** | Interne EROJU | 🟠 **Bloquant IA Act** | **H** |
| **AI Act Art.50** | **Transparence IA externe** | App + dentalschool.fr | 🟠 **Bloquant IA Act** | **I** |

**4 bloquants Qualiopi** + **2 bloquants IA Act** = 6 dossiers prioritaires.

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
Chaque formation publiée doit avoir une page publique sur dentalschool.fr (ou sur l'app accessible sans login). Format proposé : page par formation `/formations/{slug}`.

### Effort estimé
4-5h pour le template + génération des pages depuis la base Supabase.

### Prompt d'amorçage
À écrire après les Tickets B et C, selon les arbitrages stack dentalschool.fr.

---

## 6. Ticket E (REFONDU v2.0) — Démarche pédagogique et compétences (#21)

### Contexte
Indicateur #21 : *"L'organisme s'assure des compétences des personnels chargés de mettre en œuvre les prestations."*

**⚠️ Spécificité du modèle DentalLearn** : contrairement à un OF classique, DentalLearn produit du contenu via IA générative validé par un comité scientifique. Les "formateurs" au sens Qualiopi sont les membres du comité scientifique qui évaluent chaque contenu, pas des intervenants en présentiel. Des masterclass virtuelles avec formateurs invités sont prévues à l'avenir.

### Architecture pédagogique

| Rôle | Action | Statut Qualiopi |
|---|---|---|
| **Comité scientifique** (Elbeze, Gaudin, Bargman, Weisrock, autres) | Valide scientifiquement chaque contenu produit | ✅ Formateur Qualiopi |
| **Dr Julie Fantin** | Conçoit le programme + responsable pédagogique | ✅ Formateur Qualiopi |
| **Claude (IA)** | Génère le contenu rédactionnel | ❌ Outil de production |
| **Sophie & Martin (TTS ElevenLabs)** | Lisent les podcasts | ❌ Voix de synthèse |
| **Formateurs masterclass futurs** | Animent classes virtuelles 1-2h | ✅ Formateur Qualiopi (à venir) |

### Périmètre du ticket

#### A. Page publique "Notre démarche pédagogique" sur dentalschool.fr
Page qui transparentise le modèle hybride :
- Présentation du comité scientifique avec photos, titres, domaines d'expertise
- Explication du processus de production : recherche → rédaction IA → validation comité → enregistrement audio → publication
- Mention claire de l'usage d'IA générative (cohérent avec Ticket I — Transparence IA)
- Annonce des masterclass live ponctuelles (à venir)
- Lien vers la Charte IA publique (Ticket I)

#### B. Documents internes par membre du comité scientifique
Pour chaque membre, dossier confidentiel à conserver chez Julie :
- CV complet (titres, publications, expérience clinique)
- Justificatif du domaine d'expertise (correspondance avec thèmes validés)
- Engagement de validation scientifique (lettre/contrat)
- DPI (Déclaration Publique d'Intérêts) au format ANDPC, signée annuellement
- Photo officielle + autorisation de publication

#### C. Procédure de validation scientifique
Document interne décrivant le workflow :
- Réception du contenu généré par IA
- Critères de validation scientifique
- Qui valide quoi selon les thématiques
- Délais
- Trace de validation (à conserver pour audit)
- Procédure de rectification si erreur détectée post-publication

#### D. Anticipation masterclass virtuelles (cadre)
Document cadre pour quand tu lanceras les masterclass :
- Modèle de contrat formateur invité (prestation de service)
- Checklist vérification compétences pré-intervention
- Modèle DPI à faire signer
- Modèle autorisation publication
- Évaluation post-masterclass spécifique
- Référencement automatique sur la page démarche pédagogique

### Membres comité scientifique identifiés
- **Dr Julie Fantin** — responsable pédagogique
- **Dr Laurent Elbeze** — Esthétique (Éclaircissements / Taches blanches)
- **Dr Alexis Gaudin** — Comité scientifique
- **Dr Philippe Bargman** — Comité scientifique
- **Dr Gauthier Weisrock** — Restauratrice (Fêlures / Overlays)
- Autres à compléter selon évolution

### Décisions à arbitrer dans la session
- Localisation page : dentalschool.fr ou aussi mention dans l'app ?
- Niveau de détail public sur la chaîne de production IA
- Rythme renouvellement DPI (annuel ? bi-annuel ?)
- Gestion administrative DPI (papier scanné ou outil dédié ?)
- Accès aux contrats CS : qui les conserve, où, sauvegarde

### Action préalable hors dev (à faire AVANT la session)
Récupérer auprès de chaque membre du CS :
- Photo officielle haute résolution
- CV de 5-10 lignes
- Liste des publications scientifiques (3-5 références)
- DPI signée selon modèle ANDPC
- Autorisation de publication signée

### Effort estimé
- Récupération contenus formateurs : 1-2 semaines (dépend des disponibilités)
- Rédaction page démarche pédagogique : 3-4h
- Rédaction documents internes : 2-3h
- Mise en ligne sur dentalschool.fr : 2-3h
- Total : ~1 jour de dev une fois les contenus collectés

### Action complémentaire app DentalLearn
- Dans le footer de l'app, ajouter un lien `Démarche pédagogique` → `https://www.dentalschool.fr/demarche-pedagogique`
- Sur la fiche de chaque formation, mention courte : "Contenu validé par notre comité scientifique"

### Prompt d'amorçage

```
Tu travailles sur le site dentalschool.fr ET le projet DentalLearn-V3.

MISSION : créer la page publique "Notre démarche pédagogique" et les
documents internes nécessaires à l'indicateur Qualiopi #21
(compétences formateurs).

CONTEXTE PARTICULIER : DentalLearn fonctionne en modèle hybride.
Les "formateurs" au sens Qualiopi sont les membres du comité
scientifique qui valident le contenu produit par IA générative
(Claude, ElevenLabs). Pas de formateurs présentiels actuellement.
Des masterclass virtuelles sont prévues à terme.

LIRE EN PRIORITÉ :
- GUIDE_QUALIOPI_TICKETS.md §6 Ticket E (refondu v2.0)
- CHARTE_IA_DENTALSCHOOL.md (modèle Charte IA fournie)
- RECAP_DENTALLEARN_V3_29AVRIL2026.md

LIVRABLES :
1. Page publique sur https://www.dentalschool.fr/demarche-pedagogique
   - Présentation comité scientifique (photos, CV résumé, DPI résumé)
   - Explication processus production hybride IA + validation humaine
   - Annonce masterclass live à venir
2. Documents internes confidentiels (1 par membre CS) :
   - CV + DPI + contrat validation
3. Procédure interne de validation scientifique
4. Cadre futur pour masterclass virtuelles
5. Côté app : footer + mention "Validé comité scientifique" sur fiches formation

DÉCISIONS À ARBITRER :
- Niveau de transparence sur usage IA (cohérent avec Ticket I)
- Rythme renouvellement DPI
- Gestion administrative DPI

À la fin : récap RECAP_QUALIOPI_TICKET_E_<DATE>.md.
```

### Critères de validation
- [ ] Page démarche pédagogique en ligne sur dentalschool.fr
- [ ] CV + DPI conservés en interne pour chaque membre CS
- [ ] Procédure validation scientifique formalisée
- [ ] Cadre masterclass futurs prêt
- [ ] Lien footer app
- [ ] Mention "Validé CS" sur fiches formation app
- [ ] Cohérence avec Charte IA (Ticket H) et page Transparence (Ticket I)

---

## 7. Ticket F — Page Veille scientifique (#22)

### Contexte
Indicateur #22 : *"L'organisme développe une veille sur les évolutions des compétences."*

### Périmètre
Page publique sur dentalschool.fr décrivant :
- Sources de veille suivies (PubMed, Cochrane, BDJ, HAS, L'Information Dentaire, etc.)
- Fréquence de mise à jour des contenus
- Lien avec la section News (qui est elle-même une preuve de veille active)

**Forte synergie avec le pipeline News** : la section News quotidienne EST la preuve vivante de la veille. À mentionner explicitement avec lien vers `https://dental-learn-v3.vercel.app/news` (ou domaine final).

### Effort estimé
1-2h (essentiellement éditorial).

### Prompt d'amorçage
À écrire en s'appuyant sur `spec_news_podcast_pipeline_v1_3.md` qui décrit déjà tout le système de veille.

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

---

## 9. Ticket H (NEW v2.0) — Charte IA interne + AI literacy (Article 4 IA Act)

### Contexte
**Article 4 IA Act en vigueur depuis le 2 février 2025** : tout déployeur d'IA doit assurer un niveau suffisant de maîtrise de l'IA (AI literacy) pour son personnel. Une formation documentée adaptée aux systèmes utilisés est attendue par les autorités de contrôle.

DentalLearn utilise Claude (Anthropic) pour la rédaction et ElevenLabs pour la synthèse vocale. Statut : **déployeur** d'IA générative à risque limité.

### Périmètre

#### A. Charte IA interne (`CHARTE_IA_DENTALSCHOOL.md`)
Document fondateur qui formalise :
1. Cartographie des usages IA (Claude, ElevenLabs, et tout futur outil)
2. Données autorisées et interdites de traitement par IA
3. Mécanismes de contrôle humain et validation
4. Engagement de transparence envers utilisateurs
5. Engagement de non-discrimination et lutte contre les biais
6. Procédure d'évaluation des nouveaux outils IA avant adoption
7. Registre des incidents (hallucinations, erreurs détectées)
8. Engagement de formation continue de l'équipe

Modèle prêt à personnaliser fourni séparément (`CHARTE_IA_DENTALSCHOOL.md`).

#### B. Plan de formation AI literacy
Pour chaque membre de l'équipe utilisant des systèmes IA (actuellement : Julie seule, élargissable plus tard) :
- Formation initiale documentée (cf §3 du modèle de charte)
- Évaluation annuelle des connaissances
- Mise à jour selon évolution des outils
- Trace écrite de la formation (date, contenu, durée)

#### C. Registre des évaluations de conformité
Document Excel ou table Notion à tenir :
- Date d'évaluation
- Outil concerné
- Cas d'usage
- Niveau de risque IA Act
- Contrôles mis en place
- Responsable

#### D. Mention dans la documentation interne
Référence à la Charte IA dans :
- Politique qualité ISO 9001 (si applicable)
- Procédures Qualiopi
- Contrats avec collaborateurs

### Décisions à arbitrer dans la session
- Validation formelle du modèle de charte fourni
- Personnalisation des engagements selon vision EROJU
- Choix de la méthode AI literacy : auto-formation, MOOC certifiant, conseil externe
- Diffusion de la charte : interne uniquement ou publication partielle ?
- Outil de tenue du registre : tableur, Notion, autre

### Effort estimé
- Personnalisation charte : 2-3h
- Plan de formation Julie : 1 jour de formation auto-encadrée
- Documentation registre : 1-2h
- Total : 1-2 jours

### Pré-requis hors dev
Aucun pré-requis dépendant d'autres tickets. Peut être fait en parallèle des autres.

### Prompt d'amorçage

```
Tu accompagnes Dr Julie Fantin (EROJU SAS) dans la mise en conformité
IA Act Article 4 (AI literacy + Charte IA interne).

CONTEXTE :
- EROJU SAS est déployeur d'IA générative (Claude, ElevenLabs)
- Risque IA Act : limité (Article 50 transparence)
- AI literacy : obligation en vigueur depuis février 2025

LIRE EN PRIORITÉ :
- GUIDE_QUALIOPI_TICKETS.md §9 Ticket H
- CHARTE_IA_DENTALSCHOOL.md (modèle prêt à personnaliser)

LIVRABLES :
1. Charte IA personnalisée pour EROJU SAS, signée par Julie
2. Plan de formation AI literacy de Julie (programme, durée,
   évaluation, traces)
3. Registre des évaluations de conformité (modèle + 1ère entrée)
4. Procédure de mise à jour annuelle de la charte

DÉCISIONS À PRENDRE :
- Méthode AI literacy : auto-formation (gratuite, ~1 jour) vs MOOC
  certifiant (CNIL, ~3 jours, payant) vs conseil externe (1 demi-jour
  expert IA Act)
- Charte publiée publiquement ou interne seule
- Outil registre : tableur Excel, Notion, ou autre

À la fin : récap RECAP_QUALIOPI_TICKET_H_<DATE>.md + Charte IA
finalisée et signée.
```

### Critères de validation
- [ ] Charte IA personnalisée et signée
- [ ] Formation AI literacy de Julie effectuée et documentée
- [ ] Registre des évaluations créé avec au moins 2 entrées (Claude + ElevenLabs)
- [ ] Procédure de mise à jour annuelle formalisée
- [ ] Documents archivés dans le dossier conformité EROJU

---

## 10. Ticket I (NEW v2.0) — Transparence IA externe (Article 50 IA Act)

### Contexte
**Article 50 IA Act applicable au 2 août 2026** : obligation de transparence envers utilisateurs finaux pour les systèmes interactifs et génératifs. Les contenus générés par IA doivent être clairement identifiables. Échéance ferme : **2 novembre 2026** pour les notices d'information utilisateurs.

### Périmètre

#### A. Étiquetage du contenu généré dans l'app
- Badge visuel sur chaque podcast news (ex: "Contenu généré par IA, validé scientifiquement")
- Badge similaire sur les fiches synthèses news
- Mention discrète dans les séquences de formation (si pertinent — à arbitrer si la voix Sophie/Martin est explicitement IA ou si on garde une zone grise narrative)
- Tooltip explicatif au survol du badge avec lien vers la page démarche pédagogique

#### B. Page publique "Transparence IA" sur dentalschool.fr
Page dédiée qui complète la page démarche pédagogique :
- Liste des outils IA utilisés (Claude, ElevenLabs, et autres)
- Description du processus de validation humaine
- Limites connues des outils IA et garde-fous
- Procédure de signalement d'erreur (lien vers `/reclamation`)
- Engagement éditorial (cohérent avec la charte IA)
- Lien vers la Charte IA publique (Ticket H si publication)

#### C. Notice d'information utilisateur (Article 50 strict)
Mention courte, claire, accessible avant utilisation des contenus IA :
- Bandeau lors de la 1ère connexion : *"DentalLearn utilise l'IA générative pour produire ses contenus, validés systématiquement par notre comité scientifique. En savoir plus."*
- Lien vers page Transparence IA
- Acceptation explicite (case à cocher dans les CGU)

#### D. Mise à jour CGU et politique de confidentialité
Sections à ajouter :
- Usage d'IA générative pour la production de contenu
- Outils IA utilisés et fournisseurs
- Politique de validation humaine
- Droit à signalement et rectification
- Cohérence RGPD : pas de données personnelles utilisateurs envoyées aux modèles IA

### Décisions à arbitrer dans la session
- Niveau de visibilité du badge "généré par IA" : discret ou affirmé ?
- Wording exact (privilégier "validé scientifiquement" pour rassurer)
- Acceptation CGU à l'inscription : nouvelle acceptation requise pour utilisateurs existants ?
- Validation juridique du wording (juriste à solliciter ou s'appuyer sur modèles de la CNIL ?)

### Effort estimé
- Composant badge `AIGeneratedBadge` : 1-2h
- Intégration sur cartes news + sequences : 2-3h
- Page Transparence IA dentalschool.fr : 2-3h
- Bandeau notice 1ère connexion : 2h
- Mise à jour CGU + politique confidentialité : 2-3h
- Total : 1 jour de dev + relecture juridique

### Pré-requis
- Ticket H (Charte IA) livré pour références cohérentes
- Idéalement Ticket E (Démarche pédagogique) pour les liens croisés

### Prompt d'amorçage

```
Tu travailles sur le projet DentalLearn (repo DentalLearn-V3) ET le
site dentalschool.fr. Editeur : EROJU SAS.

MISSION : implémenter la transparence IA externe (Article 50 IA Act,
applicable août/novembre 2026).

LIRE EN PRIORITÉ :
- GUIDE_QUALIOPI_TICKETS.md §10 Ticket I
- CHARTE_IA_DENTALSCHOOL.md (charte interne)
- Récap Ticket H (livré au préalable)

LIVRABLES CÔTÉ APP :
1. Composant AIGeneratedBadge réutilisable (variants : podcast,
   synthèse, séquence)
2. Intégration sur cartes news (NewsCard, NewsDetail)
3. Bandeau notice IA en 1ère connexion (acceptation tracée)
4. Mise à jour CGU dans la page d'inscription

LIVRABLES CÔTÉ dentalschool.fr :
1. Page publique "Transparence IA" (https://www.dentalschool.fr/transparence-ia)
2. Lien dans le footer du site
3. Mise à jour politique de confidentialité

CONTRAINTES :
- Wording rassurant mais conforme : "Contenu généré par IA, validé
  scientifiquement"
- Pas de wording sensationnaliste
- Cohérence avec Charte IA et page démarche pédagogique
- Acceptation CGU tracée en DB pour audit

À la fin : récap RECAP_QUALIOPI_TICKET_I_<DATE>.md.
```

### Critères de validation
- [ ] Composant `AIGeneratedBadge` créé et utilisable
- [ ] Badge visible sur tous les contenus IA (podcasts, synthèses, séquences si arbitré)
- [ ] Bandeau 1ère connexion fonctionnel et accepté en DB
- [ ] Page Transparence IA en ligne sur dentalschool.fr
- [ ] CGU mises à jour avec mention IA
- [ ] Politique de confidentialité mise à jour
- [ ] Lien footer site et app
- [ ] Cohérence wording avec Charte IA (Ticket H)

---

## 11. Workflow de revue (commun à tous les tickets)

1. Une nouvelle discussion Claude par ticket
2. Lecture obligatoire des récaps + ce guide en début de session
3. Inspection MCP Supabase si modifications BDD prévues
4. Migration SQL d'abord, validée avant code
5. PR séparée par ticket avec validation Dr Fantin
6. Pas d'enchaînement sur le ticket suivant avant merge
7. Récap `RECAP_QUALIOPI_TICKET_<X>_<DATE>.md` produit en fin de session
8. Mise à jour du présent guide pour faire avancer le statut

---

## 12. Roadmap réajustée v2.0

### Phase 1 — Bloquants Qualiopi (mai 2026)
- Semaine 1 (5-9 mai) : **Ticket A** — Questionnaire satisfaction
- Semaine 2 (12-16 mai) : **Ticket B** — Page handicap + lien app
- Semaine 3 (19-23 mai) : **Ticket C** — Page indicateurs qualité + lien app
- Semaine 4 (26-30 mai) : audit blanc Qualiopi interne avec Julie

### Phase 2 — IA Act (juin 2026)
- Semaine 1 (2-6 juin) : **Ticket H** — Charte IA + AI literacy
- Semaine 2-3 (9-20 juin) : **Ticket I** — Transparence IA externe

### Phase 3 — Recommandés Qualiopi (juin-juillet 2026)
- **Ticket E** — Démarche pédagogique + comité scientifique (en parallèle de la collecte CV/DPI)
- **Ticket D** — Pages formation publiques
- **Ticket F** — Page Veille
- Préparation dossier audit ICPF

### Phase 4 — Audit & échéances finales
- **Juillet 2026** : Dépôt dossier renouvellement ICPF
- **2 août 2026** : Application Article 50 IA Act → Tickets H et I doivent être en place
- **Septembre-octobre 2026** : Audit ICPF Qualiopi
- **2 novembre 2026** : Échéance ferme notices IA Act → vérifier Ticket I
- **27 décembre 2026** : Limite renouvellement Qualiopi (à valider avant)

---

## 13. Documents associés

À la racine du repo `DentalLearn-V3` :
- `PLAN_ATTESTATIONS_QUALIOPI.md` — plan stratégique initial 22/04/2026
- `RECAP_DENTALLEARN_V3_22AVRIL2026.md` — Phase A + B1 livrées
- `RECAP_DENTALLEARN_V3_29AVRIL2026.md` — finalisation B1 + indicateur #31
- `CHARTE_IA_DENTALSCHOOL.md` — modèle Charte IA prête à personnaliser (v2.0 ce guide)
- `REFERENTIEL_CP_.pdf` — référentiel Certification Périodique
- `DENTALLEARN_VISION_EQUIPE_v2_2.docx` — vision projet

Hors repo (à conserver chez Dr Fantin) :
- Certificat Qualiopi QUA006589 (expire 27/12/2026)
- Procédures internes ISO 9001 si applicable
- Registre des aléas et actions correctives
- DPI signées des formateurs (à collecter pour Ticket E)
- Charte IA signée + traces de formation AI literacy (Ticket H)

---

*Fin du guide v2.0. Document vivant, à mettre à jour au fil de l'avancement des tickets.*
