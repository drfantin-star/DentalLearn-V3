/**
 * Scénario 2 — Formateur crée live_event présentiel → user voit la date
 *
 * Couvre : T4 (live_events CRUD, agenda /formateur/agenda),
 *          T4 (composant UpcomingEvents sur fiche formation)
 * Pseudo-code détaillé : ../SCENARIOS_PSEUDOCODE.md §S2.2
 *
 * STATUT : SQUELETTE — runtime Playwright non installé.
 * Voir tests/e2e/README.md pour la procédure d'activation.
 */
import { test, expect } from '@playwright/test';
// import { seedFormateur, seedFormation, assignFormateur, cleanupEvent, loginAs } from '../helpers';

const EVENT_TITLE = `E2E Event ${Date.now()}`;
const EVENT_DATE = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]; // J+7

test.describe('Scénario 2 — Formateur crée live_event → user voit la date sur fiche formation', () => {
  let eventId: string | null = null;
  let formationId: string | null = null;

  test.afterAll(async () => {
    // TODO: if (eventId) await cleanupEvent(eventId);
  });

  test('formateur se connecte et accède à /formateur/agenda', async ({ page }) => {
    // Pré-requis : formateur promu + assigné à une formation (cf. Scénario 1)
    // TODO: await loginAs(page, process.env.E2E_FORMATEUR_EMAIL!, process.env.E2E_FORMATEUR_PASSWORD!);
    // TODO: await page.goto('/formateur/agenda');
    // TODO: expect(page.getByText('Agenda')).toBeVisible();
    expect(true).toBe(true); // placeholder
  });

  test('formateur crée un live_event présentiel avec titre, date future et lieu', async ({ page }) => {
    // TODO: await page.click('button:has-text("Nouvel événement")');
    // TODO: await page.fill('[name="title"]', EVENT_TITLE);
    // TODO: await page.fill('[name="starts_at"]', `${EVENT_DATE}T09:00`);
    // TODO: await page.fill('[name="location_city"]', 'Paris');
    // TODO: await page.fill('[name="location_venue"]', 'Palais des Congrès');
    // TODO: sélectionner formation dans dropdown (formation_id NULLABLE — peut aussi être vide)
    // TODO: activer toggle is_published
    // TODO: submit → check row dans live_events avec deleted_at IS NULL
    // TODO: expect(page.getByText(EVENT_TITLE)).toBeVisible();
    // Note : validation starts_at passé = warning non-bloquant (D4 T4)
    expect(true).toBe(true);
  });

  test('user se rend sur la fiche formation et voit la date de l'événement', async ({ page }) => {
    // Pré-requis : live_event is_published=true + rattaché à formationId
    // TODO: await loginAs(page, process.env.E2E_USER_EMAIL!, process.env.E2E_USER_PASSWORD!);
    // TODO: await page.goto(`/formations/${formationId}`);
    // TODO: composant UpcomingEvents injecté entre progression et séquences (T4)
    // TODO: expect(page.getByText(EVENT_TITLE)).toBeVisible();
    // TODO: expect(page.getByText('Paris')).toBeVisible();
    expect(true).toBe(true);
  });
});
