// Edge Function : notify_followers_new_publication
// Cron : 30 * * * * (toutes les heures, décalé de 30 min vs live_session_reminders)
// Rôle : notifier les followers d'un formateur quand il publie une nouvelle live session
// Debounce 24h via metadata JSONB sur la table notifications

import webpush from "npm:web-push@3.6.7";
import { getServiceClient } from "../_shared/supabase.ts";
import { Logger } from "../_shared/logger.ts";

const logger = new Logger("notify_followers_new_publication");

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

interface RunOptions {
  limit: number;
}

interface RunResult {
  ok: boolean;
  sent: number;
  skipped_debounce: number;
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

  // FIX : pas d'embed imbriqué — PostgREST ne peut pas résoudre la relation
  // live_sessions.formateur_user_id → formateur_profiles.user_id (pas de FK déclarée entre ces 2 tables)
  // On charge les sessions seules, puis on fetch le display_name séparément par session.
  const { data: newSessions, error: sessErr } = await supabase
    .from("live_sessions")
    .select("id, title, formateur_user_id")
    .eq("is_published", true)
    .is("deleted_at", null)
    .not("published_at", "is", null)
    .gte("published_at", new Date(now.getTime() - 60 * 60 * 1000).toISOString())
    .limit(opts.limit);

  if (sessErr) throw new Error(`load sessions: ${sessErr.message}`);

  logger.info("sessions_loaded", { count: newSessions?.length ?? 0 });

  let sent = 0;
  let skipped_debounce = 0;
  let skipped_preference = 0;
  let failed = 0;

  for (const session of newSessions ?? []) {
    const formateurUserId = session.formateur_user_id;

    // FIX : fetch display_name séparément (requête indépendante, pas d'embed)
    const { data: fp } = await supabase
      .from("formateur_profiles")
      .select("display_name")
      .eq("user_id", formateurUserId)
      .maybeSingle();

    const displayName = fp?.display_name ?? "Formateur";

    // Récupérer les followers de ce formateur
    const { data: followers } = await supabase
      .from("formateur_followers")
      .select("user_id")
      .eq("formateur_user_id", formateurUserId);

    for (const follower of followers ?? []) {
      const userId = follower.user_id;

      // Debounce 24h : vérifier si une notification pour ce formateur a déjà été envoyée
      const since24h = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
      const { data: recent } = await supabase
        .from("notifications")
        .select("id")
        .eq("user_id", userId)
        .eq("type", "push")
        .eq("metadata->>formateur_user_id", formateurUserId)
        .gte("sent_at", since24h)
        .maybeSingle();

      if (recent) {
        logger.info("notification_skipped_debounce", {
          session_id: session.id,
          user_id: userId,
          formateur_user_id: formateurUserId,
        });
        skipped_debounce++;
        continue;
      }

      // Préférence utilisateur (row absente = true par défaut)
      // notifications_enabled = kill-switch global (consentement à l'inscription).
      const { data: prefs } = await supabase
        .from("user_notification_preferences")
        .select("notifications_enabled, formateur_publications")
        .eq("user_id", userId)
        .maybeSingle();

      if (
        prefs !== null &&
        (prefs.notifications_enabled === false || prefs.formateur_publications === false)
      ) {
        logger.info("notification_skipped_preference", {
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

      const title = "✨ Nouvelle masterclass";
      const body = `${displayName} vient de publier : ${session.title}`;
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
          logger.error("push_failed", {
            session_id: session.id,
            user_id: userId,
            error: msg,
          });
        }
      }

      if (pushOk) {
        logger.info("push_sent", {
          session_id: session.id,
          user_id: userId,
          formateur_user_id: formateurUserId,
          endpoint_count: subs.length,
        });
      }

      // INSERT notifications avec metadata pour debounce futur
      await supabase.from("notifications").insert({
        user_id: userId,
        type: "push",
        title,
        message: body,
        status: pushOk ? "sent" : "failed",
        sent_at: new Date().toISOString(),
        metadata: {
          formateur_user_id: formateurUserId,
          session_id: session.id,
        },
      });

      if (pushOk) sent++;
      else failed++;
    }
  }

  logger.info("run_complete", { sent, skipped_debounce, skipped_preference, failed });
  return { ok: true, sent, skipped_debounce, skipped_preference, failed };
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
