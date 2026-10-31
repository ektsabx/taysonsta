import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { hasProviderFor } from "@/lib/intel/registry";
import { values, excluded, sizeRange, type Targeting } from "@/lib/campaigns/targeting";
import type { AudienceSource } from "@/types/database";

// Audiences behind a campaign's groups (owner, 2026-10-31, D-272). Read with
// the admin client and always filtered by the caller's workspace (callers
// check the session first).
//  - estimate(): what is known for sure: matching prospects the workspace
//    already has, their data completeness, overlap between groups and with
//    other running campaigns. The size of the new market is NOT estimated:
//    without a connected data source there is no honest number for it.
//  - lookalike(): the common traits of a seed (customers, qualified meetings…)
//    with how many seed members share each, and the seed companies to find
//    lookalikes of. Similar is not the same as ready to buy; the screen says so.
//  - members(): the people of a list source (a custom audience, a previous
//    campaign, customers, imported contacts), each once.

type Db = ReturnType<typeof createAdminClient>;
const CAP = 5000;

type ProspectFacts = { id: string; title: string | null; country: string | null; email: string | null; email_status: string | null; company: { industry: string | null; employee_count: number | null; country: string | null } | null };

async function matching(db: Db, workspaceId: string, t: Targeting): Promise<ProspectFacts[]> {
  const { data } = await db.from("prospects").select("id, title, country, email, email_status, company:companies(industry, employee_count, country)")
    .eq("workspace_id", workspaceId).not("saved_at", "is", null).limit(CAP);
  const countries = values(t, "countries").map((c) => c.toUpperCase()), notCountries = excluded(t, "countries").map((c) => c.toUpperCase());
  const industries = values(t, "industries").map((x) => x.toLowerCase()), notIndustries = excluded(t, "industries").map((x) => x.toLowerCase());
  const titles = values(t, "titles").map((x) => x.toLowerCase()), notTitles = excluded(t, "titles").map((x) => x.toLowerCase());
  const { min, max } = sizeRange(t);
  const has = (hay: string | null | undefined, needles: string[]) => Boolean(hay) && needles.some((n) => hay!.toLowerCase().includes(n) || n.includes(hay!.toLowerCase()));
  return ((data ?? []) as unknown as ProspectFacts[]).filter((p) => {
    const country = (p.country ?? p.company?.country ?? "").toUpperCase();
    if (countries.length && !countries.includes(country)) return false;
    if (notCountries.includes(country)) return false;
    if (industries.length && !has(p.company?.industry, industries)) return false;
    if (has(p.company?.industry, notIndustries)) return false;
    if (titles.length && !has(p.title, titles)) return false;
    if (has(p.title, notTitles)) return false;
    const n = p.company?.employee_count;
    if ((min != null || max != null) && n != null && ((min != null && n < min) || (max != null && n > max))) return false;
    return true;
  });
}

export interface Estimate {
  /** Prospects the workspace already has that match (exact). */
  inWorkspace: number;
  withEmail: number;
  verified: number;
  /** Share of the matches with an email, 0..1, or null with no matches. */
  completeness: number | null;
  /** Matches already in another group of this audience set (by index), or already in a running campaign. */
  overlapGroups: number;
  inRunningCampaigns: number;
  /** A data source is connected to find new people beyond these. */
  canFindNew: boolean;
}

export async function estimate(workspaceId: string, groups: Targeting[]): Promise<Estimate[]> {
  const db = createAdminClient();
  const [lists, canFindNew, running] = await Promise.all([
    Promise.all(groups.map((g) => matching(db, workspaceId, g))),
    hasProviderFor("person.search").catch(() => false),
    db.from("outreach_enrollments").select("lead:sales_leads(prospect_id)").eq("workspace_id", workspaceId).eq("status", "active").limit(CAP),
  ]);
  const busy = new Set((running.data ?? []).map((e) => (e.lead as unknown as { prospect_id: string | null } | null)?.prospect_id).filter(Boolean));
  return lists.map((list, i) => {
    const others = new Set(lists.filter((_, j) => j !== i).flat().map((p) => p.id));
    const withEmail = list.filter((p) => p.email).length;
    return {
      inWorkspace: list.length, withEmail, verified: list.filter((p) => p.email_status === "verified" || p.email_status === "valid").length,
      completeness: list.length ? withEmail / list.length : null,
      overlapGroups: list.filter((p) => others.has(p.id)).length, inRunningCampaigns: list.filter((p) => busy.has(p.id)).length, canFindNew,
    };
  });
}

export type SeedKind = "customers" | "qualified" | "meetings" | "interested" | "audience";
export interface Lookalike {
  seedSize: number;
  /** Companies (website or name) to find lookalikes of. */
  seeds: string[];
  /** The traits most of the seed shares, with how many members share each. */
  traits: { field: "industries" | "countries" | "titles" | "sizes"; value: string; share: number }[];
  targeting: Targeting;
  /** low / medium / high: how much seed there is to learn from. */
  confidence: "low" | "medium" | "high";
}

async function seedLeads(db: Db, workspaceId: string, kind: SeedKind, audienceId?: string): Promise<string[]> {
  if (kind === "customers") return ((await db.from("sales_leads").select("id").eq("workspace_id", workspaceId).eq("stage", "closed").limit(CAP)).data ?? []).map((l) => l.id);
  if (kind === "qualified") return ((await db.from("sales_meetings").select("lead_id").eq("workspace_id", workspaceId).eq("qualified", true).limit(CAP)).data ?? []).map((m) => m.lead_id);
  if (kind === "meetings") return ((await db.from("sales_meetings").select("lead_id").eq("workspace_id", workspaceId).neq("status", "canceled").limit(CAP)).data ?? []).map((m) => m.lead_id);
  if (kind === "interested") return ((await db.from("sales_leads").select("id").eq("workspace_id", workspaceId).in("stage", ["interested", "meeting_booked", "meeting_completed", "proposal", "negotiation", "closed"]).limit(CAP)).data ?? []).map((l) => l.id);
  if (!audienceId) return [];
  return ((await db.from("audience_members").select("lead_id").eq("workspace_id", workspaceId).eq("audience_id", audienceId).limit(CAP)).data ?? []).map((m) => m.lead_id);
}

const band = (n: number | null) => n == null ? null : n <= 10 ? "1-10" : n <= 50 ? "11-50" : n <= 200 ? "51-200" : n <= 500 ? "201-500" : n <= 1000 ? "501-1000" : "1001-";

export async function lookalike(workspaceId: string, kind: SeedKind, audienceId?: string): Promise<Lookalike> {
  const db = createAdminClient();
  const ids = [...new Set(await seedLeads(db, workspaceId, kind, audienceId))];
  if (!ids.length) return { seedSize: 0, seeds: [], traits: [], targeting: {}, confidence: "low" };
  const { data } = await db.from("sales_leads").select("id, company_name, prospect:prospects(title, country), company:companies(name, domain, industry, country, employee_count)").eq("workspace_id", workspaceId).in("id", ids.slice(0, 1000));
  const rows = (data ?? []).map((l) => ({
    name: l.company_name, prospect: l.prospect as unknown as { title: string | null; country: string | null } | null,
    company: l.company as unknown as { name: string; domain: string | null; industry: string | null; country: string | null; employee_count: number | null } | null,
  }));
  const tally = (xs: (string | null | undefined)[]) => {
    const m = new Map<string, number>();
    for (const x of xs) if (x) m.set(x, (m.get(x) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  };
  const n = rows.length;
  // A trait counts when at least a quarter of the seed shares it (and two members at least).
  const keep = (field: Lookalike["traits"][number]["field"], xs: (string | null | undefined)[]) => tally(xs).filter(([, c]) => c >= 2 && c / n >= 0.25).slice(0, 4).map(([value, c]) => ({ field, value, share: c / n }));
  const traits = [
    ...keep("industries", rows.map((r) => r.company?.industry)),
    ...keep("countries", rows.map((r) => (r.prospect?.country ?? r.company?.country)?.toUpperCase())),
    ...keep("sizes", rows.map((r) => band(r.company?.employee_count ?? null))),
    ...keep("titles", rows.map((r) => r.prospect?.title)),
  ];
  const pick = (f: Lookalike["traits"][number]["field"]) => traits.filter((x) => x.field === f).map((x) => x.value);
  const seeds = [...new Set(rows.map((r) => r.company?.domain || r.company?.name || r.name).filter((x): x is string => Boolean(x)))].slice(0, 20);
  const targeting: Targeting = {};
  if (pick("industries").length) targeting.industries = { include: pick("industries") };
  if (pick("countries").length) targeting.countries = { include: pick("countries") };
  if (pick("sizes").length) targeting.sizes = { include: pick("sizes") };
  if (pick("titles").length) targeting.titles = { include: pick("titles") };
  return { seedSize: n, seeds, traits, targeting, confidence: n >= 20 ? "high" : n >= 5 ? "medium" : "low" };
}

/** The people of a list source, each once, contactable or not (enrollment applies the do-not-contact and re-contact rules). */
export async function members(workspaceId: string, source: AudienceSource, opts: { audienceId?: string | null; campaignId?: string | null } = {}): Promise<string[]> {
  const db = createAdminClient();
  let ids: string[] = [];
  if (source === "custom" && opts.audienceId) ids = ((await db.from("audience_members").select("lead_id").eq("workspace_id", workspaceId).eq("audience_id", opts.audienceId).limit(CAP)).data ?? []).map((m) => m.lead_id);
  else if (source === "previous_campaign" && opts.campaignId) ids = ((await db.from("outreach_enrollments").select("lead_id").eq("workspace_id", workspaceId).eq("campaign_id", opts.campaignId).limit(CAP)).data ?? []).map((m) => m.lead_id);
  else if (source === "customers") ids = await seedLeads(db, workspaceId, "customers");
  else if (source === "imported") ids = ((await db.from("sales_leads").select("id").eq("workspace_id", workspaceId).eq("source", "import").limit(CAP)).data ?? []).map((l) => l.id);
  return [...new Set(ids)];
}
