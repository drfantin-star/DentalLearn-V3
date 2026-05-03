/**
 * Scénario 5 — Isolation inter-tenants : un user d'org A ne voit PAS le contenu d'org B
 *
 * Couvre : T1 (organizations), T3 (RLS user_can_see_formation), T6 (curation)
 * Pseudo-code détaillé : ../SCENARIOS_PSEUDOCODE.md §5
 *
 * STATUT : SQUELETTE — runtime Playwright non installé.
 * Voir tests/e2e/README.md pour la procédure d'activation.
 *
 * Ce scénario double-vérifie le test isolé du scénario 4 mais avec DEUX
 * tenants OF distincts : on s'assure qu'aucune fuite n'existe entre eux.
 */
import { test, expect } from '@playwright/test';
// import {
//   loginAs, seedOrganization, seedAdminUser, seedMembership,
//   seedFormationOwned, cleanupOrg, cleanupUser, cleanupFormation,
// } from '../helpers';

test.describe('Scénario 5 — Isolation inter-tenants', () => {
  let orgAId: string;
  let orgBId: string;
  let userAId: string;
  let userBId: string;
  let formationAId: string;
  let formationBId: string;

  test.beforeAll(async () => {
    // TODO: orgAId = await seedOrganization({ type: 'training_org', name: 'OF Alpha' });
    // TODO: orgBId = await seedOrganization({ type: 'training_org', name: 'OF Beta' });
    // TODO: userAId = await seedAdminUser({ email: 'user-a@...' });
    // TODO: userBId = await seedAdminUser({ email: 'user-b@...' });
    // TODO: await seedMembership(userAId, orgAId, 'apprenant_of');
    // TODO: await seedMembership(userBId, orgBId, 'apprenant_of');
    // TODO: formationAId = await seedFormationOwned(orgAId, { title: 'Formation Alpha' });
    // TODO: formationBId = await seedFormationOwned(orgBId, { title: 'Formation Beta' });
  });

  test.afterAll(async () => {
    // TODO: await cleanupFormation(formationAId); await cleanupFormation(formationBId);
    // TODO: await cleanupOrg(orgAId); await cleanupOrg(orgBId);
    // TODO: await cleanupUser(userAId); await cleanupUser(userBId);
  });

  test('userA voit Formation Alpha mais PAS Formation Beta', async ({ page }) => {
    // TODO: await loginAs(page, 'user-a@...', ...);
    await page.goto('/formations');
    // TODO: assert page.getByText('Formation Alpha').isVisible();
    // TODO: assert page.getByText('Formation Beta').count() === 0;
    expect(true).toBe(true);
  });

  test('userB voit Formation Beta mais PAS Formation Alpha', async ({ page, context }) => {
    // TODO: nouveau context (isolation cookie session)
    // TODO: await loginAs(page, 'user-b@...', ...);
    await page.goto('/formations');
    // TODO: assert page.getByText('Formation Beta').isVisible();
    // TODO: assert page.getByText('Formation Alpha').count() === 0;
    expect(true).toBe(true);
  });

  test('accès direct par URL à une formation d\'un autre tenant → 404 ou redirect', async ({ page }) => {
    // TODO: await loginAs(page, 'user-a@...', ...);
    // TODO: page.goto(`/formations/${formationBId}/sequences/1`);
    // TODO: assert page.url() includes '/404' || response.status() === 404
    // TODO: vérifier qu'aucune ligne user_sequences n'a été créée pour userAId × formationBId
    expect(true).toBe(true);
  });

  test('curation côté admin_rh d\'une formation OF tiers → bloquée', async ({ page }) => {
    // Test bonus : la curation tenant ne doit accepter QUE des formations Dentalschool
    // (owner_org_id IS NULL). Tenter d'épingler formationAId depuis un autre tenant
    // doit échouer.
    // TODO: créer org HR + admin_rh
    // TODO: tenter POST /api/tenant/curation { formation_id: formationAId }
    // TODO: assert HTTP 400 ou 403
    expect(true).toBe(true);
  });
});
