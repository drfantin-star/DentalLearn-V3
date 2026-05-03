# Scénarios E2E Sprint 1 — Pseudo-code détaillé

**Date** : 3 mai 2026
**Ticket** : T8 — clôture Sprint 1
**Statut** : pseudo-code (option C — pas de Supabase staging dispo)

Ce document est la **source de vérité fonctionnelle** des 5 scénarios E2E
prévus pour valider Sprint 1. Les fichiers `*.spec.ts` du dossier `sprint1/`
en sont la charpente technique à activer quand un environnement staging existera.

Référence amont : `handoff_claude_code_sprint1_auth_rbac_v1_0.md` §3.8.

---

## Matrice de couverture

| Scénario | T1 | T2 | T3 | T4 | T5 | T6 | T7 |
|---|---|---|---|---|---|---|---|
| 1 — User solo | ✅ trigger | — | — | ✅ signup | — | — | ✅ org Dentalschool |
| 2 — Cabinet | ✅ tables | ✅ isSuperAdmin | — | — | ✅ UI back-office | ✅ /tenant/admin | — |
| 3 — HR branding | ✅ org HR | — | — | — | — | ✅ branding + curation | — |
| 4 — Training org | ✅ org OF | — | ✅ user_can_see_formation | — | — | ✅ /tenant/admin | ✅ organisme dynamique |
| 5 — Inter-tenant | ✅ orgs | — | ✅ RLS isolation | — | — | — | — |

Les 5 scénarios couvrent les 7 tickets d'implémentation. T8 (lui-même) est
couvert par l'existence de ce document + le smoke test prod (cf
`scripts/smoke_test_prod.sh`).

---

## §1 — Scénario 1 : User solo (signup → attestation)

**Périmètre** : un nouvel utilisateur s'inscrit, vérifie son email, suit une
formation Dentalschool publiée, fait son quiz et génère une attestation.

### Pré-requis BDD
- 1 formation Dentalschool publiée avec `access_type='full'`, ≥ 1 sequence
  `is_intro=false` et 4 questions valides.
- Le trigger `on_auth_user_created` (T4) doit être actif.

### Étapes

**1.1 Signup avec consentement RGPD (T4)**
```
1. GET /signup
2. Remplir : email = `e2e-solo-${ts}@dentallearn.test`,
             password = 'Test1234!@#$',
             first_name = 'Solo', last_name = 'Test',
             rpps = '' (optionnel),
             profession = 'Chirurgien-dentiste'
3. NE PAS cocher la case RGPD → click submit → assert message d'erreur visible
4. Cocher la case RGPD → click submit
5. Assert : redirect /verify-email
6. Assert BDD : auth.users contient le nouveau user (email_confirmed_at IS NULL)
7. Assert BDD : user_profiles contient (first_name, last_name) [trigger T4]
8. Assert BDD : streaks contient (current_streak=0) [trigger T4]
```

**1.2 Vérification email + login**
```
1. Helper : link = supabase.auth.admin.generateLink({ type: 'signup', email })
2. GET <link> → /verify-email/confirm
3. Assert : message "Email vérifié"
4. Assert BDD : auth.users.email_confirmed_at IS NOT NULL
5. GET /login
6. Submit (email, password)
7. Assert : redirect /home
8. Assert : header affiche prénom du user
```

**1.3 Suivre 1 formation + quiz**
```
1. GET /formations
2. Click sur la 1re formation Dentalschool
3. Sur /formations/[slug] : assert présence du bouton "Commencer"
4. Click "Commencer la séquence 1" (intro)
5. Assert : page séquence affiche le lecteur audio
6. Simuler la lecture → attendre l'écriture course_watch_logs (≥ 1 ligne, user_id, sequence_id)
7. Cliquer "Suivant" → page quiz
8. Répondre aux 4 questions (1 correcte minimum)
9. Submit quiz → assert score affiché + animation confetti
10. Assert BDD : user_sequences contient (user_id, sequence_id, score)
11. Assert BDD : user_points contient ≥ 1 ligne avec points_earned > 0
```

**1.4 Génération attestation (T7 — chemin Dentalschool)**
```
1. GET /profil/attestations
2. Click "Générer attestation" pour la formation suivie
3. Assert : PDF téléchargé
4. Lire le PDF (helper pdf-parse) :
   - assert contient "EROJU SAS — Dentalschool"
   - assert contient "Qualiopi : QUA006589"
   - assert contient "ODPC : 9AGA"
   - assert contient le nom du user (first_name + last_name)
5. Assert BDD : user_attestations + user_attestation_verifications créées
6. Assert BDD : verifications.organisme = 'EROJU SAS — Dentalschool',
                verifications.qualiopi = 'QUA006589',
                verifications.odpc = '9AGA'
   (helpers attestation_*_for() T7)
```

### Cleanup
```
- supabase.auth.admin.deleteUser(userId) → cascade sur user_profiles, streaks,
  user_sequences, user_points, course_watch_logs (RLS), user_attestations
```

---

## §2 — Scénario 2 : Cabinet (super_admin crée + invite titulaire)

**Périmètre** : Dr Fantin (super_admin) crée un cabinet, invite un titulaire,
ce dernier accepte et accède à `/tenant/admin`.

### Étapes

**2.1 Login super_admin + création org cabinet (T5)**
```
1. loginAs(super_admin)
2. GET /admin/organizations
3. Assert : page accessible (sinon T2 cassé)
4. Click "Nouvelle organisation"
5. GET /admin/organizations/new
6. Remplir : name="Cabinet Test E2E", type="cabinet", plan="standard"
7. Sélectionner owner_user_id : créer un user titulaire en pré-requis,
   le rechercher par email
8. Submit
9. Assert : redirect /admin/organizations/[id]
10. Capturer orgId depuis l'URL
11. Assert BDD : organizations(name, type='cabinet', plan='standard') créée
```

**2.2 Invitation du titulaire**
```
1. Sur /admin/organizations/[orgId], onglet "Membres"
2. Click "Inviter un membre"
3. Remplir : email=titulaireEmail, intra_role='titulaire'
4. Submit
5. Assert : toast succès
6. Assert BDD : organization_members(user_id, org_id, intra_role='titulaire',
                status='invited') créé [trigger validate_intra_role_matches_org_type
                doit accepter 'titulaire' pour type='cabinet']
```

**2.3 Acceptation par le titulaire**
```
1. Helper : récupérer le lien d'invitation (Supabase magic link ou route /invite/[token])
2. Nouveau context (logout super_admin)
3. GET <inviteLink>
4. Définir mot de passe (1re connexion)
5. Submit → redirect /tenant/admin
6. Assert BDD : organization_members.status='active', joined_at IS NOT NULL
7. Assert : page /tenant/admin affiche dashboard analytics agrégées
```

**2.4 UI cabinet : branding + curation grisés**
```
1. Sur /tenant/admin (titulaire connecté)
2. Assert : lien "Branding" est grisé/disabled (cabinet ≠ HR/OF)
3. Assert : lien "Curation" est grisé/disabled
4. GET direct /tenant/admin/branding
5. Assert : redirect ou 403 (pas un cabinet)
```

**2.5 RBAC : user lambda ne peut pas accéder /admin/***
```
1. loginAs(un user lambda sans rôle super_admin)
2. GET /admin/organizations
3. Assert : redirect / ou 403
4. Vérifier qu'aucune fuite côté API : GET /api/admin/organizations renvoie 403
```

### Cleanup
```
- DELETE FROM organizations WHERE id = orgId (CASCADE supprime members)
- supabase.auth.admin.deleteUser(titulaireUserId)
```

---

## §3 — Scénario 3 : HR entity (branding + curation visibles côté praticien)

**Périmètre** : un admin_rh modifie le branding de son entité + cure 2 formations
Dentalschool. Un praticien_salarie de la même org voit le résultat.

### Pré-requis (seed direct via service_role)
- 1 org type='hr_entity', name='VYV Test E2E', plan='standard'
- 1 user admin_rh avec membership active
- 1 user praticien_salarie avec membership active dans la même org
- 6 formations Dentalschool publiées (présentes en prod)

### Étapes

**3.1 admin_rh modifie le branding (T6)**
```
1. loginAs(admin_rh)
2. GET /tenant/admin/branding
3. Assert : page accessible
4. Upload logo : PNG 200×60 (fixture tests/fixtures/vyv-logo.png)
5. Remplir branding_primary_color = '#1A8FE3'
6. Submit
7. Assert : toast succès
8. Assert BDD : organizations.branding_logo_url IS NOT NULL,
                organizations.branding_primary_color = '#1A8FE3'
9. Assert : le PUT /api/tenant/branding a refusé un cabinet (test bonus)
```

**3.2 admin_rh cure 2 formations Dentalschool**
```
1. GET /tenant/admin/curation
2. Récupérer 2 formation_id Dentalschool (owner_org_id IS NULL, is_published=true)
3. Click "Ajouter" → sélectionner formationA → submit
4. Click "Ajouter" → sélectionner formationB → submit
5. Drag-and-drop : déplacer formationB en position 1
6. Submit l'ordre final
7. Assert BDD : org_curated_formations contient 2 lignes :
   (orgId, formationB, display_order=0)
   (orgId, formationA, display_order=1)
```

**3.3 praticien_salarie voit branding + formations épinglées**
```
1. Nouveau context (logout admin_rh)
2. loginAs(praticien_salarie)
3. GET /
4. Assert : header affiche le logo VYV (pas le logo Dentalschool)
5. Assert : couleur primaire #1A8FE3 appliquée aux boutons primaires
   (assert via getComputedStyle ou screenshot avec tolérance)
6. GET /formations
7. Assert : section "Mises en avant par votre entité" en tête de page
8. Assert : formationB affichée en 1re position, formationA en 2e
9. Assert : le reste du catalogue Dentalschool reste accessible (RLS T3 OK)
```

**3.4 Tests bonus de gating**
```
- Tenter PATCH /api/tenant/branding depuis un user cabinet → 403
- Tenter PATCH /api/tenant/branding depuis un praticien_salarie → 403
- Tenter POST /api/tenant/curation avec formation owned d'un autre tenant → 400
```

---

## §4 — Scénario 4 : Training org (apprenant_of voit owned + PAS catalogue)

**Périmètre** : un OF tiers a sa propre formation owned. Un apprenant_of de cet
OF voit cette formation, mais n'a PAS accès au catalogue Dentalschool.

### Pré-requis (seed direct via service_role)
- 1 org type='training_org', name='OF Test E2E', plan='premium'
- 1 user admin_of, 1 user apprenant_of (membership active)
- 1 formation owned par cette org (INSERT direct, owner_org_id=orgId,
  is_published=true, access_type='full', + 3 sequences + 12 questions)

### Étapes

**4.1 apprenant_of voit la formation owned**
```
1. loginAs(apprenant_of)
2. GET /formations
3. Assert : "Formation OF Test E2E" visible
4. Click sur la formation
5. Assert : page formation accessible, séquences listées
6. Click sur séquence 1
7. Assert : lecteur séquence affiché (RLS user_can_see_formation OK pour user d'org owner)
```

**4.2 apprenant_of NE voit PAS le catalogue Dentalschool — test critique**
```
1. GET /formations
2. const dentalSlugs = await getDentalschoolSlugs(); // 6 slugs en prod
3. Pour chaque slug : assert page.getByTestId(`formation-card-${slug}`).count() === 0
4. Assert : compte total formations affichées === 1 (uniquement la owned)
5. Tentative URL directe : GET /formations/<slug-dentalschool>
6. Assert : 404 ou redirect (RLS bloque)
7. GET /api/formations
8. Assert : payload contient 1 seule formation (la owned)
```

**4.3 Attestation OF tiers (T7 — chemin organisme dynamique)**
```
1. apprenant_of parcourt 1 séquence de la formation owned
2. Fait le quiz, complète la formation
3. GET /profil/attestations
4. Click "Générer attestation"
5. Lire le PDF :
   - assert contient "OF Test E2E" en organisme (pas "EROJU SAS")
   - assert NE contient PAS "QUA006589" (sauf si org.qualiopi_number renseigné)
   - assert NE contient PAS "ODPC 9AGA" (sauf si org.odpc_number renseigné)
   - assert : zone "Cachet et signature de l'organisme" vide (pas le tampon Dentalschool)
6. Assert BDD : verifications.organisme = 'OF Test E2E',
                verifications.qualiopi IS NULL,
                verifications.odpc IS NULL
```

**4.4 Test bonus : admin_of renseigne qualiopi + odpc**
```
1. loginAs(admin_of)
2. GET /tenant/admin/branding
3. Assert : section "Identifiants de certification" visible (training_org uniquement)
4. Remplir qualiopi_number = "QUA999999", odpc_number = "ZZZZ"
5. Submit
6. Apprenant_of régénère son attestation
7. Assert PDF contient désormais "QUA999999" et "ZZZZ"
```

---

## §5 — Scénario 5 : Isolation inter-tenants stricte

**Périmètre** : prouver qu'aucune fuite n'existe entre 2 tenants OF distincts.
Double-vérification du test isolé du scénario 4.

### Pré-requis (seed direct via service_role)
- orgA : training_org, name='OF Alpha', + apprenant_of userA, + formation Alpha owned
- orgB : training_org, name='OF Beta', + apprenant_of userB, + formation Beta owned

### Étapes

**5.1 userA voit Alpha mais PAS Beta**
```
1. loginAs(userA)
2. GET /formations
3. Assert : page.getByText('Formation Alpha').isVisible()
4. Assert : page.getByText('Formation Beta').count() === 0
5. GET /api/formations
6. Assert : payload ne contient JAMAIS formationBId
```

**5.2 userB voit Beta mais PAS Alpha (symétrie)**
```
1. Nouveau context (cookie session frais)
2. loginAs(userB)
3. GET /formations
4. Assert : page.getByText('Formation Beta').isVisible()
5. Assert : page.getByText('Formation Alpha').count() === 0
```

**5.3 Accès direct par URL → 404**
```
1. loginAs(userA)
2. GET /formations/${formationBId} (URL directe vers une formation autre tenant)
3. Assert : status 404 ou redirect /formations
4. Assert BDD : aucune ligne user_sequences créée pour (userA, sequence quelconque de B)
5. Assert BDD : aucune ligne course_watch_logs créée pour (userA, B)
```

**5.4 Curation cross-tenant bloquée**
```
1. Créer org HR + admin_rh en pré-requis
2. loginAs(admin_rh)
3. POST /api/tenant/curation { formation_id: formationAId }
4. Assert : status 400 (la curation n'accepte que des formations Dentalschool,
            owner_org_id IS NULL)
5. Assert BDD : aucune ligne org_curated_formations créée pour cette tentative
```

**5.5 Helpers SQL appelés directement (test unitaire de RLS)**
```
1. Via service_role :
   SELECT user_can_see_formation(userA_id, formationAId) → true
   SELECT user_can_see_formation(userA_id, formationBId) → false
   SELECT user_can_see_formation(userB_id, formationAId) → false
   SELECT user_can_see_formation(userB_id, formationBId) → true
   SELECT user_can_see_formation(orgless_user_id, formationAId) → false
   SELECT user_can_see_formation(super_admin_id, formationAId) → true
   SELECT user_can_see_formation(super_admin_id, formationBId) → true
```

---

## Annexe : ordre d'exécution recommandé

Quand le runtime sera installé, exécuter dans cet ordre (important pour
l'état BDD partagé) :

```
1. Scénario 5 (isolation inter-tenants) — le plus critique côté sécurité
2. Scénario 4 (training org isolation) — confirme RLS T3
3. Scénario 3 (HR branding + curation) — confirme T6
4. Scénario 2 (cabinet creation) — confirme T5
5. Scénario 1 (user solo) — confirme T1, T4, T7
```

Chaque scénario doit nettoyer ses données via `test.afterAll` pour que les
suivants partent d'un état BDD prévisible.

---

*Document écrit en clôture du Sprint 1 — 3 mai 2026, ticket T8.*
