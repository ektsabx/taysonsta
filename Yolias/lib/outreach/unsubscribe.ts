import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { stopEnrollments } from "@/lib/crm/follow-ups";

// Unsubscribe link in campaign emails (owner, 2026-10-28): every campaign
// email ends with one line and carries List-Unsubscribe / List-Unsubscribe-Post
// (RFC 8058) so mail apps show their own Unsubscribe button. The link holds
// the lead's random token, never its id. Unsubscribing marks the lead "do not
// contact" and stops its campaigns, like a stop request in a reply.

const TOKEN = /^[0-9a-f-]{36}$/i;
const site = () => (process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.yolias.com").replace(/\/$/, "");

/** The confirmation page in the email body (a button, so link scanners change nothing). */
export const unsubscribePageUrl = (token: string, lang: string) => `${site()}/u/${token}${lang === "ar" ? "?l=ar" : ""}`;
/** The one-click address mail apps POST to. */
export const unsubscribePostUrl = (token: string) => `${site()}/api/u/${token}`;

/** The line added under each campaign email, in the email's language (Arabic or English). */
export function unsubscribeFooter(token: string, lang: string): string {
  const url = unsubscribePageUrl(token, lang);
  return lang === "ar" ? `\n\n--\nإذا كنت لا ترغب في تلقي رسائل أخرى مني: ${url}` : `\n\n--\nIf you'd rather not hear from me again: ${url}`;
}

export async function leadByUnsubscribeToken(token: string) {
  if (!TOKEN.test(token)) return null;
  const { data: lead } = await createAdminClient().from("sales_leads").select("id, workspace_id, email, do_not_contact, unsubscribed_at, workspace:workspaces(name)").eq("unsubscribe_token", token).maybeSingle();
  if (!lead) return null;
  return { ...lead, company: (lead.workspace as unknown as { name: string | null } | null)?.name ?? null };
}

export async function unsubscribeLead(token: string): Promise<boolean> {
  const lead = await leadByUnsubscribeToken(token);
  if (!lead) return false;
  if (lead.unsubscribed_at) return true;
  const db = createAdminClient();
  await db.from("sales_leads").update({ do_not_contact: true, unsubscribed_at: new Date().toISOString() }).eq("id", lead.id);
  await stopEnrollments(lead.id, "unsubscribed");
  await db.from("lead_activities").insert({ workspace_id: lead.workspace_id, lead_id: lead.id, kind: "agent", actor_kind: "system", body: "Unsubscribed with the link in the email. Yolias won't contact this lead again.", meta: { kind: "unsubscribe" } });
  return true;
}
