import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { addLeads, leadsCreated, type LeadTarget } from "@/lib/crm";
import { enrollLeads } from "@/lib/outreach/sequence";
import { logCampaign } from "@/lib/campaigns/activity";
import { searchTargets } from "@/services/prospects";
import type { Json } from "@/types/database";

// Intake (owner, 2026-10-31, D-273; replaces the D-253 autopilot): the search
// behind each audience of a launched campaign keeps finding people, and each
// run's new people join that audience's conversations right away. There are
// no proposals and no approval cards: launching the campaign was the member's
// go-ahead. Do-not-contact, suppression, re-contact and "one person, one
// conversation" are enforced by enrollLeads. Searches that belong to no
// campaign (old searches from the chat) are left alone.

type Db = ReturnType<typeof createAdminClient>;

/** Worker step (every minute): new people from each running audience's search join its campaign. */
export async function intakeSweep(): Promise<{ joined: number }> {
  const db = createAdminClient();
  const out = { joined: 0 };
  const { data: groups } = await db.from("audience_groups").select("id, workspace_id, campaign_id, search_campaign_id, name, campaign:outreach_campaigns(id, status, approved_at, approved_by, created_by)")
    .eq("status", "active").not("search_campaign_id", "is", null).order("updated_at").limit(200);
  for (const g of groups ?? []) {
    const c = g.campaign as unknown as { id: string; status: string; approved_at: string | null; approved_by: string | null; created_by: string | null } | null;
    if (!c?.approved_at || !["active", "scheduled"].includes(c.status)) continue;
    try {
      const { data: s } = await db.from("campaigns").select("id, runs_count, prospects_found, status").eq("id", g.search_campaign_id!).maybeSingle();
      if (!s || !s.prospects_found) continue;
      // One run seen once: a key per audience holds the last run it took people from.
      const key = `intake:${g.id}`;
      const { data: st } = await db.from("worker_state").select("value").eq("key", key).maybeSingle();
      const seen = (st?.value as { runs?: number; found?: number } | null) ?? null;
      if (seen && seen.runs === s.runs_count && seen.found === s.prospects_found) continue;
      await db.from("worker_state").upsert({ key, value: { runs: s.runs_count, found: s.prospects_found } as Json, updated_at: new Date().toISOString() }, { onConflict: "key" });
      const added = await enrollSearch(db, g.workspace_id, c.approved_by ?? c.created_by, c.id, s.id, g.id);
      if (added) {
        out.joined += added;
        await logCampaign(db, g.workspace_id, c.id, "found", `${added} new ${added === 1 ? "person" : "people"} found for "${g.name}". Yolias writes to them in the campaign's hours.`, { group_id: g.id, added });
      }
    } catch (e) {
      console.error("[intake]", g.id, e instanceof Error ? e.message : e);
    }
  }
  return out;
}

/** A search's people become conversations of the campaign's audience (rules applied by enrollLeads). */
export async function enrollSearch(db: Db, ws: string, userId: string | null, outreachId: string, searchId: string, groupId: string | null): Promise<number> {
  if (!userId) return 0;
  const { data: camp } = await db.from("outreach_campaigns").select("contact_target, objective").eq("id", outreachId).maybeSingle();
  // D-274: a qualified-leads campaign finds and saves people (Leads) without contacting them.
  if (camp?.objective === "qualified_leads") return 0;
  const targets: LeadTarget[] = await searchTargets(ws, searchId, db as never, (camp?.contact_target as "people" | "companies" | "both" | undefined) ?? "both");
  if (!targets.length) return 0;
  const before = new Set(((await db.from("sales_leads").select("id").eq("workspace_id", ws).limit(10000)).data ?? []).map((l) => l.id));
  const { ids } = await addLeads(db as never, targets, "search");
  await leadsCreated(ws, ids.filter((id) => !before.has(id)), "agent");
  const r = await enrollLeads(db as never, ws, userId, outreachId, ids, groupId);
  return r?.added ?? 0;
}
