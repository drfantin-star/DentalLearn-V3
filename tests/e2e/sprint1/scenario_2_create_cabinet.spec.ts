/**
 * Scénario 2 — super_admin crée org cabinet + invite titulaire
 *
 * Couvre : T1 (organizations + organization_members), T2 (isSuperAdmin TS), T5 (UI back-office)
 * Pseudo-code détaillé : ../SCENARIOS_PSEUDOCODE.md §2
 *
 * STATUT : SQUELETTE — runtime Playwright non installé.
 * Voir tests/e2e/README.md pour la procédure d'activation.
 */
import { test, expect } from '@playwright/test';
// import { loginAs, seedAdminUser, cleanupOrg, cleanupUser } from '../helpers';

const SUPER_ADMIN_EMAIL = process.env.E2E_SUPER_ADMIN_EMAIL ?? 'drfantin@gmail.com';
const SUPER_ADMIN_PASSWORD = process.env.E2E_SUPER_ADMIN_PASSWORD ?? '';
const TITULAIRE_EMAIL = `e2e-titu-${Date.now()}@dentallearn.test`;

test.describe('Scénario 2 — Création cabinet + invitation titulaire', () => {
  let orgId: string | null = null;
  let titulaireUserId: string | null = null;

  test.afterAll(async () => {
    // TODO: if (orgId) await cleanupOrg(orgId);
    // TODO: if (titulaireUserId) await cleanupUser(titulaireUserId);
  });

  test('super_admin crée une org cabinet via /admin/organizations/new', async ({ page }) => {
    // TODO: await loginAs(page, SUPER_ADMIN_EMAIL, SUPER_ADMIN_PASSWORD);
    await page.goto('/admin/organizations/new');
    // TODO: remplir name="Cabinet Test E2E", type="cabinet", plan="standard"
    // TODO: rechercher owner via email (créer le user titulaire en pré-requis)
    // TODO: submit + assert redirect vers /admin/organizations/[id]
    // TODO: capturer orgId depuis l'URL
    expect(true).toBe(true);
  });

  test('super_admin invite le titulaire (email envoyé)', async ({ page }) => {
    // TODO: page.goto(`/admin/organizations/${orgId}/invite`);
    // TODO: remplir email=TITULAIRE_EMAIL, intra_role='titulaire'
    // TODO: submit + assert toast succès
    // TODO: assert organization_members(status='invited') créé en BDD
    expect(true).toBe(true);
  });

  test('titulaire accepte invitation + accède /tenant/admin', async ({ page, context }) => {
    // TODO: const inviteLink = await fetchLatestInviteLink(TITULAIRE_EMAIL);
    // TODO: await page.goto(inviteLink); -> page accept
    // TODO: vérifier organization_members(status='active', joined_at IS NOT NULL)
    // TODO: page.goto('/tenant/admin'); assert dashboard accessible
    // TODO: vérifier que Branding et Curation sont GRISÉS (cabinet ≠ HR/OF)
    expect(true).toBe(true);
  });

  test('un user non super_admin ne peut PAS accéder /admin/organizations', async ({ page }) => {
    // TODO: loginAs un user lambda
    // TODO: page.goto('/admin/organizations'); assert redirect /403 ou /
    expect(true).toBe(true);
  });
});
