import { defineConfig, devices } from '@playwright/test';

/**
 * Configuration Playwright DentalLearn — Sprint 1 T8.
 *
 * Statut : SQUELETTE FOURNI, RUNTIME NON INSTALLÉ.
 * Voir tests/e2e/README.md pour la procédure d'installation.
 *
 * Cible par défaut : staging local (http://localhost:3000) avec un projet
 * Supabase de staging dédié. La production (https://dental-learn-v3.vercel.app)
 * n'est PAS une cible Playwright — réservée au smoke test manuel
 * (scripts/smoke_test_prod.sh).
 */
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false, // Tests RBAC = ordre + état BDD partagé
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1, // Séquentiel obligatoire pour les scénarios multi-tenant
  reporter: [
    ['list'],
    ['html', { open: 'never', outputFolder: 'playwright-report' }],
  ],
  timeout: 60_000,
  expect: { timeout: 10_000 },

  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 10_000,
    navigationTimeout: 20_000,
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  // Pas de webServer auto : l'utilisateur lance `npm run dev` séparément
  // pour conserver la maîtrise des seeds Supabase et de l'état tenant.
});
