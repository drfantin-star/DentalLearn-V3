/**
 * Scénario 7 — Push reminder J-1 : Edge Function → live_session_reminders_sent + notifications
 *
 * Couvre : T7 (Edge Function live_session_reminders, table live_session_reminders_sent,
 *          idempotence UNIQUE(session_id, user_id, reminder_type), notifications.metadata),
 *          T8 (RLS fix live_session_reminders_sent)
 * Pseudo-code détaillé : ../SCENARIOS_PSEUDOCODE.md §S2.7
 *
 * STATUT : SQUELETTE — runtime Playwright non installé.
 * Voir tests/e2e/README.md pour la procédure d'activation.
 *
 * Note T7 : les secrets VAPID doivent être configurés dans Supabase Edge Functions secrets
 * (supabase secrets set) EN PLUS de Vercel. Les Edge Functions Deno ne lisent pas les env vars Vercel.
 */
import { test, expect } from '@playwright/test';
// import { seedSession, seedRegistration, cleanupSession, invokeEdgeFunction } from '../helpers';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://dxybsuhfkwuemapqrvgz.supabase.co';

test.describe('Scénario 7 — Push reminder live_session (J-1) via Edge Function', () => {
  let sessionId: string | null = null;
  let userId: string | null = null;

  test.afterAll(async () => {
    // TODO: if (sessionId) await cleanupSession(sessionId);
    // Nettoyage live_session_reminders_sent : DELETE WHERE session_id = sessionId
    // Nettoyage notifications : DELETE WHERE user_id = userId AND type = 'live_reminder'
  });

  test('créer live_session test avec starts_at = now()+24h', async () => {
    // Seed via service_role pour contrôler starts_at précisément
    // TODO: const { data } = await supabaseAdmin.from('live_sessions').insert({
    //   formateur_user_id: process.env.E2E_FORMATEUR_USER_ID,
    //   title: `E2E Reminder Test ${Date.now()}`,
    //   starts_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // now()+24h
    //   duration_min: 60,
    //   zoom_url: 'https://zoom.us/j/remindertest',
    //   capacity: 10,
    //   is_published: true,
    // }).select('id').single();
    // TODO: sessionId = data.id;
    expect(true).toBe(true); // placeholder
  });

  test('user test s'inscrit à la session (row dans live_registrations)', async () => {
    // TODO: userId = process.env.E2E_USER_ID;
    // TODO: await supabaseAdmin.from('live_registrations').insert({ session_id: sessionId, user_id: userId });
    // TODO: vérifier row présente
    expect(true).toBe(true);
  });

  test('invocation manuelle de l'Edge Function live_session_reminders', async ({ request }) => {
    // Invocation via curl/fetch avec service_role key (Bearer)
    // TODO: const res = await request.post(`${SUPABASE_URL}/functions/v1/live_session_reminders`, {
    //   headers: {
    //     Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
    //     'Content-Type': 'application/json',
    //   },
    //   data: { limit: 10 },
    // });
    // TODO: expect(res.status()).toBe(200);
    // Fenêtre J-1 : starts_at ∈ [now()+23h, now()+25h] (cf. implémentation T7)
    expect(true).toBe(true);
  });

  test('vérifier row dans live_session_reminders_sent (idempotence)', async () => {
    // TODO: const { data } = await supabaseAdmin
    //   .from('live_session_reminders_sent')
    //   .select('*')
    //   .eq('session_id', sessionId)
    //   .eq('user_id', userId)
    //   .eq('reminder_type', 'j_minus_1');
    // TODO: expect(data).toHaveLength(1);
    // Test idempotence : invoquer une 2e fois → ON CONFLICT DO NOTHING → toujours 1 row
    expect(true).toBe(true);
  });

  test('vérifier row dans notifications (type live_reminder)', async () => {
    // TODO: const { data } = await supabaseAdmin
    //   .from('notifications')
    //   .select('*')
    //   .eq('user_id', userId)
    //   .eq('type', 'live_reminder')
    //   .order('created_at', { ascending: false })
    //   .limit(1);
    // TODO: expect(data).toHaveLength(1);
    // TODO: expect(data[0].metadata).toMatchObject({ session_id: sessionId });
    // Note : heure affichée Europe/Paris dans le corps de la notif (T7)
    expect(true).toBe(true);
  });
});
