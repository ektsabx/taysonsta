import "server-only";
import { createClient } from "@/lib/supabase/server";
import { countryLabel } from "@/lib/format";
import { confirmSetup, titleFrom, understandAndLaunch } from "@/lib/discovery/launch";
import { updateSettings } from "@/lib/discovery/campaign-control";
import { parseIcp, type IcpCriteria } from "@/lib/discovery/icp";
import { releaseDaily, takeDaily } from "@/lib/daily-limits";
import { placeName, sizeRange, targetingPrompt, values, excluded, type Targeting } from "@/lib/campaigns/targeting";
import type { Session } from "@/lib/session";
import type { Json } from "@/types/database";

// Starting the search behind one audience (D-272, D-273), shared by the
// campaign builder and "Add audience" on a running campaign. A lookalike
// audience passes its seed companies.

export interface SearchAudience { name: string; targeting: unknown; seeds?: string[] }

export async function startGroupSearch(session: Session, g: SearchAudience, prospects: number, endsAt: string | null): Promise<{ strategyId: string; searchId: string } | "noPlan" | "noCredit" | null> {
  const db = await createClient();
  const tg = g.targeting as Targeting;
  const seeds = g.seeds ?? [];
  const prompt = seeds.length
    ? `Companies similar to: ${seeds.join(", ")}\n${targetingPrompt(tg, (c) => countryLabel(c, "en"))}`
    : targetingPrompt(tg, (c) => countryLabel(c, "en"));
  const slot = await takeDaily(session.userId, session.workspace.plan, "search");
  if (!slot.ok) return null;
  const { data: strategy } = await db.from("strategies").insert({ workspace_id: session.workspace.id, created_by: session.userId, title: titleFrom(g.name), prompt, attachments: [] as Json }).select("id").single();
  if (!strategy) { await releaseDaily(session.userId, "search"); return null; }
  await understandAndLaunch(session, strategy.id, prompt, []);
  const { data: row } = await db.from("strategies").select("status, icp").eq("id", strategy.id).single();
  const icp = row?.status === "setup" ? parseIcp(row.icp) : null;
  if (!icp) return null;
  const { min, max } = sizeRange(tg);
  const merged: IcpCriteria = {
    ...icp,
    campaign_name: g.name.slice(0, 120),
    countries: values(tg, "countries").length ? values(tg, "countries").map((c) => countryLabel(c, "en")) : icp.countries,
    cities: values(tg, "cities").length || values(tg, "regions").length ? [...values(tg, "cities"), ...values(tg, "regions")].map((id) => placeName(tg, id)) : icp.cities,
    industries: values(tg, "industries").length ? values(tg, "industries") : icp.industries,
    job_titles: values(tg, "titles").length ? values(tg, "titles") : icp.job_titles,
    employees_min: min ?? icp.employees_min, employees_max: max ?? icp.employees_max,
    hiring: values(tg, "hiring").length ? true : icp.hiring,
    funding_stages: values(tg, "funding").length ? values(tg, "funding") : icp.funding_stages,
    keywords: [...new Set([...icp.keywords, ...values(tg, "keywords"), ...values(tg, "technologies")])],
    exclusions: [...new Set([...icp.exclusions, ...excluded(tg, "keywords"), ...excluded(tg, "industries"), ...excluded(tg, "titles"), ...values(tg, "exclude_companies"),
      ...excluded(tg, "countries").map((c) => countryLabel(c, "en")), ...[...excluded(tg, "regions"), ...excluded(tg, "cities")].map((id) => placeName(tg, id))])],
    ...(seeds.length ? { search_type: "company_lookalikes" as const, lookalike_seeds: seeds } : {}),
    target_count: prospects,
  };
  const started = await confirmSetup(session, strategy.id, merged);
  if (started === "noPlan" || started === "noCredit") return started;
  if (!started) return null;
  if (endsAt) await updateSettings(db, started, { goal: prospects, deadline: endsAt, continuous: true, everyHours: 24 });
  return { strategyId: strategy.id, searchId: started };
}

