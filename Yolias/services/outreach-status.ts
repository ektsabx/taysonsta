import "server-only";
import { createClient } from "@/lib/supabase/server";
import { isAutoReplyRow } from "@/lib/outreach/auto-reply";

// Where each prospect stands in outreach (D-234), for the Prospects table:
// new → in a campaign → contacted (a message went out) → replied; plus
// do-not-contact. Read with the member's client (RLS), for one page of rows.

export type OutreachState = "new" | "in_campaign" | "contacted" | "replied" | "do_not_contact";

export async function outreachStates(workspaceId: string, items: { id: string; kind: "person" | "company" }[]): Promise<Map<string, OutreachState>> {
  const out = new Map<string, OutreachState>();
  if (!items.length) return out;
  const db = await createClient();
  const people = items.filter((i) => i.kind === "person").map((i) => i.id);
  const companies = items.filter((i) => i.kind === "company").map((i) => i.id);
  const [byPerson, byCompany] = await Promise.all([
    people.length ? db.from("sales_leads").select("id, prospect_id, company_id, do_not_contact").eq("workspace_id", workspaceId).in("prospect_id", people) : Promise.resolve({ data: [] }),
    companies.length ? db.from("sales_leads").select("id, prospect_id, company_id, do_not_contact").eq("workspace_id", workspaceId).is("prospect_id", null).in("company_id", companies) : Promise.resolve({ data: [] }),
  ]);
  const leads = [...(byPerson.data ?? []), ...(byCompany.data ?? [])];
  if (!leads.length) return out;
  const ids = leads.map((l) => l.id);
  const [{ data: enr }, { data: msgs }] = await Promise.all([
    db.from("outreach_enrollments").select("lead_id").in("lead_id", ids),
    db.from("outreach_messages").select("lead_id, direction, status, analysis").in("lead_id", ids).in("status", ["sent", "received"]),
  ]);
  const enrolled = new Set((enr ?? []).map((e) => e.lead_id));
  const sent = new Set((msgs ?? []).filter((m) => m.direction === "outbound").map((m) => m.lead_id));
  const replied = new Set((msgs ?? []).filter((m) => m.direction === "inbound" && !isAutoReplyRow(m)).map((m) => m.lead_id));
  for (const l of leads) {
    const key = l.prospect_id ?? l.company_id;
    if (!key) continue;
    out.set(key, l.do_not_contact ? "do_not_contact" : replied.has(l.id) ? "replied" : sent.has(l.id) ? "contacted" : enrolled.has(l.id) ? "in_campaign" : "new");
  }
  return out;
}
