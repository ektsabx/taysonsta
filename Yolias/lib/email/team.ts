import "server-only";
import { cleanNotificationText } from "@/lib/notification-text";
import { createAdminClient } from "@/lib/supabase/admin";
import { notify, siteUrl, userRecipient } from "@/lib/email/notify";

// Messages the Yolias team writes to one account in Admin (D-215): an email
// through the normal pipeline (email_log, Resend) or an in-app notice. The
// result is written back to account_messages so Admin shows what happened.
// Recovery and marketing messages respect "Product updates" (off = skipped);
// service messages are always delivered. Never sent twice (dedupe by id).

export async function sendTeamMessage(messageId: string): Promise<void> {
  const db = createAdminClient();
  const { data: m } = await db.from("account_messages").select("*").eq("id", messageId).maybeSingle();
  if (!m || m.status !== "queued") return;
  const done = (status: "sent" | "failed" | "skipped", error: string | null = null) =>
    db.from("account_messages").update({ status, error, sent_at: status === "sent" ? new Date().toISOString() : null }).eq("id", m.id);
  const [to] = await userRecipient(m.user_id);
  if (!to) return void (await done("skipped", "account not found"));
  const { data: mod } = await db.from("account_moderation").select("status").eq("user_id", m.user_id).maybeSingle();
  if (mod?.status === "deleted") return void (await done("skipped", "account deleted"));
  if (m.purpose !== "service" && to.prefs.notify_product === false) return void (await done("skipped", "the member turned off product updates"));
  // Only links to Yolias itself.
  const cta = m.cta_url && (m.cta_url.startsWith("/") ? `${siteUrl()}${m.cta_url}` : m.cta_url.startsWith(siteUrl()) ? m.cta_url : null);

  if (m.channel === "in_app") {
    const { error } = await db.from("notifications").upsert({
      user_id: m.user_id, kind: "team_message", title: cleanNotificationText(m.subject).slice(0, 300), body: cleanNotificationText(m.body).slice(0, 2000),
      link: cta ? cta.replace(siteUrl(), "") || "/" : null, dedupe_key: `team_message:${m.id}`,
    }, { onConflict: "dedupe_key", ignoreDuplicates: true });
    return void (await done(error ? "failed" : "sent", error?.message ?? null));
  }
  if (m.channel !== "email") return void (await done("skipped", "channel not connected"));
  const queued = await notify("team_message", [to], { subject: m.subject, body: m.body, ctaLabel: cta ? "Open Yolias" : null, ctaUrl: cta }, { dedupe: m.id, ignorePrefs: true });
  await done(queued > 0 ? "sent" : "skipped", queued > 0 ? null : "email switched off in Admin or already sent");
}
