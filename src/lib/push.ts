import "server-only";
import webpush from "web-push";
import { pushRecipients } from "./household";
import { supabaseAdmin } from "./supabase/server";

export type PushPayload = { title: string; body: string; url: string; tag?: string };

let configured: boolean | undefined;
function configure(): boolean {
  if (configured !== undefined) return configured;
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) return (configured = false);
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || "mailto:admin@example.com", pub, priv);
  return (configured = true);
}

/**
 * Schickt eine Push-Nachricht an alle registrierten Geräte der angegebenen Nutzer.
 * Abgelaufene Abos (404/410) werden dabei gelöscht.
 */
export async function sendToUsers(userIds: string[], payload: PushPayload) {
  const admin = supabaseAdmin();
  if (!admin || !configure()) return { sent: 0, failed: 0, reason: "push-not-configured" as const };
  if (userIds.length === 0) return { sent: 0, failed: 0 };

  const { data: subs, error } = await admin
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .in("user_id", userIds);
  if (error) throw error;

  const body = JSON.stringify(payload);
  let sent = 0;
  let failed = 0;
  await Promise.all(
    (subs ?? []).map(async (s) => {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, body, {
          TTL: 60 * 60 * 6,
          urgency: "high",
          topic: payload.tag?.slice(0, 32).replace(/[^A-Za-z0-9_-]/g, ""),
        });
        sent++;
      } catch (err) {
        failed++;
        const status = (err as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) await admin.from("push_subscriptions").delete().eq("id", s.id);
        else console.error("push failed", status, (err as Error).message);
      }
    }),
  );
  return { sent, failed };
}

/** Alle Mitglieder des Haushalts außer der Person, die die Aufgabe erledigt hat, und nur mit „Push an“ (household_members.notify). */
export async function notifyHousehold(householdId: string, exceptUserId: string, payload: PushPayload) {
  const admin = supabaseAdmin();
  if (!admin) return { sent: 0, failed: 0, reason: "push-not-configured" as const };
  const { data, error } = await admin
    .from("household_members")
    .select("user_id, notify")
    .eq("household_id", householdId)
    .neq("user_id", exceptUserId);
  if (error) throw error;
  return sendToUsers(pushRecipients(data ?? [], exceptUserId), payload);
}
