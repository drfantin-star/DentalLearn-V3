// Edge Function : notify_new_journal
// Cron : 15 * * * * (toutes les heures, +15min)
// Rôle : notifier les utilisateurs opt-in quand un nouveau journal hebdo passe
//        en ligne (news_episodes type='journal', status='published', audio_url présent).
// Idempotence : table weekly_journal_notifications_sent (1 broadcast par journal).
// Préférences : notifications_enabled (kill-switch global) + weekly_journal.
//               Row absente = opt-in par défaut (convention projet).

import webpush from "npm:web-push@3.6.7";
import { getServiceClient } from "../_shared/supabase.ts";
import { Logger } from "../_shared/logger.ts";

const logger = new Logger("notify_new_journal");

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

interface RunOptions {
  limit: number;
}

interface RunResult {
  ok: boolean;
  journals: number;
  sent: number;
  skipped_preference: number;
  failed: number;
}

function initVapid(): void {
  const pub = Deno.env.get("NEXT_PUBLIC_VAPID_PUBLIC_KEY");
  const priv = Deno.env.get("VAPID_PRIVATE_KEY");
  const subj = Deno.env.get("VAPID_SUBJECT") ?? "mailto:contact@dentalschool.fr";
  if (!pub || !priv) throw new Error("VAPID keys are not configured");
  webpush.setVapidDetails(subj, pub, priv);
}

async function parseBody(req: Request): Promise<RunOptions> {
  try {
    const body = await req.json();
    const raw = typeof body?.limit === "number" ? body.limit : DEFAULT_LIMIT;
    return { limit: Math.min(Math.max(1, raw), MAX_LIMIT) };
  } catch {
    return { limit: DEFAULT_LIMIT };
  }
}

async function run(opts: RunOptions): Promise<RunResult> {
  const supabase = getServiceClient();
  const now = new Date();

  logger.info("run_start", { limit: opts.limit, now_utc: now.toISOString() });

  // Journaux en ligne (prédicat identique à /api/news/journal/current).
  const { data: journals, error: jErr } = await supabase
    .from("news_episodes")
    .select("id, title")
    .eq("type", "journal")
    .eq("status", "published")
    .not("audio_url", "is", null)
    .order("published_at", { ascending: false, nullsFirst: false })
    .limit(opts.limit);

  if (jErr) throw new Error(`load journals: ${jErr.message}`);

  // Filtrer ceux déjà notifiés (table d'idempotence).
  const { data: sentRows, error: sErr } = await supabase
    .from("weekly_journal_notifications_sent")
    .select("journal_id");
  if (sErr) throw new Error(`load sent: ${sErr.message}`);
  const sentSet = new Set((sentRows ?? []).map((r) => r.journal_id));

  const fresh = (journals ?? []).filter((j) => !sentSet.has(j.id));
  logger.info("journals_fresh", { count: fresh.length });

  let sent = 0;
  let skipped_preference = 0;
  let failed = 0;

  for (const journal of fresh) {
    const payloadObj = createWeeklyJournalPayload(journal.title);
    const title = payloadObj.title;
    const body = payloadObj.body;
    const payload = JSON.stringify(payloadObj);

    // Destinataires : tous les users abonnés au push.
    const { data: subs } = await supabase
      .from("push_subscriptions")
      .select("user_id, endpoint, p256dh, auth");

    // Regrouper par user_id.
    const byUser = new Map<string, { endpoint: string; p256dh: string; auth: string }[]>();
    for (const s of subs ?? []) {
      const arr = byUser.get(s.user_id) ?? [];
      arr.push({ endpoint: s.endpoint, p256dh: s.p256dh, auth: s.auth });
      byUser.set(s.user_id, arr);
    }

    for (const [userId, userSubs] of byUser) {
      // Préférences (row absente = opt-in par défaut).
      const { data: prefs } = await supabase
        .from("user_notification_preferences")
        .select("notifications_enabled, weekly_journal")
        .eq("user_id", userId)
        .maybeSingle();

      if (
        prefs !== null &&
        (prefs.notifications_enabled === false || prefs.weekly_journal === false)
      ) {
        skipped_preference++;
        continue;
      }

      let pushOk = false;
      for (const sub of userSubs) {
        try {
          await webpush.sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            payload,
          );
          pushOk = true;
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          logger.error("push_failed", { journal_id: journal.id, user_id: userId, error: msg });
        }
      }

      await supabase.from("notifications").insert({
        user_id: userId,
        type: "push",
        title,
        message: body,
        status: pushOk ? "sent" : "failed",
        sent_at: new Date().toISOString(),
        metadata: { journal_id: journal.id },
      });

      if (pushOk) sent++;
      else failed++;
    }

    // Marquer le journal comme notifié (idempotence broadcast).
    await supabase
      .from("weekly_journal_notifications_sent")
      .insert({ journal_id: journal.id });

    logger.info("journal_broadcast", { journal_id: journal.id, recipients: byUser.size });
  }

  logger.info("run_complete", { journals: fresh.length, sent, skipped_preference, failed });
  return { ok: true, journals: fresh.length, sent, skipped_preference, failed };
}

function createWeeklyJournalPayload(journalTitle?: string): { title: string; body: string } {
  return {
    title: "📰 Nouveau journal hebdo en ligne",
    body: journalTitle
      ? `${journalTitle} — écoutez la revue de presse de la semaine.`
      : "La revue de presse de la semaine est disponible. Bonne écoute !",
  };
}

Deno.serve(async (req) => {
  const auth = req.headers.get("Authorization") ?? "";
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!key || auth !== `Bearer ${key}`) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    });
  }

  const opts = await parseBody(req);

  try {
    initVapid();
    const result = await run(opts);
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error("run_failed", { error: msg });
    return new Response(JSON.stringify({ ok: false, error: msg }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
});
