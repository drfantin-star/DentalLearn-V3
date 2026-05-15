/**
 * Scénario 4 — Formateur édite son profil → page publique /formateurs/[slug]
 *
 * Couvre : T6 (formateur_profiles, /formateur/profil édition,
 *          /formateurs/[slug] page publique connectés uniquement)
 * Pseudo-code détaillé : ../SCENARIOS_PSEUDOCODE.md §S2.4
 *
 * STATUT : SQUELETTE — runtime Playwright non installé.
 * Voir tests/e2e/README.md pour la procédure d'activation.
 *
 * ⚠️  PIÈGE BDD : formateur_profiles.user_id (PAS formateur_user_id)
 * ⚠️  Dette D2-T6-slug : slug et display_name peuvent être NULL au premier INSERT.
 *      Un super_admin doit hydrater manuellement si /formateur/profil ne les génère pas.
 */
import { test, expect } from '@playwright/test';
// import { loginAs, getFormateurSlug } from '../helpers';

const BIO_TEXT = `Bio E2E ${Date.now()} — spécialiste implantologie`;
const VILLE_TEST = 'Lyon';
const INSTAGRAM_TEST = 'https://instagram.com/testformateur';

test.describe('Scénario 4 — Formateur édite profil → /formateurs/[slug] accessible', () => {
  let slug: string | null = null;

  test('formateur se connecte et accède à /formateur/profil', async ({ page }) => {
    // TODO: await loginAs(page, process.env.E2E_FORMATEUR_EMAIL!, process.env.E2E_FORMATEUR_PASSWORD!);
    // TODO: await page.goto('/formateur/profil');
    // TODO: expect(page.getByRole('heading', { name: 'Mon profil' })).toBeVisible();
    expect(true).toBe(true); // placeholder
  });

  test('formateur remplit et sauvegarde les champs profil', async ({ page }) => {
    // TODO: await page.fill('[name="bio_long"]', BIO_TEXT);
    // TODO: await page.fill('[name="ville"]', VILLE_TEST);
    // TODO: await page.fill('[name="instagram_url"]', INSTAGRAM_TEST);
    // TODO: ajouter tags spécialités (tag input)
    // TODO: activer toggle is_published
    // TODO: await page.click('button:has-text("Enregistrer")');
    // TODO: expect(page.getByText('Profil sauvegardé')).toBeVisible();
    // TODO: slug = await getFormateurSlug(process.env.E2E_FORMATEUR_USER_ID!);
    // Note T6 : upload photo = canvas resize côté client si > 800px, 2 Mo max JPEG/PNG
    expect(true).toBe(true);
  });

  test('/formateurs/[slug] redirige vers /login si non authentifié', async ({ page }) => {
    // Page publique = connectés uniquement (décision D3 T6)
    // TODO: await page.goto(`/formateurs/${slug}`);  // sans session
    // TODO: await expect(page).toHaveURL(/\/login/);
    expect(true).toBe(true);
  });

  test('/formateurs/[slug] accessible et affiche les champs attendus (user connecté)', async ({ page }) => {
    // TODO: await loginAs(page, process.env.E2E_USER_EMAIL!, process.env.E2E_USER_PASSWORD!);
    // TODO: await page.goto(`/formateurs/${slug}`);
    // TODO: expect(page.getByText(BIO_TEXT)).toBeVisible();
    // TODO: expect(page.getByText(VILLE_TEST)).toBeVisible();
    // TODO: expect(page.getByRole('link', { name: 'Instagram' })).toHaveAttribute('href', INSTAGRAM_TEST);
    // TODO: expect(page.getByRole('button', { name: 'Suivre' })).toBeVisible(); // FollowButton T7
    expect(true).toBe(true);
  });
});
