/**
 * Scénario 3 — Live session : inscription user → bouton Rejoindre H-15min
 *
 * Couvre : T5 (live_sessions CRUD, /api/sessions/[id]/register,
 *          computeCanJoin fenêtre -15min, zoom_url masqué non-inscrits)
 * Pseudo-code détaillé : ../SCENARIOS_PSEUDOCODE.md §S2.3
 *
 * STATUT : SQUELETTE — runtime Playwright non installé.
 * Voir tests/e2e/README.md pour la procédure d'activation.
 */
import { test, expect } from '@playwright/test';
// import { seedFormateur, seedSession, cleanupSession, loginAs } from '../helpers';

test.describe('Scénario 3 — User s'inscrit à une live_session → bouton Rejoindre H-15min', () => {
  let sessionId: string | null = null;

  test.afterAll(async () => {
    // TODO: if (sessionId) await cleanupSession(sessionId);
  });

  test('formateur crée une live_session publiée (starts_at = now()+2h)', async ({ page }) => {
    // Pré-requis : formateur connecté
    // TODO: await loginAs(page, process.env.E2E_FORMATEUR_EMAIL!, process.env.E2E_FORMATEUR_PASSWORD!);
    // TODO: await page.goto('/formateur/sessions');
    // TODO: await page.click('button:has-text("Nouvelle session")');
    // TODO: remplir titre, starts_at = now()+2h, zoom_url, capacity=5
    // TODO: activer is_published
    // TODO: submit → sessionId récupéré depuis la réponse ou la BDD
    // Convention BDD : live_sessions.formateur_user_id (PAS user_id)
    expect(true).toBe(true); // placeholder
  });

  test('user s'inscrit à la session via /sessions/[id]', async ({ page }) => {
    // TODO: await loginAs(page, process.env.E2E_USER_EMAIL!, process.env.E2E_USER_PASSWORD!);
    // TODO: await page.goto(`/sessions/${sessionId}`);
    // TODO: expect(page.getByRole('button', { name: 'S\'inscrire' })).toBeVisible();
    // TODO: await page.click('button:has-text("S\'inscrire")');
    // TODO: expect(page.getByText('Inscription confirmée')).toBeVisible(); // toast in-app
    // TODO: vérifier row dans live_registrations (session_id, user_id)
    // TODO: vérifier zoom_url NON visible avant connexion session (fix T5 sécurité)
    expect(true).toBe(true);
  });

  test('bouton Rejoindre apparaît quand starts_at - 15min', async ({ page }) => {
    // Ce test simule le passage du temps via une session créée avec starts_at = now()+14min
    // OU via une modification directe BDD (service_role seed)
    // TODO: créer session_test_rejoindre avec starts_at = now()+14min via service_role
    // TODO: await page.goto(`/sessions/${sessionTestId}`);
    // TODO: expect(page.getByRole('button', { name: 'Rejoindre' })).toBeVisible();
    // TODO: expect(page.getByText(zoom_url)).toBeVisible(); // zoom_url visible à l'inscrit
    // Logique : computeCanJoin() → starts_at - 15min ≤ now() ≤ starts_at + duration_min
    // Note : badge "À venir" + bouton "Rejoindre" peuvent coexister (comportement voulu T5)
    expect(true).toBe(true);
  });
});
