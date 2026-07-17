// Edge Function : send-reminder-push
// Rôle : relais push pour les rappels générés en SQL (autoeval + autopilot).
// Appelée via pg_net depuis send_autoeval_reminders() et send_autopilot_reminders(),
// juste après l'INSERT dans notifications (la cloche existe toujours avant le push).
// Auth : Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY> — même pattern que les
// autres Edge Functions déclenchées par cron dans ce projet (notify_new_formation,
// live_session_reminders, ...).
// RGPD : le texte du rappel CP reste générique (jamais "santé" / "auto-évaluation"),
// contrairement au message in-app, qui lui reste explicite (protégé par l'auth).

import webpush from "npm:web-push@3.6.7";
import { getServiceClient } from "../_shared/supabase.ts";
import { Logger } from "../_shared/logger.ts";

const logger = new Logger("send-reminder-push");

interface RunResult {
  ok: boolean;
  sent: number;
  skipped: number;
  failed: number;
}

interface PushPayloadDef {
  title: string;
  body: string;
  tag: string;
  url: string;
}

function initVapid(): void {
  const pub = Deno.env.get("NEXT_PUBLIC_VAPID_PUBLIC_KEY");
  const priv = Deno.env.get("VAPID_PRIVATE_KEY");
  const subj = Deno.env.get("VAPID_SUBJECT") ?? "mailto:contact@dentalschool.fr";
  if (!pub || !priv) throw new Error("VAPID keys are not configured");
  webpush.setVapidDetails(subj, pub, priv);
}

function payloadFor(kind: string, metadata: Record<string, unknown>): PushPayloadDef | null {
  if (kind === "autoeval_reminder") {
    return {
      title: "Un moment pour vous",
      body: "Une tâche personnelle vous attend dans votre espace Certily.",
      tag: "cp-reminder",
      url: "/sante/auto-evaluation",
    };
  }
  if (kind === "autopilot_reminder") {
    const count = typeof metadata.todo_count === "number" ? metadata.todo_count : undefined;
    return {
      title: "🧭 Ton plan du mois",
      body: count
        ? `Il te reste ${count} action${count > 1 ? "s" : ""} prévue${count > 1 ? "s" : ""} ce mois-ci.`
        : "Ton plan du mois t'attend.",
      tag: "autopilot-reminder",
      url: "/",
    };
  }
  return null;
}

function prefColumnFor(kind: string): "cp_reminders" | "autopilot_reminders" | null {
  if (kind === "autoeval_reminder") return "cp_reminders";
  if (kind === "autopilot_reminder") return "autopilot_reminders";
  return null;
}

async function parseNotificationIds(req: Request): Promise<string[]> {
  try {
    const body = await req.json();
    return Array.isArray(body?.notification_ids) ? body.notification_ids : [];
  } catch {
    return [];
  }
}

async function run(notificationIds: string[]): Promise<RunResult> {
  const supabase = getServiceClient();

  logger.info("run_start", { requested: notificationIds.length });

  const { data: notifs, error: nErr } = await supabase
    .from("notifications")
    .select("id, user_id, metadata")
    .in("id", notificationIds);

  if (nErr) throw new Error(`load notifications: ${nErr.message}`);

  let sent = 0;
  let skipped = 0;
  let failed = 0;

  for (const n of notifs ?? []) {
    const meta = (n.metadata as Record<string, unknown> | null) ?? {};
    const kind = meta.kind as string | undefined;
    const prefColumn = kind ? prefColumnFor(kind) : null;
    const payloadDef = kind ? payloadFor(kind, meta) : null;

    if (!prefColumn || !payloadDef) {
      skipped++;
      continue;
    }

    const { data: prefs } = await supabase
      .from("user_notification_preferences")
      .select(`notifications_enabled, ${prefColumn}`)
      .eq("user_id", n.user_id)
      .maybeSingle();

    if (
      prefs !== null &&
      (prefs.notifications_enabled === false || (prefs as Record<string, unknown>)[prefColumn] === false)
    ) {
      skipped++;
      continue;
    }

    const { data: subs } = await supabase
      .from("push_subscriptions")
      .select("endpoint, p256dh, auth")
      .eq("user_id", n.user_id);

    if (!subs || subs.length === 0) {
      skipped++;
      continue;
    }

    const payload = JSON.stringify({
      title: payloadDef.title,
      body: payloadDef.body,
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      tag: payloadDef.tag,
      data: { url: payloadDef.url },
    });

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
        logger.error("push_failed", { notification_id: n.id, user_id: n.user_id, error: msg });
      }
    }

    await supabase.from("notifications").update({ push_sent_at: new Date().toISOString() }).eq("id", n.id);

    if (pushOk) sent++;
    else failed++;
  }

  logger.info("run_complete", { total: notifs?.length ?? 0, sent, skipped, failed });
  return { ok: true, sent, skipped, failed };
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

  const notificationIds = await parseNotificationIds(req);

  if (notificationIds.length === 0) {
    return new Response(JSON.stringify({ ok: true, sent: 0, skipped: 0, failed: 0 }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }

  try {
    initVapid();
    const result = await run(notificationIds);
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
