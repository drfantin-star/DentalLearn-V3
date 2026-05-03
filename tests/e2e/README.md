# Tests E2E DentalLearn — Sprint 1

**Statut** : squelettes fournis, runtime Playwright **NON installé** dans `package.json`.
**Date** : 3 mai 2026 — clôture Sprint 1 (Ticket T8).

---

## Contexte de la décision

Le ticket T8 du Sprint 1 prévoyait une suite Playwright E2E exécutable. À la
clôture du sprint, l'équipe a décidé de **livrer les fichiers sans installer le
runtime**, pour deux raisons :

1. **Pas de Supabase staging dédié** — les scénarios mutent fortement la BDD
   (créent users, orgs, formations owned, attestations). Les exécuter contre la
   prod est exclu (Dr Fantin = seul super_admin de prod, pollution irréversible
   des analytics, des attestations Qualiopi délivrées, etc.).
2. **Impact `package.json` = ~50 MB de devDeps + browsers** — à ajouter au moment
   où un environnement staging existera réellement, pas avant.

Les fichiers `*.spec.ts` sont des **squelettes Playwright** annotés en TODO, qui
référencent les pseudo-codes détaillés de `SCENARIOS_PSEUDOCODE.md`. Ce dernier
est la source de vérité fonctionnelle des 5 scénarios ; les `.spec.ts` sont la
charpente technique à compléter une fois l'environnement disponible.

---

## Procédure d'installation (à exécuter quand un staging sera dispo)

```bash
# 1. Installer Playwright (devDep + browsers Chromium)
npm install --save-dev @playwright/test
npx playwright install chromium

# 2. Ajouter scripts dans package.json (config dans tests/e2e/) :
#    "test:e2e": "playwright test --config=tests/e2e/playwright.config.ts",
#    "test:e2e:ui": "playwright test --config=tests/e2e/playwright.config.ts --ui",
#    "test:e2e:report": "playwright show-report"

# 3. Configurer .env.local pour pointer vers le projet Supabase staging :
#    NEXT_PUBLIC_SUPABASE_URL=https://<staging-ref>.supabase.co
#    NEXT_PUBLIC_SUPABASE_ANON_KEY=...
#    SUPABASE_SERVICE_ROLE_KEY=...                  # nécessaire pour les seeds
#    E2E_BASE_URL=http://localhost:3000             # ou URL preview Vercel

# 4. Étendre .gitignore (pas encore fait) :
#    /test-results
#    /playwright-report
#    /playwright/.cache

# 5. Lancer le serveur de test puis les specs
#    (le config Playwright est dans tests/e2e/, hors compilation Next.js)
npm run dev &                                       # terminal 1
npx playwright test --config=tests/e2e/playwright.config.ts  # terminal 2
```

---

## Helpers à créer (manquants — placeholder dans les specs)

Les 5 specs importent depuis `tests/e2e/helpers/` les utilitaires suivants
(à coder lors de l'activation du runtime) :

| Helper | Rôle |
|---|---|
| `seedAdminUser()` | Crée un user via `supabase.auth.admin.createUser({ email_confirm: true })` + assigne un rôle global (`user_roles`) |
| `seedOrganization(type, plan)` | INSERT direct dans `organizations` via service_role |
| `seedMembership(userId, orgId, intra_role)` | INSERT direct `organization_members` (status='active') |
| `seedFormationOwned(orgId)` | INSERT formation + sequences + questions avec `owner_org_id = orgId` |
| `loginAs(page, email, password)` | Flow login UI (`/login` → submit) |
| `cleanupOrg(orgId)` | DELETE org (CASCADE supprime members + curated) — à appeler en `test.afterAll` |
| `cleanupUser(userId)` | `supabase.auth.admin.deleteUser()` + cascade RLS |

Ces helpers DOIVENT utiliser `SUPABASE_SERVICE_ROLE_KEY` (jamais l'anon key) pour
contourner les RLS lors du seed/cleanup, tout en respectant l'immutabilité des
`course_watch_logs` (cf contrainte non-négociable §4.4 du handoff Sprint 1).

---

## Liste des scénarios

Détail complet et pseudo-code dans [`SCENARIOS_PSEUDOCODE.md`](./SCENARIOS_PSEUDOCODE.md).

| # | Spec | Couverture |
|---|---|---|
| 1 | `sprint1/scenario_1_signup_user_solo.spec.ts` | T1, T4 — signup → verify email → login → suivre formation → quiz → attestation |
| 2 | `sprint1/scenario_2_create_cabinet.spec.ts` | T1, T2, T5 — super_admin crée cabinet + invite titulaire |
| 3 | `sprint1/scenario_3_hr_entity_branding.spec.ts` | T1, T6 — admin_rh modifie branding + curation, praticien_salarie voit le résultat |
| 4 | `sprint1/scenario_4_training_org_isolation.spec.ts` | T1, T3 — apprenant_of voit formation owned mais pas le catalogue Dentalschool |
| 5 | `sprint1/scenario_5_inter_tenant_isolation.spec.ts` | T1, T3 — user org A ne voit pas le contenu org B |

---

## Limites assumées

- **Pas de CI** : aucun workflow GitHub Actions ne déclenche ces tests. À ajouter
  dans `.github/workflows/e2e.yml` quand le runtime sera installé.
- **Pas de tests de régression visuelle** : Playwright supporte `expect(page).toHaveScreenshot()`
  mais hors scope V1.
- **Pas de tests d'API isolés** : les scénarios passent obligatoirement par l'UI.
  Les tests d'API (curl direct sur `/api/admin/organizations`, `/api/tenant/curation`)
  sont à ajouter dans une suite séparée si besoin.
- **Délivrabilité email** : le scénario 1 intercepte l'email de vérification via
  l'Admin API Supabase (`generateLink({ type: 'signup' })`) plutôt que d'attendre
  un mail réel — évite la dépendance Brevo/Gmail.

---

*Document maintenu par Claude Code lors de l'implémentation T8 — 3 mai 2026.*
