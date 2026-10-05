import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { allRecipients, notify } from "@/lib/email/notify";

// Product update announcements (written and approved in Yolias Admin). Sent
// to users who turned "Product updates" on; service, plan and pricing notices
// may go to everyone (audience "all"). Idempotent per announcement + user.

export async function sendAnnouncement(id: string): Promise<void> {
  const db = createAdminClient();
  const { data: a } = await db.from("announcements").select("*").eq("id", id).maybeSingle();
  if (!a || a.status === "sent") return;
  if (a.status === "draft") await db.from("announcements").update({ status: "sending" }).eq("id", id);
  const everyone = a.audience === "all";
  let total = 0;
  for (let page = 0; ; page++) {
    const batch = await allRecipients(everyone ? null : "notify_product", page);
    if (!batch.length) break;
    total += await notify("announcement", batch, (l) => ({
      type: a.type,
      title: l === "ar" ? a.title_ar : a.title_en,
      body: l === "ar" ? a.body_ar : a.body_en,
      ctaLabel: (l === "ar" ? a.cta_label_ar : a.cta_label_en) || null,
      ctaUrl: a.cta_url || null,
    }), { dedupe: id, ignorePrefs: everyone });
  }
  const { count } = await db.from("email_log").select("id", { count: "exact", head: true }).like("dedupe_key", `announcement:${id}:%`);
  await db.from("announcements").update({ status: "sent", sent_at: new Date().toISOString(), recipients: count ?? total }).eq("id", id);
}
