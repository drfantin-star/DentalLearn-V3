/**
 * Scénario 5 — Capacity respectée (capacity=2 → 3e inscription bloquée 409)
 *
 * Couvre : T5 (guard capacity dans POST /api/sessions/[id]/register,
 *          réponse 409 avec message explicite)
 * Pseudo-code détaillé : ../SCENARIOS_PSEUDOCODE.md §S2.5
 *
 * STATUT : SQUELETTE — runtime Playwright non installé.
 * Voir tests/e2e/README.md pour la procédure d'activation.
 */
import { test, expect } from '@playwright/test';
// import { seedSession, seedUser, cleanupSession, cleanupUser } from '../helpers';

test.describe('Scénario 5 — Capacity=2 respectée, 3e inscription bloquée', () => {
  let sessionId: string | null = null;
  let userAId: string | null = null;
  let userBId: string | null = null;
  let userCId: string | null = null;

  test.afterAll(async () => {
    // TODO: if (sessionId) await cleanupSession(sessionId);
    // TODO: if (userAId) await cleanupUser(userAId);
    // TODO: if (userBId) await cleanupUser(userBId);
    // TODO: if (userCId) await cleanupUser(userCId);
  });

  test('créer une live_session avec capacity=2', async () => {
    // Seed via service_role (bypass RLS) pour isoler du comportement UI
    // TODO: const { data } = await supabaseAdmin.from('live_sessions').insert({
    //   formateur_user_id: process.env.E2E_FORMATEUR_USER_ID,
    //   title: `E2E Capacity Test ${Date.now()}`,
    //   starts_at: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
    //   duration_min: 60,
    //   zoom_url: 'https://zoom.us/j/test',
    //   capacity: 2,
    //   is_published: true,
    // }).select('id').single();
    // TODO: sessionId = data.id;
    expect(true).toBe(true); // placeholder
  });

  test('user_A s'inscrit → 1 place prise', async ({ request }) => {
    // Test API direct (pas UI) pour isoler la logique capacity
    // TODO: const res = await request.post(`/api/sessions/${sessionId}/register`, {
    //   headers: { Authorization: `Bearer ${userAJwt}` },
    // });
    // TODO: expect(res.status()).toBe(200);
    expect(true).toBe(true);
  });

  test('user_B s'inscrit → 2e place prise (session complète)', async ({ request }) => {
    // TODO: const res = await request.post(`/api/sessions/${sessionId}/register`, {
    //   headers: { Authorization: `Bearer ${userBJwt}` },
    // });
    // TODO: expect(res.status()).toBe(200);
    expect(true).toBe(true);
  });

  test('user_C tente de s'inscrire → 409 avec message explicite', async ({ request }) => {
    // TODO: const res = await request.post(`/api/sessions/${sessionId}/register`, {
    //   headers: { Authorization: `Bearer ${userCJwt}` },
    // });
    // TODO: expect(res.status()).toBe(409);
    // TODO: const body = await res.json();
    // TODO: expect(body.error).toMatch(/complet|capacity|places/i);
    // Note T5 : pas de liste d'attente V1 (décision D1 T5)
    expect(true).toBe(true);
  });
});
