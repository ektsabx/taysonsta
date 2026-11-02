import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { values, excluded, placeName, sizeRange, type Targeting } from "@/lib/campaigns/targeting";
import type { AudienceSource } from "@/types/database";

// Audiences (owner, 2026-10-31, D-272, D-273). Read with the admin client and
// always filtered by the caller's workspace (callers check the session first).
//  - estimate(): what is known for sure: the companies and people Yolias
//    already has for this workspace that match, and how many can be emailed.
//    The size of the wider market is not estimated (no honest number exists);
//    the screen says new matches keep being found while the campaign runs.
//  - lookalike(): the traits most of a base shares (customers, booked
//    meetings, interested people or a custom audience), at an expansion level
//    (1 = closest), with the seed size and a confidence from it.
//  - members(): the people of a list source, each once.

type Db = ReturnType<typeof createAdminClient>;
const CAP = 5000;

type Known = { id: string; email: boolean; country: string | null; city: string | null; industry: string | null; title: string | null; employees: number | null; name: string; domain: string | null };

async function known(db: Db, workspaceId: string): Promise<Known[]> {
  const [{ data: people }, { data: companies }] = await Promise.all([
    db.from("prospects").select("id, full_name, title, country, city, email, email_status, company:companies(name, domain, industry, employee_count, country, city)").eq("workspace_id", workspaceId).limit(CAP),
    db.from("companies").select("id, name, domain, industry, employee_count, country, city, email").eq("workspace_id", workspaceId).limit(CAP),
  ]);
  type C = { name: string; domain: string | null; industry: string | null; employee_count: number | null; country: string | null; city: string | null } | null;
  return [
    ...(people ?? []).map((p) => {
      const c = p.company as unknown as C;
      return { id: `p:${p.id}`, email: Boolean(p.email) && p.email_status !== "invalid", country: p.country ?? c?.country ?? null, city: p.city ?? c?.city ?? null, industry: c?.industry ?? null, title: p.title, employees: c?.employee_count ?? null, name: c?.name ?? p.full_name, domain: c?.domain ?? null };
    }),
    ...(companies ?? []).map((c) => ({ id: `c:${c.id}`, email: Boolean(c.email), country: c.country, city: c.city, industry: c.industry, title: null, employees: c.employee_count, name: c.name, domain: c.domain })),
  ];
}

const low = (x: string | null | undefined) => (x ?? "").toLowerCase();
const has = (hay: string | null | undefined, needles: string[]) => Boolean(hay) && needles.some((n) => low(hay).includes(n) || n.includes(low(hay)));

/** Pure: does one known company or person match a targeting (unit-tested). */
export function matches(k: Omit<Known, "id" | "email">, t: Targeting): boolean {
  const cc = (k.country ?? "").toUpperCase();
  const inc = values(t, "countries").map((c) => c.toUpperCase()), exc = excluded(t, "countries").map((c) => c.toUpperCase());
  if (inc.length && !inc.includes(cc)) return false;
  if (exc.includes(cc)) return false;
  const places = (ids: string[]) => ids.map((id) => low(placeName(t, id)));
  const cities = places([...values(t, "cities"), ...values(t, "regions")]), notCities = places([...excluded(t, "cities"), ...excluded(t, "regions")]);
  if (cities.length && !has(k.city, cities)) return false;
  if (has(k.city, notCities)) return false;
  const ind = values(t, "industries").map(low), notInd = excluded(t, "industries").map(low);
  if (ind.length && !has(k.industry, ind)) return false;
  if (has(k.industry, notInd)) return false;
  const titles = values(t, "titles").map(low), notTitles = excluded(t, "titles").map(low);
  if (titles.length && k.title !== null && !has(k.title, titles)) return false;
  if (has(k.title, notTitles)) return false;
  const never = values(t, "exclude_companies").map(low);
  if (never.length && (has(k.name, never) || has(k.domain, never))) return false;
  const { min, max } = sizeRange(t);
  if ((min != null || max != null) && k.employees != null && ((min != null && k.employees < min) || (max != null && k.employees > max))) return false;
  return true;
}

export interface Estimate { known: number; email: number }

export async function estimate(workspaceId: string, audiences: Targeting[]): Promise<Estimate[]> {
  const list = await known(createAdminClient(), workspaceId);
  return audiences.map((t) => {
    const hit = list.filter((k) => matches(k, t));
    return { known: hit.length, email: hit.filter((k) => k.email).length };
  });
}

export type SeedKind = "customers" | "meetings" | "interested" | "audience";
export interface Lookalike {
  seedSize: number;
  /** Companies (website or name) to find lookalikes of. */
  seeds: string[];
  /** The traits the base shares at this expansion, with how many of the base share each. */
  traits: { field: "industries" | "countries" | "titles" | "sizes"; value: string; share: number }[];
  targeting: Targeting;
  confidence: "low" | "medium" | "high";
}

async function seedLeads(db: Db, workspaceId: string, kind: SeedKind, audienceId?: string): Promise<string[]> {
  if (kind === "customers") return ((await db.from("sales_leads").select("id").eq("workspace_id", workspaceId).eq("stage", "closed").limit(CAP)).data ?? []).map((l) => l.id);
  if (kind === "meetings") return ((await db.from("sales_meetings").select("lead_id").eq("workspace_id", workspaceId).neq("status", "canceled").limit(CAP)).data ?? []).map((m) => m.lead_id);
  if (kind === "interested") return ((await db.from("sales_leads").select("id").eq("workspace_id", workspaceId).in("stage", ["interested", "meeting_booked", "meeting_completed", "proposal", "negotiation", "closed"]).limit(CAP)).data ?? []).map((l) => l.id);
  if (!audienceId) return [];
  return ((await db.from("audience_members").select("lead_id").eq("workspace_id", workspaceId).eq("audience_id", audienceId).limit(CAP)).data ?? []).map((m) => m.lead_id);
}

const band = (n: number | null) => n == null ? null : n <= 10 ? "1-10" : n <= 50 ? "11-50" : n <= 200 ? "51-200" : n <= 500 ? "201-500" : n <= 1000 ? "501-1000" : "1001-";

/** Confidence from how many people the base has (shown with the size; never presented as a sure match). */
export const confidenceOf = (n: number): Lookalike["confidence"] => (n >= 20 ? "high" : n >= 5 ? "medium" : "low");

/**
 * Pure: the traits kept at an expansion level. 1 keeps only what at least 60%
 * of the base shares (closest, fewest companies); 10 keeps what 15% shares and
 * drops the job titles and sizes (broadest).
 */
export function traitsAt(rows: { industry: string | null; country: string | null; size: string | null; title: string | null }[], expansion: number): Lookalike["traits"] {
  const n = rows.length;
  if (!n) return [];
  const e = Math.min(10, Math.max(1, Math.round(expansion)));
  const floor = 0.6 - (e - 1) * 0.05;
  const tally = (xs: (string | null)[]) => {
    const m = new Map<string, number>();
    for (const x of xs) if (x) m.set(x, (m.get(x) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  };
  const keep = (field: Lookalike["traits"][number]["field"], xs: (string | null)[]) => tally(xs).filter(([, c]) => c >= 2 && c / n >= floor).slice(0, 4).map(([value, c]) => ({ field, value, share: c / n }));
  return [
    ...keep("industries", rows.map((r) => r.industry)),
    ...keep("countries", rows.map((r) => r.country)),
    ...(e <= 7 ? keep("sizes", rows.map((r) => r.size)) : []),
    ...(e <= 5 ? keep("titles", rows.map((r) => r.title)) : []),
  ];
}

export async function lookalike(workspaceId: string, kind: SeedKind, audienceId?: string, expansion = 3): Promise<Lookalike> {
  const db = createAdminClient();
  const ids = [...new Set(await seedLeads(db, workspaceId, kind, audienceId))];
  if (!ids.length) return { seedSize: 0, seeds: [], traits: [], targeting: {}, confidence: "low" };
  const { data } = await db.from("sales_leads").select("id, company_name, prospect:prospects(title, country), company:companies(name, domain, industry, country, employee_count)").eq("workspace_id", workspaceId).in("id", ids.slice(0, 1000));
  const rows = (data ?? []).map((l) => ({
    name: l.company_name, prospect: l.prospect as unknown as { title: string | null; country: string | null } | null,
    company: l.company as unknown as { name: string; domain: string | null; industry: string | null; country: string | null; employee_count: number | null } | null,
  }));
  const traits = traitsAt(rows.map((r) => ({ industry: r.company?.industry ?? null, country: (r.prospect?.country ?? r.company?.country)?.toUpperCase() ?? null, size: band(r.company?.employee_count ?? null), title: r.prospect?.title ?? null })), expansion);
  const pick = (f: Lookalike["traits"][number]["field"]) => traits.filter((x) => x.field === f).map((x) => x.value);
  // Broader = more seed companies to find lookalikes of.
  const seeds = [...new Set(rows.map((r) => r.company?.domain || r.company?.name || r.name).filter((x): x is string => Boolean(x)))].slice(0, 6 + Math.round(expansion) * 2);
  const targeting: Targeting = {};
  if (pick("industries").length) targeting.industries = { include: pick("industries") };
  if (pick("countries").length) targeting.countries = { include: pick("countries") };
  if (pick("sizes").length) targeting.sizes = { include: pick("sizes") };
  if (pick("titles").length) targeting.titles = { include: pick("titles") };
  return { seedSize: rows.length, seeds, traits, targeting, confidence: confidenceOf(rows.length) };
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
