import "server-only";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { hasProviderFor } from "@/lib/intel/registry";
import { runCapability } from "@/lib/intel/service";
import { launchInSearch, titleFrom, understandAndLaunch } from "@/lib/discovery/launch";
import * as control from "@/lib/discovery/campaign-control";
import { enqueue } from "@/lib/jobs/queue";
import { extractCompanyFacts, researchSummary } from "@/lib/ai/orchestrator";
import { draftOutreach } from "@/lib/outreach";
import { hasActivePlan } from "@/lib/plans";
import type { Session } from "@/lib/session";
import { auditInput, authorize, type AgentActor, type AgentPermission } from "@/lib/agent/authz";
import type { AgentToolOutcome, Database, Json } from "@/types/database";
import { AGENT_TOOLS, type AgentPolicy } from "@/lib/agent/policy-schema";

// Yolias AI agent tools (docs/07 "Tools", final spec phase 7: tools for every
// area). Each one is typed (zod), authorized in code, scoped to the caller's
// workspace, runs with the user's own Supabase client (RLS applies, rule 31)
// and is audited with what it cost (rules 28, 35). Tools only read and start
// work the app already offers; they never invent data (rule 4). Contact
// details come only through revealContact, which records the reveal like the app.

export interface AgentContext {
  session: Session;
  /** The signed-in user's client: RLS is the second line of defence. */
  db: SupabaseClient<Database>;
  /** The conversation (public.conversations) this turn belongs to. */
  conversationId: string | null;
  /** The search this conversation belongs to: campaigns started here join it (D-133). */
  strategyId?: string | null;
  /** Campaigns started during this turn (shown as cards in the thread). */
  launched?: string[];
  /** The published agent policy (D-141): tools on/off, roles, approvals, research limits, memory. */
  policy?: AgentPolicy;
  /** Set when the user approved a pending action: run it now instead of asking again. */
  approved?: boolean;
  /** Approval requests created during this turn (shown under the reply). */
  pending?: string[];
  /** Per-turn counters, shared by reference across tool calls (research limit). */
  counters?: { research: number };
  /** Adds what a provider or LLM call inside the tool cost (null = unpriced). Set by executeTool. */
  spend?: (usd: number | null) => void;
}

export type ToolResult = { ok: true; data: unknown } | { ok: false; outcome: Exclude<AgentToolOutcome, "ok">; message: string };

interface AgentTool<S extends z.ZodType = z.ZodType> {
  name: string;
  description: string;
  permission: AgentPermission;
  input: S;
  run: (ctx: AgentContext, input: z.infer<S>) => Promise<ToolResult>;
}

const LIST_MAX = 25;
const ok = (data: unknown): ToolResult => ({ ok: true, data });
const fail = (outcome: Exclude<AgentToolOutcome, "ok">, message: string): ToolResult => ({ ok: false, outcome, message });
const uuid = z.string().uuid();
const term = (s: string) => s.replace(/[%,()*]/g, " ").trim();

export function actorOf(session: Session): AgentActor {
  return {
    userId: session.userId,
    workspaceId: session.workspace.id,
    role: session.role,
    active: hasActivePlan(session.workspace) && Boolean(session.profile.onboarded_at),
  };
}

// No email / phone here: those come only through revealContact (recorded).
const prospectColumns = "id, campaign_id, company_id, full_name, title, seniority, email_status, linkedin_url, city, country, match_score, match_reasons, confidence, missing_fields, last_updated, saved_at, revealed_at, source, created_at";
const companyColumns = "id, campaign_id, kind, name, domain, industry, description, employee_count, city, country, category, address, website, rating, reviews_count, match_score, match_reasons, confidence, missing_fields, last_updated, saved_at, people_status, people_found, source, created_at";
const campaignColumns = "id, workspace_id, strategy_id, name, search_type, quota, status, companies_found, prospects_found, partial_reason, continuous, run_every_hours, deadline, next_run_at, runs_count, started_at, completed_at, created_at";

function define<S extends z.ZodType>(t: AgentTool<S>): AgentTool<S> {
  return t;
}

const controlMessages: Record<control.ControlError, string> = {
  notFound: "No such campaign in this workspace.", goal: "The goal must be a whole number from 1 to 10,000.", deadline: "The deadline must be in the future.",
  schedule: "Run every 24 or 168 hours.", failed: "Couldn't save the change.", notRunning: "The campaign isn't running.", notPaused: "The campaign isn't paused.",
  notScheduled: "The campaign isn't waiting for a run.", alreadyEnded: "The campaign has already ended.",
};

export const agentTools = [
  // ───────────── Prospects (people) ─────────────
  define({
    name: "searchProspects",
    description: "Free-text search over this workspace's delivered people (prospects) by name or job title. Returns at most 25, best match first. Contact details are not included; use revealContact.",
    permission: "read",
    input: z.object({
      query: z.string().trim().min(1).max(100).describe("Name or title words, Arabic or English"),
      savedOnly: z.boolean().optional().describe("Only prospects saved to the Prospects list"),
    }),
    async run(ctx, input) {
      const t = term(input.query);
      let q = ctx.db.from("prospects").select(prospectColumns).eq("workspace_id", ctx.session.workspace.id).or(`full_name.ilike.%${t}%,title.ilike.%${t}%`);
      if (input.savedOnly) q = q.not("saved_at", "is", null);
      const { data, error } = await q.order("match_score", { ascending: false, nullsFirst: false }).limit(LIST_MAX);
      if (error) throw error;
      return ok({ count: data.length, prospects: data });
    },
  }),
  define({
    name: "filterProspects",
    description: "Filter this workspace's delivered people by campaign, country, minimum match score, email status or seniority. Returns at most 25 plus the total.",
    permission: "read",
    input: z.object({
      campaignId: uuid.optional(),
      country: z.string().length(2).optional().describe("ISO 3166-1 alpha-2, e.g. SA"),
      minMatch: z.number().int().min(0).max(100).optional(),
      emailStatus: z.enum(["verified", "found", "invalid", "unknown"]).optional(),
      seniority: z.enum(["founder", "c_level", "vp", "director", "head", "manager", "other"]).optional(),
    }),
    async run(ctx, input) {
      let q = ctx.db.from("prospects").select(prospectColumns, { count: "exact" }).eq("workspace_id", ctx.session.workspace.id);
      if (input.campaignId) q = q.eq("campaign_id", input.campaignId);
      if (input.country) q = q.eq("country", input.country.toUpperCase());
      if (input.minMatch != null) q = q.gte("match_score", input.minMatch);
      if (input.emailStatus) q = q.eq("email_status", input.emailStatus);
      if (input.seniority) q = q.eq("seniority", input.seniority);
      const { data, count, error } = await q.order("match_score", { ascending: false, nullsFirst: false }).limit(LIST_MAX);
      if (error) throw error;
      return ok({ total: count ?? data.length, shown: data.length, prospects: data });
    },
  }),
  define({
    name: "getProspect",
    description: "One person with their company, match reasons and data intelligence (confidence, missing data, last updated). Contact details: use revealContact.",
    permission: "read",
    input: z.object({ prospectId: uuid }),
    async run(ctx, input) {
      const { data } = await ctx.db.from("prospects")
        .select(`${prospectColumns}, workspace_id, provenance, company:companies(id, name, domain, industry, employee_count, city, country)`)
        .eq("id", input.prospectId).maybeSingle();
      if (!data || data.workspace_id !== ctx.session.workspace.id) return fail("not_found", "No such prospect in this workspace.");
      return ok(data);
    },
  }),
  define({
    name: "revealContact",
    description: "Reveal a person's email and phone (as in the Prospects list). The reveal is recorded. Only use when the user asks for contact details.",
    permission: "read",
    input: z.object({ prospectId: uuid }),
    async run(ctx, input) {
      const { data } = await ctx.db.from("prospects").select("id, workspace_id, full_name, email, email_status, phone, linkedin_url, revealed_at").eq("id", input.prospectId).maybeSingle();
      if (!data || data.workspace_id !== ctx.session.workspace.id) return fail("not_found", "No such prospect in this workspace.");
      if (!data.revealed_at) await ctx.db.from("prospects").update({ revealed_at: new Date().toISOString(), revealed_by: ctx.session.userId }).eq("id", data.id).is("revealed_at", null);
      return ok({ name: data.full_name, email: data.email_status === "invalid" ? null : data.email, emailStatus: data.email_status, phone: data.phone, linkedin: data.linkedin_url });
    },
  }),
  define({
    name: "saveResults",
    description: "Save a search's results (people, or the companies / local businesses it delivered) to the Prospects list.",
    permission: "prospect.save",
    input: z.object({ campaignId: uuid }),
    async run(ctx, input) {
      const ws = ctx.session.workspace.id;
      const { data: c } = await ctx.db.from("campaigns").select("id, workspace_id").eq("id", input.campaignId).maybeSingle();
      if (!c || c.workspace_id !== ws) return fail("not_found", "No such campaign in this workspace.");
      const now = new Date().toISOString();
      const [{ data: p }, { data: co }] = await Promise.all([
        ctx.db.from("prospects").update({ saved_at: now }).eq("workspace_id", ws).eq("campaign_id", c.id).is("saved_at", null).select("id"),
        ctx.db.from("companies").update({ saved_at: now }).eq("workspace_id", ws).eq("campaign_id", c.id).is("saved_at", null).not("delivered_at", "is", null).select("id"),
      ]);
      return ok({ saved: (p?.length ?? 0) + (co?.length ?? 0) });
    },
  }),
  define({
    name: "enrichProspect",
    description: "Find (and verify) a person's work email through a connected data provider, or find their phone.",
    permission: "prospect.enrich",
    input: z.object({ prospectId: uuid, want: z.enum(["email", "phone"]) }),
    async run(ctx, input) {
      const ws = ctx.session.workspace.id;
      const { data: p } = await ctx.db.from("prospects").select("id, workspace_id, campaign_id, full_name, title, email, phone, linkedin_url, city, country, company:companies(name, domain, city, country)").eq("id", input.prospectId).maybeSingle();
      if (!p || p.workspace_id !== ws) return fail("not_found", "No such prospect in this workspace.");
      const capability = input.want === "email" ? "email.find" : "phone.find";
      if (!(await hasProviderFor(capability))) return fail("not_connected", `No data provider is connected for ${capability}.`);
      const co = (p.company as unknown as { name: string; domain: string | null; city: string | null; country: string | null } | null) ?? { name: "", domain: null, city: null, country: null };
      const person = { fullName: p.full_name, title: p.title, email: p.email, phone: p.phone, linkedinUrl: p.linkedin_url, city: p.city, country: p.country, sourceRef: null };
      const company = { name: co.name, domain: co.domain, industry: null, description: null, city: co.city, country: co.country, employeeCount: null, fundingStage: null, fundingTotalUsd: null, hiringRoles: null, signals: [], sourceRef: null };
      const scope = { workspaceId: ws, campaignId: p.campaign_id };
      if (input.want === "phone") {
        const r = await runCapability("phone.find", { person, company }, scope);
        ctx.spend?.(r.ok ? r.costUsd : null);
        if (!r.ok || !r.data) return ok({ found: false });
        await ctx.db.from("prospects").update({ phone: r.data.phone, last_updated: new Date().toISOString() }).eq("id", p.id);
        return ok({ found: true });
      }
      const found = await runCapability("email.find", { person, company }, scope);
      if (found.ok) ctx.spend?.(found.costUsd);
      if (!found.ok || !found.data) return ok({ found: false });
      // Only a verifier can mark an email verified (docs/00).
      const verified = await runCapability("email.verify", { email: found.data.email }, scope);
      if (verified.ok) ctx.spend?.(verified.costUsd);
      const status = !verified.ok ? "found" : verified.data.status === "valid" ? "verified" : verified.data.status === "invalid" ? "invalid" : "found";
      await ctx.db.from("prospects").update({ email: found.data.email.toLowerCase(), email_status: status, last_updated: new Date().toISOString() }).eq("id", p.id);
      return ok({ found: true, emailStatus: status });
    },
  }),

  // ───────────── Companies, local businesses, jobs ─────────────
  define({
    name: "listCompanies",
    description: "Companies or local businesses this workspace's searches delivered (or saved). Filter by text, campaign, minimum match. At most 25.",
    permission: "read",
    input: z.object({
      kind: z.enum(["company", "local_business"]).default("company"),
      query: z.string().trim().max(100).optional(),
      campaignId: uuid.optional(),
      minMatch: z.number().int().min(0).max(100).optional(),
      savedOnly: z.boolean().optional(),
    }),
    async run(ctx, input) {
      let q = ctx.db.from("companies").select(companyColumns, { count: "exact" }).eq("workspace_id", ctx.session.workspace.id).eq("kind", input.kind).not("delivered_at", "is", null);
      if (input.campaignId) q = q.eq("campaign_id", input.campaignId);
      if (input.minMatch != null) q = q.gte("match_score", input.minMatch);
      if (input.savedOnly) q = q.not("saved_at", "is", null);
      if (input.query) {
        const t = term(input.query);
        q = q.or(`name.ilike.%${t}%,industry.ilike.%${t}%,category.ilike.%${t}%,domain.ilike.%${t}%`);
      }
      const { data, count, error } = await q.order("match_score", { ascending: false, nullsFirst: false }).limit(LIST_MAX);
      if (error) throw error;
      return ok({ total: count ?? data.length, shown: data.length, companies: data });
    },
  }),
  define({
    name: "getCompany",
    description: "One company or local business with its decision makers, open roles (jobs) and data intelligence.",
    permission: "read",
    input: z.object({ companyId: uuid }),
    async run(ctx, input) {
      const { data } = await ctx.db.from("companies").select(`${companyColumns}, workspace_id, provenance, phone`).eq("id", input.companyId).maybeSingle();
      if (!data || data.workspace_id !== ctx.session.workspace.id) return fail("not_found", "No such company in this workspace.");
      const [{ data: people }, { data: jobs }] = await Promise.all([
        ctx.db.from("prospects").select("id, full_name, title, match_score").eq("company_id", data.id).order("match_score", { ascending: false, nullsFirst: false }).limit(LIST_MAX),
        ctx.db.from("jobs").select("id, title, department, city, country, url, posted_at").eq("company_id", data.id).limit(LIST_MAX),
      ]);
      return ok({ company: data, decisionMakers: people ?? [], jobs: jobs ?? [] });
    },
  }),
  define({
    name: "listJobs",
    description: "Job postings (hiring signals) found for this workspace's companies, optionally for one company or campaign. At most 25.",
    permission: "read",
    input: z.object({ companyId: uuid.optional(), campaignId: uuid.optional(), query: z.string().trim().max(100).optional() }),
    async run(ctx, input) {
      let q = ctx.db.from("jobs").select("id, company_id, campaign_id, title, department, city, country, url, posted_at, match_score, company:companies(name)").eq("workspace_id", ctx.session.workspace.id);
      if (input.companyId) q = q.eq("company_id", input.companyId);
      if (input.campaignId) q = q.eq("campaign_id", input.campaignId);
      if (input.query) {
        const t = term(input.query);
        q = q.or(`title.ilike.%${t}%,department.ilike.%${t}%`);
      }
      const { data, error } = await q.order("posted_at", { ascending: false, nullsFirst: false }).limit(LIST_MAX);
      if (error) throw error;
      return ok({ jobs: data });
    },
  }),
  define({
    name: "findDecisionMakers",
    description: "Find the decision makers at saved companies / local businesses (background job). Each person found uses one prospect. Confirm with the user first.",
    permission: "prospect.find",
    input: z.object({ companyIds: z.array(uuid).min(1).max(50) }),
    async run(ctx, input) {
      const ws = ctx.session.workspace.id;
      const { data } = await ctx.db.from("companies").update({ people_requested_at: new Date().toISOString() }).eq("workspace_id", ws).in("id", input.companyIds).not("saved_at", "is", null).select("id");
      const ids = (data ?? []).map((r) => r.id);
      if (!ids.length) return fail("not_found", "None of those companies are saved in this workspace's Prospects.");
      if (!(await hasProviderFor("person.search"))) return fail("not_connected", "No people data source is connected yet.");
      await enqueue("company.people", { workspaceId: ws, companyIds: ids });
      return ok({ queued: ids.length });
    },
  }),
  define({
    name: "researchCompany",
    description: "Research a company from public web sources: a short sourced summary and the facts found. Uses connected web providers.",
    permission: "company.research",
    input: z.object({ companyId: uuid, question: z.string().trim().max(300).optional() }),
    async run(ctx, input) {
      const ws = ctx.session.workspace.id;
      const { data: c } = await ctx.db.from("companies").select("id, workspace_id, campaign_id, name, domain, website, city, country").eq("id", input.companyId).maybeSingle();
      if (!c || c.workspace_id !== ws) return fail("not_found", "No such company in this workspace.");
      if (!(await hasProviderFor("web.search"))) return fail("not_connected", "No web research provider is connected.");
      // Research strategy from the policy (D-141): searches per turn, depth, source governance.
      const rp = ctx.policy?.research;
      if (rp) {
        const n = ctx.counters ? ++ctx.counters.research : 1;
        if (!rp.enabled || n > rp.maxSearchesPerTurn) return fail("denied", "The research limit for this message is reached.");
      }
      const depth = { quick: { sources: 3, read: 0 }, standard: { sources: 6, read: 3 }, deep: { sources: 10, read: 5 } }[rp?.depth ?? "standard"];
      const scope = { workspaceId: ws, campaignId: c.campaign_id };
      const found = await runCapability("web.search", { query: [c.name, c.domain ?? c.website, c.city].filter(Boolean).join(" "), limit: depth.sources + 4, country: c.country }, scope);
      if (found.ok) ctx.spend?.(found.costUsd);
      const governed = found.ok ? governSources(found.data, rp) : [];
      if (!governed.length) return ok({ summary: null, sources: [], note: "No public sources found." });
      const sources = governed.slice(0, depth.sources).map((s) => ({ ...s, text: null as string | null }));
      // Read the top pages when a provider can extract them (skipped otherwise).
      if (depth.read && (await hasProviderFor("web.extract"))) {
        for (const s of sources.slice(0, depth.read)) {
          const page = await runCapability("web.extract", { url: s.url }, scope);
          if (page.ok) {
            ctx.spend?.(page.costUsd);
            s.text = page.data.text;
          }
        }
      }
      const log = { workspaceId: ws, campaignId: c.campaign_id, conversationId: ctx.conversationId, promptVersion: "research-2026-10-06" };
      const research = await researchSummary(input.question ?? `What does ${c.name} do and is it a fit for us?`, sources, ctx.session.profile.language === "ar" ? "ar" : "en", log);
      // LLM calls: their priced cost, and each unpriced one counted as unknown (D-114).
      const spendLlm = (o: { costUsd: number; unpricedCalls: number }) => {
        if (o.costUsd) ctx.spend?.(o.costUsd);
        for (let i = 0; i < o.unpricedCalls; i++) ctx.spend?.(null);
      };
      spendLlm(research);
      const extracted = await extractCompanyFacts(research.summary, log);
      spendLlm(extracted);
      const facts = extracted.facts;
      return ok({ summary: research.summary, facts, sources: sources.map((s) => ({ title: s.title, url: s.url })) });
    },
  }),

  // ───────────── Outreach ─────────────
  define({
    name: "prepareOutreach",
    description: "Write a personal email draft to a person, saved in Outreach for the user to review. It is never sent automatically: the user approves and sends it from their own mailbox.",
    permission: "outreach.prepare",
    input: z.object({ prospectId: uuid, instruction: z.string().trim().max(1000).optional(), language: z.enum(["en", "ar"]).optional() }),
    async run(ctx, input) {
      const { data: p } = await ctx.db.from("prospects").select("id, workspace_id").eq("id", input.prospectId).maybeSingle();
      if (!p || p.workspace_id !== ctx.session.workspace.id) return fail("not_found", "No such prospect in this workspace.");
      const r = await draftOutreach({
        workspaceId: ctx.session.workspace.id, userId: ctx.session.userId, prospectId: p.id,
        instruction: input.instruction ?? null, language: input.language ?? (ctx.session.profile.language === "ar" ? "ar" : "en"),
      });
      if (!r.ok) return fail(r.error === "not_found" ? "not_found" : r.error === "not_configured" ? "not_connected" : "invalid", r.error);
      ctx.spend?.(r.message.cost_usd);
      return ok({ draftId: r.message.id, subject: r.message.subject, body: r.message.body, status: "draft", openAt: `/prospects/person/${p.id}` });
    },
  }),

  // ───────────── Searches & campaigns ─────────────
  define({
    name: "getCampaign",
    description: "A campaign's real status, goal progress, schedule, deadline, partial reason and its latest progress events. Without an id, lists the 10 most recent campaigns.",
    permission: "read",
    input: z.object({ campaignId: uuid.optional() }),
    async run(ctx, input) {
      const ws = ctx.session.workspace.id;
      if (!input.campaignId) {
        const { data, error } = await ctx.db.from("campaigns").select(campaignColumns).eq("workspace_id", ws).order("created_at", { ascending: false }).limit(10);
        if (error) throw error;
        return ok({ campaigns: data });
      }
      const { data: campaign } = await ctx.db.from("campaigns").select(`${campaignColumns}, criteria`).eq("id", input.campaignId).maybeSingle();
      if (!campaign || campaign.workspace_id !== ws) return fail("not_found", "No such campaign in this workspace.");
      const [{ data: events }, { data: usage }, { data: runs }] = await Promise.all([
        ctx.db.from("campaign_events").select("stage, level, message, created_at").eq("campaign_id", campaign.id).order("created_at", { ascending: false }).limit(10),
        ctx.db.rpc("campaign_usage", { p_campaign: campaign.id }),
        ctx.db.from("campaign_runs").select("id, status, started_at, finished_at, delivered").eq("campaign_id", campaign.id).order("started_at", { ascending: false }).limit(10),
      ]);
      return ok({ campaign, prospectsUsed: usage?.[0]?.consumed ?? 0, recentRuns: runs ?? [], recentEvents: events ?? [] });
    },
  }),
  define({
    name: "updateCampaign",
    description: "Change a campaign: pause, resume, run now, stop, or set its goal, deadline and continuous schedule. Confirm with the user before stopping.",
    permission: "campaign.manage",
    input: z.object({
      campaignId: uuid,
      action: z.enum(["pause", "resume", "runNow", "stop", "settings"]),
      goal: z.number().int().min(1).max(10_000).optional(),
      deadline: z.string().datetime().nullable().optional().describe("ISO date-time, or null to remove"),
      continuous: z.boolean().optional(),
      everyHours: z.union([z.literal(24), z.literal(168)]).optional(),
    }),
    async run(ctx, input) {
      const { data: c } = await ctx.db.from("campaigns").select("id, workspace_id, quota, deadline, continuous, run_every_hours").eq("id", input.campaignId).maybeSingle();
      if (!c || c.workspace_id !== ctx.session.workspace.id) return fail("not_found", "No such campaign in this workspace.");
      const r = input.action === "pause" ? await control.pause(ctx.db, c.id)
        : input.action === "resume" ? await control.resume(ctx.db, c.id)
        : input.action === "runNow" ? await control.runNow(ctx.db, c.id)
        : input.action === "stop" ? await control.stop(ctx.db, c.id)
        : await control.updateSettings(ctx.db, c.id, {
          goal: input.goal ?? c.quota, deadline: input.deadline === undefined ? c.deadline : input.deadline,
          continuous: input.continuous ?? c.continuous, everyHours: input.everyHours ?? c.run_every_hours,
        });
      if (!r.ok) return fail(r.error === "notFound" ? "not_found" : "invalid", controlMessages[r.error]);
      const { data: after } = await ctx.db.from("campaigns").select(campaignColumns).eq("id", c.id).single();
      return ok({ campaign: after });
    },
  }),
  define({
    name: "getStrategy",
    description: "A search request as the user typed it, how Yolias understood it (the ICP, incl. search type) and its campaign id.",
    permission: "read",
    input: z.object({ strategyId: uuid }),
    async run(ctx, input) {
      const { data } = await ctx.db.from("strategies").select("id, workspace_id, title, prompt, icp, status, error, created_at").eq("id", input.strategyId).maybeSingle();
      if (!data || data.workspace_id !== ctx.session.workspace.id) return fail("not_found", "No such search in this workspace.");
      const { data: campaign } = await ctx.db.from("campaigns").select("id, status, search_type").eq("strategy_id", data.id).order("created_at").limit(1).maybeSingle();
      return ok({ strategy: data, campaign });
    },
  }),
  define({
    name: "createCampaign",
    description: "Start a new search from a natural-language request (Arabic or English), exactly like typing it in the search box. It can find people, companies, local businesses or company lookalikes. Delivered results count against the monthly prospects. Confirm with the user before calling.",
    permission: "campaign.create",
    input: z.object({ request: z.string().trim().min(3).max(4000) }),
    async run(ctx, input) {
      const { session, db } = ctx;
      // Inside a search's conversation the campaign joins that search and
      // shows in the same thread — no new search (D-133).
      if (ctx.strategyId) {
        const r = await launchInSearch(session, ctx.strategyId, input.request, db);
        if (r.campaignId) ctx.launched?.push(r.campaignId);
        const { data: campaign } = r.campaignId ? await db.from("campaigns").select("id, status, quota, search_type").eq("id", r.campaignId).maybeSingle() : { data: null };
        return ok({ strategyId: ctx.strategyId, error: r.error, campaign });
      }
      const { data: strategy, error } = await db.from("strategies").insert({
        workspace_id: session.workspace.id, created_by: session.userId, title: titleFrom(input.request), prompt: input.request, attachments: [] as Json,
      }).select("id").single();
      if (error || !strategy) throw error ?? new Error("strategy insert failed");
      await understandAndLaunch(session, strategy.id, input.request, [], db);
      const [{ data: after }, { data: campaign }] = await Promise.all([
        db.from("strategies").select("status, error").eq("id", strategy.id).single(),
        db.from("campaigns").select("id, status, quota, search_type").eq("strategy_id", strategy.id).order("created_at").limit(1).maybeSingle(),
      ]);
      return ok({ strategyId: strategy.id, strategyStatus: after?.status, error: after?.error ?? null, campaign });
    },
  }),

  // ───────────── Long-term memory (D-141) ─────────────
  define({
    name: "rememberFact",
    description: "Save a lasting fact about this workspace's business or preferences (what they sell, who they target, how they like results) so it's used in every future conversation of the workspace. Never contact details or anything sensitive.",
    permission: "memory.write",
    input: z.object({ fact: z.string().trim().min(3).max(500) }),
    async run(ctx, input) {
      const ws = ctx.session.workspace.id;
      const max = ctx.policy?.memory.maxItems ?? 30;
      if (ctx.policy && (!ctx.policy.memory.enabled || max === 0)) return fail("denied", "Memory is switched off.");
      const { data, error } = await ctx.db.from("agent_memories").insert({ workspace_id: ws, content: input.fact, created_by: ctx.session.userId }).select("id").single();
      if (error || !data) throw error ?? new Error("memory insert failed");
      // Keep only the newest facts.
      const { data: all } = await ctx.db.from("agent_memories").select("id").eq("workspace_id", ws).order("created_at", { ascending: false });
      const extra = (all ?? []).slice(max).map((m) => m.id);
      if (extra.length) await ctx.db.from("agent_memories").delete().in("id", extra);
      return ok({ saved: true, id: data.id });
    },
  }),
  define({
    name: "forgetFact",
    description: "Delete a saved fact about this workspace (by its id from the saved facts list).",
    permission: "memory.write",
    input: z.object({ memoryId: uuid }),
    async run(ctx, input) {
      const { data } = await ctx.db.from("agent_memories").select("id, workspace_id").eq("id", input.memoryId).maybeSingle();
      if (!data || data.workspace_id !== ctx.session.workspace.id) return fail("not_found", "No such saved fact.");
      await ctx.db.from("agent_memories").delete().eq("id", data.id);
      return ok({ forgotten: true });
    },
  }),

  // ───────────── Usage, analytics, billing ─────────────
  define({
    name: "getAnalytics",
    description: "Workspace results over the last 7, 30 or 90 days: prospects, verified emails, decision makers, companies, fit rate and markets.",
    permission: "read",
    input: z.object({ days: z.union([z.literal(7), z.literal(30), z.literal(90)]).default(30) }),
    async run(ctx, input) {
      const since = new Date(Date.now() - input.days * 86_400_000).toISOString();
      const { data, error } = await ctx.db.rpc("workspace_analytics", { p_ws: ctx.session.workspace.id, p_since: since });
      if (error) throw error;
      return ok({ days: input.days, ...(data as Record<string, unknown>) });
    },
  }),
  define({
    name: "getUsage",
    description: "This month's prospects: allowance, used (delivered), reserved by running campaigns and still available.",
    permission: "read",
    input: z.object({}),
    async run(ctx) {
      // usage_summary is service-role only; scoped explicitly to the caller's workspace.
      const { data, error } = await createAdminClient().rpc("usage_summary", { p_ws: ctx.session.workspace.id });
      if (error) throw error;
      const u = data?.[0];
      return ok({ plan: ctx.session.workspace.plan, allowance: u?.allowance ?? 0, used: u?.consumed ?? 0, reserved: u?.reserved ?? 0, available: u?.available ?? 0, periodStart: u?.period_start ?? null });
    },
  }),
  define({
    name: "getBilling",
    description: "The workspace's plan, subscription status, renewal / end date, billing currency and the last invoices (owner and admins only).",
    permission: "billing.read",
    input: z.object({}),
    async run(ctx) {
      const ws = ctx.session.workspace;
      const { data: invoices } = await ctx.db.from("invoices").select("number, kind, plan, billing_period, prospects, amount, currency, status, mode, created_at").eq("workspace_id", ws.id).order("created_at", { ascending: false }).limit(10);
      return ok({
        plan: ws.plan, status: ws.subscription_status, billingPeriod: ws.billing_period, currency: ws.billing_currency,
        periodEnd: ws.current_period_end, cancelAtPeriodEnd: ws.cancel_at_period_end, invoices: invoices ?? [],
      });
    },
  }),
] as const;

export type AgentToolName = (typeof agentTools)[number]["name"];

async function logCall(ctx: AgentContext, tool: string, input: unknown, outcome: AgentToolOutcome, error: string | null, started: number, meter?: { usd: number; priced: number; unpriced: number }) {
  await createAdminClient().from("agent_tool_calls").insert({
    workspace_id: ctx.session.workspace.id, user_id: ctx.session.userId, conversation_id: ctx.conversationId, tool,
    input: auditInput(input) as Json, ok: outcome === "ok", outcome, error: error?.slice(0, 1000) ?? null, latency_ms: Date.now() - started,
    cost_usd: meter && meter.priced ? Math.round(meter.usd * 1_000_000) / 1_000_000 : null, unpriced_calls: meter?.unpriced ?? 0,
  }).then(({ error: e }) => e && console.error("agent audit failed", e.message));
}

/** Validates, authorizes, runs and audits one tool call (with what it cost). Never throws. */
/** Source governance (D-141): blocked domains out, allowed-only when a list is set, preferred first. */
function governSources<T extends { url: string }>(list: T[], rp: AgentPolicy["research"] | undefined): T[] {
  if (!rp) return list;
  const host = (u: string) => { try { return new URL(u).hostname.toLowerCase().replace(/^www\./, ""); } catch { return ""; } };
  const match = (h: string, d: string) => (d.startsWith("*.") ? h.endsWith(d.slice(1)) : h === d.replace(/^www\./, "") || h.endsWith(`.${d.replace(/^www\./, "")}`));
  const any = (h: string, ds: string[]) => ds.some((d) => match(h, d));
  const kept = list.filter((s) => {
    const h = host(s.url);
    if (!h || any(h, rp.blockedDomains)) return false;
    return !rp.allowedDomains.length || any(h, rp.allowedDomains);
  });
  return [...kept.filter((s) => any(host(s.url), rp.preferredDomains)), ...kept.filter((s) => !any(host(s.url), rp.preferredDomains))];
}

/** One line for the approval card: what will happen. */
function approvalSummary(name: string, input: Record<string, unknown>, lang: "ar" | "en"): string {
  const label = AGENT_TOOLS.find((t) => t.name === name)?.label[lang] ?? name;
  const detail = [input.request, input.action, input.instruction, input.want].find((v) => typeof v === "string" && v) as string | undefined;
  const count = Array.isArray(input.companyIds) ? input.companyIds.length : null;
  return [label, detail ? `«${detail.slice(0, 200)}»` : null, count ? (lang === "ar" ? `${count} شركة` : `${count} companies`) : null].filter(Boolean).join(" — ");
}

export async function executeTool(ctx: AgentContext, name: string, rawInput: unknown): Promise<ToolResult> {
  const started = Date.now();
  const tool = agentTools.find((t) => t.name === name) as AgentTool | undefined;
  if (!tool) {
    await logCall(ctx, name, rawInput, "invalid", "unknown tool", started);
    return fail("invalid", "Unknown tool.");
  }
  // The owner's policy can switch a tool off or limit it to some roles —
  // never grant more than authz.ts below (D-141).
  const tp = ctx.policy?.tools[name];
  if (tp && (!tp.enabled || !tp.roles.includes(ctx.session.role))) {
    await logCall(ctx, name, rawInput, "disabled", tp.enabled ? "role not allowed by policy" : "disabled by policy", started);
    return fail("disabled", "That isn't available here.");
  }
  const auth = authorize(actorOf(ctx.session), tool.permission);
  if (!auth.ok) {
    await logCall(ctx, name, rawInput, "denied", auth.reason, started);
    return fail("denied", "You don't have permission to do that.");
  }
  const parsed = tool.input.safeParse(rawInput);
  if (!parsed.success) {
    const msg = parsed.error.issues.map((i) => `${i.path.join(".") || "input"}: ${i.message}`).join("; ");
    await logCall(ctx, name, rawInput, "invalid", msg, started);
    return fail("invalid", msg);
  }
  // Human-in-the-loop: the action waits for the user's Approve in the chat.
  if (tp?.approval && !ctx.approved) {
    const lang = ctx.session.profile.language === "ar" ? "ar" : "en";
    const { data: pa, error } = await createAdminClient().from("agent_pending_actions").insert({
      workspace_id: ctx.session.workspace.id, conversation_id: ctx.conversationId, requested_by: ctx.session.userId,
      tool: name, input: parsed.data as Json, summary: approvalSummary(name, parsed.data as Record<string, unknown>, lang),
    }).select("id").single();
    if (error || !pa) throw error ?? new Error("approval request failed");
    ctx.pending?.push(pa.id);
    await logCall(ctx, name, parsed.data, "awaiting_approval", null, started);
    return fail("awaiting_approval", "Waiting for the user's approval. An Approve / Reject card is shown under your reply; tell the user in one line what will happen.");
  }
  const meter = { usd: 0, priced: 0, unpriced: 0 };
  const metered: AgentContext = { ...ctx, spend: (usd) => (usd == null ? meter.unpriced++ : ((meter.usd += usd), meter.priced++)) };
  try {
    const result = await tool.run(metered, parsed.data);
    await logCall(ctx, name, parsed.data, result.ok ? "ok" : result.outcome, result.ok ? null : result.message, started, meter);
    return result;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`agent tool ${name} failed`, e);
    await logCall(ctx, name, parsed.data, "error", msg, started, meter);
    return fail("error", "That didn't work. Please try again.");
  }
}
