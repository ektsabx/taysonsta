import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

// Try again later (owner, 2026-10-30, D-268): people whose sequence ended
// without a reply more than 60 days ago, who never answered, didn't ask to
// stop and aren't in an active campaign. Shown in Analytics → Today and as a
// Prospects filter, so a new campaign starts from Prospects like any other.

export const REENGAGE_DAYS = 60;
type Db = SupabaseClient<Database>;

export async function reengageTargets(db: Db, workspaceId: string, cap = 2000): Promise<{ prospectIds: string[]; companyIds: string[] }> {
  const before = new Date(Date.now() - REENGAGE_DAYS * 86_400_000).toISOString();
  const { data: done } = await db.from("outreach_enrollments").select("lead_id, lead:sales_leads(prospect_id, company_id, stage, do_not_contact, unsubscribed_at)")
    .eq("workspace_id", workspaceId).eq("status", "completed").eq("stop_reason", "sequence_done").lt("updated_at", before).limit(cap);
  const leads = (done ?? []).map((e) => ({ id: e.lead_id, ...(e.lead as unknown as { prospect_id: string | null; company_id: string | null; stage: string; do_not_contact: boolean; unsubscribed_at: string | null } | null) }))
    .filter((l) => l.stage === "new" && !l.do_not_contact && !l.unsubscribed_at);
  if (!leads.length) return { prospectIds: [], companyIds: [] };
  const ids = [...new Set(leads.map((l) => l.id))];
  const busy = new Set<string>();
  for (let i = 0; i < ids.length; i += 300) {
    const part = ids.slice(i, i + 300);
    const [{ data: replied }, { data: active }] = await Promise.all([
      db.from("outreach_messages").select("lead_id").in("lead_id", part).eq("direction", "inbound"),
      db.from("outreach_enrollments").select("lead_id").in("lead_id", part).in("status", ["active", "paused"]),
    ]);
    for (const r of [...(replied ?? []), ...(active ?? [])]) if (r.lead_id) busy.add(r.lead_id);
  }
  const keep = leads.filter((l) => !busy.has(l.id));
  return {
    prospectIds: [...new Set(keep.map((l) => l.prospect_id).filter((x): x is string => Boolean(x)))],
    companyIds: [...new Set(keep.filter((l) => !l.prospect_id).map((l) => l.company_id).filter((x): x is string => Boolean(x)))],
  };
}
