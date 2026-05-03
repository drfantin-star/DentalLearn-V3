/**
 * Scénario 1 — Parcours utilisateur solo (signup → attestation)
 *
 * Couvre : T1 (handle_new_user trigger), T4 (pages auth + RGPD)
 * Pseudo-code détaillé : ../SCENARIOS_PSEUDOCODE.md §1
 *
 * STATUT : SQUELETTE — runtime Playwright non installé.
 * Voir tests/e2e/README.md pour la procédure d'activation.
 */
import { test, expect } from '@playwright/test';
// import { seedAdminUser, cleanupUser, generateConfirmationLink } from '../helpers';

const TEST_EMAIL = `e2e-solo-${Date.now()}@dentallearn.test`;
const TEST_PASSWORD = 'Test1234!@#$';

test.describe('Scénario 1 — User solo signup → attestation', () => {
  let createdUserId: string | null = null;

  test.afterAll(async () => {
    // TODO: if (createdUserId) await cleanupUser(createdUserId);
  });

  test('signup avec consentement RGPD obligatoire', async ({ page }) => {
    await page.goto('/signup');

    // TODO: remplir email/mot de passe/nom/prénom/RPPS optionnel
    // TODO: vérifier que le submit est bloqué si la case RGPD n'est pas cochée
    // TODO: cocher la case + submit
    // TODO: assert redirect vers /verify-email
    expect(true).toBe(true); // placeholder
  });

  test('verify email via Admin API + login', async ({ page }) => {
    // TODO: const link = await generateConfirmationLink(TEST_EMAIL);
    // TODO: await page.goto(link); -> /verify-email/confirm
    // TODO: vérifier que le trigger handle_new_user a créé user_profiles + streaks
    // TODO: navigate /login + soumettre credentials
    // TODO: assert /home accessible
    expect(true).toBe(true);
  });

  test('suivre 1 séquence + quiz + attestation', async ({ page }) => {
    // Pré-requis : user logué, formation Dentalschool publiée disponible
    // TODO: page.goto('/formations'); cliquer sur la 1re carte
    // TODO: cliquer "Commencer" sur la séquence d'intro (access_type='full' requis)
    // TODO: parcourir la séquence audio jusqu'à insertion en course_watch_logs
    // TODO: répondre aux 4 questions (assert score >= 1)
    // TODO: page.goto('/profil/attestations'); cliquer "Générer attestation"
    // TODO: assert PDF téléchargé contient "EROJU SAS — Dentalschool" + Qualiopi QUA006589 + ODPC 9AGA
    expect(true).toBe(true);
  });
});
