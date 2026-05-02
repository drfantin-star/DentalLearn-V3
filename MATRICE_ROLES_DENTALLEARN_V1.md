# MATRICE DES RÔLES — DentalLearn V1
## Référentiel d'autorisation pour l'architecture multi-tenant

**Date** : 2 mai 2026
**Version** : V1.2 — assistante ajoutée dans training_org
**Auteur** : Dr Julie Fantin (avec assistance Claude)
**Statut** : Validée pour spec technique Sprint 1 (sauf RGPD à confirmer avocat)
**Documents liés** : `DATABASE_SCHEMA.md`, `RECAP_DENTALLEARN_V3_29AVRIL2026.md`

---

## 1. Contexte

DentalLearn évolue d'une application B2C single-tenant vers une **plateforme multi-tenant** capable de servir trois familles d'organisations clientes :

- **Cabinets dentaires libéraux** — modèle historique. Un titulaire + collaborateurs + assistantes.
- **Entités RH / centres de soins** — groupes type VYV dentaire, avec dentistes salariés à suivre.
- **Organismes de formation tiers** — autres OF utilisant DentalLearn comme infrastructure pour distribuer leur propre catalogue à leurs apprenants.

Ce document définit la matrice complète des rôles applicatifs et de leurs autorisations. Il sert de référence unique pour :

- la conception des Row Level Security policies Supabase ;
- les checks d'autorisation côté front (middleware Next.js + composants) ;
- la rédaction des CGU / CGV différenciées par type de tenant ;
- l'onboarding produit (parcours d'accueil par sous-rôle).

**Principe directeur retenu** : isolation stricte du contenu créé par les tenants tiers (RH, OF). Le contenu d'un tenant n'est jamais visible par les utilisateurs d'un autre tenant ni dans le catalogue public Dentalschool. Ta responsabilité scientifique reste circonscrite au contenu Dentalschool.

---

## 2. Hiérarchie globale des rôles

### 2.1 Rôles globaux (transversaux à toutes les organisations)

| Rôle | Périmètre | Description | Statut V1 |
|---|---|---|---|
| `super_admin` | Tout | Toi (Dr Julie Fantin). Accès total backend. Peut impersonner. Modifie le contenu Dentalschool. Gère tous les tenants. | ✅ V1 |
| `formateur` | Ses formations Dentalschool | Formateur intervenant pour Dentalschool. Scopé aux formations qui lui sont assignées par toi. Périmètre V1 = planning + masterclass + stats (pas de création/édition contenu). | ✅ V1 |
| `cs_member` | Validation contenu Dentalschool | Membre Conseil Scientifique. Géré séparément (workflow non automatisé). | 📋 V2 |
| `marketing` | Back-office marketing | Accès aux campagnes emails + publications réseaux sociaux. Pas de contenu pédagogique. | 📋 V2 |
| `support` | Réclamations / tickets | Réponse aux réclamations Qualiopi (table `complaints`). | 📋 V2 |
| `user` | Soi-même | Rôle par défaut. Tout utilisateur final. | ✅ V1 |

**Règle d'attribution** : tout utilisateur a au minimum le rôle `user`. Les autres rôles sont **additifs** et stockés dans `user_roles (user_id, role)`. Un super_admin reste un user (peut suivre des formations).

### 2.2 Rôles intra-organisation

Un même `user` peut être membre d'**une seule organisation à la fois** en V1 (contrainte simplificatrice). L'`intra_role` est polymorphe : sa valeur n'a de sens que combinée à `org.type`.

| Type d'organisation | Sous-rôles intra |
|---|---|
| `cabinet` | `titulaire` / `collaborateur` / `assistante` |
| `hr_entity` | `admin_rh` / `manager` / `praticien_salarie` / `assistante` |
| `training_org` | `admin_of` / `formateur_of` / `apprenant_of` / `assistante` |

**Règle de cohérence** : une CHECK constraint en BDD garantit que `intra_role` est compatible avec `org.type`. Le sous-rôle `assistante` est partagé entre `cabinet`, `hr_entity` et `training_org` (mêmes droits métier dans les trois cas) — pas de duplication de valeur enum.

### 2.3 Schéma de la hiérarchie

```
                          super_admin (Dr Julie Fantin)
                                    │
                ┌───────────────────┼───────────────────┐
                │                   │                   │
            formateur          cs_member            marketing  …  (rôles globaux V2)
                │
        (scopé aux formations Dentalschool assignées)


                                  user (rôle de base)
                                    │
            ┌───────────────────────┼─────────────────────────┐
            │                       │                         │
        Cabinet                 HR Entity                Training Org
            │                       │                         │
   ┌────────┼────────┐    ┌────────┬────────┬───────────┐    ┌──────────┬──────────┬──────────┐
titulaire collab. assist. admin_rh manager prat.salarié assist. admin_of formateur_of appr.  assist.
```

---

## 3. Liste exhaustive des actions applicatives

Avant de croiser actions × rôles, on fige le vocabulaire. Toute action absente de cette liste sera ajoutée par avenant à ce document.

### 3.1 Compte personnel (toujours scopé à soi-même)

| Code | Action |
|---|---|
| `A.01` | Modifier son profil personnel (nom, photo, ville, RPPS, profession) |
| `A.02` | Changer son mot de passe |
| `A.03` | Configurer ses préférences notifications (push, emails, horaire de rappel) |
| `A.04` | Demander la suppression de son compte (RGPD) |
| `A.05` | Consulter son historique de points / streak / badges |
| `A.06` | Lier MaCertifProPlus (sync conformité CP) |

### 3.2 Pédagogie (consommation de contenu)

| Code | Action |
|---|---|
| `B.01` | Suivre une formation du catalogue public Dentalschool |
| `B.02` | Suivre une formation curée par son organisation (mise en avant) |
| `B.03` | Suivre une formation **propre** à son organisation (sandbox tenant, isolation stricte) |
| `B.04` | Faire le quiz quotidien |
| `B.05` | Soumettre un audit EPP (T1 ou T2) |
| `B.06` | Liker une formation |
| `B.07` | Écouter le podcast news / journal hebdo |

### 3.3 Conformité CP / attestations

| Code | Action |
|---|---|
| `C.01` | Configurer sa période CP (date d'inscription, durée 6/9 ans) |
| `C.02` | Voir son radar CP (visualisation des 4 axes) |
| `C.03` | Générer ses attestations (formation_online + EPP) |
| `C.04` | Soumettre une réclamation Qualiopi (table `complaints`) |

### 3.4 Administration de l'organisation

| Code | Action |
|---|---|
| `D.01` | Voir la liste des membres de l'org |
| `D.02` | Inviter un nouveau membre (génération d'un lien d'invitation) |
| `D.03` | Révoquer un membre / changer son `intra_role` |
| `D.04` | Voir et modifier l'abonnement de l'org (plan, facturation Stripe) |
| `D.05` | Personnaliser le branding (logo, couleur primaire — co-brand simple V1) |
| `D.06` | Curer le catalogue Dentalschool (épingler 3-N formations à mettre en avant pour ses users) |
| `D.07` | **Créer du contenu propre à l'org** (formation + séquences + questions, sandbox isolé) — RH/OF uniquement |
| `D.08` | Affecter des formations obligatoires à des membres (avec deadline) |
| `D.09` | Voir analytics scopées org (engagement, taux complétion, points distribués sur SES users) |
| `D.10` | Voir le suivi conformité CP de l'équipe (RH spécifique) |
| `D.11` | Exporter rapports PDF / CSV (factures, conformité, engagement) |
| `D.12` | Voir et répondre aux réclamations soumises par les users de l'org |

### 3.5 Opérations Dentalschool (super_admin uniquement, pour mémoire)

| Code | Action |
|---|---|
| `E.01` | Créer / modifier formations Dentalschool |
| `E.02` | Valider questions news en attente (`/admin/news/pending`) |
| `E.03` | Gérer les sources news, lancer ingestions manuelles |
| `E.04` | Modifier les rôles globaux d'un user (assigner `formateur`, etc.) |
| `E.05` | Créer / modifier des organisations clientes |
| `E.06` | Impersonner un user pour debug |
| `E.07` | Accéder aux logs DPC / aux exports comptables |

### 3.6 Espace formateur Dentalschool

| Code | Action |
|---|---|
| `F.01` | Voir le dashboard stats sur SES formations assignées (vues, users actifs, taux complétion) |
| `F.02` | Gérer son agenda de formations présentielles (CRUD events) |
| `F.03` | Gérer ses masterclass live (CRUD sessions + visio Zoom) |
| `F.04` | Voir la liste des inscrits à ses sessions live |
| `F.05` | Modifier son profil public formateur (bio, photo, prochaines dates) |
| `F.06` | Voir ses revenus calculés (V2 — pas de calcul V1, juste vues) |

---

## 4. MATRICE — Type CABINET

**Sous-rôles** : `titulaire` / `collaborateur` / `assistante`

**Légende** : ✅ peut faire — 🔄 uniquement pour soi-même — 👁️ lecture seule — ❌ ne peut pas

| Action | titulaire | collaborateur | assistante |
|---|---|---|---|
| **Compte personnel** | | | |
| A.01 Modifier profil perso | 🔄 | 🔄 | 🔄 |
| A.02 Changer mot de passe | 🔄 | 🔄 | 🔄 |
| A.03 Préférences notifications | 🔄 | 🔄 | 🔄 |
| A.04 Demander suppression RGPD | 🔄 | 🔄 | 🔄 |
| A.05 Historique points perso | 🔄 | 🔄 | 🔄 |
| A.06 Lier MaCertifProPlus | ✅ | ✅ | ❌ (non concerné CP) |
| **Pédagogie** | | | |
| B.01 Suivre formations Dentalschool | ✅ | ✅ | ✅ (limité aux axes 3 & 4 + soft skills) |
| B.02 Suivre formations curées org | ✅ | ✅ | ✅ |
| B.03 Suivre formations propres org | N/A (cabinet ne crée pas de contenu) | N/A | N/A |
| B.04 Quiz quotidien | ✅ | ✅ | ✅ |
| B.05 Soumettre EPP | ✅ | ✅ | ❌ |
| B.06 Liker formation | ✅ | ✅ | ✅ |
| B.07 Podcast news | ✅ | ✅ | ✅ |
| **Conformité CP** | | | |
| C.01 Configurer période CP | 🔄 | 🔄 | ❌ |
| C.02 Voir radar CP | 🔄 | 🔄 | ❌ |
| C.03 Générer attestations | 🔄 | 🔄 | ❌ |
| C.04 Soumettre réclamation | ✅ | ✅ | ✅ |
| **Administration cabinet** | | | |
| D.01 Voir liste membres | ✅ | 👁️ | 👁️ |
| D.02 Inviter membre | ✅ | ❌ | ❌ |
| D.03 Révoquer / changer rôle | ✅ | ❌ | ❌ |
| D.04 Gérer abonnement | ✅ | ❌ | ❌ |
| D.05 Personnaliser branding | ❌ (non disponible cabinet V1) | ❌ | ❌ |
| D.06 Curer catalogue | ❌ (non disponible cabinet V1) | ❌ | ❌ |
| D.07 Créer contenu propre | N/A (cabinet ne crée pas) | N/A | N/A |
| D.08 Affecter formations obligatoires | ✅ | ❌ | ❌ |
| D.09 Voir analytics scopées | ✅ (agrégées équipe) | 👁️ (sur soi seulement) | 👁️ (sur soi seulement) |
| D.10 Suivi conformité CP équipe | ❌ (cabinet hors scope RH) | ❌ | ❌ |
| D.11 Exporter rapports | ✅ | ❌ | ❌ |
| D.12 Voir réclamations équipe | ✅ | ❌ | ❌ |

**Notes spécifiques cabinet** :
- L'assistante n'est **pas concernée par la Certification Périodique** (réglementation : la CP s'applique aux chirurgiens-dentistes uniquement). Elle accède aux formations soft-skills, ergonomie, communication, prévention violences, mais ne génère pas d'attestation CP.
- Le `titulaire` est unique par cabinet à l'invitation initiale ; un transfert de titularité est une action super_admin (V2).
- Le `collaborateur` est un praticien (CP applicable) mais sans droit administratif sur le cabinet.
- **D.05 et D.06 désactivés cabinet V1** : un cabinet libéral n'a pas besoin de personnaliser un logo ni de réorganiser le catalogue. Ces fonctionnalités restent réservées aux types `hr_entity` et `training_org` qui en ont une réelle utilité commerciale.

---

## 5. MATRICE — Type HR ENTITY (centre de soins / employeur)

**Sous-rôles** : `admin_rh` / `manager` / `praticien_salarie` / `assistante`

**Cas d'usage type** : VYV dentaire. L'entité paie un abonnement collectif, suit la conformité de ses dentistes salariés, peut imposer des formations obligatoires et publier du contenu interne (procédures groupe, mises à jour réglementaires internes). Inclut systématiquement les assistantes salariées pour les formations communication, ergonomie, accueil patient.

| Action | admin_rh | manager | praticien_salarie | assistante |
|---|---|---|---|---|
| **Compte personnel** | | | | |
| A.01 → A.05 | 🔄 | 🔄 | 🔄 | 🔄 |
| A.06 Lier MaCertifProPlus | ❌ | ❌ | ✅ | ❌ (non concerné CP) |
| **Pédagogie** | | | | |
| B.01 Suivre formations Dentalschool | ✅ | ✅ | ✅ | ✅ (limité aux axes 3 & 4 + soft skills) |
| B.02 Suivre formations curées org | ✅ | ✅ | ✅ | ✅ |
| B.03 Suivre formations propres org (sandbox) | ✅ | ✅ | ✅ | ✅ (si assignée par admin_rh) |
| B.04 → B.07 | ✅ | ✅ | ✅ | ✅ |
| **Conformité CP** | | | | |
| C.01 → C.03 | 🔄 (si praticien aussi) | 🔄 (si praticien aussi) | 🔄 | ❌ |
| C.04 Soumettre réclamation | ✅ | ✅ | ✅ | ✅ |
| **Administration entité RH** | | | | |
| D.01 Voir liste membres | ✅ (toute l'entité) | ✅ (son équipe scopée) | 👁️ (lui-même) | 👁️ (lui-même) |
| D.02 Inviter membre | ✅ | ❌ | ❌ | ❌ |
| D.03 Révoquer / changer rôle | ✅ | ❌ | ❌ | ❌ |
| D.04 Gérer abonnement | ✅ | ❌ | ❌ | ❌ |
| D.05 Personnaliser branding | ✅ | ❌ | ❌ | ❌ |
| D.06 Curer catalogue | ✅ | ❌ | ❌ | ❌ |
| D.07 **Créer contenu propre (sandbox)** — *plan premium uniquement* | ✅ | ❌ | ❌ | ❌ |
| D.08 Affecter formations obligatoires | ✅ (toute l'entité) | ✅ (son équipe) | ❌ | ❌ |
| D.09 Voir analytics scopées | ✅ (agrégées entité) | ✅ (agrégées équipe) | 🔄 | 🔄 |
| D.10 Suivi conformité CP équipe | ✅ (agrégées entité) | ✅ (agrégées équipe) | ❌ | ❌ |
| D.11 Exporter rapports | ✅ | ✅ (sur son équipe) | ❌ | ❌ |
| D.12 Voir réclamations équipe | ✅ | ❌ | ❌ | ❌ |

**Notes spécifiques HR entity** :
- Distinction `admin_rh` vs `manager` : l'admin RH a une vue groupe (toute l'entité) ; le manager a une vue scopée à son équipe directe (lien hiérarchique stocké dans `organization_members.manager_id`). Permet à VYV par exemple d'avoir un responsable formation national (admin_rh) et des managers régionaux.
- L'`admin_rh` n'est **pas nécessairement praticien**. C'est typiquement un DRH ou responsable formation. Il n'accède donc pas aux formations en tant qu'apprenant CP par défaut, sauf s'il a aussi été inscrit comme praticien salarié.
- Le sous-rôle `assistante` partage les mêmes droits qu'en cabinet (limité axes 3 & 4 + soft skills, pas de CP) mais bénéficie en plus de l'accès au contenu propre de l'entité (B.03) — utile pour des procédures internes type "accueil patient maison VYV".
- Le contenu D.07 créé par l'admin_rh est strictement isolé : visible **uniquement** par les membres rattachés à la même `organization_id`. Jamais exposé au catalogue public Dentalschool.
- D.07 est conditionné au **plan premium** (cf. §6bis). Une entité sur plan standard peut suivre les formations Dentalschool + curer le catalogue + voir analytics, mais ne peut pas créer son propre contenu.
- **Analytics agrégées uniquement** (RGPD modèle A — cf. §7) : aucune donnée nominative individuelle n'est exposée à l'admin_rh ou au manager. Ils voient des moyennes équipe, des taux de complétion, des distributions, jamais "le Dr Untel a échoué le quiz X".
- Les attestations CP générées par les praticiens salariés mentionnent toujours **EROJU SAS — Dentalschool** comme organisme délivrant la formation Dentalschool ; le contenu propre HR n'est pas certifiant Qualiopi/DPC sauf si l'entité a sa propre certification.

---

## 6. MATRICE — Type TRAINING ORG (organisme de formation tiers)

**Sous-rôles** : `admin_of` / `formateur_of` / `apprenant_of` / `assistante`

**Cas d'usage type** : un autre OF que Dentalschool veut utiliser ta plateforme pour distribuer son catalogue à ses apprenants. Modèle commercial probable : licence forfaitaire annuelle ou partage de revenus à arbitrer (V2 — voir §7).

| Action | admin_of | formateur_of | apprenant_of | assistante |
|---|---|---|---|---|
| **Compte personnel** | | | | |
| A.01 → A.05 | 🔄 | 🔄 | 🔄 | 🔄 |
| A.06 Lier MaCertifProPlus | ❌ | ❌ | ✅ | ❌ (non concerné CP) |
| **Pédagogie** | | | | |
| B.01 Suivre formations Dentalschool | ❌ (V1 isolation totale) | ❌ | ❌ | ❌ |
| B.02 Suivre formations curées org | N/A (l'OF tiers ne cure pas Dentalschool) | N/A | N/A | N/A |
| B.03 **Suivre formations propres OF (sandbox)** | ✅ | ✅ | ✅ | ✅ (si assignée par admin_of) |
| B.04 Quiz quotidien | ✅ (sur questions OF) | ✅ | ✅ | ✅ |
| B.05 Soumettre EPP | ✅ (si l'OF en propose) | ✅ | ✅ | ❌ |
| B.06 → B.07 | ✅ (sur contenu OF) | ✅ | ✅ | ✅ |
| **Conformité CP** | | | | |
| C.01 → C.03 | ❌ (CP géré par certif OF tiers, pas Dentalschool) | ❌ | 🔄 (selon certif propre OF) | ❌ |
| C.04 Soumettre réclamation | ✅ (vers admin_of) | ✅ | ✅ | ✅ |
| **Administration OF tiers** | | | | |
| D.01 Voir liste membres | ✅ | 👁️ | 👁️ (lui-même) | 👁️ (lui-même) |
| D.02 Inviter membre | ✅ | ❌ | ❌ | ❌ |
| D.03 Révoquer / changer rôle | ✅ | ❌ | ❌ | ❌ |
| D.04 Gérer abonnement | ✅ | ❌ | ❌ | ❌ |
| D.05 Personnaliser branding | ✅ | ❌ | ❌ | ❌ |
| D.06 Curer catalogue | N/A | N/A | N/A | N/A |
| D.07 **Créer contenu propre (sandbox)** | ✅ | ✅ (ses propres formations assignées) | ❌ | ❌ |
| D.08 Affecter formations obligatoires | ✅ | ❌ | ❌ | ❌ |
| D.09 Voir analytics scopées | ✅ (tout l'OF) | ✅ (sur ses formations) | 🔄 | 🔄 |
| D.10 Suivi conformité CP équipe | ❌ (CP hors scope OF tiers) | ❌ | ❌ | ❌ |
| D.11 Exporter rapports | ✅ | ✅ (sur ses formations) | ❌ | ❌ |
| D.12 Voir réclamations équipe | ✅ | ❌ | ❌ | ❌ |

**Notes spécifiques training org** :
- **Isolation stricte renforcée** : aucun apprenant_of n'accède au catalogue Dentalschool. Aucun user Dentalschool ou cabinet ou HR ne voit le contenu OF tiers. Les seuls ponts sont la base technique (auth Supabase, infra Next.js), pas le contenu.
- Le `formateur_of` n'est **pas** le rôle global `formateur` Dentalschool. Ce sont deux rôles distincts qui ne se croisent pas. Un user peut techniquement avoir les deux mais ce sera exceptionnel et nécessite arbitrage super_admin.
- Le sous-rôle `assistante` dans `training_org` s'aligne exactement sur les droits de l'`assistante` en `hr_entity` : accès aux formations propres OF si assignée par `admin_of`, pas de CP, pas de droits d'administration, isolation stricte (ne voit pas le catalogue Dentalschool).
- Les attestations délivrées aux apprenants OF mentionnent l'OF tiers comme organisme, **pas** EROJU SAS. Implique : table `user_attestations.organisme` qui sort de la valeur fixe `'EROJU SAS — Dentalschool'` et devient dynamique par tenant. Migration BDD requise.
- La certif Qualiopi `QUA006589` ne couvre pas le contenu OF tiers — l'OF doit avoir sa propre Qualiopi. À acter dans le contrat de licence.

---

## 6bis. Modèle tarifaire (arbitré 2 mai 2026)

**Principe** : facturation au **user actif** par mois, avec deux niveaux de plan.

| Plan | Caractéristiques | Cibles principales |
|---|---|---|
| **Standard** | Tarif au siège user actif. Accès catalogue Dentalschool + curation (D.06) + branding (D.05) + analytics agrégées + suivi CP. **Pas de création de contenu propre (D.07)**. | Cabinet (forfait dégressif), HR entity standard, OF qui veut juste pousser le catalogue Dentalschool à son public. |
| **Premium** | Standard + débloque la création de contenu propre (D.07) avec sandbox isolé. Tarif majoré au siège user actif. | HR entity (VYV) qui veut publier des procédures internes, OF tiers qui distribue son propre catalogue. |

**Définition "user actif"** : à arbitrer dans la spec Sprint 1. Hypothèse de travail : user ayant complété au moins une séquence ou un quiz dans le mois facturé. Affiner avec ton expert-comptable et selon usage observé.

**Implications BDD** :
- Colonne `organizations.plan` ∈ `{'standard', 'premium'}`.
- Helper SQL `org_can_create_content(p_org_id)` qui retourne `true` uniquement si `plan = 'premium'`.
- D.07 (création contenu) gated par ce helper côté RLS et côté front.

**Pas de limite hard sur le nombre de membres en V1** — monitoring usage uniquement. Si un tenant explose les volumes prévus, négociation commerciale au cas par cas.

---

## 7. Décisions arbitrées et points juridiques

### 7.1 Décisions techniques arbitrées (2 mai 2026)

| # | Sujet | Décision retenue |
|---|---|---|
| Q1 | Multi-org par user | **Non en V1** — un user = une org max. Contrainte UNIQUE sur `organization_members.user_id`. |
| Q2 | Migration users existants | Un seul user concerné aujourd'hui (Dr Fantin). Reste **orgless** avec rôle `super_admin`. Pas de migration de masse à prévoir. |
| Q3 | Suppression d'un membre | Historique d'apprentissage **conservé** côté tables `user_*` (RGPD oblige + DPC). Le rattachement org est marqué `status='revoked'` avec `revoked_at` daté. |
| Q4 | Limite de membres par plan | Pas de limite hard V1. Monitoring usage. Chiffrage à faire ultérieurement avec grille tarifaire. |
| Q5 | Personnalisation branding | **Logo + couleur primaire** uniquement. Stockés dans `organizations.branding_logo_url` et `organizations.branding_primary_color`. |
| Q6 | Modèle tarifaire | **Tarif au user actif** + plan **premium** débloquant la création contenu (D.07). Détails §6bis. |
| Q7 | Responsabilité contenu tenant | **Le tenant est seul responsable** du contenu qu'il publie. Aucune implication Dentalschool pour le contenu non généré par Dentalschool. À acter dans les CGV. |
| Q8 | Marque blanche | **Hors scope V1, V2, V3**. Position commerciale assumée : DentalLearn ne propose pas de marque blanche complète. Co-brand simple suffit. |

### 7.2 Q9 — RGPD inter-tenants (recommandation à valider par avocat)

**Modèle retenu V1 — Dentalschool seul responsable de traitement** :

- Dentalschool est l'unique responsable de traitement (RGPD art.4) pour tous les utilisateurs, quel que soit leur tenant de rattachement.
- Les tenants (cabinet, HR, OF) sont des comptes payeurs avec accès à des **analytics agrégées uniquement** sur leurs membres : moyennes, taux, distributions. Aucune donnée nominative individuelle n'est exposée au tenant.
- Conséquence : pas de DPA (Data Processing Agreement) à signer avec chaque tenant — gain de temps commercial considérable.
- Le user reste maître de ses données. Il peut quitter une org sans perdre son compte, exporter ses données, demander suppression directement à Dentalschool.
- Limite assumée : un employeur HR ne pourra pas exiger de tableau nominatif "Dr Untel = X% conformité CP". C'est paradoxalement une protection pour Dentalschool et pour le user salarié.

**Conditions d'application** :
- Toutes les analytics côté tenant doivent être **strictement agrégées** côté requête SQL (jamais de `WHERE user_id = ?` exposé au tenant). Helper SQL dédié à coder.
- Les CGU différenciées par type de tenant doivent expliciter ce modèle.
- **Avant de signer le premier client B2B (HR ou OF)** : faire valider le modèle par un avocat RGPD spécialisé santé. Budget estimé 1500-2500 € pour audit + rédaction CGU. Non négociable, ça protège juridiquement Dentalschool.

**DPO** :
- Recommandation forte : désigner un DPO pour DentalLearn vu le traitement de données de santé (RGPD art.9) + RPPS. Soit toi-même après formation DPO (~3500 €), soit DPO externe mutualisé spécialisé santé (~150-300 €/mois).
- Les tenants gèrent leur propre DPO interne en parallèle si requis chez eux. Aucune coordination opérationnelle nécessaire dans le modèle V1.

### 7.3 À traiter en V2 / V3

- Rôle `cs_member` (Conseil Scientifique) avec workflow de validation contenu Dentalschool — géré séparément hors automatisation par Dr Fantin.
- Rôle `marketing` avec accès au back-office campagnes emails / réseaux sociaux.
- Rôle `support` avec accès aux réclamations et tickets.
- Calcul des revenus formateurs (modèle économique non arrêté — affichage V1 = vues / users actifs / taux complétion uniquement).
- Voice cloning ElevenLabs pour formateurs Dentalschool — chiffrage Pro $99/mois pour 10 slots.
- Multi-cabinets par praticien (collaborateur sur plusieurs sites).
- Bascule éventuelle vers DPA / co-responsabilité de traitement si Dentalschool grossit (>50 tenants) ou si un client HR exige des données nominatives.

---

## 8. Implications base de données

Cette section donne le **squelette** des migrations à prévoir pour le Sprint 1. Les migrations détaillées (avec `_down.sql` symétriques) seront produites dans la spec technique Sprint 1.

### 8.1 Nouveaux types

```sql
CREATE TYPE app_role AS ENUM (
  'super_admin', 'formateur', 'cs_member', 'marketing', 'support', 'user'
);

CREATE TYPE org_type AS ENUM (
  'cabinet', 'hr_entity', 'training_org'
);

CREATE TYPE intra_role AS ENUM (
  -- Cabinet + HR + Training Org (assistante partagé) :
  'titulaire', 'collaborateur', 'assistante',
  -- HR Entity :
  'admin_rh', 'manager', 'praticien_salarie',
  -- Training Org :
  'admin_of', 'formateur_of', 'apprenant_of'
);

CREATE TYPE org_plan AS ENUM (
  'standard', 'premium'
);

CREATE TYPE membership_status AS ENUM (
  'active', 'invited', 'revoked'
);
```

### 8.2 Nouvelles tables

```sql
-- Rôles globaux additifs (un user peut cumuler plusieurs rôles)
CREATE TABLE user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

-- Organisations clientes (cabinets, RH, OF tiers)
CREATE TABLE organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name varchar(200) NOT NULL,
  type org_type NOT NULL,
  plan org_plan NOT NULL DEFAULT 'standard',
  branding_logo_url text,
  branding_primary_color varchar(7), -- hex #RRGGBB
  owner_user_id uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  -- Branding réservé aux types qui en ont besoin
  CONSTRAINT branding_only_for_hr_or_of CHECK (
    type IN ('hr_entity', 'training_org')
    OR (branding_logo_url IS NULL AND branding_primary_color IS NULL)
  )
);

-- Membres d'une organisation (1 user = 1 org max en V1)
CREATE TABLE organization_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  intra_role intra_role NOT NULL,
  manager_id uuid REFERENCES auth.users(id), -- pour HR : lien hiérarchique
  status membership_status NOT NULL DEFAULT 'invited',
  joined_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id), -- contrainte V1 : 1 user = 1 org max
  CONSTRAINT intra_role_matches_org_type CHECK (
    -- Vérification cohérence type org / intra_role à compléter
    -- (CHECK avec sous-requête impossible : à faire via trigger)
    true
  )
);

-- Curation par tenant (catalogue Dentalschool mis en avant pour ses users)
CREATE TABLE organization_curated_content (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  formation_id uuid NOT NULL REFERENCES formations(id) ON DELETE CASCADE,
  display_order int NOT NULL DEFAULT 0,
  custom_label text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, formation_id)
);

-- Contenu propre tenant (sandbox isolé) — RH/OF uniquement
CREATE TABLE organization_owned_content (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  formation_id uuid NOT NULL REFERENCES formations(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (formation_id) -- une formation = un seul propriétaire (Dentalschool ou un tenant)
);
```

### 8.3 Modification table existante

La table `formations` doit pouvoir distinguer Dentalschool vs contenu tenant. Deux options :

- **Option A (recommandée)** : ajouter `formations.owner_org_id uuid NULL` — NULL = contenu Dentalschool, NOT NULL = contenu tenant. Permet de supprimer la table `organization_owned_content` (redondante).
- **Option B** : garder la table `organization_owned_content` séparée pour l'isolation explicite.

À trancher avec Claude Code lors de la spec Sprint 1. Recommandation : Option A.

### 8.4 Helpers SQL à créer

```sql
-- Vérifier si un user a un rôle global
CREATE FUNCTION has_role(p_user_id uuid, p_role app_role)
RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = p_user_id AND role = p_role
  );
$$;

-- Vérifier si un user est super_admin
CREATE FUNCTION is_super_admin(p_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT has_role(p_user_id, 'super_admin');
$$;

-- Récupérer l'org d'un user (NULL si orgless)
CREATE FUNCTION user_org(p_user_id uuid)
RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT org_id FROM organization_members
  WHERE user_id = p_user_id AND status = 'active'
  LIMIT 1;
$$;

-- Vérifier si un user peut voir une formation
CREATE FUNCTION user_can_see_formation(p_user_id uuid, p_formation_id uuid)
RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT
    -- super_admin voit tout
    is_super_admin(p_user_id)
    OR
    -- formation Dentalschool publique
    EXISTS (
      SELECT 1 FROM formations
      WHERE id = p_formation_id
      AND owner_org_id IS NULL
      AND is_published = true
    )
    OR
    -- formation propre à l'org du user
    EXISTS (
      SELECT 1 FROM formations f
      WHERE f.id = p_formation_id
      AND f.owner_org_id = user_org(p_user_id)
    );
$$;

-- Vérifier si une org peut créer du contenu propre (gating D.07)
CREATE FUNCTION org_can_create_content(p_org_id uuid)
RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM organizations
    WHERE id = p_org_id
    AND plan = 'premium'
    AND type IN ('hr_entity', 'training_org')
  );
$$;
```

### 8.5 RLS à mettre à jour

Toutes les tables manipulant du contenu pédagogique doivent intégrer la vérification `user_can_see_formation()` dans leurs policies SELECT. Liste des tables impactées : `formations`, `sequences`, `questions`, `user_formations`, `user_sequences`, `course_watch_logs`, `epp_audits`. Détails dans la spec Sprint 1.

### 8.6 Suppression du hardcoding admin

Tous les fichiers contenant `drfantin@gmail.com` en dur (~11 occurrences identifiées dans la dette technique D4) doivent être remplacés par un check `await isSuperAdmin(user.id)`. Liste exhaustive à produire en début de Sprint 1 via grep.

---

## 9. Prochaines étapes

1. **Production de la spec technique Sprint 1** au format `spec_*.md` : migrations versionnées + plan de tests + ordre d'application.
2. **Rédaction des CGU différenciées** par type de tenant — à confier à un avocat RGPD spécialisé santé. Inclure la clause d'exonération totale Dentalschool pour le contenu publié par les tenants (Q7).
3. **Mise à jour DATABASE_SCHEMA.md** après application des migrations Sprint 1.
4. **Désignation DPO** Dentalschool — décision toi-même formé ou DPO externe mutualisé.

---

## 10. Historique des révisions

| Version | Date | Auteur | Changements |
|---|---|---|---|
| V1.0 | 2 mai 2026 | Claude | Draft initial — 9 questions ouvertes |
| V1.1 | 2 mai 2026 | Dr Fantin + Claude | Arbitrages intégrés : D.05/D.06 retirés cabinet, ajout `assistante` en HR, modèle tarifaire standard/premium (§6bis), Q1-Q9 résolues, modèle RGPD A documenté |
| V1.2 | 2 mai 2026 | Dr Fantin + Claude | `assistante` étendue à `training_org` (aligne sur droits hr_entity/assistante). Trigger BDD mis à jour en conséquence. |

---

*Document mis à jour le 2 mai 2026 — DentalLearn V1.2 — Architecture multi-tenant*
