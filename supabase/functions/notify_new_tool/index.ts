// Edge Function : notify_new_tool
// Déclenchée par le trigger SQL tools_notify_published quand is_published
// passe de false à true sur un outil.
// Corps attendu : { slug: string, title: string }
// Préférences : notifications_enabled (kill-switch global) + new_tools.
//               Row absente = opt-in par défaut (convention projet).

import webpush from "npm:web-push@3.6.7";
import { getServiceClient } from "../_shared/supabase.ts";
import { Logger } from "../_shared/logger.ts";

const logger = new Logger("notify_new_tool");

interface ToolPayload {
  slug: string;
  title: string;
}

function initVapid(): void {
  const pub = Deno.env.get("NEXT_PUBLIC_VAPID_PUBLIC_KEY");
  const priv = Deno.env.get("VAPID_PRIVATE_KEY");
  const subj = Deno.env.get("VAPID_SUBJECT") ?? "mailto:contact@dentalschool.fr";
  if (!pub || !priv) throw new Error("VAPID keys are not configured");
  webpush.setVapidDetails(subj, pub, priv);
}

async function parseBody(req: Request): Promise<ToolPayload> {
  const body = await req.json();
  if (!body?.slug || !body?.title) {
    throw new Error("Missing slug or title in request body");
  }
  return { slug: body.slug, title: body.title };
}

async function run(tool: ToolPayload): Promise<{ ok: boolean; sent: number; skipped_preference: number; failed: number }> {
  const supabase = getServiceClient();

  logger.info("run_start", { slug: tool.slug, title: tool.title });

  // Fetch pending notifications inserted by the SQL trigger for this tool.
  const { data: pendingNotifs, error: nErr } = await supabase
    .from("notifications")
    .select("id, user_id")
    .eq("status", "pending")
    .contains("metadata", { tool_slug: tool.slug });

  if (nErr) throw new Error(`load notifications: ${nErr.message}`);

  const notifsByUser = new Map<string, string[]>();
  for (const n of pendingNotifs ?? []) {
    const ids = notifsByUser.get(n.user_id) ?? [];
    ids.push(n.id);
    notifsByUser.set(n.user_id, ids);
  }

  const payload = JSON.stringify({
    title: "🧰 Nouvel outil dans ta boîte",
    body: `${tool.title} est prêt à l'emploi.`,
    link: "/outils",
  });

  // Fetch all push subscriptions in one query.
  const { data: allSubs } = await supabase
    .from("push_subscriptions")
    .select("user_id, endpoint, p256dh, auth");

  const subsByUser = new Map<string, { endpoint: string; p256dh: string; auth: string }[]>();
  for (const s of allSubs ?? []) {
    const arr = subsByUser.get(s.user_id) ?? [];
    arr.push({ endpoint: s.endpoint, p256dh: s.p256dh, auth: s.auth });
    subsByUser.set(s.user_id, arr);
  }

  let sent = 0;
  let skipped_preference = 0;
  let failed = 0;

  for (const [userId, notifIds] of notifsByUser) {
    // Preferences (absente = opt-in par defaut).
    const { data: prefs } = await supabase
      .from("user_notification_preferences")
      .select("notifications_enabled, new_tools")
      .eq("user_id", userId)
      .maybeSingle();

    if (
      prefs !== null &&
      (prefs.notifications_enabled === false || prefs.new_tools === false)
    ) {
      skipped_preference++;
      await supabase
        .from("notifications")
        .update({ status: "failed" })
        .in("id", notifIds);
      continue;
    }

    const userSubs = subsByUser.get(userId) ?? [];
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
        logger.error("push_failed", { tool_slug: tool.slug, user_id: userId, error: msg });
      }
    }

    await supabase
      .from("notifications")
      .update({
        status: pushOk ? "sent" : "failed",
        sent_at: new Date().toISOString(),
        push_sent_at: pushOk ? new Date().toISOString() : null,
      })
      .in("id", notifIds);

    if (pushOk) sent++;
    else failed++;
  }

  logger.info("run_complete", { tool_slug: tool.slug, sent, skipped_preference, failed });
  return { ok: true, sent, skipped_preference, failed };
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

  try {
    initVapid();
    const tool = await parseBody(req);
    const result = await run(tool);
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
