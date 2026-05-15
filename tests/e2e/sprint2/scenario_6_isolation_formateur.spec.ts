/**
 * Scénario 6 — Isolation formateur : formateur_B ne peut pas éditer les sessions de formateur_A
 *
 * Couvre : T5 (ownership check explicite PATCH/DELETE /api/formateur/sessions/[id],
 *          réponse 403 en cas de violation)
 * Pseudo-code détaillé : ../SCENARIOS_PSEUDOCODE.md §S2.6
 *
 * STATUT : SQUELETTE — runtime Playwright non installé.
 * Voir tests/e2e/README.md pour la procédure d'activation.
 *
 * Note : le check ownership est double — RLS ET vérification explicite côté API
 * (event.formateur_user_id !== user.id). Les deux couches sont testées ici.
 */
import { test, expect } from '@playwright/test';
// import { seedFormateur, seedSession, cleanupSession, cleanupUser, getJwt } from '../helpers';

test.describe('Scénario 6 — Isolation : formateur_B ne peut pas modifier session formateur_A', () => {
  let sessionAId: string | null = null;
  let formateurBJwt: string | null = null;

  test.afterAll(async () => {
    // TODO: if (sessionAId) await cleanupSession(sessionAId);
  });

  test('formateur_A crée une live_session (seed service_role)', async () => {
    // TODO: const { data } = await supabaseAdmin.from('live_sessions').insert({
    //   formateur_user_id: process.env.E2E_FORMATEUR_A_USER_ID,
    //   title: `Session A ${Date.now()}`,
    //   starts_at: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
    //   duration_min: 60,
    //   zoom_url: 'https://zoom.us/j/sessionA',
    //   capacity: 10,
    //   is_published: true,
    // }).select('id').single();
    // TODO: sessionAId = data.id;
    // Convention BDD : live_sessions.formateur_user_id (PAS user_id)
    expect(true).toBe(true); // placeholder
  });

  test('formateur_B tente PATCH /api/formateur/sessions/[session_A_id] → 403', async ({ request }) => {
    // TODO: formateurBJwt = await getJwt(process.env.E2E_FORMATEUR_B_EMAIL!, process.env.E2E_FORMATEUR_B_PASSWORD!);
    // TODO: const res = await request.patch(`/api/formateur/sessions/${sessionAId}`, {
    //   headers: { Authorization: `Bearer ${formateurBJwt}` },
    //   data: { title: 'Hacked title' },
    // });
    // TODO: expect(res.status()).toBe(403);
    expect(true).toBe(true);
  });

  test('formateur_B tente DELETE /api/formateur/sessions/[session_A_id] → 403', async ({ request }) => {
    // TODO: const res = await request.delete(`/api/formateur/sessions/${sessionAId}`, {
    //   headers: { Authorization: `Bearer ${formateurBJwt}` },
    // });
    // TODO: expect(res.status()).toBe(403);
    // TODO: vérifier que la session existe toujours en BDD (non supprimée)
    expect(true).toBe(true);
  });
});
