import "server-only";
import { randomBytes } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";

// Link clicks (owner, 2026-11-05): a link in a campaign email goes through
// yolias.com/l/<code>, which counts the click and sends the person on. One code
// per person and destination, so the same link in a follow-up keeps its count.

const site = () => (process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.yolias.com").replace(/\/$/, "");

/** Mail security scanners open links before the person does: those aren't clicks (unit-tested). */
export const isScanner = (ua: string | null) => !ua || /bot|crawl|spider|preview|scan|proofpoint|mimecast|barracuda|safelinks|urlscan|headless|curl|wget|python|go-http|java\//i.test(ua);

/** The tracked link for this person; the plain link if it can't be made, so an email never loses it. */
export async function clickLink(url: string | null, c: { workspaceId: string; leadId: string | null | undefined; campaignId: string | null | undefined }): Promise<string | null> {
  if (!url || !c.leadId) return url;
  try {
    const db = createAdminClient();
    const { data: had } = await db.from("email_links").select("code").eq("lead_id", c.leadId).eq("url", url).maybeSingle();
    if (had) return `${site()}/l/${had.code}`;
    const code = randomBytes(6).toString("base64url");
    const { error } = await db.from("email_links").insert({ code, workspace_id: c.workspaceId, lead_id: c.leadId, campaign_id: c.campaignId ?? null, url });
    if (error) throw error;
    return `${site()}/l/${code}`;
  } catch (e) {
    console.error("[links]", e instanceof Error ? e.message : e);
    return url;
  }
}
