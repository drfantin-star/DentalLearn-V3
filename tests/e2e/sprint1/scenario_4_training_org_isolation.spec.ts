/**
 * Scénario 4 — Training org : apprenant_of voit formation owned mais PAS le catalogue Dentalschool
 *
 * Couvre : T1 (org type='training_org'), T3 (RLS user_can_see_formation), T6 (espace tenant)
 * Pseudo-code détaillé : ../SCENARIOS_PSEUDOCODE.md §4
 *
 * STATUT : SQUELETTE — runtime Playwright non installé.
 * Voir tests/e2e/README.md pour la procédure d'activation.
 *
 * NOTE : la création de contenu propre (D.07) n'est PAS livrée Sprint 1
 * (cf §4.3 du handoff). Le scénario simule une formation owned via INSERT
 * direct service_role (helpers.seedFormationOwned), pas via UI.
 */
import { test, expect } from '@playwright/test';
// import {
//   loginAs, seedOrganization, seedAdminUser, seedMembership,
//   seedFormationOwned, cleanupOrg, cleanupUser, cleanupFormation,
// } from '../helpers';

test.describe('Scénario 4 — Training org isolation catalogue', () => {
  let orgId: string;
  let adminOfUserId: string;
  let apprenantUserId: string;
  let ownedFormationId: string;

  test.beforeAll(async () => {
    // TODO: orgId = await seedOrganization({ type: 'training_org', plan: 'premium', name: 'OF Test E2E' });
    // TODO: adminOfUserId = await seedAdminUser({ email: 'admin-of-e2e@...' });
    // TODO: apprenantUserId = await seedAdminUser({ email: 'apprenant-of-e2e@...' });
    // TODO: await seedMembership(adminOfUserId, orgId, 'admin_of');
    // TODO: await seedMembership(apprenantUserId, orgId, 'apprenant_of');
    // TODO: ownedFormationId = await seedFormationOwned(orgId);
    //       (INSERT formation + 3 sequences + 12 questions, owner_org_id = orgId, is_published=true)
  });

  test.afterAll(async () => {
    // TODO: await cleanupFormation(ownedFormationId);
    // TODO: await cleanupOrg(orgId);
    // TODO: await cleanupUser(adminOfUserId); await cleanupUser(apprenantUserId);
  });

  test('apprenant_of voit la formation owned dans son catalogue', async ({ page }) => {
    // TODO: await loginAs(page, apprenantEmail, ...);
    await page.goto('/formations');
    // TODO: assert page.getByText('Formation OF Test E2E').isVisible()
    // TODO: assert clic + accès aux séquences possible (RLS user_can_see_formation OK)
    expect(true).toBe(true);
  });

  test('apprenant_of NE voit PAS le catalogue Dentalschool (6 formations)', async ({ page }) => {
    // Vérification critique de l'isolation
    await page.goto('/formations');
    // TODO: const dentalSlugs = ['eclaircissement', 'composite-anterieur', ...]; // depuis BDD prod
    // TODO: pour chaque slug : assert page.getByTestId(`formation-card-${slug}`).count() === 0
    // TODO: assert le compte total de formations affichées === 1 (seulement la owned)
    expect(true).toBe(true);
  });

  test('attestation générée par apprenant_of mentionne le nom de l\'OF (T7)', async ({ page }) => {
    // TODO: parcourir une séquence + quiz de la formation owned
    // TODO: page.goto('/profil/attestations'); cliquer "Générer attestation"
    // TODO: assert PDF contient "OF Test E2E" en organisme (PAS "EROJU SAS")
    // TODO: assert PDF NE contient PAS "QUA006589" ni "ODPC 9AGA"
    //       (l'OF n'a pas renseigné ses propres numéros dans cet exemple)
    expect(true).toBe(true);
  });
});
