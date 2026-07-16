// Edge Function : notify_new_formation
// Cron : 45 * * * * (toutes les heures, +45min)
// Rôle : notifier les utilisateurs opt-in quand une nouvelle formation du
//        catalogue public passe en ligne (formations is_published=true,
//        owner_org_id IS NULL).
// Idempotence : table new_formation_notifications_sent (1 broadcast par formation).
//   formations n'a PAS de published_at → détection par diff avec la table _sent
//   (seedée avec les formations déjà publiées lors du déploiement, cf. 20260716c).
// Préférences : notifications_enabled (kill-switch global) + new_formations.
//               Row absente = opt-in par défaut (convention projet).

import webpush from "npm:web-push@3.6.7";
import { getServiceClient } from "../_shared/supabase.ts";
import { Logger } from "../_shared/logger.ts";

const logger = new Logger("notify_new_formation");

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

interface RunOptions {
  limit: number;
}

interface RunResult {
  ok: boolean;
  formations: number;
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

  // Formations du catalogue public en ligne.
  const { data: formations, error: fErr } = await supabase
    .from("formations")
    .select("id, title")
    .eq("is_published", true)
    .is("owner_org_id", null)
    .order("created_at", { ascending: false })
    .limit(opts.limit);

  if (fErr) throw new Error(`load formations: ${fErr.message}`);

  // Filtrer celles déjà notifiées (table d'idempotence).
  const { data: sentRows, error: sErr } = await supabase
    .from("new_formation_notifications_sent")
    .select("formation_id");
  if (sErr) throw new Error(`load sent: ${sErr.message}`);
  const sentSet = new Set((sentRows ?? []).map((r) => r.formation_id));

  const fresh = (formations ?? []).filter((f) => !sentSet.has(f.id));
  logger.info("formations_fresh", { count: fresh.length });

  let sent = 0;
  let skipped_preference = 0;
  let failed = 0;

  for (const formation of fresh) {
    const payloadObj = createNewFormationPayload(formation.title, formation.id);
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
        .select("notifications_enabled, new_formations")
        .eq("user_id", userId)
        .maybeSingle();

      if (
        prefs !== null &&
        (prefs.notifications_enabled === false || prefs.new_formations === false)
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
          logger.error("push_failed", { formation_id: formation.id, user_id: userId, error: msg });
        }
      }

      await supabase.from("notifications").insert({
        user_id: userId,
        type: "push",
        title,
        message: body,
        status: pushOk ? "sent" : "failed",
        sent_at: new Date().toISOString(),
        metadata: { formation_id: formation.id },
      });

      if (pushOk) sent++;
      else failed++;
    }

    // Marquer la formation comme notifiée (idempotence broadcast).
    await supabase
      .from("new_formation_notifications_sent")
      .insert({ formation_id: formation.id });

    logger.info("formation_broadcast", { formation_id: formation.id, recipients: byUser.size });
  }

  logger.info("run_complete", { formations: fresh.length, sent, skipped_preference, failed });
  return { ok: true, formations: fresh.length, sent, skipped_preference, failed };
}

function createNewFormationPayload(
  formationTitle: string,
  _formationId: string,
): { title: string; body: string } {
  return {
    title: "🎓 Nouvelle formation en ligne",
    body: `${formationTitle} est désormais disponible. Découvrez-la dès maintenant !`,
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
