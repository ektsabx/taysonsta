import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { EventLevel, PipelineStage } from "@/types/database";
import { parseIcp, type IcpCriteria } from "@/lib/discovery/icp";
import { classifySeniority, scoreMatch } from "@/lib/discovery/match";
import { monthWindow, plans } from "@/lib/plans";
import type { CompanyCandidate, DiscoveryContext, PersonCandidate } from "@/lib/discovery/types";
import type { EmailStatus } from "@/types/database";
import { hasProviderFor, sourceLabels } from "@/lib/intel/registry";
import { runCapability, type CallScope } from "@/lib/intel/service";

// Discovery pipeline: Search → Find Companies → Find Decision Makers →
// Enrich & Verify → Qualify / Match → Prospects. Runs with the service role
// (callers must have checked workspace membership) and records every step in
// campaign_events so the UI can show AI activity / progress. Every external
// call goes through the Intelligence Layer (lib/intel): capabilities, not
// providers (docs/03). Scoring stays deterministic code (rule 24).

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
  const { data: ws } = await db.from("workspaces").select("offering, plan").eq("id", campaign.workspace_id).single();

  // Plans are billed on prospects only: each decision maker delivered uses
  // one from this month's allowance, and discovery stops when it runs out.
  const { start } = monthWindow();
  const { count: used } = await db
    .from("prospects").select("id", { count: "exact", head: true })
    .eq("workspace_id", campaign.workspace_id).gte("created_at", start.toISOString());
  const allowance = plans[ws?.plan ?? "free"].prospects;
  const remaining = Math.max(0, allowance - (used ?? 0));
  if (remaining === 0) {
    await db.from("campaigns").update({ status: "paused" }).eq("id", campaignId);
    await logEvent(campaign.workspace_id, campaignId, "plan", "This month’s prospects are used up. Upgrade or wait for the reset.", "warning", {
      key: "quotaReached",
      vars: { total: allowance },
    });
    return;
  }
  const ctx: DiscoveryContext = {
    workspaceId: campaign.workspace_id,
    campaignId,
    offering: ws?.offering ?? null,
    limit: Math.min(campaign.quota, remaining),
    log: (stage, message, level, text) => logEvent(campaign.workspace_id, campaignId, stage, message, level, text),
  };

  if (!(await hasProviderFor("company.search"))) {
    await db.from("campaigns").update({ status: "awaiting_source" }).eq("id", campaignId);
    await ctx.log("companies", "No company data source is connected yet. Results will be collected once one is connected.", "warning", { key: "noCompanySource" });
    return;
  }

  await db.from("campaigns").update({ status: "running", started_at: new Date().toISOString() }).eq("id", campaignId);
  try {
    const companies = await findCompanies(icp, ctx);
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
        if (prospectsFound >= remaining) break;
        const p = await enrichPerson(person, enriched, ctx);
        const emailStatus = p.email ? await verifyEmail(p.email, ctx) : "unknown";
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
      if (prospectsFound >= remaining) {
        await ctx.log("deliver", "This month’s prospects are used up.", "warning", { key: "quotaReached", vars: { total: allowance } });
        break;
      }
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
const scopeOf = (ctx: DiscoveryContext): CallScope => ({ workspaceId: ctx.workspaceId, campaignId: ctx.campaignId });

async function findCompanies(icp: IcpCriteria, ctx: DiscoveryContext) {
  const source = (await sourceLabels()).join(", ") || "Yolias";
  await ctx.log("companies", `Searching ${source} for matching companies…`, "info", { key: "searching", vars: { source } });
  const res = await runCapability("company.search", { icp, limit: ctx.limit, offering: ctx.offering }, scopeOf(ctx));
  const seen = new Map<string, CompanyCandidate>();
  if (res.ok) {
    for (const c of res.data) {
      const key = dedupeKey(c);
      if (seen.has(key)) continue;
      origin.set(c, res.provider);
      seen.set(key, c);
    }
  } else if (res.reason === "all_failed") {
    throw new Error(`company search failed (${res.errors.map((e) => e.provider).join(", ")})`);
  }
  await ctx.log("companies", `Found ${seen.size} candidate companies.`, "success", { key: "foundCompanies", vars: { count: seen.size } });
  return [...seen.values()].slice(0, ctx.limit);
}

async function findPeople(company: CompanyCandidate, icp: IcpCriteria, ctx: DiscoveryContext) {
  const res = await runCapability("person.search", { company, icp, limit: 5 }, scopeOf(ctx));
  if (!res.ok) return [];
  for (const p of res.data) origin.set(p, res.provider);
  return res.data;
}

// Optional steps: skipped (no call, no cost) when no provider offers them.
async function enrichCompany(company: CompanyCandidate, ctx: DiscoveryContext): Promise<CompanyCandidate> {
  const res = await runCapability("company.enrich", { company }, scopeOf(ctx));
  if (!res.ok) return company;
  const c = { ...company, ...res.data };
  origin.set(c, sourceOf(company));
  return c;
}

async function enrichPerson(person: PersonCandidate, company: CompanyCandidate, ctx: DiscoveryContext): Promise<PersonCandidate> {
  const res = await runCapability("person.enrich", { person, company }, scopeOf(ctx));
  if (!res.ok) return person;
  const p = { ...person, ...res.data };
  origin.set(p, sourceOf(person));
  return p;
}

// Only a verifier can mark an email verified (docs/00: never claim verification).
async function verifyEmail(email: string, ctx: DiscoveryContext): Promise<EmailStatus> {
  const res = await runCapability("email.verify", { email }, scopeOf(ctx));
  if (!res.ok) return "found";
  return res.data.status === "valid" ? "verified" : res.data.status === "invalid" ? "invalid" : "found";
}
