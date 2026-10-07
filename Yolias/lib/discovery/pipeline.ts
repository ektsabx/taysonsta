import "server-only";
import { capture } from "@/lib/analytics/server";
import { campaignFinished, usageAlerts } from "@/lib/email/events";
import { createAdminClient } from "@/lib/supabase/admin";
import type { CampaignStatus, CompanyKind, CompanyRow, EventLevel, Json, PipelineStage, SearchType } from "@/types/database";
import { finalState, runningStates } from "@/lib/discovery/states";
import { parseIcp, type IcpCriteria } from "@/lib/discovery/icp";
import { classifySeniority, scoreMatch } from "@/lib/discovery/match";
import type { CompanyCandidate, DiscoveryContext, JobCandidate, PersonCandidate } from "@/lib/discovery/types";
import type { EmailStatus } from "@/types/database";
import { clampConfidence, missingFields, provenanceFields, provenanceFor, searchTypeSpecs, type EntityKind } from "@/lib/entities";
import type { Capability } from "@/lib/intel/capabilities";
import { hasProviderFor } from "@/lib/intel/registry";
import { runCapability, type CallScope } from "@/lib/intel/service";
import { cacheCompanies, cachedCompanies, isSuppressed, saveContact, upsertCompany, upsertPerson, type Source } from "@/lib/intel/shared";
import { fingerprintIcp } from "@/lib/intel/fingerprint";
import { findSocials } from "@/lib/intel/socials";

// Discovery pipeline: Search → Find Companies → Find Decision Makers →
// Enrich & Verify → Qualify / Match → Prospects. Runs with the service role
// (callers must have checked workspace membership) and records every step in
// campaign_events so the UI can show AI activity / progress. Every external
// call goes through the Intelligence Layer (lib/intel): capabilities, not
// providers (docs/03). Scoring stays deterministic code (rule 24).
//
// Search types (final spec phase 4, lib/entities): people deliver decision
// makers; companies and company lookalikes deliver companies; local
// businesses deliver places. One delivered result of the search's entity is
// one prospect of usage. Every result carries the standard intelligence
// fields (provenance, confidence, last updated, match, missing data).

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

const dedupeKey = (c: CompanyCandidate) =>
  c.placeRef ? `place:${c.placeRef}` : c.domain ? c.domain.toLowerCase().replace(/^www\./, "") : c.name.toLowerCase().trim();

export interface RunOptions {
  /** Delivery attempt of the background job (1 = first try). */
  attempt?: number;
}

const finished: CampaignStatus[] = ["completed", "partial", "failed"];

const waitingFor: Partial<Record<Capability, EventText & { message: string }>> = {
  "company.search": { key: "noCompanySource", message: "No company data source is connected yet. Results will be collected once one is connected." },
  "place.search": { key: "noPlaceSource", message: "No local business (maps) source is connected yet. Results will be collected once one is connected." },
  "company.lookalikes": { key: "noLookalikeSource", message: "No lookalike-companies source is connected yet. Results will be collected once one is connected." },
};

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
  const searchType: SearchType = campaign.search_type ?? icp.search_type;
  const spec = searchTypeSpecs[searchType];
  const { data: ws } = await db.from("workspaces").select("offering").eq("id", campaign.workspace_id).single();
  const log = (stage: PipelineStage, message: string, level?: EventLevel, text?: EventText) => logEvent(campaign.workspace_id, campaignId, stage, message, level, text);

  // Nothing to run without a source for this search type: no reservation, no cost.
  if (!(await hasProviderFor(spec.source))) {
    if (campaign.status !== "awaiting_source") {
      await db.from("campaigns").update({ status: "awaiting_source" }).eq("id", campaignId);
      const w = waitingFor[spec.source]!;
      await log("companies", w.message, "warning", { key: w.key });
    }
    return;
  }

  // Claim it: only one worker moves a campaign out of a waiting state. A retry
  // may also take over a campaign left mid-run by a crashed attempt.
  const claimable: CampaignStatus[] = ["created", "queued", "awaiting_source", "scheduled", ...(attempt > 1 ? runningStates : [])];
  const { data: claimed } = await db.from("campaigns")
    .update({ status: "discovering_companies", started_at: campaign.started_at ?? new Date().toISOString(), partial_reason: null, next_run_at: null, runs_count: campaign.runs_count + (attempt > 1 ? 0 : 1) })
    .eq("id", campaignId).in("status", claimable).select("id").maybeSingle();
  if (!claimed) return;

  const { data: run } = await db.from("campaign_runs").insert({ workspace_id: campaign.workspace_id, campaign_id: campaignId, job: "campaign.discover", attempt }).select("id").single();
  const finishRun = (status: "succeeded" | "failed" | "skipped", meta: Record<string, unknown> = {}, error: string | null = null) =>
    run ? db.from("campaign_runs").update({ status, finished_at: new Date().toISOString(), meta: meta as Json, error, delivered: Number(meta.prospects ?? 0) }).eq("id", run.id) : Promise.resolve();

  // Plans are billed on prospects only (docs/06): reserve this campaign's
  // share of the month's allowance atomically, consume one per delivered
  // result, release the rest at the end (rule 27).
  // A continuous campaign reserves only what's left of its goal.
  const left = Math.max(campaign.quota - campaign.prospects_found, 0);
  const { data: reservedRaw } = left ? await db.rpc("reserve_usage", { p_ws: campaign.workspace_id, p_campaign: campaignId, p_n: left }) : { data: 0 };
  const reserved = Number(reservedRaw ?? 0);
  if (reserved === 0) {
    const { data: summary } = await db.rpc("usage_summary", { p_ws: campaign.workspace_id });
    // "quota": resumed by itself when prospects are bought or the plan is upgraded (resumeQuotaPaused).
    await db.from("campaigns").update({ status: left ? "paused" : "completed", partial_reason: left ? "quota" : null }).eq("id", campaignId);
    await log("plan", "Prospects are used up. Buy more prospects or upgrade; the campaign continues by itself.", "warning", { key: "quotaReached", vars: { total: summary?.[0]?.allowance ?? 0 } });
    await finishRun("skipped", { reason: "quota" });
    await usageAlerts(campaign.workspace_id);
    return;
  }
  const offset = await candidatesSeen(db, campaignId);
  const ctx: DiscoveryContext = { workspaceId: campaign.workspace_id, campaignId, offering: ws?.offering ?? null, limit: reserved, log, runId: run?.id ?? null, offset };
  const totals = { companies: campaign.companies_found, prospects: campaign.prospects_found };

  let final = false;
  try {
    const outcome = spec.entity === "person"
      ? await discoverPeople(db, campaignId, icp, ctx, reserved, totals)
      : await discoverCompanies(db, campaignId, icp, searchType, ctx, reserved, totals);
    final = await settleRun(db, campaignId, outcome.prospects + totals.prospects, ctx);
    await finishRun("succeeded", outcome);
    // Qualification: candidates the sources returned vs. those that matched the ICP and were delivered.
    const props = { workspace_id: campaign.workspace_id, campaign_id: campaignId, search_type: searchType, run: campaign.runs_count + 1 };
    await capture(campaign.created_by, "qualification_completed", { ...props, candidates: outcome.candidates, qualified: outcome.prospects, rate: outcome.candidates ? Math.round((outcome.prospects / outcome.candidates) * 100) / 100 : null });
    if (outcome.prospects > 0) await capture(campaign.created_by, "results_delivered", { ...props, prospects: outcome.prospects, companies: outcome.companies, total: outcome.prospects + totals.prospects, goal: campaign.quota, finished: final });
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
  // Emails after the ledger is settled: "results ready" (once, when the campaign ends) and usage alerts (80 % / 100 %).
  if (final) await campaignFinished(campaignId);
  await usageAlerts(campaign.workspace_id);
}

/** Candidates the source already returned in earlier runs (asked for the next ones now). */
async function candidatesSeen(db: Db, campaignId: string): Promise<number> {
  const { data } = await db.from("campaign_runs").select("meta").eq("campaign_id", campaignId).eq("status", "succeeded");
  return (data ?? []).reduce((n, r) => n + Number((r.meta as { candidates?: number } | null)?.candidates ?? 0), 0);
}

/**
 * After a run: the goal reached → completed; a continuous campaign with time
 * left → scheduled for its next run; otherwise completed / partial. Never
 * overrides a pause or stop a member made while the run was going. Returns
 * whether the campaign has ended.
 */
async function settleRun(db: Db, campaignId: string, total: number, ctx: DiscoveryContext): Promise<boolean> {
  const { data: c } = await db.from("campaigns").select("quota, continuous, run_every_hours, deadline, status").eq("id", campaignId).single();
  if (!c || !(runningStates as readonly string[]).includes(c.status)) return false;
  const now = Date.now();
  const timeLeft = !c.deadline || new Date(c.deadline).getTime() > now;
  if (c.continuous && total < c.quota && timeLeft) {
    const next = new Date(now + c.run_every_hours * 3_600_000);
    const at = c.deadline && new Date(c.deadline) < next ? null : next.toISOString();
    if (at) {
      await db.from("campaigns").update({ status: "scheduled", next_run_at: at }).eq("id", campaignId).in("status", runningStates);
      await ctx.log("deliver", `Run complete: ${total} of ${c.quota} so far. Next run scheduled.`, "info", { key: "runScheduled", vars: { total, goal: c.quota } });
      return false;
    }
  }
  const outcome = finalState(total, c.quota);
  const reason = outcome.status === "partial" && c.continuous && !timeLeft ? "deadline" : outcome.partialReason;
  await db.from("campaigns").update({ status: outcome.status, partial_reason: reason, completed_at: new Date().toISOString(), next_run_at: null }).eq("id", campaignId).in("status", runningStates);
  return true;
}

/** A member paused or stopped the campaign while it was running. */
async function interrupted(db: Db, campaignId: string): Promise<boolean> {
  const { data } = await db.from("campaigns").select("status").eq("id", campaignId).single();
  return !data || !(runningStates as readonly string[]).includes(data.status);
}

type Db = ReturnType<typeof createAdminClient>;

function stageSetter(db: Db, campaignId: string) {
  let stage: CampaignStatus = "discovering_companies";
  return async (next: CampaignStatus) => {
    if (next === stage) return;
    stage = next;
    await db.from("campaigns").update({ status: next }).eq("id", campaignId);
  };
}

/** Delivered ⇒ one prospect used. Never deliver beyond what was reserved. */
async function consumeOne(db: Db, ctx: DiscoveryContext): Promise<boolean> {
  if (ctx.free) return true;
  const { data: used } = await db.rpc("consume_usage", { p_ws: ctx.workspaceId, p_campaign: ctx.campaignId, p_n: 1 });
  return Number(used ?? 0) >= 1;
}

// ───────────────────────── Standard intelligence fields ─────────────────────────

function companyFields(c: CompanyCandidate) {
  return {
    name: c.name, domain: c.domain, industry: c.industry, description: c.description, city: c.city, country: c.country,
    employee_count: c.employeeCount, funding_stage: c.fundingStage, hiring_roles: c.hiringRoles,
    category: c.category ?? null, address: c.address ?? null, phone: c.phone ?? null, website: c.website ?? null,
    email: publicEmail(c.email),
    rating: c.rating ?? null, reviews_count: c.reviewsCount ?? null,
    ...socialFields(c),
  };
}

const publicEmail = (e: string | null | undefined) => (e && e.length <= 254 && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e) ? e.toLowerCase() : null);
const httpsOnly = (u: string | null | undefined) => (u && /^https:\/\//i.test(u) ? u.slice(0, 1000) : null);
const year = (y: number | null | undefined) => (y && Number.isInteger(y) && y >= 1800 && y <= 2100 ? y : null);

/** Logo, LinkedIn page and founding year (kept outside the provenance fields). */
function companyMedia(c: CompanyCandidate) {
  return { logo_url: httpsOnly(c.logoUrl), linkedin_url: httpsOnly(c.linkedinUrl), founded_year: year(c.foundedYear) };
}

const whatsappNumber = (v: string | null | undefined) => {
  const digits = (v ?? "").replace(/\D/g, "");
  return digits.length >= 6 && digits.length <= 20 ? digits : null;
};

/** Facebook, Instagram and WhatsApp (D-161), as the source gave them. */
function socialFields(c: { facebookUrl?: string | null; instagramUrl?: string | null; whatsapp?: string | null }) {
  return { facebook_url: httpsOnly(c.facebookUrl), instagram_url: httpsOnly(c.instagramUrl), whatsapp: whatsappNumber(c.whatsapp) };
}

/**
 * Fills a company's missing social profiles, public email and phone from
 * its own website (D-161, D-163; no provider, no cost); the source stays the website.
 */
async function withSocials(c: CompanyCandidate): Promise<CompanyCandidate> {
  if (c.facebookUrl && c.instagramUrl && c.whatsapp && c.email && c.phone) return c;
  const site = c.website ?? c.domain;
  if (!site) return c;
  const found = await findSocials(site);
  const next = {
    ...c, facebookUrl: c.facebookUrl ?? found.facebookUrl, instagramUrl: c.instagramUrl ?? found.instagramUrl, whatsapp: c.whatsapp ?? found.whatsapp,
    email: c.email ?? found.email, phone: c.phone ?? found.phone,
  };
  const o = origin.get(c);
  if (o) origin.set(next, o);
  const id = intelIds.get(c);
  if (id) intelIds.set(next, id);
  return next;
}

function intelligence(kind: EntityKind, row: Record<string, unknown>, source: string, confidence: number | null) {
  const at = new Date().toISOString();
  return {
    confidence,
    provenance: provenanceFor(row, provenanceFields[kind], source, at, confidence) as unknown as Json,
    missing_fields: missingFields(kind, row),
    last_updated: at,
  };
}

/**
 * A result counts as one prospect only when it is a business we can identify
 * (website, domain or map place) and reach (email, phone or WhatsApp); social
 * profiles alone are not enough (owner decision 2026-10-07, D-164).
 */
function qualifies(c: CompanyCandidate): boolean {
  const identified = Boolean(c.website || c.domain || c.placeRef);
  const reachable = Boolean(c.email || c.phone || whatsappNumber(c.whatsapp));
  return identified && reachable;
}

async function insertCompany(db: Db, campaignId: string, ctx: DiscoveryContext, c: CompanyCandidate, kind: CompanyKind, match: { score: number; reasons: string[] } | null, delivered = false) {
  const fields = companyFields(c);
  return db.from("companies").insert({
    workspace_id: ctx.workspaceId, campaign_id: campaignId, kind, name: c.name, domain: c.domain,
    industry: c.industry, description: c.description, city: c.city, country: c.country,
    employee_count: c.employeeCount, funding_stage: c.fundingStage, funding_total_usd: c.fundingTotalUsd,
    hiring_roles: c.hiringRoles, signals: c.signals, source: sourceOf(c), source_ref: c.sourceRef,
    category: fields.category, address: fields.address, phone: fields.phone, website: fields.website,
    rating: fields.rating, reviews_count: fields.reviews_count, place_ref: c.placeRef ?? null, maps_url: c.mapsUrl ?? null,
    facebook_url: fields.facebook_url, instagram_url: fields.instagram_url, whatsapp: fields.whatsapp, email: fields.email,
    ...companyMedia(c),
    intel_company_id: intelIds.get(c) ?? null,
    delivered_at: delivered ? new Date().toISOString() : null,
    // Every delivered result goes straight to Prospects (owner decision 2026-10-07, D-165).
    saved_at: delivered ? new Date().toISOString() : null,
    run_id: ctx.runId ?? null,
    match_score: match?.score ?? null, match_reasons: match?.reasons ?? [],
    ...intelligence(kind === "local_business" ? "local_business" : "company", fields, sourceOf(c), clampConfidence(c.confidence)),
    raw: (c.raw ?? null) as never,
  }).select("id").single();
}

// ───────────────────────── People searches ─────────────────────────

async function discoverPeople(db: Db, campaignId: string, icp: IcpCriteria, ctx: DiscoveryContext, remaining: number, totals: { companies: number; prospects: number }) {
  const setStage = stageSetter(db, campaignId);
  const companies = await findCompanies(icp, ctx, "company.search");
  const candidates = companies.length;
  await setStage("matching_companies");
  let companiesFound = 0;
  let peopleFound = 0;

  // One prospect = one qualifying company (D-164): the company is charged when
  // it is delivered and its decision makers come with it, free.
  const free: DiscoveryContext = { ...ctx, free: true };
  for (const company of companies) {
    if (companiesFound >= remaining || (await interrupted(db, campaignId))) break;
    const enriched = await withSocials(await enrichCompany(company, ctx));
    if (!qualifies(enriched)) continue;
    if (await isSuppressed({ domain: enriched.domain ?? enriched.website, email: enriched.email })) continue;
    if (await companyAlreadyDelivered(db, ctx.workspaceId, "company", enriched)) continue;
    const { data: row, error } = await insertCompany(db, campaignId, ctx, enriched, "company", scoreMatch(icp, enriched, null), true);
    if (error || !row) continue;
    if (!(await consumeOne(db, ctx))) {
      await db.from("companies").delete().eq("id", row.id);
      break;
    }
    companiesFound++;
    await findJobs(db, campaignId, icp, enriched, row.id, ctx);

    await setStage("discovering_people");
    const people = await findPeople(enriched, icp, ctx);
    let found = 0;
    for (const person of people) {
      if (found >= PEOPLE_PER_COMPANY) break;
      const r = await deliverPerson(db, campaignId, row.id, enriched, intelIds.get(enriched) ?? intelIds.get(company) ?? null, person, icp, free, setStage, new Date().toISOString());
      if (r === "delivered") found++;
    }
    peopleFound += found;
    if (found) await db.from("companies").update({ people_status: "done", people_found: found }).eq("id", row.id);
    await db.from("campaigns").update({ companies_found: totals.companies + companiesFound, prospects_found: totals.prospects + companiesFound }).eq("id", campaignId);
  }

  await ctx.log("deliver", `Discovery complete: ${companiesFound} companies, ${peopleFound} decision makers.`, "success", {
    key: "complete",
    vars: { companies: companiesFound, prospects: peopleFound },
  });
  return { companies: companiesFound, prospects: companiesFound, candidates };
}

/**
 * One decision maker: enrich → shared intel → suppression / already paid →
 * verify → score → insert → consume one prospect. "stop" when the
 * reservation is used up.
 */
async function deliverPerson(
  db: Db, campaignId: string, companyRowId: string, company: CompanyCandidate, companyIntelId: string | null, person: PersonCandidate,
  icp: IcpCriteria, ctx: DiscoveryContext, setStage: (s: CampaignStatus) => Promise<void>, savedAt: string | null = null,
): Promise<"delivered" | "skipped" | "stop"> {
  await setStage("enriching");
  const p = await enrichPerson(person, company, ctx);
  const personId = companyIntelId ? await upsertPerson(p, companyIntelId, origin.get(p) ?? SHARED) : null;
  // Never deliver suppressed people (rule 34); the workspace never pays twice for the same person (docs/04).
  if (await isSuppressed({ email: p.email, linkedinUrl: p.linkedinUrl, personId })) return "skipped";
  if (await alreadyDelivered(db, ctx.workspaceId, p, personId)) return "skipped";
  await setStage("verifying");
  const emailStatus = p.email ? await verifyEmail(p.email, personId, ctx) : "unknown";
  await setStage("scoring");
  const match = scoreMatch(icp, company, p);
  await setStage("delivering");
  const fields = { full_name: p.fullName, title: p.title, email: p.email, phone: p.phone, linkedin_url: p.linkedinUrl, city: p.city ?? company.city, country: p.country ?? company.country, ...socialFields(p) };
  const { data: inserted, error: insertError } = await db.from("prospects").insert({
    workspace_id: ctx.workspaceId, campaign_id: campaignId, company_id: companyRowId, ...fields,
    seniority: classifySeniority(p.title), email_status: emailStatus,
    match_score: match.score, match_reasons: match.reasons, source: sourceOf(p), source_ref: p.sourceRef,
    ...intelligence("person", fields, sourceOf(p), clampConfidence(p.confidence)),
    raw: (p.raw ?? null) as never, person_id: personId, saved_at: savedAt, run_id: ctx.runId ?? null, photo_url: httpsOnly(p.photoUrl),
  }).select("id").single();
  if (insertError || !inserted) return "skipped";
  if (!(await consumeOne(db, ctx))) {
    await db.from("prospects").delete().eq("id", inserted.id);
    return "stop";
  }
  return "delivered";
}

// ───────────────────────── Decision-maker matching ─────────────────────────

const PEOPLE_PER_COMPANY = 5;

/**
 * "Find decision makers" for saved companies / local businesses (final spec
 * phase 5): the people who match the search's titles, delivered straight to
 * Prospects. Background job "company.people"; idempotent per company (a
 * company already done or running is skipped). Each person found is one
 * prospect of usage, reserved before the work and released after it.
 */
export async function findDecisionMakers(workspaceId: string, companyIds: string[]): Promise<void> {
  const db = createAdminClient();
  const { data: rows } = await db.from("companies").select("*").eq("workspace_id", workspaceId).in("id", companyIds);
  for (const row of rows ?? []) {
    if (row.people_status === "done" || row.people_status === "running") continue;
    if (!(await hasProviderFor("person.search"))) {
      await db.from("companies").update({ people_status: "no_source" }).eq("id", row.id);
      continue;
    }
    const { data: claimed } = await db.from("companies").update({ people_status: "running" }).eq("id", row.id).or("people_status.is.null,people_status.in.(queued,no_source,no_quota,failed)").select("id").maybeSingle();
    if (!claimed) continue;
    const { data: campaign } = await db.from("campaigns").select("criteria, search_type").eq("id", row.campaign_id).single();
    const icp = parseIcp(campaign?.criteria);
    if (!icp) {
      await db.from("companies").update({ people_status: "failed" }).eq("id", row.id);
      continue;
    }
    // The company was charged when it was delivered (one result = one prospect,
    // D-146): its decision makers come with it and aren't charged again.
    const reserved = PEOPLE_PER_COMPANY;
    const log = (stage: PipelineStage, message: string, level?: EventLevel, text?: EventText) => logEvent(workspaceId, row.campaign_id, stage, message, level, text);
    const ctx: DiscoveryContext = { workspaceId, campaignId: row.campaign_id, offering: null, limit: reserved, log, free: true };
    const company = candidateFromRow(row);
    let found = 0;
    try {
      const people = await findPeople(company, icp, ctx);
      for (const person of people) {
        if (found >= reserved) break;
        const r = await deliverPerson(db, row.campaign_id, row.id, company, row.intel_company_id, person, icp, ctx, async () => {}, new Date().toISOString());
        if (r === "stop") break;
        if (r === "delivered") found++;
      }
      await db.from("companies").update({ people_status: "done", people_found: row.people_found + found }).eq("id", row.id);
    } catch (e) {
      await db.from("companies").update({ people_status: "failed" }).eq("id", row.id);
      throw e;
    }
  }
}

function candidateFromRow(row: CompanyRow): CompanyCandidate {
  const c: CompanyCandidate = {
    name: row.name, domain: row.domain, industry: row.industry, description: row.description, city: row.city, country: row.country,
    employeeCount: row.employee_count, fundingStage: row.funding_stage, fundingTotalUsd: row.funding_total_usd, hiringRoles: row.hiring_roles,
    signals: Array.isArray(row.signals) ? (row.signals as string[]) : [], sourceRef: row.source_ref, kind: row.kind, category: row.category,
    address: row.address, phone: row.phone, website: row.website, rating: row.rating, reviewsCount: row.reviews_count, placeRef: row.place_ref, mapsUrl: row.maps_url,
  };
  origin.set(c, { ...SHARED, provider: row.source });
  return c;
}

// ───────────────────────── Company, lookalike and local business searches ─────────────────────────

async function discoverCompanies(db: Db, campaignId: string, icp: IcpCriteria, searchType: SearchType, ctx: DiscoveryContext, remaining: number, totals: { companies: number; prospects: number }) {
  const setStage = stageSetter(db, campaignId);
  const local = searchType === "local_businesses";
  const kind: CompanyKind = local ? "local_business" : "company";
  const candidates = await findCompanies(icp, ctx, searchTypeSpecs[searchType].source);
  await setStage("matching_companies");
  const peopleSource = !local && (await hasProviderFor("person.search"));
  let delivered = 0;

  for (const candidate of candidates) {
    if (delivered >= remaining || (await interrupted(db, campaignId))) break;
    const c = await withSocials(local ? candidate : await enrichCompany(candidate, ctx));
    if (!qualifies(c)) continue;
    if (await isSuppressed({ domain: c.domain ?? c.website, email: c.email })) continue;
    if (await companyAlreadyDelivered(db, ctx.workspaceId, kind, c)) continue;
    await setStage("scoring");
    const match = scoreMatch(icp, { ...c, kind }, null);
    await setStage("delivering");
    const { data: row, error } = await insertCompany(db, campaignId, ctx, c, kind, match, true);
    if (error || !row) continue;
    if (!(await consumeOne(db, ctx))) {
      await db.from("companies").delete().eq("id", row.id);
      break;
    }
    delivered++;
    if (!local) await findJobs(db, campaignId, icp, c, row.id, ctx);
    // Decision makers inside the company come with it, free (D-164, D-166).
    if (!local && peopleSource) {
      await setStage("discovering_people");
      let found = 0;
      for (const person of await findPeople(c, icp, ctx)) {
        if (found >= PEOPLE_PER_COMPANY) break;
        const r = await deliverPerson(db, campaignId, row.id, c, intelIds.get(c) ?? intelIds.get(candidate) ?? null, person, icp, { ...ctx, free: true }, setStage, new Date().toISOString());
        if (r === "delivered") found++;
      }
      await db.from("companies").update({ people_status: "done", people_found: found }).eq("id", row.id);
    }
    await db.from("campaigns").update({ companies_found: totals.companies + delivered, prospects_found: totals.prospects + delivered }).eq("id", campaignId);
  }

  await ctx.log("deliver", `Discovery complete: ${delivered} ${local ? "local businesses" : "companies"} delivered.`, "success", {
    key: local ? "completePlaces" : "completeCompanies",
    vars: { count: delivered },
  });
  return { companies: delivered, prospects: delivered, candidates: candidates.length };
}

async function companyAlreadyDelivered(db: Db, workspaceId: string, kind: CompanyKind, c: CompanyCandidate): Promise<boolean> {
  const checks: [string, string][] = [];
  if (c.placeRef) checks.push(["place_ref", c.placeRef]);
  if (c.domain) checks.push(["domain", c.domain.toLowerCase()]);
  for (const [col, value] of checks) {
    const { count } = await db.from("companies").select("id", { count: "exact", head: true })
      .eq("workspace_id", workspaceId).eq("kind", kind).not("delivered_at", "is", null).eq(col as "domain", value);
    if (count) return true;
  }
  return false;
}

async function alreadyDelivered(db: Db, workspaceId: string, p: PersonCandidate, personId: string | null): Promise<boolean> {
  const checks: [string, string][] = [];
  if (personId) checks.push(["person_id", personId]);
  if (p.linkedinUrl) checks.push(["linkedin_url", p.linkedinUrl]);
  if (p.email) checks.push(["email", p.email.toLowerCase()]);
  for (const [col, value] of checks) {
    const { count } = await db.from("prospects").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId).eq(col as "email", value);
    if (count) return true;
  }
  return false;
}

// Where each candidate came from (provider + license + call), so rows record their source.
const origin = new WeakMap<object, Source>();
const SHARED: Source = { provider: "yolias_shared", license: { scope: "yolias_shared", redistributable: true, customerFacing: true, retentionDays: null }, callId: null };
const sourceOf = (x: object) => origin.get(x)?.provider ?? "unknown";
const scopeOf = (ctx: DiscoveryContext): CallScope => ({ workspaceId: ctx.workspaceId, campaignId: ctx.campaignId });
const intelIds = new WeakMap<object, string>();

// Ladder step 1 (rule 15): reuse fresh, licensed results for the same audience
// (and search type — it's in the fingerprint) before paying a provider;
// otherwise search and store what we find.
async function findCompanies(icp: IcpCriteria, ctx: DiscoveryContext, capability: "company.search" | "place.search" | "company.lookalikes") {
  const places = capability === "place.search";
  const fingerprint = fingerprintIcp(icp);
  const offset = ctx.offset ?? 0;
  // The cache holds the first page of results; later runs of a continuous campaign need the next ones.
  const cached = offset ? null : await cachedCompanies(fingerprint, ctx.workspaceId);
  if (cached) {
    await ctx.log("companies", `Reusing ${cached.length} results already found for this audience.`, "info", { key: places ? "foundPlaces" : "foundCompanies", vars: { count: cached.length } });
    for (const c of cached) {
      origin.set(c, SHARED);
      intelIds.set(c, c.intelId);
    }
    return cached.slice(0, ctx.limit);
  }

  const source = "Yolias"; // providers stay internal (D-165)
  await ctx.log("companies", places ? `Searching ${source} for matching local businesses…` : `Searching ${source} for matching companies…`, "info", { key: places ? "searchingPlaces" : "searching", vars: { source } });
  const res = capability === "company.lookalikes"
    ? await runCapability("company.lookalikes", { seeds: icp.lookalike_seeds, icp, limit: ctx.limit, offset }, scopeOf(ctx))
    : capability === "place.search"
      ? await runCapability("place.search", { icp, limit: ctx.limit, offset }, scopeOf(ctx))
      : await runCapability("company.search", { icp, limit: ctx.limit, offering: ctx.offering, offset }, scopeOf(ctx));
  const seen = new Map<string, CompanyCandidate>();
  if (res.ok) {
    const src: Source = { provider: res.provider, license: res.license, callId: res.callId };
    for (const raw of res.data) {
      const c: CompanyCandidate = places ? { ...raw, kind: "local_business" } : raw;
      const key = dedupeKey(c);
      if (seen.has(key)) continue;
      origin.set(c, src);
      // Routing only uses providers whose license allows storage (rule 19), so it can join shared intelligence.
      intelIds.set(c, await upsertCompany(c, src));
      seen.set(key, c);
    }
    const ids = [...seen.values()].map((c) => intelIds.get(c)).filter(Boolean) as string[];
    if (!offset) await cacheCompanies(fingerprint, ctx.workspaceId, ids, res.license.redistributable, res.provider);
  } else if (res.reason === "all_failed") {
    throw new Error(`${capability} failed (${res.errors.map((e) => e.provider).join(", ")})`);
  }
  await ctx.log("companies", places ? `Found ${seen.size} candidate businesses.` : `Found ${seen.size} candidate companies.`, "success", { key: places ? "foundPlaces" : "foundCompanies", vars: { count: seen.size } });
  return [...seen.values()].slice(0, ctx.limit);
}

async function findPeople(company: CompanyCandidate, icp: IcpCriteria, ctx: DiscoveryContext) {
  const res = await runCapability("person.search", { company, icp, limit: 5 }, scopeOf(ctx));
  if (!res.ok) return [];
  const src: Source = { provider: res.provider, license: res.license, callId: res.callId };
  for (const p of res.data) origin.set(p, src);
  return res.data;
}

/**
 * Hiring signals: job postings for a company, only when the search asks for
 * hiring companies and a provider offers job search (no call otherwise).
 * Jobs enrich the result; they are not billed.
 */
async function findJobs(db: Db, campaignId: string, icp: IcpCriteria, company: CompanyCandidate, companyRowId: string, ctx: DiscoveryContext) {
  if (!icp.hiring) return;
  const res = await runCapability("job.search", { icp, company, limit: 10 }, scopeOf(ctx));
  if (!res.ok || !res.data.length) return;
  const rows = res.data.map((j: JobCandidate) => {
    const fields = { title: j.title, department: j.department, city: j.city, country: j.country, url: j.url, posted_at: j.postedAt };
    const roleHit = icp.hiring_roles.length ? icp.hiring_roles.some((r) => j.title.toLowerCase().includes(r.toLowerCase())) : true;
    return {
      workspace_id: ctx.workspaceId, campaign_id: campaignId, company_id: companyRowId, ...fields, run_id: ctx.runId ?? null,
      seniority: classifySeniority(j.title), source: res.provider, source_ref: j.sourceRef,
      match_score: roleHit ? 100 : 0, match_reasons: roleHit ? ["Hiring role"] : [],
      ...intelligence("job", fields, res.provider, clampConfidence(j.confidence)),
      raw: (j.raw ?? null) as never,
    };
  });
  await db.from("jobs").upsert(rows, { onConflict: "campaign_id,url", ignoreDuplicates: true });
  await db.from("companies").update({ hiring_roles: rows.length }).eq("id", companyRowId);
}

// Optional steps: skipped (no call, no cost) when no provider offers them.
async function enrichCompany(company: CompanyCandidate, ctx: DiscoveryContext): Promise<CompanyCandidate> {
  const res = await runCapability("company.enrich", { company }, scopeOf(ctx));
  if (!res.ok) return company;
  const c = { ...company, ...res.data };
  origin.set(c, origin.get(company)!);
  const id = await upsertCompany(c, { provider: res.provider, license: res.license, callId: res.callId });
  intelIds.set(c, id);
  return c;
}

async function enrichPerson(person: PersonCandidate, company: CompanyCandidate, ctx: DiscoveryContext): Promise<PersonCandidate> {
  const res = await runCapability("person.enrich", { person, company }, scopeOf(ctx));
  if (!res.ok) return person;
  const p = { ...person, ...res.data };
  origin.set(p, origin.get(person)!);
  return p;
}

// Only a verifier can mark an email verified (docs/00: never claim verification).
async function verifyEmail(email: string, personId: string | null, ctx: DiscoveryContext): Promise<EmailStatus> {
  const res = await runCapability("email.verify", { email }, scopeOf(ctx));
  if (!res.ok) return "found";
  if (personId) await saveContact(personId, "work_email", email.toLowerCase(), { provider: res.provider, license: res.license, callId: res.callId }, res.data.status, res.provider);
  return res.data.status === "valid" ? "verified" : res.data.status === "invalid" ? "invalid" : "found";
}
