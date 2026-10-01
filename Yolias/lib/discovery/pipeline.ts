import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { CampaignStatus, EventLevel, Json, PipelineStage } from "@/types/database";
import { finalState, runningStates } from "@/lib/discovery/states";
import { parseIcp, type IcpCriteria } from "@/lib/discovery/icp";
import { classifySeniority, scoreMatch } from "@/lib/discovery/match";
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

export interface RunOptions {
  /** Delivery attempt of the background job (1 = first try). */
  attempt?: number;
}

const finished: CampaignStatus[] = ["completed", "partial", "failed"];

// Runs one campaign. Called by the background worker (lib/jobs/worker.ts),
// never inside a web request. Idempotent: a finished campaign is skipped,
// and only one worker can claim a campaign at a time. Throws on a failure
// worth retrying; the worker retries with backoff, then gives up.
export async function runDiscovery(campaignId: string, { attempt = 1 }: RunOptions = {}): Promise<void> {
  const db = createAdminClient();
  const { data: campaign } = await db.from("campaigns").select("*").eq("id", campaignId).maybeSingle();
  if (!campaign || finished.includes(campaign.status)) return;
  const icp = parseIcp(campaign.criteria);
  if (!icp) {
    await db.from("campaigns").update({ status: "failed" }).eq("id", campaignId);
    await logEvent(campaign.workspace_id, campaignId, "plan", "Campaign criteria are invalid.", "error", { key: "invalidCriteria" });
    return;
  }
  const { data: ws } = await db.from("workspaces").select("offering").eq("id", campaign.workspace_id).single();
  const log = (stage: PipelineStage, message: string, level?: EventLevel, text?: EventText) => logEvent(campaign.workspace_id, campaignId, stage, message, level, text);

  // Nothing to run without a company source: no reservation, no cost.
  if (!(await hasProviderFor("company.search"))) {
    if (campaign.status !== "awaiting_source") {
      await db.from("campaigns").update({ status: "awaiting_source" }).eq("id", campaignId);
      await log("companies", "No company data source is connected yet. Results will be collected once one is connected.", "warning", { key: "noCompanySource" });
    }
    return;
  }

  // Claim it: only one worker moves a campaign out of a waiting state. A retry
  // may also take over a campaign left mid-run by a crashed attempt.
  const claimable: CampaignStatus[] = ["created", "queued", "awaiting_source", "paused", ...(attempt > 1 ? runningStates : [])];
  const { data: claimed } = await db.from("campaigns")
    .update({ status: "discovering_companies", started_at: new Date().toISOString(), partial_reason: null })
    .eq("id", campaignId).in("status", claimable).select("id").maybeSingle();
  if (!claimed) return;

  const { data: run } = await db.from("campaign_runs").insert({ workspace_id: campaign.workspace_id, campaign_id: campaignId, job: "campaign.discover", attempt }).select("id").single();
  const finishRun = (status: "succeeded" | "failed" | "skipped", meta: Record<string, unknown> = {}, error: string | null = null) =>
    run ? db.from("campaign_runs").update({ status, finished_at: new Date().toISOString(), meta: meta as Json, error }).eq("id", run.id) : Promise.resolve();

  // Plans are billed on prospects only (docs/06): reserve this campaign's
  // share of the month's allowance atomically, consume one per delivered
  // prospect, release the rest at the end (rule 27).
  const { data: reservedRaw } = await db.rpc("reserve_usage", { p_ws: campaign.workspace_id, p_campaign: campaignId, p_n: campaign.quota });
  const reserved = Number(reservedRaw ?? 0);
  if (reserved === 0) {
    const { data: summary } = await db.rpc("usage_summary", { p_ws: campaign.workspace_id });
    await db.from("campaigns").update({ status: "paused" }).eq("id", campaignId);
    await log("plan", "This month’s prospects are used up. Upgrade or wait for the reset.", "warning", { key: "quotaReached", vars: { total: summary?.[0]?.allowance ?? 0 } });
    await finishRun("skipped", { reason: "quota" });
    return;
  }
  const ctx: DiscoveryContext = { workspaceId: campaign.workspace_id, campaignId, offering: ws?.offering ?? null, limit: reserved, log };

  try {
    const outcome = await discover(db, campaignId, icp, ctx, reserved, campaign.quota);
    await finishRun("succeeded", outcome);
  } catch (e) {
    const reason = e instanceof Error ? e.message : "unknown error";
    await finishRun("failed", {}, reason.slice(0, 1000));
    // Back to the queue state; the worker retries it (or marks it failed after the last attempt).
    await db.from("campaigns").update({ status: "queued" }).eq("id", campaignId);
    await log("deliver", `Attempt ${attempt} failed, retrying: ${reason}`, "warning", { key: "stopped", vars: { reason } });
    throw e;
  } finally {
    await db.rpc("release_usage", { p_ws: campaign.workspace_id, p_campaign: campaignId, p_reason: "campaign ended" });
  }
}

async function discover(db: ReturnType<typeof createAdminClient>, campaignId: string, icp: IcpCriteria, ctx: DiscoveryContext, remaining: number, target: number) {
  let stage: CampaignStatus = "discovering_companies";
  const setStage = async (next: CampaignStatus) => {
    if (next === stage) return;
    stage = next;
    await db.from("campaigns").update({ status: next }).eq("id", campaignId);
  };

  const companies = await findCompanies(icp, ctx);
  await setStage("matching_companies");
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

    await setStage("discovering_people");
    const people = await findPeople(enriched, icp, ctx);
    for (const person of people) {
      if (prospectsFound >= remaining) break;
      await setStage("enriching");
      const p = await enrichPerson(person, enriched, ctx);
      // The workspace never pays twice for the same person (docs/04).
      if (await alreadyDelivered(db, ctx.workspaceId, p)) continue;
      await setStage("verifying");
      const emailStatus = p.email ? await verifyEmail(p.email, ctx) : "unknown";
      await setStage("scoring");
      const match = scoreMatch(icp, enriched, p);
      await setStage("delivering");
      const { data: inserted, error: insertError } = await db.from("prospects").insert({
        workspace_id: ctx.workspaceId, campaign_id: campaignId, company_id: row.id, full_name: p.fullName, title: p.title,
        seniority: classifySeniority(p.title), email: p.email, email_status: emailStatus, phone: p.phone, whatsapp: p.whatsapp,
        linkedin_url: p.linkedinUrl, city: p.city ?? enriched.city, country: p.country ?? enriched.country,
        match_score: match.score, match_reasons: match.reasons, source: sourceOf(p), source_ref: p.sourceRef,
        raw: (p.raw ?? null) as never,
      }).select("id").single();
      if (insertError || !inserted) continue;
      // Delivered ⇒ one prospect used. Never deliver beyond what was reserved.
      const { data: used } = await db.rpc("consume_usage", { p_ws: ctx.workspaceId, p_campaign: campaignId, p_n: 1 });
      if (Number(used ?? 0) < 1) {
        await db.from("prospects").delete().eq("id", inserted.id);
        break;
      }
      prospectsFound++;
    }
    await db.from("campaigns").update({ companies_found: companiesFound, prospects_found: prospectsFound }).eq("id", campaignId);
    if (prospectsFound >= remaining) break;
  }

  // Fewer than asked is "partial", with the reason shown to the user (docs/00: no fake completeness).
  const outcome = finalState(prospectsFound, Math.min(target, remaining));
  await db.from("campaigns").update({ status: outcome.status, partial_reason: outcome.partialReason, completed_at: new Date().toISOString() }).eq("id", campaignId);
  await ctx.log("deliver", `Discovery complete: ${companiesFound} companies, ${prospectsFound} decision makers.`, "success", {
    key: "complete",
    vars: { companies: companiesFound, prospects: prospectsFound },
  });
  return { companies: companiesFound, prospects: prospectsFound, status: outcome.status };
}

async function alreadyDelivered(db: ReturnType<typeof createAdminClient>, workspaceId: string, p: PersonCandidate): Promise<boolean> {
  const checks: [string, string][] = [];
  if (p.linkedinUrl) checks.push(["linkedin_url", p.linkedinUrl]);
  if (p.email) checks.push(["email", p.email.toLowerCase()]);
  for (const [col, value] of checks) {
    const { count } = await db.from("prospects").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId).eq(col as "email", value);
    if (count) return true;
  }
  return false;
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
