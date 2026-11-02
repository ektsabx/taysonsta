import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { campaignTable } from "@/services/campaign-table";

// Prospects as the campaigns' source (owner, 2026-11-02, D-274): for each
// campaign, what its audiences' searches found (companies, people, how many
// with an email) and what came of them (contacted, replied, meetings).
// Counted from real rows; read after requireViewer with the session's workspace.

export interface SourceLine { id: string; name: string; status: string; companies: number; people: number; withEmail: number; contacted: number; replied: number; meetings: number }

export async function campaignSources(workspaceId: string): Promise<SourceLine[]> {
  const lines = (await campaignTable(workspaceId, { from: null, to: null }, {})).filter((l) => l.status !== "draft");
  if (!lines.length) return [];
  const db = createAdminClient();
  const { data: groups } = await db.from("audience_groups").select("campaign_id, search_campaign_id").eq("workspace_id", workspaceId).in("campaign_id", lines.map((l) => l.id)).not("search_campaign_id", "is", null);
  const out: SourceLine[] = [];
  for (const l of lines) {
    const searches = (groups ?? []).filter((g) => g.campaign_id === l.id).map((g) => g.search_campaign_id!);
    let withEmail = 0;
    if (searches.length) {
      const head = { count: "exact" as const, head: true };
      const [p, c] = await Promise.all([
        db.from("prospects").select("id", head).eq("workspace_id", workspaceId).in("campaign_id", searches).not("email", "is", null),
        db.from("companies").select("id", head).eq("workspace_id", workspaceId).in("campaign_id", searches).not("email", "is", null),
      ]);
      withEmail = (p.count ?? 0) + (c.count ?? 0);
    }
    out.push({ id: l.id, name: l.name, status: l.status, companies: l.counts.foundCompanies, people: l.counts.foundPeople, withEmail, contacted: l.counts.contacted, replied: l.counts.replies, meetings: l.counts.meetings });
  }
  return out;
}
