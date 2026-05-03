/**
 * Scénario 3 — HR entity : branding + curation visibles côté praticien_salarie
 *
 * Couvre : T1 (org type='hr_entity'), T6 (espace tenant admin + branding + curation)
 * Pseudo-code détaillé : ../SCENARIOS_PSEUDOCODE.md §3
 *
 * STATUT : SQUELETTE — runtime Playwright non installé.
 * Voir tests/e2e/README.md pour la procédure d'activation.
 */
import { test, expect } from '@playwright/test';
// import {
//   loginAs, seedOrganization, seedAdminUser, seedMembership,
//   cleanupOrg, cleanupUser, getDentalschoolFormationIds,
// } from '../helpers';

test.describe('Scénario 3 — HR entity branding + curation', () => {
  let orgId: string;
  let adminRhUserId: string;
  let praticienUserId: string;

  test.beforeAll(async () => {
    // TODO: orgId = await seedOrganization({ type: 'hr_entity', plan: 'standard', name: 'VYV Test E2E' });
    // TODO: adminRhUserId = await seedAdminUser({ email: 'admin-rh-e2e@...', emailConfirmed: true });
    // TODO: praticienUserId = await seedAdminUser({ email: 'prat-salarie-e2e@...' });
    // TODO: await seedMembership(adminRhUserId, orgId, 'admin_rh');
    // TODO: await seedMembership(praticienUserId, orgId, 'praticien_salarie');
  });

  test.afterAll(async () => {
    // TODO: await cleanupOrg(orgId); await cleanupUser(adminRhUserId); await cleanupUser(praticienUserId);
  });

  test('admin_rh modifie le branding (logo + couleur primaire)', async ({ page }) => {
    // TODO: await loginAs(page, adminRhEmail, ...);
    await page.goto('/tenant/admin/branding');
    // TODO: setInputFiles sur le champ logo (PNG test 200x60)
    // TODO: remplir branding_primary_color=#1A8FE3
    // TODO: submit + assert toast succès + organizations.branding_logo_url IS NOT NULL en BDD
    expect(true).toBe(true);
  });

  test('admin_rh épingle 2 formations Dentalschool (curation)', async ({ page }) => {
    // TODO: const dentalIds = await getDentalschoolFormationIds(); // 6 dispo
    await page.goto('/tenant/admin/curation');
    // TODO: cliquer "Ajouter une formation" + sélectionner dentalIds[0]
    // TODO: idem pour dentalIds[1]
    // TODO: drag-and-drop pour ordre [1, 0]
    // TODO: assert org_curated_formations contient 2 lignes avec bon display_order
    expect(true).toBe(true);
  });

  test('praticien_salarie voit branding + formations épinglées', async ({ page, context }) => {
    // TODO: nouveau context (logout admin_rh)
    // TODO: await loginAs(page, praticienEmail, ...);
    // TODO: page.goto('/'); assert logo VYV affiché en header (pas le logo Dentalschool)
    // TODO: assert couleur primaire #1A8FE3 appliquée aux boutons primaires
    // TODO: page.goto('/formations'); assert section "Mises en avant par votre entité"
    //       contient les 2 formations dans l'ordre [dentalIds[1], dentalIds[0]]
    expect(true).toBe(true);
  });
});
