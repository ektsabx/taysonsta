import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { EventLevel, PipelineStage } from "@/types/database";
import { parseIcp, type IcpCriteria } from "@/lib/discovery/icp";
import { classifySeniority, scoreMatch } from "@/lib/discovery/match";
import { companySources, configured, emailVerifiers, enrichers, peopleSources } from "@/lib/discovery/registry";
import type { CompanyCandidate, DiscoveryContext, PersonCandidate } from "@/lib/discovery/types";

// Discovery pipeline: Search → Find Companies → Find Decision Makers →
// Enrich & Verify → Qualify / Match → Prospects. Runs with the service role
// (callers must have checked workspace membership) and records every step in
// campaign_events so the UI can show AI activity / progress.

// Events store an English message plus meta {key, vars} pointing at the
// `events` dictionary, so the UI shows them in the reader's language.
export interface EventText {
  key?: string;
  vars?: Record<string, string | number>;
}

export async function logEvent(workspaceId: string, campaignId: string, stage: PipelineStage, message: string, level: EventLevel = "info", text: EventText = {}) {
  await createAdminClient()
    .from("campaign_events")
    .insert({ workspace_id: workspaceId, campaign_id: campaignId, stage, message, level, meta: text.key ? (text as never) : null });
}

const dedupeKey = (c: CompanyCandidate) => (c.domain ? c.domain.toLowerCase().replace(/^www\./, "") : c.name.toLowerCase().trim());

export async function runDiscovery(campaignId: string): Promise<void> {
  const db = createAdminClient();
  const { data: campaign } = await db.from("campaigns").select("*").eq("id", campaignId).single();
  if (!campaign) return;
  const icp = parseIcp(campaign.criteria);
  if (!icp) {
    await db.from("campaigns").update({ status: "failed" }).eq("id", campaignId);
    await logEvent(campaign.workspace_id, campaignId, "plan", "Campaign criteria are invalid.", "error", { key: "invalidCriteria" });
    return;
  }
  const { data: ws } = await db.from("workspaces").select("offering").eq("id", campaign.workspace_id).single();
  const ctx: DiscoveryContext = {
    workspaceId: campaign.workspace_id,
    campaignId,
    offering: ws?.offering ?? null,
    limit: campaign.quota,
    log: (stage, message, level, text) => logEvent(campaign.workspace_id, campaignId, stage, message, level, text),
  };

  const sources = configured(companySources);
  if (sources.length === 0) {
    await db.from("campaigns").update({ status: "awaiting_source" }).eq("id", campaignId);
    await ctx.log("companies", "No company data source is connected yet. Results will be collected once one is connected.", "warning", { key: "noCompanySource" });
    return;
  }

  await db.from("campaigns").update({ status: "running", started_at: new Date().toISOString() }).eq("id", campaignId);
  try {
    const companies = await findCompanies(icp, ctx, sources);
    let companiesFound = 0;
    let prospectsFound = 0;

    for (const company of companies) {
      const enriched = await enrichCompany(company, ctx);
      const { data: row, error } = await db.from("companies").insert({
        workspace_id: ctx.workspaceId, campaign_id: campaignId, name: enriched.name, domain: enriched.domain,
        industry: enriched.industry, description: enriched.description, city: enriched.city, country: enriched.country,
        employee_count: enriched.employeeCount, funding_stage: enriched.fundingStage, funding_total_usd: enriched.fundingTotalUsd,
        hiring_roles: enriched.hiringRoles, signals: enriched.signals, source: sourceOf(enriched), source_ref: enriched.sourceRef,
        raw: (enriched.raw ?? null) as never,
      }).select("id").single();
      if (error || !row) continue;
      companiesFound++;

      const people = await findPeople(enriched, icp, ctx);
      for (const person of people) {
        const p = await enrichPerson(person, enriched, ctx);
        const emailStatus = p.email ? await verifyEmail(p.email) : "unknown";
        const match = scoreMatch(icp, enriched, p);
        await db.from("prospects").insert({
          workspace_id: ctx.workspaceId, campaign_id: campaignId, company_id: row.id, full_name: p.fullName, title: p.title,
          seniority: classifySeniority(p.title), email: p.email, email_status: emailStatus, phone: p.phone, whatsapp: p.whatsapp,
          linkedin_url: p.linkedinUrl, city: p.city ?? enriched.city, country: p.country ?? enriched.country,
          match_score: match.score, match_reasons: match.reasons, source: sourceOf(p), source_ref: p.sourceRef,
          raw: (p.raw ?? null) as never,
        });
        prospectsFound++;
      }
      await db.from("campaigns").update({ companies_found: companiesFound, prospects_found: prospectsFound }).eq("id", campaignId);
    }

    await db.from("campaigns").update({ status: "completed", completed_at: new Date().toISOString() }).eq("id", campaignId);
    await ctx.log("deliver", `Discovery complete: ${companiesFound} companies, ${prospectsFound} decision makers.`, "success", {
      key: "complete",
      vars: { companies: companiesFound, prospects: prospectsFound },
    });
  } catch (e) {
    await db.from("campaigns").update({ status: "failed" }).eq("id", campaignId);
    const reason = e instanceof Error ? e.message : "unknown error";
    await ctx.log("deliver", `Discovery stopped: ${reason}`, "error", { key: "stopped", vars: { reason } });
  }
}

// Provider id travels with each candidate so the row records where it came from.
const origin = new WeakMap<object, string>();
const sourceOf = (x: object) => origin.get(x) ?? "unknown";

async function findCompanies(icp: IcpCriteria, ctx: DiscoveryContext, sources: typeof companySources) {
  const seen = new Map<string, CompanyCandidate>();
  for (const source of sources) {
    if (seen.size >= ctx.limit) break;
    await ctx.log("companies", `Searching ${source.label} for matching companies…`, "info", { key: "searching", vars: { source: source.label } });
    const found = await source.searchCompanies(icp, { ...ctx, limit: ctx.limit - seen.size });
    for (const c of found) {
      const key = dedupeKey(c);
      if (seen.has(key)) continue;
      origin.set(c, source.id);
      seen.set(key, c);
    }
  }
  await ctx.log("companies", `Found ${seen.size} candidate companies.`, "success", { key: "foundCompanies", vars: { count: seen.size } });
  return [...seen.values()].slice(0, ctx.limit);
}

async function findPeople(company: CompanyCandidate, icp: IcpCriteria, ctx: DiscoveryContext) {
  const out: PersonCandidate[] = [];
  for (const source of configured(peopleSources)) {
    const people = await source.findDecisionMakers(company, icp, ctx);
    for (const p of people) origin.set(p, source.id);
    out.push(...people);
    if (out.length) break;
  }
  return out;
}

async function enrichCompany(company: CompanyCandidate, ctx: DiscoveryContext): Promise<CompanyCandidate> {
  let c = company;
  for (const e of configured(enrichers)) {
    if (e.enrichCompany) c = { ...c, ...(await e.enrichCompany(c, ctx)) };
  }
  if (c !== company) origin.set(c, sourceOf(company));
  return c;
}

async function enrichPerson(person: PersonCandidate, company: CompanyCandidate, ctx: DiscoveryContext): Promise<PersonCandidate> {
  let p = person;
  for (const e of configured(enrichers)) {
    if (e.enrichPerson) p = { ...p, ...(await e.enrichPerson(p, company, ctx)) };
  }
  if (p !== person) origin.set(p, sourceOf(person));
  return p;
}

async function verifyEmail(email: string) {
  const verifier = configured(emailVerifiers)[0];
  return verifier ? verifier.verify(email) : ("found" as const);
}
