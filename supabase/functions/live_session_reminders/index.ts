// Edge Function : live_session_reminders
// Cron : 0 * * * * (toutes les heures, UTC)
// Rôle : envoyer des rappels push aux inscrits d'une live session
//   - 'j_minus_1'  → starts_at dans [now()+23h, now()+25h]
//   - 'h_minus_1'  → starts_at dans [now()+45min, now()+75min]
// Idempotence : live_session_reminders_sent (UNIQUE session_id/user_id/reminder_type)

import webpush from "npm:web-push@3.6.7";
import { getServiceClient } from "../_shared/supabase.ts";
import { Logger } from "../_shared/logger.ts";

const logger = new Logger("live_session_reminders");

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

interface RunOptions {
  limit: number;
}

interface RunResult {
  ok: boolean;
  sent: number;
  skipped_idempotent: number;
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

function formatParisTime(isoUtc: string): string {
  return new Date(isoUtc).toLocaleString("fr-FR", {
    timeZone: "Europe/Paris",
    hour: "2-digit",
    minute: "2-digit",
  });
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

  // Charger les sessions dans la fenêtre [now+45min, now+25h]
  const windowStart = new Date(now.getTime() + 45 * 60 * 1000).toISOString();
  const windowEnd = new Date(now.getTime() + 25 * 60 * 60 * 1000).toISOString();

  const { data: sessions, error: sessErr } = await supabase
    .from("live_sessions")
    .select("id, title, starts_at, formateur_user_id")
    .eq("is_published", true)
    .is("deleted_at", null)
    .gte("starts_at", windowStart)
    .lte("starts_at", windowEnd)
    .limit(opts.limit);

  if (sessErr) throw new Error(`load sessions: ${sessErr.message}`);

  logger.info("sessions_loaded", { count: sessions?.length ?? 0 });

  let sent = 0;
  let skipped_idempotent = 0;
  let skipped_preference = 0;
  let failed = 0;

  for (const session of sessions ?? []) {
    const startsAt = new Date(session.starts_at);
    const diffMs = startsAt.getTime() - now.getTime();
    const diffH = diffMs / (60 * 60 * 1000);

    let reminder_type: "j_minus_1" | "h_minus_1" | null = null;
    if (diffH >= 23 && diffH <= 25) reminder_type = "j_minus_1";
    else if (diffH >= 0.75 && diffH <= 1.25) reminder_type = "h_minus_1";

    if (!reminder_type) continue;

    // Charger les inscrits
    const { data: regs } = await supabase
      .from("live_registrations")
      .select("user_id")
      .eq("session_id", session.id)
      .is("cancelled_at", null);

    for (const reg of regs ?? []) {
      const userId = reg.user_id;

      // Idempotence
      const { data: alreadySent } = await supabase
        .from("live_session_reminders_sent")
        .select("id")
        .eq("session_id", session.id)
        .eq("user_id", userId)
        .eq("reminder_type", reminder_type)
        .maybeSingle();

      if (alreadySent) {
        logger.info("reminder_skipped_idempotent", {
          session_id: session.id,
          user_id: userId,
          reminder_type,
        });
        skipped_idempotent++;
        continue;
      }

      // Préférence utilisateur (row absente = true par défaut)
      // notifications_enabled = kill-switch global (consentement à l'inscription).
      const { data: prefs } = await supabase
        .from("user_notification_preferences")
        .select("notifications_enabled, live_session_reminders")
        .eq("user_id", userId)
        .maybeSingle();

      if (
        prefs !== null &&
        (prefs.notifications_enabled === false || prefs.live_session_reminders === false)
      ) {
        logger.info("reminder_skipped_preference", {
          session_id: session.id,
          user_id: userId,
        });
        skipped_preference++;
        continue;
      }

      // Charger les push subscriptions
      const { data: subs } = await supabase
        .from("push_subscriptions")
        .select("endpoint, p256dh, auth")
        .eq("user_id", userId);

      if (!subs || subs.length === 0) {
        skipped_preference++;
        continue;
      }

      const timeStr = formatParisTime(session.starts_at);
      const title =
        reminder_type === "j_minus_1" ? "📅 Rappel J-1" : "🎙️ Dans 1 heure";
      const body =
        reminder_type === "j_minus_1"
          ? `Demain à ${timeStr} : ${session.title}. N'oublie pas !`
          : `${session.title} commence dans 1h. Le lien Zoom sera disponible 15 min avant.`;

      const payload = JSON.stringify({ title, body });

      let pushOk = false;
      for (const sub of subs) {
        try {
          await webpush.sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            payload,
          );
          pushOk = true;
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          logger.error("push_failed", { session_id: session.id, user_id: userId, error: msg });
        }
      }

      if (pushOk) {
        logger.info("push_sent", {
          session_id: session.id,
          user_id: userId,
          reminder_type,
          endpoint_count: subs.length,
        });
      }

      // INSERT notifications
      await supabase.from("notifications").insert({
        user_id: userId,
        type: "push",
        title,
        message: body,
        status: pushOk ? "sent" : "failed",
        sent_at: new Date().toISOString(),
        metadata: { session_id: session.id, reminder_type },
      });

      // Marquer comme envoyé (idempotence)
      await supabase
        .from("live_session_reminders_sent")
        .insert({ session_id: session.id, user_id: userId, reminder_type })
        .throwOnError();

      if (pushOk) sent++;
      else failed++;
    }
  }

  logger.info("run_complete", { sent, skipped_idempotent, skipped_preference, failed });
  return { ok: true, sent, skipped_idempotent, skipped_preference, failed };
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
