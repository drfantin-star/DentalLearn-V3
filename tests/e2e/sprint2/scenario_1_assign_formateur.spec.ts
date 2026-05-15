/**
 * Scénario 1 — Assignation formateur → dashboard
 *
 * Couvre : T1 (formation_instructors), T2 (UI admin promotion/rattachement),
 *          T3 (dashboard stats formateur)
 * Pseudo-code détaillé : ../SCENARIOS_PSEUDOCODE.md §S2.1
 *
 * STATUT : SQUELETTE — runtime Playwright non installé.
 * Voir tests/e2e/README.md pour la procédure d'activation.
 */
import { test, expect } from '@playwright/test';
// import { seedFormateur, seedFormation, cleanupUser, loginAs } from '../helpers';

const SUPER_ADMIN_EMAIL = 'drfantin@gmail.com';
const FORMATEUR_EMAIL = `e2e-formateur-${Date.now()}@dentallearn.test`;
const FORMATEUR_PASSWORD = 'Test1234!@#$';

test.describe('Scénario 1 — super_admin assigne formateur → formateur voit formation', () => {
  let formateurUserId: string | null = null;
  let formationId: string | null = null;

  test.afterAll(async () => {
    // TODO: if (formateurUserId) await cleanupUser(formateurUserId);
    // TODO: cleanup formation_instructors row si formateur supprimé
  });

  test('super_admin se connecte et accède à /admin/formateurs', async ({ page }) => {
    // TODO: await loginAs(page, SUPER_ADMIN_EMAIL, process.env.SUPER_ADMIN_PASSWORD!);
    // TODO: await page.goto('/admin/formateurs');
    // TODO: expect(page.getByText('Formateurs')).toBeVisible();
    expect(true).toBe(true); // placeholder
  });

  test('super_admin crée un compte formateur et le promeut', async ({ page }) => {
    // Pré-requis : user FORMATEUR_EMAIL existe ou est créé via Admin API
    // TODO: const { data } = await supabaseAdmin.auth.admin.createUser({ email: FORMATEUR_EMAIL, password: FORMATEUR_PASSWORD, email_confirm: true });
    // TODO: formateurUserId = data.user!.id;
    // TODO: await page.goto('/admin/formateurs/promote');
    // TODO: await page.fill('[name="email"]', FORMATEUR_EMAIL);
    // TODO: await page.click('button[type="submit"]');
    // TODO: expect(page.getByText('Formateur promu avec succès')).toBeVisible();
    expect(true).toBe(true);
  });

  test('super_admin assigne le formateur à une formation existante', async ({ page }) => {
    // Pré-requis : une formation publiée existe en BDD (seed ou formation de test)
    // TODO: formationId = await seedFormation(); // ou récupérer depuis /api/admin/formations
    // TODO: await page.goto(`/admin/formations/${formationId}/instructors`);
    // TODO: cliquer "Ajouter un intervenant"
    // TODO: sélectionner FORMATEUR_EMAIL dans le dropdown
    // TODO: cocher "Intervenant principal"
    // TODO: submit → row dans formation_instructors confirmée
    // TODO: expect(page.getByText(FORMATEUR_EMAIL)).toBeVisible();
    expect(true).toBe(true);
  });

  test('formateur se connecte et voit la formation dans /formateur/dashboard', async ({ page }) => {
    // TODO: await loginAs(page, FORMATEUR_EMAIL, FORMATEUR_PASSWORD);
    // TODO: await page.goto('/formateur/dashboard');
    // TODO: expect(page.getByText('Dashboard')).toBeVisible();
    // TODO: expect(page.getByTestId('formation-stats-card')).toBeVisible();
    // TODO: vérifier que la formation assignée apparaît dans les KPIs par formation
    // Conventions BDD : formateur_profiles.user_id (PAS formateur_user_id)
    expect(true).toBe(true);
  });
});
